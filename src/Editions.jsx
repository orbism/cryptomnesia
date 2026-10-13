import { useEffect, useMemo, useRef, useState } from 'react';
import { zeroAddress } from 'viem';
import { usePublicClient } from 'wagmi';
import { DF, PAGES, PH, PW, pal } from './lib.js';
import { Who } from './Mint.jsx';
import Modal from './Modal.jsx';
import Plate from './Plate.jsx';
import { chain, contract, MINTED, seaToken, START } from './wallet.js';

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
// the wait while the contract is asked: three dots, growing slowly to eight, and round again
function Asking() {
  const [n, setN] = useState(3);
  useEffect(() => { const t = setInterval(() => setN((x) => (x < 8 ? x + 1 : 3)), 450); return () => clearInterval(t); }, []);
  return <p className="note">Asking the contract{'.'.repeat(n)}</p>;
}

// one page brought up in the frame, moving, with no turn into it. the way out is the stone at the heart of the frame's top right corner
function Big({ k, onShut }) {
  const page = useMemo(() => sized(k), [k]), colors = useMemo(() => pal(PAGES[k]), [k]);
  return <Modal wide level={innerWidth < 700 ? 2 : 3} onShut={onShut}><button type="button" className="shut" aria-label="close" onClick={onShut}>X</button><Plate plain page={page} colors={colors} /></Modal>;
}
// the list hangs from the word that opened it: its left edge is that word's, and further columns go off to the right. behind three bars the word has no place, and the page's own margin does
const edge = () => document.querySelector('header .links [aria-pressed]')?.getBoundingClientRect().left || 20;
// how many columns there is room for from there. the list fills one eight deep before it starts the next, and goes deeper only when it runs out of room
const room = () => Math.max(1, Math.floor((innerWidth - edge() - 20) / 328));

// the pages that have been minted: a picture of each, its number, how many copies, where it is on OpenSea, and under each, on asking, who minted them. read from the contract's own mint events
export default function Editions() {
  const client = usePublicClient({ chainId: chain.id });
  const [by, setBy] = useState(null), [open, setOpen] = useState(null), [big, setBig] = useState(null), [err, setErr] = useState(''), [fit, setFit] = useState(room), [left, setLeft] = useState(edge);
  useEffect(() => { const size = () => { setFit(room()); setLeft(edge()); }; addEventListener('resize', size); document.fonts.ready.then(size); return () => removeEventListener('resize', size); }, []);
  useEffect(() => {
    if (!contract || !client) return;
    let dead = false;
    client.getLogs({ address: contract, event: MINTED, args: { from: zeroAddress }, fromBlock: START, toBlock: 'latest' }).then((logs) => {
      const m = {};
      for (const { args: { to, id, value } } of logs) { const p = (m[id] ||= {}); p[to] = (p[to] || 0) + Number(value); }
      if (!dead) setBy(m);
    }, (e) => !dead && setErr(e.shortMessage || e.message));
    return () => { dead = true; };
  }, [client]);
  if (!contract) return <main className="shelf" style={{ paddingLeft: left }}><p className="note">Nothing has been minted. The edition contract is not deployed yet.</p></main>;
  if (err) return <main className="shelf" style={{ paddingLeft: left }}><p className="note">The chain would not say. {err}</p></main>;
  if (!by) return <main className="shelf" style={{ paddingLeft: left }}><Asking /></main>;
  const rows = names.map((k, i) => ({ k, id: i + 1, who: Object.entries(by[i + 1] || {}).sort((a, b) => b[1] - a[1]) })).filter((r) => r.who.length);
  const sum = (who) => who.reduce((a, [, c]) => a + c, 0), all = rows.reduce((a, r) => a + sum(r.who), 0);
  return (
    <main className="shelf" style={{ paddingLeft: left }}>
      <p className="note">{all ? `${all} minted so far, over ${rows.length} of ${names.length} pages.` : 'Nothing has been minted yet.'}</p>
      <ol style={{ gridTemplateRows: `repeat(${Math.max(8, Math.ceil(rows.length / fit))}, auto)` }}>
        {rows.map(({ k, id, who }) => (
          <li key={k}>
            <button type="button" className="thumb" aria-label={`look at ${k}`} onClick={() => setBig(k)}><Thumb k={k} /></button>
            <button type="button" aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}><span>{String(id).padStart(2, '0')}</span><span>{k}</span><span>× {sum(who)}</span></button>
            {seaToken(id) && <a href={seaToken(id)} target="_blank" rel="noreferrer">opensea</a>}
            {open === k && <ul>{who.map(([a, c]) => <li key={a}><Who address={a} /> × {c}</li>)}</ul>}
          </li>
        ))}
      </ol>
      {big && <Big k={big} onShut={() => setBig(null)} />}
    </main>
  );
}
