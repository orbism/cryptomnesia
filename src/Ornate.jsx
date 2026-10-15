import { useEffect, useRef } from 'react';
import { still } from './Plate.jsx';

// the ornate frame, one design all the way round, drawn a pixel at a time the way the plates are: unbroken lines over a mist of scanlines that thins to scattered dots.
// one gold line runs right round. at each corner it does not turn: it runs on past the line it meets and winds in on itself, square, the two of them woven through each other, to a boss with a stone in it.
// a vine goes in and out across that line from each corner to the middle of each side, throwing a curl at every turn, big ones in the corners, and at the middles the line runs through a star.
// the biggest has no vine. it is ruled instead: a comb off the line and lines inside it that crowd toward the corners and step across them, with a fan of rays over the steps.
// the mist lies thickest on the line and in the corners, and lets a little of itself fall over what the frame holds.
// it sits still until it has somebody's attention. then light runs round the line, always the one way, the vines and the ruled work undraw and draw themselves again, each length in its own time, the mist slides along its rows, the stones shift colour,
// and when the attention goes it all eases round to where it started
const TICK = 70, TAU = Math.PI * 2, PER = 64;
const GOLD = [112, 90, 58], LIT = [172, 144, 96], MIST = [32, 56, 54], VINE = [38, 86, 82], HUES = [[124, 36, 40], [42, 90, 86], [124, 76, 34], [78, 66, 118]];
const LINE = [0, 2, 1, 3], scan = (x, y) => (LINE[y & 3] * 4 + LINE[x & 3] + 0.5) / 16, hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
// how much frame each size of thing gets, least first; the fourth is the one a page's title wears, slighter than the least, tighter wound, and with a star at the middle of each side; the fifth, the barest, is for a tab. b = the room it is given, a = how far in the line runs, g = the step from one winding to the next, R = how big the corner winding is, clear = the room left at its heart,
// hw = how far the mist reaches off the line; then the vine: amp = how far it swings, curl = how big its curls, per = how long one swing; star = how big the stars at the middles are. deco = no vine but that many ruled lines, in its place.
// k = where the heart of a corner lies, in from both edges
export const LEVELS = [{ b: 16, g: 3, a: 9, R: 11, clear: 5, hw: 5 }, { b: 24, g: 3, a: 11, R: 16, clear: 6, hw: 9, amp: 2, curl: 4, per: 28, star: 6 }, { b: 48, g: 3, a: 18, R: 27, clear: 12, hw: 18, deco: 6, star: 12 }, { b: 12, g: 2, a: 7, R: 7, clear: 3, hw: 4, star: 4 }, { b: 8, g: 2, a: 4, R: 4, clear: 2, hw: 2 }];
for (const L of LEVELS) L.k = L.a + L.R - L.g;

// the frame for a box w by h: the mist as a list of pixels (where, how thick, where on its row's slide, what it takes to light it) and the line work as another (where, what, how far along, whose).
// it is drawn once for the top left quarter, along the top and down the side, and laid out four ways
function build(w, h, { g, a, R, clear, hw, amp, curl, per, star, deco, k }) {
  const n = w * h, cls = new Uint8Array(n), par = new Float32Array(n), who = new Uint16Array(n), reach = [0, 0], o = k + R + 3;
  let gid = 2;                                                                                                // every length of line that draws and undraws on its own has a number (who / 4), and reach is how long each is
  // what: 1 the line, 3 a stone, 5 something that draws and undraws (vine, or the ruled work), 6 a star. how far along runs the same way round the whole frame, so a quarter laid out backwards counts backwards
  const put = (x, y, c, p, f) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x > w >> 1 || y > h >> 1) return;
    for (let i = 0; i < 4; i++) { const q = (i & 2 ? h - 1 - y : y) * w + (i & 1 ? w - 1 - x : x); cls[q] = c; par[q] = i === 1 || i === 2 ? -p : p; who[q] = f + i; }
  };
  for (let T = 0; T < 2; T++) {                                                                               // T = 0 along the top, 1 down the side: the same thing turned over the corner
    const half = (T ? h : w) >> 1, pt = (u, v, c, p, f = 0) => (T ? put(v, u, c, -p, f) : put(u, v, c, p, f));
    const eight = (cu, cv, r) => {                                                                            // a star of eight points: a square and a square on its point
      const d = Math.round(r * 1.3);
      for (let i = -d; i <= d; i++) { pt(cu + i, cv - d + Math.abs(i), 6, 0); pt(cu + i, cv + d - Math.abs(i), 6, 0); if (Math.abs(i) <= r) for (const e of [-r, r]) { pt(cu + i, cv + e, 6, 0); pt(cu + e, cv + i, 6, 0); } }
      for (let i = -2; i <= 2; i++) for (let j = Math.abs(i) - 2; j <= 2 - Math.abs(i); j++) pt(cu + i, cv + j, 3, 0, 4 + T);
    };
    // the line: in from the middle of the side, past the corner, and round and round to the heart. each of its windings lies midway between two of the other side's, so the two only ever cross, and every side of the knot is evenly ruled
    const xs = [half], ys = [a], run = [];
    for (let i = 1, r; (r = R - 2 * g * ((i - 1) >> 2) - [0, 0, g, 3 * g][(i - 1) & 3]) >= clear; i++) { xs.push(i & 1 ? k + (i % 4 === 1 ? -r : r) : xs[i - 1]); ys.push(i & 1 ? ys[i - 1] : k + (i % 4 === 2 ? r : -r)); }
    for (let i = 1; i < xs.length; i++) for (let x = xs[i - 1], y = ys[i - 1]; x !== xs[i] || y !== ys[i]; x += Math.sign(xs[i] - x), y += Math.sign(ys[i] - y)) run.push(x, y);
    for (let i = 0; i < run.length; i += 2) pt(run[i], run[i + 1], 1, (run.length - i) / 2);
    if (curl) {
      const u0 = k + R + 4, u1 = half - (star * 1.3 + 4), turns = 1.6 * TAU;
      let p = 0, pv = a;
      for (let u = u0; u <= u1; u += 0.5) { const v = a + amp * Math.sin(((u - u0) / per) * TAU); p += Math.hypot(0.5, v - pv); pv = v; pt(u, v, 5, p, 4 * T); }
      reach[T] = p + curl * 6;
      for (let j = 0, ue; (ue = u0 + per * (0.25 + j / 2)) < u1 - curl; j++) {                                 // a curl off each turn of it: in, then out, the first one in the biggest
        const sg = j & 1 ? -1 : 1, r0 = curl * (sg < 0 ? 0.7 : j ? 1 : 1.9), cv = a + sg * (amp + r0), p0 = (ue - u0) * 1.05;
        for (let th = 0; th < turns; th += 0.03) { const r = r0 * (1 - (0.8 * th) / turns); pt(ue + r * Math.sin(th), cv - sg * r * Math.cos(th), th > turns - 0.6 ? 3 : 5, p0 + th * r0 * 0.6, th > turns - 0.6 ? j : 4 * T); }
      }
    }
    if (deco) {
      const end = half - star * 1.3 - 6;
      // ruled lines inside the line, more of them the nearer the corner: each sets out from a stone part way along the wall, runs to the corner, and there steps down across it to meet its other half, the next one always further in.
      // so the inside of the frame is cut off at the corners in steps, deeper and deeper
      for (let j = 1; j <= deco; j++) {
        const v0 = a + 5 * j, t = 2 * (o + 1 + 4 * j) - v0, far = Math.min(end, t + ((half - t - 30) * (deco - j + 1)) / (deco + 1)) | 0, line = [];
        for (let u = far; u > t; u--) line.push(u, v0);
        for (let u = t, v = v0; u > v;) { for (let s = 0; s < 3 && u > v; s++) line.push(u--, v); for (let s = 0; s < 3 && u > v; s++) line.push(u, v++); }
        for (let i = 0; i < line.length; i += 2) pt(line[i], line[i + 1], 5, (line.length - i) / 2, 4 * gid);
        reach[gid++] = line.length / 2;
        for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) pt(far + 3 + x, v0 + y, 3, 0, j);
      }
      for (const d of [0, 10, 20, 30]) {                                                                      // rays out of the corner across the steps, a fan
        const m = o + 1 + 4 * deco, len = m + d - o;
        for (let i = 0; i <= len; i++) pt(o + i, o + ((m - d - o) * i) / len, 5, i, 4 * gid);
        reach[gid++] = len;
      }
      for (let u = o + 2; u < end; u += 4) for (let i = 2, len = 13 * Math.max(0, 1 - (u - o) / (half * 0.55)) ** 1.5; i < len + 2; i++) pt(u, a - i, 5, u - o + i, 4 * gid);   // a comb standing out from the line, long teeth at the corner, none by the middle
      reach[gid++] = half;
    }
    if (star) { eight(half, a, star); if (T && star > 8) eight(half - star * 3, a, star - 3); }
  }
  if (clear > 8) for (let i = -clear + 2; i <= clear - 2; i++) for (const [x, y] of [[i, Math.abs(i) - clear + 2], [i, clear - 2 - Math.abs(i)]]) put(k + x, k + y, 6, 0, 0);   // the boss: a lozenge
  for (let i = -2; i <= 2; i++) for (let j = Math.abs(i) - 2; j <= 2 - Math.abs(i); j++) put(k + i, k + j, 3, 0, 0);
  const hi = [], hb = [], hp = [], ht = [], li = [];
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
    if (cls[p]) { li.push(p); continue; }
    if (cls[p - 1] || cls[p + 1] || cls[p - w] || cls[p + w]) continue;                                       // the mist stands a pixel off the lines
    const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
    const v = Math.max(0.75 * Math.max(0, 1 - Math.abs(Math.min(dx, dy) - a) / hw) ** 1.4, 0.95 * Math.max(0, 1 - Math.hypot(dx - k, dy - k) / (R * 1.6)) ** 1.2, deco && Math.min(dx, dy) > a ? 0.6 * Math.min(1, Math.max(0, 1 - (dx + dy - 2 * o) / (8 * deco + 30))) : 0);
    if (v > 0.03) { hi.push(p); hb.push(v); hp.push(hash(y >> 1) * TAU + x * 0.09); ht.push(scan(x, y)); }
  }
  return { hi, hb, hp, ht, li, lc: li.map((p) => cls[p]), lp: li.map((p) => par[p]), lf: li.map((p) => who[p]), reach };
}
// one frame of it into px (four bytes a pixel, w across). ang = how far round things have gone, heat = how stirred they are
function draw(px, { hi, hb, hp, ht, li, lc, lp, lf, reach }, ang, heat) {
  const ink = (p, A, B, f) => { const q = p * 4; px[q] = A[0] + (B[0] - A[0]) * f; px[q + 1] = A[1] + (B[1] - A[1]) * f; px[q + 2] = A[2] + (B[2] - A[2]) * f; px[q + 3] = 255; };
  const beat = (p, at) => Math.max(0, 1 - Math.abs(((((p - at) % PER) + PER) % PER) - 8) / 8), at = (ang / TAU) * PER * 4, swell = 0.2 + 0.1 * heat;
  for (let i = 0; i < hi.length; i++) if (hb[i] * (0.8 + swell * Math.sin(hp[i] + ang * 3)) > ht[i]) ink(hi[i], MIST, MIST, 0);
  for (let i = 0; i < li.length; i++) {
    const c = lc[i], p = lp[i], f = lf[i];
    if (c === 3) ink(li[i], HUES[f & 3], HUES[(f + 1) & 3], heat * Math.sin(ang * 0.5 + f) ** 2);
    else if (c !== 5) ink(li[i], GOLD, LIT, 0.6 * heat * beat(p, at));
    else if (Math.abs(p) < reach[f >> 2] * (1 - 0.3 * heat * (0.5 + 0.5 * Math.sin(ang * 2 + f)))) ink(li[i], VINE, LIT, 0.3 * heat * beat(-p, at / 2));
  }
}

// level = how much frame, 1 to 3, or 4 for a title, 5 for a tab (LEVELS). live = the attention it has with nobody on it (a thing brought up over the page has some just by being there)
export default function Ornate({ as: Tag = 'div', level = 1, live = 0, className = '', children, ...rest }) {
  const box = useRef(null), cv = useRef(null);
  useEffect(() => {
    const el = box.current, c = cv.current, g = c.getContext('2d');
    let w = 0, h = 0, img, S, heat = 0, ang = 0, vel = 0, home = 0, want = still.matches ? 0 : live, timer = 0;
    const paint = () => { img.data.fill(0); draw(img.data, S, ang, heat); g.putImageData(img, 0, 0); };
    const tick = () => {
      if (want) { heat += (want - heat) * 0.06; vel += (0.07 * want - vel) * 0.04; home = 0; }                 // winding up, and settling into its turn
      else {                                                                                                  // easing on round to the next whole turn, which is where it started
        home ||= Math.round(ang / TAU) * TAU || TAU; vel = Math.max(-0.09, Math.min(0.09, (home - ang) * 0.07)); heat *= 0.97;
        if (Math.abs(home - ang) < 0.02) { ang = vel = heat = home = 0; clearInterval(timer); timer = 0; }
      }
      ang += vel; paint();
    };
    const set = (to) => { if (still.matches) return; want = to; if (to && !timer) timer = setInterval(tick, TICK); };
    const size = () => {
      const nw = el.offsetWidth, nh = el.offsetHeight;
      if (nw === w && nh === h) return;
      c.width = w = nw; c.height = h = nh; S = build(w, h, LEVELS[level - 1]); img = g.createImageData(w, h);
      paint(); set(want);
    };
    const ro = new ResizeObserver(size), up = () => set(1), down = () => set(live);
    ro.observe(el);
    for (const e of ['pointerenter', 'focus']) el.addEventListener(e, up);
    for (const e of ['pointerleave', 'blur']) el.addEventListener(e, down);
    return () => { ro.disconnect(); clearInterval(timer); for (const e of ['pointerenter', 'focus']) el.removeEventListener(e, up); for (const e of ['pointerleave', 'blur']) el.removeEventListener(e, down); };
  }, [level, live]);
  return <Tag ref={box} className={`ornate ${className}`} style={{ '--b': `${LEVELS[level - 1].b}px` }} {...rest}><canvas ref={cv} className="orn" aria-hidden="true" />{children}</Tag>;
}
