#!/usr/bin/env node
// `pnpm dev`: a local chain, the contract on it with the current art, and the site pointed at both.
// Starts anvil if none is running, deploys (or brings up to date) through scripts/deploy.mjs, then runs vite.
// Without Foundry installed it just runs the site, with minting closed.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname, RPC = 'http://127.0.0.1:8545', rec = `${root}contracts/deployments/localhost.json`;
const has = (bin) => { try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const up = () => fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' }).then((r) => r.ok, () => false);
const env = { ...process.env };
let anvil;

if (has('anvil') && has('forge')) {
  if (!(await up())) {
    anvil = spawn('anvil', ['--silent', '--state', `${root}contracts/deployments/anvil-state.json`], { stdio: 'ignore' });   // the chain is kept in a file between runs, so what was minted on it is still there next time
    for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 150));
    console.log('anvil · started on 127.0.0.1:8545');
  } else console.log('anvil · already running on 127.0.0.1:8545');
  try {
    execFileSync('node', [`${root}scripts/deploy.mjs`], { stdio: 'inherit', env: { ...process.env, CHAIN: 'localhost', DEPLOY_AUTO: '1' } });
    Object.assign(env, { VITE_CHAIN: 'localhost', VITE_CONTRACT: JSON.parse(readFileSync(rec, 'utf8')).address });
    console.log('\nTo mint locally, add network 127.0.0.1:8545 (chain 31337) to your wallet and import one of anvil’s test accounts.\n');
  } catch { console.log('\nThe local deploy did not finish. Starting the site with minting closed.\n'); }
} else console.log('Foundry (anvil, forge) is not installed. Starting the site with minting closed.\n');

const vite = spawn(`${root}node_modules/.bin/vite`, process.argv.slice(2), { stdio: 'inherit', env, cwd: root });
const stop = () => { anvil?.kill(); vite.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
vite.on('exit', (code) => { anvil?.kill(); process.exit(code ?? 0); });
