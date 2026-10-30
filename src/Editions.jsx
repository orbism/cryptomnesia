import { useEffect, useMemo, useRef, useState } from 'react';
import { zeroAddress } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import Download from './Download.jsx';
import { Icon } from './Footer.jsx';
import { DF, PAGES, PH, PW, pal } from './lib.js';
import { Turning, Wallet, Who } from './Mint.jsx';
import Modal from './Modal.jsx';
import Ornate from './Ornate.jsx';
import Plate from './Plate.jsx';
import { ABI, chain, contract, MOVED, scanToken, seaToken, START, txUrl } from './wallet.js';

const names = Object.keys(PAGES), sized = (k) => ({ ...PAGES[k], w: PW, h: PH });

// a page drawn once and left still, small: the list may hold every page there is. a page is slow to draw, so they are done one at a time with the window let breathe between, and a page once drawn is kept
const drawn = {};
let line = DF.fontsReady();
const still = (k) => (drawn[k] ||= line = line.then(() => new Promise((r) => setTimeout(() => { const c = document.createElement('canvas'); DF.mount(c, sized(k), pal(PAGES[k])); r(c); }))));
function Thumb({ k }) {
  const ref = useRef(null);
  useEffect(() => { let dead = false; still(k).then((c) => dead || ref.current.getContext('2d').drawImage(c, 0, 0)); return () => { dead = true; }; }, [k]);
  return <canvas ref={ref} width={PW} height={PH} />;
}
const Asking = () => <p className="note">Asking the contract <Turning /></p>;

// every copy of every page, followed from the chain's own record of it moving: who minted how many (minted), who holds how many now (held), and every move in order (past)
function ledger(logs) {
  const ids = {};
  for (const { eventName, args, blockNumber, transactionHash } of logs) {
    const moves = eventName === 'TransferBatch' ? args.ids.map((id, i) => [id, args.values[i]]) : [[args.id, args.value]];
    for (const [id, v] of moves) {
      const e = (ids[Number(id)] ||= { minted: {}, held: {}, past: [] }), n = Number(v);
      if (args.from === zeroAddress) e.minted[args.to] = (e.minted[args.to] || 0) + n; else e.held[args.from] -= n;
      if (args.to !== zeroAddress) e.held[args.to] = (e.held[args.to] || 0) + n;
      e.past.push({ from: args.from, to: args.to, n, block: blockNumber, tx: transactionHash });
    }
  }
  return ids;
}
// the chain's record of every copy moving, from the block the contract went in at, in order. public nodes answer for only so many blocks at a time
// (Sepolia's, 1,000), so it is asked a stretch at a time, and a refused stretch is halved and asked again
async function history(client) {
  const end = await client.getBlockNumber(), logs = [];
  for (let a = START, span = 100000n; a <= end;) {
    const b = a + span - 1n < end ? a + span - 1n : end;
    try { logs.push(...(await client.getLogs({ address: contract, events: MOVED, fromBlock: a, toBlock: b === end ? 'latest' : b }))); a = b + 1n; }
    catch (e) { if (span < 500n) throw e; span /= 2n; }
  }
  return logs;
}
// read once a visit to the list, when a page is first brought up, and kept until the list is left
let record;
const recordOf = (client) => (record ||= history(client).then(ledger, (e) => { record = null; throw e; }));
// an address, said briefly; a click copies the whole of it
function Addr({ a }) {
  const [ok, setOk] = useState(false);
  const copy = () => navigator.clipboard.writeText(a).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }, () => {});
  return <button type="button" className="addr" title={`${a} · click to copy`} onClick={copy}>{ok ? 'copied' : <Who address={a} />}</button>;
}
const day = (t) => new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
// one move, said the way the place would say it
function Move({ from, to, n, when, tx }) {
  const x = n > 1 ? ` (${n})` : '', link = txUrl(tx);
  const said = from === zeroAddress ? <><Addr a={to} /> remembered it{x}</> : to === zeroAddress ? <><Addr a={from} /> forgot it, on purpose{x}</> : <><Addr a={from} /> let it go to <Addr a={to} />{x}</>;
  return <li>{said}<small>{when ? day(when) : <Turning />}{link && <> · <a href={link} target="_blank" rel="noreferrer">the record</a></>}</small></li>;
}

const out = <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
// a lozenge in a corner of the frame, like the close X: a way out to somewhere, dim while there is nowhere (a local chain)
const Stone = ({ at, href, icon, label }) => href
  ? <a className={`shut ${at}`} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}><Icon icon={icon} size={12} /></a>
  : <span className={`shut ${at} soon`} title={`${label}: not on a local chain`}><Icon icon={icon} size={12} /></span>;

// one page brought up in the frame, moving, with no turn into it, and beside the frame (on a phone, in a drawer under it) who keeps it now and everything that has happened to it. the way out is the stone at the heart of the frame's top right corner
function Big({ k, onShut }) {
  const client = usePublicClient({ chainId: chain.id }), id = names.indexOf(k) + 1, [e, setE] = useState(null), [fail, setFail] = useState('');
  useEffect(() => { let dead = false; recordOf(client).then((b) => dead || setE(b[id] || {}), (x) => !dead && setFail(x.shortMessage || x.message)); return () => { dead = true; }; }, [client, id]);
  const past = e?.past || [], kept = Object.entries(e?.held || {}).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  const page = useMemo(() => sized(k), [k]), colors = useMemo(() => pal(PAGES[k]), [k]), name = `cryptomnesia-${String(id).padStart(2, '0')}-${k}`;
  const [open, setOpen] = useState(false), [when, setWhen] = useState({}), flip = () => setOpen((o) => !o);
  useEffect(() => {                                                             // the dates are the blocks' own, asked for only when the page is looked at
    let dead = false;
    Promise.all([...new Set(past.map((p) => p.block))].slice(-40).map((b) => client.getBlock({ blockNumber: b }).then((x) => [b, Number(x.timestamp)]))).then((e) => dead || setWhen(Object.fromEntries(e)), () => {});
    return () => { dead = true; };
  }, [client, past.length]);
  return (
    <Modal wide level={innerWidth < 700 ? 2 : 3} onShut={onShut} side={
      <aside className={open ? 'log drawer open' : 'log drawer'}>
        <Ornate as="h2" level={4} className="title" onClick={flip}>{String(id).padStart(2, '0')} · {PAGES[k].title}</Ornate>
        {seaToken(id) ? <a className="sea" href={seaToken(id)} target="_blank" rel="noreferrer">opensea {out}</a> : <span className="sea" title="OpenSea only knows Ethereum and Sepolia, not a local chain">opensea {out}</span>}
        <Download page={page} colors={colors} name={name} className="sea" size={14} tail />
        {kept.length > 0 && <><h3>Kept by</h3><ul>{kept.map(([a, c]) => <li key={a}><Addr a={a} /> × {c}</li>)}</ul></>}
        <h3>What became of it</h3>
        {!e ? (fail ? <p>The chain would not say. {fail}</p> : <Asking />) : past.length ? <ol>{[...past].reverse().map((p, i) => <Move key={i} {...p} when={when[p.block]} />)}</ol> : <p>Nobody has remembered this one yet. It is patient.</p>}
        <p><small>{seaToken(id) ? 'Nothing is bought or sold here. OpenSea will take your money for it, if you insist.' : 'Nothing is bought or sold here. When it has a market, the market will be somewhere else.'}</small></p>
      </aside>
    }>
      <button type="button" className="shut" aria-label="close" onClick={onShut}>X</button>
      <Stone at="tl" href={seaToken(id)} icon="sea" label="this one on OpenSea" />
      <Stone at="br" href={scanToken(id)} icon="scan" label="this one on Etherscan" />
      <Download page={page} colors={colors} name={name} className="shut bl" label="" size={12} />
      <div className="art" onClick={flip}><Plate plain page={page} colors={colors} /></div>
    </Modal>
  );
}
// the list hangs from the word that opened it: its left edge is that word's, and further columns go off to the right. behind three bars the word has no place, and the page's own margin does
const edge = () => document.querySelector('header .links [aria-pressed]')?.getBoundingClientRect().left || 20;
// how many columns there is room for from there. the list fills one eight deep before it starts the next, and goes deeper only when it runs out of room
const room = () => Math.max(1, Math.floor((innerWidth - edge() - 20) / 328));

// the pages that have been minted, every one (all) or the connected wallet's (yours): a picture of each, its number, how many, and where it is on OpenSea. a click on one brings it up, with who keeps it and its history.
// piece = the page brought up, if any; it is in the address, so a link can go straight to it
export default function Editions({ piece, onPiece }) {
  const client = usePublicClient({ chainId: chain.id }), { address } = useAccount();
  const [book, setBook] = useState(null), [tab, setTab] = useState('all'), [err, setErr] = useState(''), [fit, setFit] = useState(room), [left, setLeft] = useState(edge);
  useEffect(() => { const size = () => { setFit(room()); setLeft(edge()); }; addEventListener('resize', size); document.fonts.ready.then(size); return () => removeEventListener('resize', size); }, []);
  useEffect(() => {                                                             // how many of each page there are, and the wallet's own, in a call each. the record of who and when waits until a page is brought up
    if (!contract || !client) return;
    let dead = false;
    const read = (functionName, args) => client.readContract({ address: contract, abi: ABI, functionName, args }).then((n) => n.map(Number));
    Promise.all([read('minted'), address && read('balanceOfBatch', [names.map(() => address), names.map((_, i) => BigInt(i + 1))])])
      .then(([all, yours]) => dead || setBook({ all, yours }), (e) => !dead && setErr(e.shortMessage || e.message));
    return () => { dead = true; };
  }, [client, address]);
  useEffect(() => () => { record = null; }, []);                                // leaving the list lets the record go: the next visit reads it fresh
  const say = (p) => <main className="shelf" style={{ paddingLeft: left }}>{p}</main>;
  if (!contract) return say(<p className="note">mintable very soon!</p>);
  if (err) return say(<p className="note">The chain would not say. {err}</p>);
  if (!book) return say(<Asking />);
  const mine = tab === 'yours', counts = (mine ? book.yours : book.all) || [];
  const rows = names.map((k, i) => ({ k, id: i + 1, n: counts[i] || 0 })).filter((r) => r.n > 0), all = rows.reduce((a, r) => a + r.n, 0);
  const tabs = <p className="tabs">{[['all', 'all memories'], ['yours', 'your memories']].map(([t, label]) => <Ornate as="button" type="button" level={5} key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</Ornate>)}</p>;
  const note = mine
    ? !address ? <>Whose memories are these? We can't tell what's yours until you tell us who you are. <Wallet /></>
      : all ? `You keep ${all === 1 ? 'one memory' : `${all} memories`}, from ${rows.length === 1 ? 'one page' : `${rows.length} pages`}.` : 'You have not kept anything yet. Or you have, and it has slipped your mind.'
    : all ? `${all} minted so far, over ${rows.length} of ${names.length} pages.` : 'Nothing has been minted yet. The town is still waiting to be remembered.';
  return (
    <main className="shelf" style={{ paddingLeft: left }}>
      {tabs}
      <p className="note">{note}</p>
      {(!mine || address) && rows.length > 0 && (
        <ol style={{ gridTemplateRows: `repeat(${Math.max(8, Math.ceil(rows.length / fit))}, auto)` }}>
          {rows.map(({ k, id, n }) => (
            <li key={k}>
              <button type="button" className="thumb" aria-label={`look at ${PAGES[k].title}`} onClick={() => onPiece(k)}><Thumb k={k} /></button>
              <button type="button" onClick={() => onPiece(k)}><span>{String(id).padStart(2, '0')}</span><span>{PAGES[k].title}</span><span>× {n}</span></button>
              {seaToken(id) && <a href={seaToken(id)} target="_blank" rel="noreferrer">opensea</a>}
            </li>
          ))}
        </ol>
      )}
      {piece && <Big k={piece} onShut={() => onPiece(null)} />}
    </main>
  );
}
