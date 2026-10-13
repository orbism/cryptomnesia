import { DF } from './lib.js';

// a page as a looping GIF, twice the size, every pixel a hard square. the page is drawn afresh off screen and stepped through one whole turn of its moving panels;
// after the first, each frame holds only the rectangle that changed. a page has a handful of colours, so the encoder here is all it takes
const SCALE = 2, MOST = 120, gcd = (a, b) => (b ? gcd(b, a % b) : a);
const word = (n) => [n & 255, n >> 8];

// the indices of one frame, packed the way a GIF wants them. min = bits a pixel
function lzw(px, min) {
  const out = [], clear = 1 << min;
  let size = min + 1, next = clear + 2, cur = 0, bits = 0, dict = new Map(), p = px[0];
  const emit = (c) => { cur |= c << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(clear);
  for (let i = 1; i < px.length; i++) {
    const key = (p << 8) | px[i], c = dict.get(key);
    if (c !== undefined) { p = c; continue; }
    emit(p); p = px[i];
    if (next === 4096) { emit(clear); next = clear + 2; size = min + 1; dict = new Map(); } else { if (next >= 1 << size) size++; dict.set(key, next++); }
  }
  emit(p); emit(clear + 1); if (bits) out.push(cur & 255);
  return out;
}

export async function gif(page, colors) {
  await DF.fontsReady();
  const cv = document.createElement('canvas'), step = DF.mount(cv, page, colors), g = cv.getContext('2d', { willReadFrequently: true }), { w, h } = page;
  const turn = Math.min(MOST, page.panels.filter((p) => p.live).reduce((n, p) => { const l = DF.seq(p.s).length; return (n * l) / gcd(n, l); }, 1));
  const seen = new Map(), table = [], frames = [];
  for (let t = 0; t < turn; t++) {
    if (t) step(t);
    const d = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer), ix = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i++) { let k = seen.get(d[i]); if (k === undefined) { k = Math.min(255, table.length); seen.set(d[i], k); if (table.length < 256) table.push(d[i]); } ix[i] = k; }
    frames.push(ix);
  }
  const bits = Math.max(2, Math.ceil(Math.log2(table.length))), out = [...'GIF89a'].map((c) => c.charCodeAt(0));
  out.push(...word(w * SCALE), ...word(h * SCALE), 0xf0 | (bits - 1), 0, 0);
  for (let i = 0; i < 1 << bits; i++) { const c = table[i] || 0; out.push(c & 255, (c >> 8) & 255, (c >> 16) & 255); }
  out.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);                    // round and round, for good
  frames.forEach((ix, f) => {
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    if (f) {                                                                                                  // only the part that is not what it was
      const was = frames[f - 1];
      x0 = w; y0 = h; x1 = y1 = -1;
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) if (ix[i] !== was[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) x0 = y0 = x1 = y1 = 0;                                                                      // nothing moved: one pixel, to keep the time
    }
    const fw = (x1 - x0 + 1) * SCALE, fh = (y1 - y0 + 1) * SCALE, px = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) px[y * fw + x] = ix[(y0 + ((y / SCALE) | 0)) * w + x0 + ((x / SCALE) | 0)];
    out.push(0x21, 0xf9, 4, 4, ...word(22), 0, 0, 0x2c, ...word(x0 * SCALE), ...word(y0 * SCALE), ...word(fw), ...word(fh), 0, bits);   // 22 hundredths: the pace the page keeps on the site
    for (let d = lzw(px, bits), i = 0; i < d.length; i += 255) { const n = Math.min(255, d.length - i); out.push(n, ...d.slice(i, i + n)); }
    out.push(0);
  });
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
