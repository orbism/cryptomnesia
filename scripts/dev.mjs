#!/usr/bin/env node
// `pnpm dev`: a local chain, the contract on it with the current art, and the site pointed at both.
// Starts anvil if none is running, deploys (or brings up to date) through scripts/deploy.mjs, then runs vite.
// Without Foundry installed it just runs the site, with minting closed. With .env.local pointing at sepolia or mainnet, it runs the site against that instead.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname, RPC = 'http://127.0.0.1:8545', rec = `${root}contracts/deployments/localhost.json`;
const has = (bin) => { try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const up = () => fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' }).then((r) => r.ok, () => false);
const env = { ...process.env };
let anvil;
// .env.local pointed at a real chain (as npm run deploy leaves it): the site runs against that, and no local chain is started
const real = (() => { try { return readFileSync(`${root}.env.local`, 'utf8').match(/^VITE_CHAIN=(sepolia|mainnet)\s*$/m)?.[1]; } catch { return null; } })();

if (real) console.log(`.env.local points the site at ${real}. Running it against that, with no local chain. Take VITE_CHAIN out of .env.local to go back to anvil.\n`);
else if (has('anvil') && has('forge')) {
  if (!(await up())) {
    anvil = spawn('anvil', ['--silent', '--state', `${root}contracts/deployments/anvil-state.json`], { stdio: 'ignore' });   // the chain is kept in a file between runs, so what was minted on it is still there next time
    for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 150));
    console.log('anvil · started on 127.0.0.1:8545');
  } else console.log('anvil · already running on 127.0.0.1:8545');
  try {
    execFileSync('node', [`${root}scripts/deploy.mjs`], { stdio: 'inherit', env: { ...process.env, CHAIN: 'localhost', DEPLOY_AUTO: '1' } });
    const { address, block } = JSON.parse(readFileSync(rec, 'utf8'));
    Object.assign(env, { VITE_CHAIN: 'localhost', VITE_CONTRACT: address, VITE_DEPLOY_BLOCK: String(block) });
    console.log('\nTo mint locally, add network 127.0.0.1:8545 (chain 31337) to your wallet and import one of anvil’s test accounts.\n');
  } catch { console.log('\nThe local deploy did not finish. Starting the site with minting closed.\n'); }
} else console.log('Foundry (anvil, forge) is not installed. Starting the site with minting closed.\n');

const vite = spawn(`${root}node_modules/.bin/vite`, process.argv.slice(2), { stdio: 'inherit', env, cwd: root });
const stop = () => { anvil?.kill(); vite.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
vite.on('exit', (code) => { anvil?.kill(); process.exit(code ?? 0); });
