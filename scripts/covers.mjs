// Draws the still that stands for each page where only a picture is shown: half size, as small a PNG as will hold it, into contracts/art/covers.
// The words in the pictures need a real browser to set them, so this drives Chrome, headless, on the packed program itself: the stills are of exactly what goes on chain.
// Run again whenever the art changes (the pack will say so):
//   npm run covers
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crc32, deflateSync, constants as Z } from 'node:zlib';
import { pack } from './pack.mjs';

const root = new URL('..', import.meta.url).pathname, CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9377;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const part = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); return Buffer.concat([u32(data.length), body, u32(crc32(body))]); };
// a PNG of w x h pixels, each an index into pal ([r, g, b]...), at the fewest bits a pixel that will count them, squeezed the best of three ways
function png(w, h, pal, px) {
  const bits = pal.length <= 2 ? 1 : pal.length <= 4 ? 2 : pal.length <= 16 ? 4 : 8, row = Math.ceil((w * bits) / 8), raw = Buffer.alloc((row + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (row + 1) + 1 + ((x * bits) >> 3)] |= px[y * w + x] << (8 - bits - ((x * bits) & 7));
  const idat = [Z.Z_DEFAULT_STRATEGY, Z.Z_FILTERED, Z.Z_RLE].map((strategy) => deflateSync(raw, { level: 9, memLevel: 9, strategy })).sort((a, b) => a.length - b.length)[0];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), part('IHDR', Buffer.concat([u32(w), u32(h), Buffer.from([bits, 3, 0, 0, 0])])), part('PLTE', Buffer.from(pal.flat())), part('IDAT', idat), part('IEND', Buffer.alloc(0))]);
}

const art = await pack({ covers: false }), dir = `${tmpdir()}/cryptomnesia-covers-${process.pid}`, page = `${dir}/draw.html`;
mkdirSync(dir, { recursive: true });
// the program with nothing set going, and one thing to call: draw a page at half size and say what colours it used and which each pixel is
writeFileSync(page, `<!doctype html><meta charset=utf8><script>${art.lib}</script><script>
window.cover = async (k) => {
  await Promise.all(Object.values(FONTS).map(([n, w, b]) => new FontFace(n, 'url(data:font/woff2;base64,' + b + ')', { weight: w }).load().then((f) => document.fonts.add(f))));
  const g = DFDATA.PAGES[k], w = DFDATA.PW / 2, h = DFDATA.PH / 2, c = document.createElement('canvas');
  DF.mount(c, { ...g, w, h, panels: g.panels.map((p) => ({ ...p, x: p.x >> 1, y: p.y >> 1, w: p.w >> 1, h: p.h >> 1 })), text: (g.text || []).map((t) => ({ ...t, z: t.z / 2, y: t.y >> 1, ...(t.x != null && { x: t.x >> 1 }) })) }, DFDATA.pal(g));
  const d = c.getContext('2d').getImageData(0, 0, w, h).data, pal = [], at = new Map(), px = [];
  for (let i = 0; i < d.length; i += 4) { const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; if (!at.has(key)) { at.set(key, pal.length); pal.push([d[i], d[i + 1], d[i + 2]]); } px.push(at.get(key)); }
  return JSON.stringify({ w, h, pal, px: px.join('') });
};</script>`);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--mute-audio', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}/profile`, 'about:blank'], { stdio: 'ignore' });
chrome.on('error', () => { console.error(`Could not start Chrome at ${CHROME}. Set CHROME to where it is.`); process.exit(1); });
try {
  let tab;
  for (let i = 0; i < 40 && !tab; i++) { await sleep(250); tab = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page'), () => null); }
  if (!tab) throw new Error('Chrome did not answer.');
  const ws = new WebSocket(tab.webSocketDebuggerUrl), wait = {};
  let id = 0;
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); wait[d.id]?.(d.result); };
  const cmd = (method, params = {}) => new Promise((r) => { wait[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await cmd('Page.navigate', { url: `file://${page}` });
  for (let i = 0; i < 40 && !(await cmd('Runtime.evaluate', { expression: 'typeof window.cover', returnByValue: true })).result?.value?.startsWith('f'); i++) await sleep(250);
  rmSync(`${root}contracts/art/covers`, { recursive: true, force: true });
  mkdirSync(`${root}contracts/art/covers`, { recursive: true });
  let total = 0;
  for (const k of art.pages) {
    const r = await cmd('Runtime.evaluate', { expression: `cover(${JSON.stringify(k)})`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${k}: ${r.exceptionDetails.exception?.description || 'could not be drawn'}`);
    const { w, h, pal, px } = JSON.parse(r.result.value);
    if (pal.length > 10) throw new Error(`${k} came out in ${pal.length} colours: a still is written one digit a pixel`);
    const file = png(w, h, pal, [...px].map(Number));
    writeFileSync(`${root}contracts/art/covers/${k}.png`, file);
    total += file.length;
  }
  // which art these are stills of, so the pack can tell when they have fallen behind it
  writeFileSync(`${root}contracts/art/covers/made.json`, JSON.stringify({ art: createHash('sha256').update(art.gz).digest('hex') }));
  console.log(`${art.pages.length} stills · ${total} bytes · about ${Math.round((total * 216) / 1e5) / 10}M gas to store`);
} finally { chrome.kill(); await sleep(300); rmSync(dir, { recursive: true, force: true }); }
process.exit(0);
