// Packs what goes on chain: the drawing engine, the page recipes and a few lines that start it, minified and gzipped.
// Writes contracts/art/art.gz and pages.json, and says what storing it will cost in gas.
import { transform } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname, read = (f) => readFileSync(root + f, 'utf8');
export const CHUNK = 24575;                               // a contract's code may be 24576 bytes; one is the STOP in front
// the token page needs the pictures, not the story: drop the telling, the choices and the opening questions before packing
const { PAGES } = createRequire(import.meta.url)(root + 'src/pages.js');
const lean = Object.fromEntries(Object.entries(PAGES).map(([k, { cap, ch, again, kind, back, ...p }]) => [k, p]));
const pages = read('src/pages.js');
const a = pages.indexOf('  const PAGES = {'), b = pages.indexOf('  for (const pg of Object.values(PAGES))'), c = pages.indexOf('  // every walk from each way in'), d = pages.indexOf('  // the four colours for a page');
if ([a, b, c, d].some((i) => i < 0)) throw new Error('src/pages.js has changed shape; scripts/pack.mjs needs to be told where things are');
const data = pages.slice(0, a) + `  const PAGES = ${JSON.stringify(lean)};\n` + pages.slice(d).replace('const DATA = { WORLDS, HOME, TINT, PAGES, QUIZ, ENTRIES, PW, PH, pal, walks, repeats };', 'const DATA = { PAGES, PW, PH, pal };');
// P is set by the contract to the page's name
const run = "(()=>{const g=DFDATA.PAGES[P],s=DF.mount(document.getElementById('c'),{...g,w:DFDATA.PW,h:DFDATA.PH},DFDATA.pal(g));let t=0;setInterval(()=>s(++t),220)})()";
const min = async (s) => (await transform(s, { minify: true, target: 'es2020' })).code;

export async function pack() {
  const js = (await min(read('src/engine.js'))) + (await min(data)) + run, gz = gzipSync(js, { level: 9 });
  const chunks = [];
  for (let i = 0; i < gz.length; i += CHUNK) chunks.push(gz.subarray(i, i + CHUNK));
  mkdirSync(root + 'contracts/art', { recursive: true });
  writeFileSync(root + 'contracts/art/art.gz', gz);
  writeFileSync(root + 'contracts/art/pages.json', JSON.stringify(Object.keys(PAGES)));
  return { js, gz, chunks, pages: Object.keys(PAGES) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { js, gz, chunks, pages: list } = await pack();
  console.log(`${list.length} pages · ${js.length} bytes minified · ${gz.length} bytes gzipped · ${chunks.length} chunk${chunks.length > 1 ? 's' : ''}`);
  console.log(`about ${Math.round((gz.length * 216 + chunks.length * 90000) / 1e5) / 10}M gas to store`);
}
