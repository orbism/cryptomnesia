#!/usr/bin/env node
// Deploys Cryptomnesia and puts its art on chain. Everything it needs is asked for first and shown back before anything is sent.
//   npm run deploy           deploy, or carry on with one that stopped part way
//   npm run verify           send the source of the last deployment on a chain to Etherscan
// Both leave contracts/deployments/<chain>.preview.html: every token as the chain gives it, its still beside its moving page.
// Chains: localhost (anvil), sepolia, mainnet. Keys can be given as ALCHEMY_KEY, ETHERSCAN_KEY and DEPLOYER_KEY in the
// environment; anything missing is asked for. DEPLOY_AUTO=1 takes every default without asking (local use). No key but the Alchemy one
// is written to disk: the site reads the chain through it, so it goes into .env.live with everything else the site needs.
import { execFileSync, spawn } from 'node:child_process';
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
const SOL = `${root}contracts/src/Cryptomnesia.sol`;
const TENDERLY = { sepolia: 'https://sepolia.gateway.tenderly.co', mainnet: 'https://mainnet.gateway.tenderly.co' };   // public nodes, for reading when no Alchemy key is given
// every token read whole, as a marketplace reads it, into one page to look over: its image (the still) beside its animation_url (the moving page), name and traits under.
// read until a page id the contract does not have; anything else going wrong stops it
const preview = async (read, address, name) => {
  const json = (u) => JSON.parse(u.slice(u.indexOf(',') + 1)), tokens = [], esc = (x) => String(x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const uri = (id) => read('uri', [BigInt(id)]).then(json, (e) => { if (e.walk((x) => x.name === 'ContractFunctionRevertedError')) return null; throw e; });
  for (let i = 1, got = []; !got.includes(null); i += 6) tokens.push(...(got = await Promise.all([0, 1, 2, 3, 4, 5].map((k) => uri(i + k)))).filter(Boolean));
  const col = json(await read('contractURI')), locked = (await read('pageCount')) > 0n, file = `${root}contracts/deployments/${name}.preview.html`;
  const card = (t, i) => `<figure><div class=pair><img src="${t.image}" alt="${esc(t.name)}, still"><iframe loading=lazy src="${t.animation_url}" title="${esc(t.name)}"></iframe></div><figcaption><b>#${i + 1} ${esc(t.name)}</b><span>${t.attributes.map((a) => `${esc(a.trait_type)}: ${esc(a.value)}`).join(' · ')}</span></figcaption></figure>`;
  writeFileSync(file, `<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><title>Token preview</title>
<style>body{margin:0;padding:24px 16px;background:#0d1218;color:#d3ccba;font:14px/1.4 system-ui,sans-serif}h1{font:600 20px system-ui;margin:0 0 4px}p{color:#8b939b;margin:0}
header{display:flex;gap:16px;align-items:center;margin-bottom:20px}header img{width:72px;aspect-ratio:3/4;image-rendering:pixelated}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr));gap:18px}figure{margin:0;background:#000;border:1px solid #222;border-radius:8px;padding:10px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pair img,iframe{width:100%;aspect-ratio:3/4;border:0;background:#111;image-rendering:pixelated;display:block}
figcaption{margin-top:8px;display:grid;gap:2px}figcaption span{color:#8b939b;font-size:12px}</style>
<header><img src="${col.image}" alt=""><div><h1>${esc(col.name)} · ${tokens.length} tokens, read from ${name}</h1><p>${address} · ${locked ? 'locked' : 'not locked yet'} · read ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · left: image · right: animation_url</p></div></header>
<main>${tokens.map(card).join('\n')}</main>`);
  say(`Preview of all ${tokens.length} tokens: file://${file}`);
  if (!AUTO) spawn(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open', [file], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();   // opened in the browser, to look over while the next question waits
  return { tokens, col };
};
const compile = () => { execFileSync('forge', ['build', '--silent'], { cwd: `${root}contracts`, stdio: 'inherit' }); return JSON.parse(readFileSync(`${root}contracts/out/Cryptomnesia.sol/Cryptomnesia.json`, 'utf8')); };
// the source checked against the chain by Etherscan, through its v2 API (one key for every chain). forge only hands over the exact compiler input;
// the sending is done here, since forge before 1.2 cannot reach the v2 API
const verify = async (address, args, chainId, { abi, metadata }, key) => {
  const api = `https://api.etherscan.io/v2/api?chainid=${chainId}`, post = (body) => fetch(api, { method: 'POST', body: new URLSearchParams({ apikey: key, module: 'contract', ...body }) }).then((r) => r.json());
  try {
    const input = execFileSync('forge', ['verify-contract', address, 'src/Cryptomnesia.sol:Cryptomnesia', '--show-standard-json-input'], { cwd: `${root}contracts`, encoding: 'utf8', maxBuffer: 1 << 26 });
    const typed = [BigInt(args[0]), BigInt(args[1]), args[2], args[3], BigInt(args[4])], ctor = encodeAbiParameters(abi.find((x) => x.type === 'constructor').inputs, typed).slice(2);
    const r = await post({ action: 'verifysourcecode', codeformat: 'solidity-standard-json-input', sourceCode: input, contractaddress: address, contractname: 'src/Cryptomnesia.sol:Cryptomnesia', compilerversion: `v${metadata.compiler.version}`, constructorArguements: ctor });
    if (r.status !== '1') { if (/already verified/i.test(r.result)) return say('Already verified.'), true; throw new Error(r.result); }
    say('Sent to Etherscan. Waiting for it to compile and compare…');
    for (let i = 0; i < 36; i++) {                                         // the answer is a ticket, asked after every 5 s until it is settled
      await new Promise((ok) => setTimeout(ok, 5000));
      const s = await fetch(`${api}&module=contract&action=checkverifystatus&guid=${r.result}&apikey=${key}`).then((x) => x.json());
      if (/pending/i.test(s.result)) continue;
      if (s.status === '1' || /already verified/i.test(s.result)) return say(`Verified: ${s.result}`), true;
      throw new Error(s.result);
    }
    throw new Error('Etherscan was still working on it after 3 minutes');
  } catch (e) { say(`Verification did not go through (${e.message}). Try again later with: npm run verify`); return false; }
};

try {
  // the eye from the head of the contract's source, where Etherscan shows it too
  const head = readFileSync(SOL, 'utf8').split('\n').slice(1);
  say(`${head.slice(0, head.findIndex((l) => !l.startsWith('//'))).map((l) => l.slice(3)).join('\n')}\n`);
  const VERIFY = process.argv[2] === 'verify';
  // --- where
  const name = env.CHAIN || (await ask(VERIFY ? 'Chain: sepolia or mainnet' : 'Chain: localhost, sepolia or mainnet', VERIFY ? 'sepolia' : 'localhost'));
  const net = CHAINS[name] || die(`Unknown chain "${name}".`);
  const recFile = `${root}contracts/deployments/${name}.json`, prev = existsSync(recFile) ? JSON.parse(readFileSync(recFile, 'utf8')) : null;
  if (VERIFY) {
    if (name === 'localhost') die('Etherscan cannot see a local chain.');
    if (!prev) die(`No deployment on ${name} is recorded in ${recFile}.`);
    say(`Verifying ${prev.address} on ${name}…`);
    const built = compile(), ok = await verify(prev.address, prev.args, net.chain.id, built, env.ETHERSCAN_KEY || (await secret('Etherscan API key')) || die('An Etherscan key is needed.'));
    const reader = createPublicClient({ chain: net.chain, transport: http(env.ALCHEMY_KEY ? net.rpc(env.ALCHEMY_KEY) : TENDERLY[name], { timeout: 60_000, retryCount: 5 }) });
    await preview((functionName, a = []) => reader.readContract({ address: prev.address, abi: built.abi, functionName, args: a }), prev.address, name);
    process.exit(ok ? 0 : 1);
  }
  if (AUTO && name !== 'localhost') die('DEPLOY_AUTO=1 is for a local chain only: on a real one every clear and upload is asked about.');
  const alchemy = name === 'localhost' ? '' : env.ALCHEMY_KEY || (await secret('Alchemy API key')) || die('An Alchemy key is needed for this chain.');
  // a slow node is waited on a minute a request, and asked again, rather than stopping the run. a send asked twice is the same signed transaction, so it cannot go out twice
  const transport = http(net.rpc(alchemy), { timeout: 60_000, retryCount: 5 }), pub = createPublicClient({ chain: net.chain, transport });
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
  const art = await pack(), built = compile(), { abi, bytecode } = built;
  say(`${art.pages.length} pages · art ${art.gz.length} bytes gzipped, in ${art.chunks.length} piece${art.chunks.length > 1 ? 's' : ''} · stills ${art.covers.blob.length} bytes, in ${art.covers.chunks.length} · names and traits ${art.metas.blob.length} bytes`);

  // --- new, or carry on with one that stopped
  // a contract from before the stores were laid out this way has no pieces() to answer with: that one is left where it is and a new one deployed.
  // any other failure to ask (the network) stops the run, rather than deploy twice
  const current = (at) => pub.readContract({ address: at, abi, functionName: 'pieces', args: [0n] }).then(() => true, (e) => {
    if (e.walk((x) => /^ContractFunction(Reverted|ZeroData)Error$/.test(x.name))) return say(`The contract at ${at} is an older build. Deploying a new one.`);
    throw e;
  });
  let address = prev && (await pub.getCode({ address: prev.address })) && (await current(prev.address)) && (await yes(`Carry on with the contract already at ${prev.address}`, true)) ? prev.address : null;
  let args = prev && address ? prev.args : null;
  const read = (functionName, a = []) => pub.readContract({ address, abi, functionName, args: a });
  if (address && (await read('pageCount'))) die('That contract is locked. There is nothing left to do to it.');
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
    const cap = BigInt(await ask('Most copies of any one page (0 = no limit)', '10'));
    const owner = await ask('Owner: can upload and lock the art, and withdraw', account.address);
    const bps = BigInt(Math.round(Number(await ask('Royalty on resale, in percent (0 = none)', '0')) * 100));
    const royaltyTo = bps ? await ask('Royalties are paid to', owner) : owner;
    if (!isAddress(owner) || !isAddress(royaltyTo)) die('That is not an address.');
    if (bps > 10000n) die('A royalty cannot be more than 100%.');
    if (owner.toLowerCase() !== account.address.toLowerCase()) die('The owner must be the deployer for now: the owner uploads the art. Hand ownership over afterwards with transferOwnership.');
    args = [price, cap, owner, royaltyTo, bps];
  }

  // --- the rest of what it needs, so nothing but clears and the lock is asked once sending starts
  const scan = name !== 'localhost' && (await yes('Verify the source on Etherscan afterwards (or later, with npm run verify)', true)) && (env.ETHERSCAN_KEY || (await secret('Etherscan API key')) || die('Verifying needs an Etherscan key.'));
  const site = !AUTO && (await yes('Point the site at it afterwards (writes VITE_CHAIN, VITE_CONTRACT and VITE_DEPLOY_BLOCK to .env.local)', true));

  // --- shown back whole, then one go-ahead
  const [price, cap, owner, royaltyTo, bps] = args.map((x) => (typeof x === 'string' && /^\d+$/.test(x) ? BigInt(x) : x));
  const gas = address ? 0n : (await pub.estimateContractGas({ abi, bytecode: bytecode.object, args, account }).catch(() => 3_000_000n)) + BigInt(bytes * 216 + pieces * 90_000) + 60_000n;
  say(`\n— review —
  chain       ${name} (${id})
  deployer    ${account.address}
  contract    ${address ? `carry on with ${address}` : 'new'}
  price       ${formatEther(price)} ETH a copy
  editions    ${art.pages.length} pages · ${cap ? `${cap} copies each · ${cap * BigInt(art.pages.length)} NFTs at most` : 'no limit on copies'}
  owner       ${owner}
  royalty     ${bps ? `${Number(bps) / 100}% to ${royaltyTo}` : 'none'}
  verify      ${scan ? 'yes' : 'no'}
  site        ${[site ? 'write .env.local' : 'leave .env.local', name !== 'localhost' && 'write .env.live'].filter(Boolean).join(' · ')}${gas ? `\n  cost        about ${gas} gas at ${Number(formatGwei(fee)).toFixed(2)} gwei: roughly ${eth(gas * fee)}, in ${pieces + 2} transactions` : ''}`);
  if (name === 'mainnet') { if ((await ask('\nThis is mainnet and costs real ETH. Type mainnet to go on')) !== 'mainnet') die('Stopped. Nothing was sent.'); }
  else if (!(await yes('\nGo on', true))) die('Stopped. Nothing was sent.');

  if (!address) {
    say('\nDeploying…');
    const r = await send('contract', () => wallet.deployContract({ abi, bytecode: bytecode.object, args }));
    address = r.contractAddress || die('The deployment went through but made no contract.');
    mkdirSync(`${root}contracts/deployments`, { recursive: true });
    if (prev) copyFileSync(recFile, recFile.replace(/\.json$/, `.${prev.address}.json`));   // the record of the one before is kept
    writeFileSync(recFile, JSON.stringify({ chain: name, chainId: id, address, deployer: account.address, block: Number(r.blockNumber), args: args.map((x) => (typeof x === 'bigint' ? x.toString() : x)) }, null, 2));
    say(`  at ${address}`);
  }

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
  // every token read whole, as a marketplace will, and laid out to be looked at, before anything is made permanent
  say('');
  const { tokens, col } = await preview(read, address, name);
  if (tokens.length !== art.pages.length) die(`The contract gives ${tokens.length} tokens, not ${art.pages.length}.`);
  say(`Stored and read back: the art, all ${art.pages.length} stills and every page's name and traits match byte for byte, and every token's JSON reads. Token 1 is "${tokens[0].name}", with ${tokens[0].attributes.length} traits. The collection is "${col.name}".`);

  // --- lock
  say('\nLocking makes everything stored permanent. It cannot be undone. Minting stays paused until start() is called (owner only; pause() stops it again). The preview is open in your browser: look it over, then answer.');
  if (await yes('Lock now')) {
    await send('lock', () => wallet.writeContract({ address, abi, functionName: 'lock' }));
    if (await yes('Start minting now (or later, from the contract’s Write tab on Etherscan: start)')) await send('start', () => wallet.writeContract({ address, abi, functionName: 'start' }));
  }

  // --- verify
  if (scan) await verify(address, args, id, built, scan);

  // --- tell the site
  const block = JSON.parse(readFileSync(recFile, 'utf8')).block;
  if (site) {
    const f = `${root}.env.local`, keep = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l && !/^VITE_(CHAIN|CONTRACT|DEPLOY_BLOCK)=/.test(l)) : [];
    writeFileSync(f, [...keep, `VITE_CHAIN=${name}`, `VITE_CONTRACT=${address}`, `VITE_DEPLOY_BLOCK=${block}`, ''].join('\n'));
  }
  // everything the live site needs, to paste into the host's settings. written new each time; what this cannot know (OpenSea, WalletConnect) is carried over from the last one
  if (name !== 'localhost') {
    const f = `${root}.env.live`, old = existsSync(f) ? Object.fromEntries(readFileSync(f, 'utf8').split('\n').map((l) => l.match(/^(VITE_\w+)=(.*)$/)?.slice(1)).filter(Boolean)) : {};
    writeFileSync(f, `# written by npm run deploy, ${new Date().toISOString().slice(0, 10)}: the site's settings for ${name}. copy them into the host's environment
VITE_CHAIN=${name}
VITE_CONTRACT=${address}
VITE_DEPLOY_BLOCK=${block}
# the same Alchemy key the deploy used. it ends up in the site's code, so in Alchemy's dashboard limit it to the site's domain
VITE_RPC=${net.rpc(alchemy)}
# the collection's OpenSea page, once it has one. blank: the mark in the footer stays dim
VITE_OPENSEA=${old.VITE_OPENSEA || ''}
# a Reown project id switches WalletConnect on. blank: off
VITE_WC_PROJECT_ID=${old.VITE_WC_PROJECT_ID || ''}
`);
    say('Wrote .env.live');
  }
  say(`\nDone. ${name} · ${address}${net.chain.blockExplorers ? ` · ${net.chain.blockExplorers.default.url}/address/${address}` : ''}`);
  process.exit(0);
} catch (e) { die(e.shortMessage || e.message); }
