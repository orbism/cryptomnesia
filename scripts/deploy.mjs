#!/usr/bin/env node
// Deploys Cryptomnesia and puts its art on chain, asking for whatever it needs as it goes.
//   npm run deploy
// Chains: localhost (anvil), sepolia, mainnet. Keys can be given as ALCHEMY_KEY, ETHERSCAN_KEY and DEPLOYER_KEY in the
// environment; anything missing is asked for. DEPLOY_AUTO=1 takes every default without asking (local use). Nothing secret is written to disk. A deployment that stops part way can be picked up again.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { createPublicClient, createWalletClient, encodeAbiParameters, formatEther, formatGwei, http, isAddress, keccak256, parseEther, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, mainnet, sepolia } from 'viem/chains';
import { pack } from './pack.mjs';

const root = new URL('..', import.meta.url).pathname, env = process.env;
const CHAINS = {
  localhost: { chain: foundry, rpc: () => 'http://127.0.0.1:8545' },
  sepolia: { chain: sepolia, rpc: (k) => `https://eth-sepolia.g.alchemy.com/v2/${k}` },
  mainnet: { chain: mainnet, rpc: (k) => `https://eth-mainnet.g.alchemy.com/v2/${k}` },
};
const ANVIL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';   // anvil's first account. public knowledge, local only

// --- asking
let mute = false;
const out = new Writable({ write(c, e, cb) { if (!mute) process.stdout.write(c, e); cb(); } });
const rl = readline.createInterface({ input: process.stdin, output: out, terminal: !!process.stdin.isTTY }), lines = rl[Symbol.asyncIterator]();
const line = async () => { const r = await lines.next(); if (r.done) throw new Error('ran out of answers'); return r.value.trim(); };
const AUTO = env.DEPLOY_AUTO === '1';                      // take every default and ask nothing: how `pnpm dev` keeps a local chain in step
const ask = async (q, def = '') => { if (AUTO) return def; process.stdout.write(`${q}${def ? ` [${def}]` : ''}: `); return (await line()) || def; };
const secret = async (q) => { process.stdout.write(`${q} (hidden): `); mute = true; const a = await line(); mute = false; process.stdout.write('\n'); return a; };
const yes = async (q, def = false) => /^y/i.test(await ask(`${q} (y/n)`, def ? 'y' : 'n'));
const say = (s = '') => console.log(s), die = (s) => { say(`\n${s}`); process.exit(1); };
const eth = (wei) => `${Number(formatEther(wei)).toFixed(5)} ETH`;

try {
  say('Cryptomnesia · deploy\n');
  // --- where
  const name = env.CHAIN || (await ask('Chain: localhost, sepolia or mainnet', 'localhost'));
  const net = CHAINS[name] || die(`Unknown chain "${name}".`);
  const alchemy = name === 'localhost' ? '' : env.ALCHEMY_KEY || (await secret('Alchemy API key')) || die('An Alchemy key is needed for this chain.');
  const transport = http(net.rpc(alchemy)), pub = createPublicClient({ chain: net.chain, transport });
  const id = await pub.getChainId().catch(() => die(name === 'localhost' ? 'Nothing is listening on 127.0.0.1:8545. Start one with: anvil' : 'Could not reach Alchemy. Check the key and that the app is enabled for this network.'));
  if (id !== net.chain.id) die(`That endpoint is chain ${id}, not ${net.chain.id}.`);

  // --- who
  let key = env.DEPLOYER_KEY || (name === 'localhost' && (await yes('Use anvil’s first account', true)) ? ANVIL_KEY : await secret('Deployer private key'));
  if (!key.startsWith('0x')) key = `0x${key}`;
  const account = privateKeyToAccount(key), wallet = createWalletClient({ account, chain: net.chain, transport });
  say(`Deployer ${account.address} · balance ${eth(await pub.getBalance({ address: account.address }))}`);

  // --- build
  say('\nPacking the art and compiling…');
  const art = await pack();
  execFileSync('forge', ['build', '--silent'], { cwd: `${root}contracts`, stdio: 'inherit' });
  const { abi, bytecode } = JSON.parse(readFileSync(`${root}contracts/out/Cryptomnesia.sol/Cryptomnesia.json`, 'utf8'));
  say(`${art.pages.length} pages · art ${art.gz.length} bytes gzipped, in ${art.chunks.length} piece${art.chunks.length > 1 ? 's' : ''} · stills ${art.covers.blob.length} bytes, in ${art.covers.chunks.length}`);

  // --- new, or carry on with one that stopped
  const recFile = `${root}contracts/deployments/${name}.json`, prev = existsSync(recFile) ? JSON.parse(readFileSync(recFile, 'utf8')) : null;
  let address = prev && (await pub.getCode({ address: prev.address })) && (await yes(`Carry on with the contract already at ${prev.address}`, true)) ? prev.address : null;
  let args = prev && address ? prev.args : null;
  const read = (functionName, a = []) => pub.readContract({ address, abi, functionName, args: a });
  const fee = await pub.getGasPrice();
  const send = async (label, tx) => {
    const hash = await tx();
    process.stdout.write(`  ${label} · ${hash} `);
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') die(`${label} reverted.`);
    say(`· ${r.gasUsed} gas`);
    return r;
  };

  if (!address) {
    say('\nContract settings. Enter keeps the value in brackets. None of these can be changed after deployment.');
    const title = await ask('Name', 'Cryptomnesia'), symbol = await ask('Symbol', 'CRYPT');
    const price = parseEther(await ask('Price of one copy of one page, in ETH', '0.003'));
    const cap = BigInt(await ask('Most copies of any one page (0 = no limit)', '0'));
    const owner = await ask('Owner: can upload and lock the art, and withdraw', account.address);
    const bps = BigInt(Math.round(Number(await ask('Royalty on resale, in percent (0 = none)', '0')) * 100));
    const royaltyTo = bps ? await ask('Royalties are paid to', owner) : owner;
    if (!isAddress(owner) || !isAddress(royaltyTo)) die('That is not an address.');
    if (bps > 10000n) die('A royalty cannot be more than 100%.');
    if (owner.toLowerCase() !== account.address.toLowerCase()) die('The owner must be the deployer for now: the owner uploads the art. Hand ownership over afterwards with transferOwnership.');
    args = [title, symbol, price, cap, owner, royaltyTo, bps];

    const gas = (await pub.estimateContractGas({ abi, bytecode: bytecode.object, args, account }).catch(() => 2_800_000n)) + BigInt((art.gz.length + art.covers.blob.length) * 216 + (art.chunks.length + art.covers.chunks.length) * 90_000) + 60_000n + BigInt(art.pages.length * 28_000);
    say(`\nAbout ${gas} gas at ${Number(formatGwei(fee)).toFixed(2)} gwei: roughly ${eth(gas * fee)}, in ${art.chunks.length + art.covers.chunks.length + 2} transactions.`);
    if (name === 'mainnet') { if ((await ask('This is mainnet and costs real ETH. Type mainnet to go on')) !== 'mainnet') die('Stopped. Nothing was sent.'); }
    else if (!(await yes('Go on', true))) die('Stopped. Nothing was sent.');

    say('\nDeploying…');
    const r = await send('contract', () => wallet.deployContract({ abi, bytecode: bytecode.object, args }));
    address = r.contractAddress;
    mkdirSync(`${root}contracts/deployments`, { recursive: true });
    writeFileSync(recFile, JSON.stringify({ chain: name, chainId: id, address, deployer: account.address, block: Number(r.blockNumber), args: args.map((x) => (typeof x === 'bigint' ? x.toString() : x)) }, null, 2));
    say(`  at ${address}`);
  } else if (await read('locked')) die('That contract is locked. There is nothing left to do to it.');

  // --- the art, one piece per transaction, from wherever it got to
  const want = keccak256(toHex(art.gz));
  let have = Number(await read('chunkCount'));
  if (have && keccak256(await read('art')) !== want && have >= art.chunks.length || have > art.chunks.length) {
    if (!(await yes('What is stored there is not this build of the art. Clear it and upload again', true))) die('Stopped.');
    await send('clear', () => wallet.writeContract({ address, abi, functionName: 'clearChunks' }));
    have = 0;
  }
  if (have < art.chunks.length) say('\nStoring the art…');
  for (let i = have; i < art.chunks.length; i++) await send(`piece ${i + 1} of ${art.chunks.length}`, () => wallet.writeContract({ address, abi, functionName: 'addChunk', args: [toHex(art.chunks[i])] }));
  if (keccak256(await read('art')) !== want) die('What came back from the chain is not what was sent. Run this again and let it clear and re-upload.');
  const onChain = Number(await read('pageCount')) === art.pages.length && (await Promise.all(art.pages.map((_, i) => read('pages', [BigInt(i)])))).every((p, i) => p === art.pages[i]);
  if (!onChain) await send('page list', () => wallet.writeContract({ address, abi, functionName: 'setPages', args: [art.pages] }));
  // --- the stills, the same way. what is there is checked by reading every one back
  const pngAt = (i) => { const end = (n) => (n < 0 ? art.pages.length * 3 : art.covers.blob.readUIntBE(n * 3, 3)); return toHex(art.covers.blob.subarray(end(i - 1), end(i))); };
  const stillsMatch = async () => (await Promise.all(art.pages.map((_, i) => read('cover', [BigInt(i + 1)])))).every((p, i) => p === pngAt(i));
  let stored = Number(await read('coverCount'));
  if (stored > art.covers.chunks.length || (stored === art.covers.chunks.length && !(await stillsMatch()))) {
    if (!(await yes('The stills stored there are not of this build. Clear them and upload again', true))) die('Stopped.');
    await send('clear stills', () => wallet.writeContract({ address, abi, functionName: 'clearCovers' }));
    stored = 0;
  }
  if (stored < art.covers.chunks.length) say('\nStoring the stills…');
  for (let i = stored; i < art.covers.chunks.length; i++) await send(`stills ${i + 1} of ${art.covers.chunks.length}`, () => wallet.writeContract({ address, abi, functionName: 'addCover', args: [toHex(art.covers.chunks[i])] }));
  if (!(await stillsMatch())) die('The stills that came back from the chain are not what was sent. Run this again and let it clear and re-upload.');
  const uri = await read('uri', [1n]);
  say(`\nStored and read back: the art and all ${art.pages.length} stills match byte for byte. Token 1 answers with ${uri.length} characters of ${uri.slice(0, 29)}…`);

  // --- lock
  say('\nLocking makes the art and the page list permanent. It cannot be undone. Leave it until you have looked at a token.');
  if (await yes('Lock now')) await send('lock', () => wallet.writeContract({ address, abi, functionName: 'lock' }));

  // --- verify
  if (name !== 'localhost' && (await yes('Verify the source on Etherscan', true))) {
    const scan = env.ETHERSCAN_KEY || (await secret('Etherscan API key'));
    const types = abi.find((x) => x.type === 'constructor').inputs, typed = [args[0], args[1], BigInt(args[2]), BigInt(args[3]), args[4], args[5], BigInt(args[6])];
    const cmd = ['verify-contract', address, 'src/Cryptomnesia.sol:Cryptomnesia', '--chain', String(id), '--constructor-args', encodeAbiParameters(types, typed), '--watch'];
    try { execFileSync('forge', [...cmd, '--etherscan-api-key', scan], { cwd: `${root}contracts`, stdio: 'inherit' }); }
    catch { say(`Verification did not go through. Try again from contracts/ with:\n  forge ${cmd.join(' ')} --etherscan-api-key <key>`); }
  }

  // --- tell the site
  if (!AUTO && (await yes('Point the site at it (writes VITE_CHAIN and VITE_CONTRACT to .env.local)', true))) {
    const f = `${root}.env.local`, keep = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l && !/^VITE_(CHAIN|CONTRACT)=/.test(l)) : [];
    writeFileSync(f, [...keep, `VITE_CHAIN=${name}`, `VITE_CONTRACT=${address}`, ''].join('\n'));
  }
  say(`\nDone. ${name} · ${address}${net.chain.blockExplorers ? ` · ${net.chain.blockExplorers.default.url}/address/${address}` : ''}`);
  process.exit(0);
} catch (e) { die(e.shortMessage || e.message); }
