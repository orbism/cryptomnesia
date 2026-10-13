import { useEffect, useRef } from 'react';
import { DF } from './lib.js';

export const still = matchMedia('(prefers-reduced-motion: reduce)');

// --- page turns: the old plate goes, fast, and the new one comes up out of the same dark. each world has its own way of going
const OUT = 340, IN = 480;
const FX = { shore: 'drip', graves: 'drip', woods: 'burn', kitchen: 'blinds', lamp: 'iris', town: 'shred', cellar: 'fizz', deep: 'fizz' };
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rnd = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const soft = (x, y) => {                                  // lumpy noise, for things that burn away
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (rnd(xi, yi) * (1 - u) + rnd(xi + 1, yi) * u) * (1 - v) + (rnd(xi, yi + 1) * (1 - u) + rnd(xi + 1, yi + 1) * u) * v;
};
const abgr = (hex) => (0xff000000 | (parseInt(hex.slice(5, 7), 16) << 16) | (parseInt(hex.slice(3, 5), 16) << 8) | parseInt(hex.slice(1, 3), 16)) >>> 0;
// what is left of a plate when t of it has gone (0 = all there, 1 = none). where it has gone the page shows through; edge is the colour things burn at
function gone(src, out, w, h, t, fx, edge) {
  const ground = 0;
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
    let q = p;
    if (fx === 'drip') { const k = Math.max(0, (t * 1.5 - rnd(x >> 1) * 0.5)), sy = y - Math.floor(k * k * h); q = sy < 0 ? -1 : sy * w + x; }   // each column lets go in its own time and runs
    else if (fx === 'shred') { const b = Math.floor(y / 6), sx = x - Math.floor(t * t * w * (0.6 + 0.8 * rnd(b))) * (b & 1 ? 1 : -1); q = sx < 0 || sx >= w ? -1 : y * w + sx; }   // strips pulled out sideways
    else if (fx === 'blinds') q = (y % 12) / 12 < t ? -1 : p;
    else if (fx === 'fizz') q = rnd(x >> 2, y >> 2) < t ? -1 : p;
    else if (fx === 'iris') q = Math.hypot((x / w) * 2 - 1, (y / h) * 2 - 1) / 1.42 + (B4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.3 > 1.15 - t * 1.3 ? -1 : p;   // the dark comes in from the edges
    else if (fx === 'burn') { const n = soft(x / 22, y / 22) * 0.7 + soft(x / 6, y / 6) * 0.3 - t * 1.25 + 0.12; out[p] = n < 0 ? ground : n < 0.035 ? edge : src[p]; continue; }
    else q = (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < t ? -1 : p;                                                                  // dissolve
    out[p] = q < 0 ? ground : src[q];
  }
}
let last = null;                                         // the plate that was up before this one: { px, w, h, fx, edge }

// one page (or one scene) drawn by the engine, its moving panels stepped every 220 ms
// plain = put up as it is: no turn into it, and nothing later turns out of it
export default function Plate({ page, colors, small, plain }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, fx = page.end ? 'burn' : FX[page.world] || 'dissolve', edge = abgr(colors[2]);
    let timer, raf, dead = false;
    DF.fontsReady().then(() => {
      if (dead) return;
      const step = DF.mount(cv, page, colors), g = cv.getContext('2d'), { w, h } = page;
      const run = () => { let tick = 0; if (!still.matches) timer = setInterval(() => step(++tick), 220); };
      if (plain || still.matches) return run();
      const next = g.getImageData(0, 0, w, h), px = new Uint32Array(next.data.buffer.slice(0)), buf = g.createImageData(w, h), out = new Uint32Array(buf.data.buffer);
      const old = last && last.w === w && last.h === h ? last : null, t0 = performance.now(), lead = old ? OUT : 0;
      const frame = (now) => {
        if (dead) return;
        const e = Math.max(0, now - t0);                   // a frame's clock can read a hair earlier than ours
        if (e >= lead + IN) { g.putImageData(next, 0, 0); return run(); }
        if (e < lead) { const t = e / lead; gone(old.px, out, w, h, t * t, old.fx, old.edge); }               // going: slow, then all at once
        else { const t = 1 - (e - lead) / IN; gone(px, out, w, h, t * t, fx, edge); }                              // coming: quick, then settling
        g.putImageData(buf, 0, 0);
        raf = requestAnimationFrame(frame);
      };
      frame(t0);
    });
    return () => {
      dead = true; clearInterval(timer); cancelAnimationFrame(raf);
      if (!plain) try { last = { px: new Uint32Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer), w: cv.width, h: cv.height, fx, edge }; } catch { last = null; }
    };
  }, [page, colors, plain]);
  return <canvas ref={ref} className={small ? 'plate small' : 'plate'} width={page.w} height={page.h} style={{ '--ar': page.w / page.h }} />;
}
