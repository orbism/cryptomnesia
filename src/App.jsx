import { useCallback, useEffect, useMemo, useState } from 'react';
import Choices from './Choices.jsx';
import Editions from './Editions.jsx';
import Footer from './Footer.jsx';
import { gif } from './gif.js';
import Header from './Header.jsx';
import Modal from './Modal.jsx';
import Ornate from './Ornate.jsx';
import { ENTRIES, PAGES, PH, PW, QUIZ, RECALL, pal, tokenId } from './lib.js';
import { Mint } from './Mint.jsx';
import Plate from './Plate.jsx';

const KEY = 'cryptomnesia-run';
// progress saved under the old name is still read
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('darkforest-run')) || {}; } catch { return {}; } };

// text arrives a few letters at a time; any key or click finishes it. bold = a part of it to set heavy
function Typed({ text, bold, onDone }) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  useEffect(() => {
    if (done) return onDone();
    const t = setTimeout(() => setN((x) => x + 2), 18), skip = () => setN(text.length);
    addEventListener('keydown', skip); addEventListener('pointerdown', skip);
    return () => { clearTimeout(t); removeEventListener('keydown', skip); removeEventListener('pointerdown', skip); };
  }, [n, done, text, onDone]);
  const shown = text.slice(0, n), i = bold ? text.indexOf(bold) : -1;
  return <p className="telling">{i < 0 ? shown : <>{shown.slice(0, i)}<b>{shown.slice(i, i + bold.length)}</b>{shown.slice(i + bold.length)}</>}</p>;
}

function Scene({ page, colors, title, onTitle, text, bold, items, onPick, small, children }) {
  const [ready, setReady] = useState(false), [open, setOpen] = useState(false);   // open = on a phone, the telling drawn up over the picture
  const done = useCallback(() => setReady(true), []), flip = () => setOpen((o) => !o);
  useEffect(() => { document.documentElement.style.setProperty('--ground', colors[0]); }, [colors]);   // the whole window takes the page's ground, header and all
  return (
    <main className="scene" style={{ '--ink': colors[1], '--accent': colors[2] }}>
      <div className="art" onClick={flip}><Plate page={page} colors={colors} small={small} /></div>
      <div className={`words${small ? '' : ' sheet'}${open ? ' open' : ''}`}>
        <Ornate as="h2" level={4} className={onTitle ? 'title asks' : 'title'} role={onTitle && 'button'} onClick={onTitle || flip}>{title}</Ornate>
        <Typed text={text} bold={bold} onDone={done} />
        {ready && <Choices items={items} onPick={onPick} />}
        {ready && children}
      </div>
    </main>
  );
}

// the page as a looping GIF. it takes a moment to draw, and says so
function Download({ page, colors, name }) {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));                                // let the word change before the drawing holds everything up
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await gif(page, colors)); a.download = `${name}.gif`; a.click(); URL.revokeObjectURL(a.href);
    setBusy(false);
  };
  return <button type="button" className="save" disabled={busy} onClick={save}><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>{busy ? 'drawing…' : 'download'}</button>;
}

const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const deal = () => shuffle(QUIZ).slice(0, 3).map((q) => ({ ...q, a: shuffle(q.a) }));

// what the questions are called. anamnesis: the calling back to mind of what was known before; and what a doctor calls the questions asked on the way in
const SORTING = 'Anamnesis';
// three questions dealt from the pack, then the disposition they add up to and the page it opens on.
// from = the ending the reader has come back round from, if any: it has something to say first
function Quiz({ onStart, from }) {
  const [qs, setQs] = useState(deal), [got, setGot] = useState([]), [gloss, setGloss] = useState(false);   // gloss = the word over the questions, looked up
  const again = PAGES[from]?.again, q = qs[got.length];
  const who = useMemo(() => {
    const n = {};
    for (const k of got) n[k] = (n[k] || 0) + 1;
    if (new Set(got).size === 3) return 'hand';             // three answers that agree on nothing: nobody in particular
    return Object.keys(n).sort((a, b) => n[b] - n[a] || got.lastIndexOf(b) - got.lastIndexOf(a))[0];
  }, [got]);
  const e = ENTRIES[who], page = q ? q.scene : e.pic, colors = useMemo(() => pal(page.panels[0].s), [page]);
  const word = gloss && (
    <Modal tap level={4} onShut={() => setGloss(false)}>
      <p className="entry"><b>an·am·ne·sis</b> <i>noun</i><br />\ ˌa-ˌnam-ˈnē-səs \<br />1 : the calling back to mind of something known before<br />2 : the history a patient gives of themselves, taken by questioning on the way in</p>
    </Modal>
  );
  if (q) return <><p className="ask">who am i?</p>{word}<Scene key={got.length} small title={SORTING} onTitle={() => setGloss(true)} page={page} colors={colors} text={again && !got.length ? `${again}\n\n${q.q}` : q.q} items={q.a} onPick={([, k]) => setGot([...got, k])} /></>;
  return <><p className="ask" />{word}<Scene key="who" small title={SORTING} onTitle={() => setGloss(true)} bold={e.name} page={page} colors={colors} text={`You are ${e.name}. ${e.where} ${e.bend}`} items={[['Begin', e.start], ['Answer again', '']]} onPick={([, to]) => (to ? onStart(to) : (setQs(deal()), setGot([])))} /></>;
}

export default function App() {
  // where the reader is lives in this browser, not in the address: nobody is handed a link into the middle of it
  // lead = what the last choice did on the way here; it is told before the page's own words
  // been = how many times this walk has stood on each page: a second time, the page may greet the reader differently and offer other ways on.
  // a road that leads round counts as a second time even on a first: the reader has been here, whether or not they walked it tonight
  const [leave, setLeave] = useState(false);                                    // the reader has asked to start over, and is being asked if they mean it
  const [shelf, setShelf] = useState(false);                                    // the list of what has been minted, in place of the story
  const [run, setRun] = useState(() => { const { at = null, lead, been, from } = saved(); return { at, lead, been, from }; });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(run)); } catch { /* private window */ }
    if (location.hash) history.replaceState(null, '', location.pathname);        // an old link with a page on the end of it: the page is not honoured, and the end comes off
  }, [run]);
  const go = useCallback((to, lead, round) => setRun((r) => (PAGES[to] ? { at: to, lead, been: { ...(r.at && r.been), [to]: Math.max((r.at && r.been?.[to]) || 0, round ? 1 : 0) + 1 } } : { at: null, from: r.at })), []);
  const pg = PAGES[run.at], times = run.been?.[run.at] || 1, now = (times > 1 && pg?.re) || pg;       // now = the telling and the choices for this visit
  const thought = pg && (times > 1 ? RECALL[Math.min(times, RECALL.length + 1) - 2] : pg.think);
  const page = useMemo(() => pg && { ...pg, w: PW, h: PH }, [pg]), colors = useMemo(() => pg && pal(pg), [pg]);
  return (
    <>
      <Header shelf={shelf} onShelf={() => setShelf(!shelf)} onHome={() => setShelf(false)} />
      {pg && !shelf && <p className="ask">{thought}</p>}
      <Footer>{pg && !shelf && <><button type="button" onClick={() => setLeave(true)}>forget</button><span>page {String(tokenId(run.at)).padStart(2, '0')}</span></>}</Footer>
      {leave && (
        <Modal onShut={() => setLeave(false)}>
          <p>This walks you back out to the three questions and tonight’s way through is lost, though anything you have minted stays minted.</p>
          <p className="row"><button type="button" onClick={() => setLeave(false)}>cancel</button><button type="button" onClick={() => { setLeave(false); setRun({ at: null }); }}>confirm</button></p>
        </Modal>
      )}
      {shelf ? <Editions /> : pg
        ? <Scene key={run.at} page={page} colors={colors} title={pg.title} text={run.lead ? `${run.lead}\n\n${now.cap}` : now.cap} items={now.ch} onPick={([, to, lead, round]) => go(to, lead, round)}><Mint id={tokenId(run.at)} /><Download page={page} colors={colors} name={`cryptomnesia-${String(tokenId(run.at)).padStart(2, '0')}-${run.at}`} /></Scene>
        : <Quiz from={run.from} onStart={(to) => go(to)} />}
    </>
  );
}
