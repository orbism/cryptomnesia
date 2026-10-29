#!/usr/bin/env node
// Deploys Cryptomnesia and puts its art on chain, asking for whatever it needs as it goes.
//   npm run deploy
// Chains: localhost (anvil), sepolia, mainnet. Keys can be given as ALCHEMY_KEY, ETHERSCAN_KEY and DEPLOYER_KEY in the
// environment; anything missing is asked for. DEPLOY_AUTO=1 takes every default without asking (local use). Nothing secret is written to disk. A deployment that stops part way can be picked up again.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { createPublicClient, createWalletClient, encodeAbiParameters, formatEther, formatGwei, http, isAddress, parseEther, toHex } from 'viem';
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
const AUTO = env.DEPLOY_AUTO === '1';                      // take every default and ask nothing: how `pnpm dev` keeps a local chain in step. local only
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
  if (AUTO && name !== 'localhost') die('DEPLOY_AUTO=1 is for a local chain only: on a real one every clear and upload is asked about.');
  const alchemy = name === 'localhost' ? '' : env.ALCHEMY_KEY || (await secret('Alchemy API key')) || die('An Alchemy key is needed for this chain.');
  const transport = http(net.rpc(alchemy)), pub = createPublicClient({ chain: net.chain, transport });
  const id = await pub.getChainId().catch(() => die(name === 'localhost' ? 'Nothing is listening on 127.0.0.1:8545. Start one with: anvil' : 'Could not reach Alchemy. Check the key and that the app is enabled for this network.'));
  if (id !== net.chain.id) die(`That endpoint is chain ${id}, not ${net.chain.id}.`);

  // --- who
  let key = env.DEPLOYER_KEY || (name === 'localhost' && (await yes('Use anvil’s first account', true)) ? ANVIL_KEY : await secret('Deployer private key'));
  if (!key.startsWith('0x')) key = `0x${key}`;
  const account = privateKeyToAccount(key), wallet = createWalletClient({ account, chain: net.chain, transport });
  say(`Deployer ${account.address} · balance ${eth(await pub.getBalance({ address: account.address }))}`);
  // a run stopped while something it sent was still pending must not go on until that has been mined, or it would store the same piece twice
  const [mined, sent] = await Promise.all(['latest', 'pending'].map((blockTag) => pub.getTransactionCount({ address: account.address, blockTag })));
  if (sent > mined) die(`${sent - mined} transaction${sent - mined > 1 ? 's' : ''} from ${account.address} still waiting to be mined. Run this again once ${sent - mined > 1 ? 'they have' : 'it has'} gone through.`);

  // --- build
  say('\nPacking the art and compiling…');
  const art = await pack();
  execFileSync('forge', ['build', '--silent'], { cwd: `${root}contracts`, stdio: 'inherit' });
  const { abi, bytecode } = JSON.parse(readFileSync(`${root}contracts/out/Cryptomnesia.sol/Cryptomnesia.json`, 'utf8'));
  say(`${art.pages.length} pages · art ${art.gz.length} bytes gzipped, in ${art.chunks.length} piece${art.chunks.length > 1 ? 's' : ''} · stills ${art.covers.blob.length} bytes, in ${art.covers.chunks.length} · names and traits ${art.metas.blob.length} bytes`);

  // --- new, or carry on with one that stopped
  const recFile = `${root}contracts/deployments/${name}.json`, prev = existsSync(recFile) ? JSON.parse(readFileSync(recFile, 'utf8')) : null;
  // a contract from before the stores were laid out this way has no pieces() to answer with: that one is left where it is and a new one deployed.
  // any other failure to ask (the network) stops the run, rather than deploy twice
  const current = (at) => pub.readContract({ address: at, abi, functionName: 'pieces', args: [0n] }).then(() => true, (e) => {
    if (e.walk((x) => /^ContractFunction(Reverted|ZeroData)Error$/.test(x.name))) return say(`The contract at ${at} is an older build. Deploying a new one.`);
    throw e;
  });
  let address = prev && (await pub.getCode({ address: prev.address })) && (await current(prev.address)) && (await yes(`Carry on with the contract already at ${prev.address}`, true)) ? prev.address : null;
  let args = prev && address ? prev.args : null;
  const read = (functionName, a = []) => pub.readContract({ address, abi, functionName, args: a });
  const fee = await pub.getGasPrice();
  const send = async (label, tx) => {
    const hash = await tx();
    process.stdout.write(`  ${label} · ${hash} `);
    // however long it takes: given up on, a piece still pending would be sent again by the next run. sped up in a wallet is the same send; cancelled or replaced is not
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 0, onReplaced: (x) => x.reason === 'repriced' || die(`${label} was ${x.reason} in a wallet. Run this again to carry on.`) });
    if (r.status !== 'success') die(`${label} reverted.`);
    say(`· ${r.gasUsed} gas`);
    return r;
  };
  const STORES = [['art', art.chunks], ['stills', art.covers.chunks], ['names and traits', art.metas.chunks]], pieces = STORES.reduce((n, [, p]) => n + p.length, 0), bytes = art.gz.length + art.covers.blob.length + art.metas.blob.length;

  if (!address) {
    say('\nContract settings. Enter keeps the value in brackets. None of these can be changed after deployment.');
    const price = parseEther(await ask('Price of one copy of one page, in ETH', '0.003'));
    const cap = BigInt(await ask('Most copies of any one page (0 = no limit)', '0'));
    const owner = await ask('Owner: can upload and lock the art, and withdraw', account.address);
    const bps = BigInt(Math.round(Number(await ask('Royalty on resale, in percent (0 = none)', '0')) * 100));
    const royaltyTo = bps ? await ask('Royalties are paid to', owner) : owner;
    if (!isAddress(owner) || !isAddress(royaltyTo)) die('That is not an address.');
    if (bps > 10000n) die('A royalty cannot be more than 100%.');
    if (owner.toLowerCase() !== account.address.toLowerCase()) die('The owner must be the deployer for now: the owner uploads the art. Hand ownership over afterwards with transferOwnership.');
    args = [price, cap, owner, royaltyTo, bps];

    const gas = (await pub.estimateContractGas({ abi, bytecode: bytecode.object, args, account }).catch(() => 3_000_000n)) + BigInt(bytes * 216 + pieces * 90_000) + 60_000n;
    say(`\nAbout ${gas} gas at ${Number(formatGwei(fee)).toFixed(2)} gwei: roughly ${eth(gas * fee)}, in ${pieces + 2} transactions.`);
    if (name === 'mainnet') { if ((await ask('This is mainnet and costs real ETH. Type mainnet to go on')) !== 'mainnet') die('Stopped. Nothing was sent.'); }
    else if (!(await yes('Go on', true))) die('Stopped. Nothing was sent.');

    say('\nDeploying…');
    const r = await send('contract', () => wallet.deployContract({ abi, bytecode: bytecode.object, args }));
    address = r.contractAddress || die('The deployment went through but made no contract.');
    mkdirSync(`${root}contracts/deployments`, { recursive: true });
    if (prev) copyFileSync(recFile, recFile.replace(/\.json$/, `.${prev.address}.json`));   // the record of the one before is kept
    writeFileSync(recFile, JSON.stringify({ chain: name, chainId: id, address, deployer: account.address, block: Number(r.blockNumber), args: args.map((x) => (typeof x === 'bigint' ? x.toString() : x)) }, null, 2));
    say(`  at ${address}`);
  } else if (await read('pageCount')) die('That contract is locked. There is nothing left to do to it.');

  // --- the three stores, one piece per transaction, from wherever it got to. a piece already there is kept only if it is this build's, byte for byte
  const code = (p) => toHex(Buffer.concat([Buffer.alloc(1), p]));                // a piece as held: a STOP, then the bytes
  for (const [i, [what, want]] of STORES.entries()) {
    const same = async () => Promise.all((await read('pieces', [BigInt(i)])).map((a, j) => j < want.length && pub.getCode({ address: a }).then((c) => c === code(want[j]))));
    let held = await same();
    if (held.includes(false)) {
      if (!(await yes(`The ${what} stored there are not of this build. Clear them and upload again`, true))) die('Stopped.');
      await send(`clear ${what}`, () => wallet.writeContract({ address, abi, functionName: 'clear', args: [BigInt(i)] }));
      held = [];
    }
    if (held.length < want.length) say(`\nStoring the ${what}…`);
    for (let j = held.length; j < want.length; j++) await send(`${what} ${j + 1} of ${want.length}`, () => wallet.writeContract({ address, abi, functionName: 'add', args: [BigInt(i), toHex(want[j])] }));
    held = await same();
    if (held.length !== want.length || held.includes(false)) die(`The ${what} that came back from the chain are not what was sent. Run this again and let it clear and re-upload.`);
  }
  // every token read whole, as a marketplace will, before anything is made permanent
  const json = (u) => JSON.parse(u.slice(u.indexOf(',') + 1));
  const tokens = await Promise.all(art.pages.map((_, i) => read('uri', [BigInt(i + 1)]).then(json)));
  say(`\nStored and read back: the art, all ${art.pages.length} stills and every page's name and traits match byte for byte, and every token's JSON reads. Token 1 is "${tokens[0].name}", with ${tokens[0].attributes.length} traits. The collection is "${json(await read('contractURI')).name}".`);

  // --- lock
  say('\nLocking makes everything stored permanent and opens minting. It cannot be undone. Leave it until you have looked at a token.');
  if (await yes('Lock now')) await send('lock', () => wallet.writeContract({ address, abi, functionName: 'lock' }));

  // --- verify
  if (name !== 'localhost' && (await yes('Verify the source on Etherscan', true))) {
    const scan = env.ETHERSCAN_KEY || (await secret('Etherscan API key'));
    const types = abi.find((x) => x.type === 'constructor').inputs, typed = [BigInt(args[0]), BigInt(args[1]), args[2], args[3], BigInt(args[4])];
    const cmd = ['verify-contract', address, 'src/Cryptomnesia.sol:Cryptomnesia', '--chain', String(id), '--constructor-args', encodeAbiParameters(types, typed), '--watch'];
    try { execFileSync('forge', cmd, { cwd: `${root}contracts`, stdio: 'inherit', env: { ...env, ETHERSCAN_API_KEY: scan } }); }   // the key goes in the environment, where ps cannot see it
    catch { say(`Verification did not go through. Try again from contracts/ with ETHERSCAN_API_KEY set:\n  forge ${cmd.join(' ')}`); }
  }

  // --- tell the site
  if (!AUTO && (await yes('Point the site at it (writes VITE_CHAIN, VITE_CONTRACT and VITE_DEPLOY_BLOCK to .env.local)', true))) {
    const f = `${root}.env.local`, keep = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l && !/^VITE_(CHAIN|CONTRACT|DEPLOY_BLOCK)=/.test(l)) : [];
    writeFileSync(f, [...keep, `VITE_CHAIN=${name}`, `VITE_CONTRACT=${address}`, `VITE_DEPLOY_BLOCK=${JSON.parse(readFileSync(recFile, 'utf8')).block}`, ''].join('\n'));
  }
  say(`\nDone. ${name} · ${address}${net.chain.blockExplorers ? ` · ${net.chain.blockExplorers.default.url}/address/${address}` : ''}`);
  process.exit(0);
} catch (e) { die(e.shortMessage || e.message); }
