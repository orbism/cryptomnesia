import { useCallback, useEffect, useMemo, useState } from 'react';
import Choices from './Choices.jsx';
import Header from './Header.jsx';
import { ENTRIES, PAGES, PH, PW, QUIZ, pal, tokenId } from './lib.js';
import { Mint } from './Mint.jsx';
import Plate from './Plate.jsx';

const KEY = 'cryptomnesia-run';
// progress saved under the old name is still read
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('darkforest-run')) || {}; } catch { return {}; } };
const total = Object.keys(PAGES).length;

// text arrives a few letters at a time; any key or click finishes it
function Typed({ text, onDone }) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  useEffect(() => {
    if (done) return onDone();
    const t = setTimeout(() => setN((x) => x + 2), 18), skip = () => setN(text.length);
    addEventListener('keydown', skip); addEventListener('pointerdown', skip);
    return () => { clearTimeout(t); removeEventListener('keydown', skip); removeEventListener('pointerdown', skip); };
  }, [n, done, text, onDone]);
  return <p className="telling">{text.slice(0, n)}</p>;
}

function Scene({ page, colors, text, items, onPick, small, children }) {
  const [ready, setReady] = useState(false);
  const done = useCallback(() => setReady(true), []);
  useEffect(() => { document.documentElement.style.setProperty('--ground', colors[0]); }, [colors]);   // the whole window takes the page's ground, header and all
  return (
    <main className="scene" style={{ '--ink': colors[1], '--accent': colors[2] }}>
      <Plate page={page} colors={colors} small={small} />
      <div className="words">
        <Typed text={text} onDone={done} />
        {ready && <Choices items={items} onPick={onPick} />}
        {ready && children}
      </div>
    </main>
  );
}

const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const deal = () => shuffle(QUIZ).slice(0, 3).map((q) => ({ ...q, a: shuffle(q.a) }));

// three questions dealt from the pack, then the disposition they add up to and the page it opens on.
// from = the ending the reader has come back round from, if any: it has something to say first
function Quiz({ onStart, from }) {
  const [qs, setQs] = useState(deal), [got, setGot] = useState([]);
  const again = PAGES[from]?.again, q = qs[got.length];
  const who = useMemo(() => {
    const n = {};
    for (const k of got) n[k] = (n[k] || 0) + 1;
    if (new Set(got).size === 3) return 'hand';             // three answers that agree on nothing: nobody in particular
    return Object.keys(n).sort((a, b) => n[b] - n[a] || got.lastIndexOf(b) - got.lastIndexOf(a))[0];
  }, [got]);
  const e = ENTRIES[who], page = q ? q.scene : e.pic, colors = useMemo(() => pal(page.panels[0].s), [page]);
  if (q) return <><p className="ask">who am i?</p><Scene key={got.length} small page={page} colors={colors} text={again && !got.length ? `${again}\n\n${q.q}` : q.q} items={q.a} onPick={([, k]) => setGot([...got, k])} /></>;
  return <Scene key="who" small page={page} colors={colors} text={`You are ${e.name}. ${e.where} ${e.bend}`} items={[['Begin', e.start], ['Answer again', '']]} onPick={([, to]) => (to ? onStart(to) : (setQs(deal()), setGot([])))} />;
}

export default function App() {
  // a page's link is its name after the #, so any page can be shared or come back to
  // lead = what the last choice did on the way here; it is told before the page's own words
  const [run, setRun] = useState(() => { const r = { at: null, seen: [], ...saved() }, h = location.hash.slice(1); return PAGES[h] && h !== r.at ? { at: h, seen: r.seen.includes(h) ? r.seen : [...r.seen, h] } : r; });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(run)); } catch { /* private window */ }
    history.replaceState(null, '', run.at ? `#${run.at}` : location.pathname);
  }, [run]);
  const go = useCallback((to, lead) => setRun((r) => (PAGES[to] ? { at: to, lead, seen: r.seen.includes(to) ? r.seen : [...r.seen, to] } : { seen: r.seen, at: null, from: r.at })), []);
  const pg = PAGES[run.at];
  const page = useMemo(() => pg && { ...pg, w: PW, h: PH }, [pg]), colors = useMemo(() => pg && pal(pg), [pg]);
  return (
    <>
      <Header />
      <span className="seen">{run.seen.length} of {total} pages seen</span>
      {pg && <span className="folio">page {String(tokenId(run.at)).padStart(2, '0')}</span>}
      {pg
        ? <Scene key={run.at} page={page} colors={colors} text={run.lead ? `${run.lead}\n\n${pg.cap}` : pg.cap} items={pg.ch} onPick={([, to, lead]) => go(to, lead)}><Mint id={tokenId(run.at)} /></Scene>
        : <Quiz from={run.from} onStart={(to) => go(to)} />}
    </>
  );
}
