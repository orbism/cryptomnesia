// Packs what goes on chain: the drawing engine, the page recipes, the letters the words in the pictures need (scripts/fonts.mjs) and a few lines that start it, minified and gzipped.
// Writes contracts/art/art.gz, gathers the stills (scripts/covers.mjs) and every page's name and traits, each behind a table of where each page's part ends, and says what storing it all will cost in gas.
import { transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { FAMILY, letters } from './fonts.mjs';

const root = new URL('..', import.meta.url).pathname, read = (f) => readFileSync(root + f, 'utf8');
const CHUNK = 24575;                                // a contract's code may be 24576 bytes; one is the STOP in front
// the token page needs the pictures, not the story: drop the telling, the choices and the opening questions before packing
const { PAGES, ENTRIES } = createRequire(import.meta.url)(root + 'src/pages.js');
const lean = Object.fromEntries(Object.entries(PAGES).map(([k, { cap, ch, again, kind, back, re, think, title, ...p }]) => [k, p]));
const pages = read('src/pages.js');
const a = pages.indexOf('  const PAGES = {'), b = pages.indexOf('  for (const pg of Object.values(PAGES))'), c = pages.indexOf('  // every straight walk from each way in'), d = pages.indexOf('  // the four colours for a page');
if ([a, b, c, d].some((i) => i < 0)) throw new Error('src/pages.js has changed shape; scripts/pack.mjs needs to be told where things are');
const data = pages.slice(0, a) + `  const PAGES = ${JSON.stringify(lean)};\n` + pages.slice(d).replace('const DATA = { WORLDS, HOME, TINT, PAGES, QUIZ, ENTRIES, RECALL, PW, PH, pal, walks, repeats };', 'const DATA = { PAGES, PW, PH, pal };');
// the faces, cut down to the letters the pages use, go in with the program: FONTS = { code: [family, weight, the file in base64] }. a face that lacks a letter some page now uses stops the pack
const need = letters(PAGES), have = JSON.parse(read('contracts/art/fonts/letters.json'));
for (const [k, text] of Object.entries(need)) for (const ch of text) if (!have[k]?.includes(ch)) throw new Error(`${FAMILY[k][0]} on file has no "${ch}". Run: npm run fonts`);
const fonts = `const FONTS=${JSON.stringify(Object.fromEntries(Object.keys(need).map((k) => [k, [FAMILY[k][0], FAMILY[k][2], readFileSync(`${root}contracts/art/fonts/${k}.woff2`).toString('base64')]])))};`;
// P is set by the contract to the page's name. the page's own two faces are made ready first, then it is drawn and set going
const run = "(async()=>{const g=DFDATA.PAGES[P];await Promise.all([g.face||'g','d'].map(k=>new FontFace(FONTS[k][0],'url(data:font/woff2;base64,'+FONTS[k][2]+')',{weight:FONTS[k][1]}).load().then(f=>document.fonts.add(f)))).catch(()=>{});const s=DF.mount(document.getElementById('c'),{...g,w:DFDATA.PW,h:DFDATA.PH},DFDATA.pal(g));let t=0;setInterval(()=>s(++t),220)})()";
const min = async (s) => (await transform(s, { minify: true, target: 'es2020' })).code;

// the plates that tell a reader who they are belong to the site: no token shows one
const engine = read('src/engine.js').replace(/  \/\/ <<who\n[\s\S]*?  \/\/ who>>\n/, '');

const cut = (bytes) => { const out = []; for (let i = 0; i < bytes.length; i += CHUNK) out.push(bytes.subarray(i, i + CHUNK)); return out; };
// a store as the contract wants it: two bytes saying how many pages, three a page saying where its part ends, then the parts, in page order
function table(parts) {
  const head = Buffer.alloc(2 + parts.length * 3);
  head.writeUInt16BE(parts.length, 0);
  parts.reduce((end, f, i) => { head.writeUIntBE(end + f.length, 2 + i * 3, 3); return end + f.length; }, head.length);
  return Buffer.concat([head, ...parts]);
}
// the stills. they must be stills of this very art
function stills(list, gz) {
  const dir = root + 'contracts/art/covers/', made = existsSync(dir + 'made.json') && JSON.parse(readFileSync(dir + 'made.json', 'utf8')).art;
  if (made !== createHash('sha256').update(gz).digest('hex')) throw new Error(made ? 'The stills are of an older build of the art. Run: npm run covers' : 'There are no stills yet. Run: npm run covers');
  return table(list.map((k) => readFileSync(`${dir}${k}.png`)));
}
// each page's name and traits, split by "|" as the contract wants them (its _fields): key, name, chapter, setting, kind, disposition, panels, choices.
// the chapter is the row of the book the page is written in, between pages.js's `// ---` lines
const SETTING = { town: 'Town', lamp: 'Lamplight', kitchen: 'Kitchen', shore: 'Shore', woods: 'Woods', cellar: 'Cellar', works: 'Works', deep: 'Deep', graves: 'Graves' };
const CHAPTERS = ['Nine Lit', 'Eight Lit', 'Seven Lit', 'Six Lit', 'Five Lit', 'The End'], rows = [...pages.matchAll(/^ {4}\/\/ --- /gm)].map((m) => m.index);
const DISPOSITION = Object.fromEntries(Object.values(ENTRIES).map((e) => [e.start, e.name]));
if (rows.length !== CHAPTERS.length) throw new Error('src/pages.js has changed its rows; scripts/pack.mjs needs new chapter names');
function meta(k) {
  const p = PAGES[k], at = pages.indexOf(`\n    ${k}: {`), who = DISPOSITION[k];
  const f = [k, p.title, CHAPTERS[rows.filter((r) => r < at).length - 1], SETTING[p.world], who ? 'Start' : p.end ? 'Ending' : p.back ? 'Return' : 'Crossroads', who || '', p.panels.length, p.end ? 0 : p.ch.length];
  // they go into JSON, a data: URI and a script as they are: no quotes, backslashes, # or %, | or control characters; the key plain, the counts whole numbers
  if (at < 0 || !/^[a-z0-9]+$/.test(k) || !Number.isInteger(f[6]) || !Number.isInteger(f[7]) || f.some((x) => x === undefined || /["\\#%|\x00-\x1f]/.test(x))) throw new Error(`scripts/pack.mjs cannot write the traits of page "${k}"`);
  return Buffer.from(f.join('|'));
}

// covers: false = leave the stills out of it (they are made from the pack, so the pack must be had without them first)
export async function pack({ covers = true } = {}) {
  const lib = (await min(engine)) + (await min(data)) + fonts, js = lib + run, gz = gzipSync(js, { level: 9 }), chunks = cut(gz);
  mkdirSync(root + 'contracts/art', { recursive: true });
  writeFileSync(root + 'contracts/art/art.gz', gz);
  const list = Object.keys(PAGES), blob = covers ? stills(list, gz) : Buffer.alloc(0), metas = table(list.map(meta));
  return { js, lib, gz, chunks, pages: list, covers: { blob, chunks: cut(blob) }, metas: { blob: metas, chunks: cut(metas) } };   // the three stores, in the contract's order: chunks, covers, metas
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { js, gz, chunks, pages: list, covers, metas } = await pack();
  const gas = (bytes, pieces) => `about ${Math.round((bytes * 216 + pieces * 90000) / 1e5) / 10}M gas to store`;
  console.log(`${list.length} pages · ${js.length} bytes minified · ${gz.length} bytes gzipped · ${chunks.length} chunk${chunks.length > 1 ? 's' : ''} · ${gas(gz.length, chunks.length)}`);
  for (const [what, s] of [['stills', covers], ['names and traits', metas]]) console.log(`${what} · ${s.blob.length} bytes · ${s.chunks.length} chunk${s.chunks.length > 1 ? 's' : ''} · ${gas(s.blob.length, s.chunks.length)}`);
}
