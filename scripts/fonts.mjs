// The four faces the words in the pictures are set in, cut down to just the letters those words use, for keeping on chain with the art.
// Fetches them from Google Fonts into contracts/art/fonts, with a note of which letters each holds. Run again whenever the words in the pictures change:
//   npm run fonts
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
// by the code a page uses (src/engine.js FACES): the family's name, how Google is asked for it, its weight
export const FAMILY = { g: ['Grenze Gotisch', 'Grenze+Gotisch:wght@600', '600'], m: ['MedievalSharp', 'MedievalSharp', '400'], p: ['Pirata One', 'Pirata+One', '400'], d: ['DotGothic16', 'DotGothic16', '400'] };
// the letters each face is asked for, over every page: a page's display words are in its own face, and the small line under them is always d
export function letters(PAGES) {
  const by = {};
  for (const p of Object.values(PAGES)) for (const t of p.text || []) { const k = t.f === 'd' ? 'd' : p.face || 'g'; by[k] = [...new Set((by[k] || '') + t.t)].sort().join(''); }
  return by;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const need = letters(createRequire(import.meta.url)(root + 'src/pages.js').PAGES), UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };   // asked as a browser, or it sends the old big format
  mkdirSync(root + 'contracts/art/fonts', { recursive: true });
  for (const [k, text] of Object.entries(need)) {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${FAMILY[k][1]}&text=${encodeURIComponent(text)}`, { headers: UA })).text(), url = css.match(/url\((https:[^)]+\.woff2?[^)]*)\)/)?.[1] || css.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) throw new Error(`Google Fonts had nothing for ${FAMILY[k][0]}`);
    const bytes = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer());
    writeFileSync(`${root}contracts/art/fonts/${k}.woff2`, bytes);
    console.log(`${FAMILY[k][0]} · ${[...text].length} letters · ${bytes.length} bytes`);
  }
  writeFileSync(root + 'contracts/art/fonts/letters.json', JSON.stringify(need, null, 1));
}
