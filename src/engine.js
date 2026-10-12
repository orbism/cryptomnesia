// Dither-plate scene engine: each scene is a shader (u,v,frame) -> [ink, accent1, accent2, material],
// quantized to a 1-bit plate plus accent splashes. material 1 = soft stuff (sky, fog, water) that the
// 'mix' style draws in scanlines while solids stay ordered-dither. Resolution independent.
(function () {
  const { floor, abs, exp, sin, cos, hypot, max, min, PI } = Math;
  const cl = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x); };
  const fr = (x) => x - floor(x);
  const hash = (x, y) => fr(sin(x * 127.1 + y * 311.7) * 43758.5453);
  const vn = (x, y) => {
    const xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const fbm = (x, y) => vn(x, y) * 0.5 + vn(x * 2.03 + 7, y * 2.03 + 3) * 0.3 + vn(x * 4.1 + 1, y * 4.1 + 9) * 0.2;
  const inBox = (u, v, x0, y0, x1, y1) => u >= x0 && u < x1 && v >= y0 && v < y1;
  const dBox = (u, v, cx, cy, hw, hh) => hypot(max(abs(u - cx) - hw, 0), max(abs(v - cy) - hh, 0));
  const dSeg = (u, v, ax, ay, bx, by) => {
    const px = u - ax, py = v - ay, dx = bx - ax, dy = by - ay;
    const t = cl((px * dx + py * dy) / (dx * dx + dy * dy));
    return hypot(px - dx * t, py - dy * t);
  };

  const S = {};

  // --- town: Marrow Street down its length. every house dark but one. four lamps. in one frame someone is at the window
  S.town = (u, v, f, o) => {
    const fl = [1, 0.75, 1, 0.5][f], vx = 0.38, hz = 0.5, side = u > vx ? 1 : -1, Z = (side > 0 ? 0.9 : 0.7) / max(abs(u - vx), 1e-3), Y = (v - hz) * Z, n = Z / 0.9 + (side > 0 ? 0.3 : 0.7), id = floor(n), c = fr(n);
    let L = 0.08 + 0.36 * ss(0.05, 0.6, v) + 0.2 * ss(0.5, 0.8, fbm(u * 3, v * 13)) * ss(0.55, 0.15, v), A = 0, B = 0, M = 1;
    if (v < 0.36 && hash(floor(u * 96), floor(v * 96)) > 0.993) L = 1;
    const sp = abs(u - vx - 0.012);
    if ((v > 0.33 && sp < (v - 0.33) * 0.12) || (sp < 0.003 && v > 0.3 && v < 0.5)) { L = 0; M = 0; }                                    // the steeple, at the far end
    if (Y > 0.16) {                                                                                                                // the road
      const z = 1 / (v - hz), cob = hash(floor((u - vx) * z * 7), floor(z * 2.5));
      M = 0; L = 0.03 + 0.26 * cob * ss(0, 0.3, v - hz);
      if (abs((v - hz) / (u - vx) - 0.2286) < 0.008 || abs((v - hz) / (vx - u) - 0.32) < 0.011) L = 0.6;                                // kerbs
    } else if (Y > -(0.33 + 0.16 * (1 - abs(c - 0.5) * 2) + 0.05 * hash(id, side)) && Z < 14) {                                         // the terraces, gable after gable
      const fog = cl(Z / 12), row = Y > -0.27 && Y < -0.15 ? 1 : Y > -0.07 && Y < 0.07 ? 2 : 0, col = abs(c - 0.27) < 0.12 ? 1 : abs(c - 0.73) < 0.12 ? 2 : 0, cc = col === 1 ? c - 0.27 : c - 0.73;
      M = 0; L = Y < -0.33 ? (fr(Y * 40) < 0.45 ? 0.42 : 0.14) : fr(Y * 30) < 0.3 ? 0.3 : 0.09;
      if (abs(Y + 0.33) < 0.01 || c < 0.03) L = c < 0.03 ? 0 : 0.8;
      if (Y < -0.36 && hypot(c - 0.5, (Y + 0.4) * 1.2) < 0.035) L = 0.01;                                                            // attic eye
      if (row && col) {
        L = abs(cc) > 0.095 || (row === 1 && abs(cc) < 0.012) ? 0.85 : 0;
        if (side > 0 && id === 3 && row === 1 && col === 1 && abs(cc) <= 0.095) { L = 0; A = abs(cc) < 0.012 || abs(Y + 0.21) < 0.008 ? 0 : 1; if (f === 3 && (hypot(cc - 0.04, (Y + 0.225) * 1.1) < 0.028 || (abs(cc - 0.04) < 0.045 && Y > -0.2))) A = 0; }   // the one
        if (row === 2 && col === 2 && hash(id, 5) > 0.4) L = abs(cc) > 0.095 ? 0.85 : fr(Y * 9) < 0.1 ? 0.3 : 0.06;                      // a door
      }
      L += (0.2 - L) * fog * 0.8;
    }
    for (const z of [1.3, 2.2, 3.4, 5.5]) {                                                                                       // four lamps you can see
      const x = vx + 0.7 / z, base = hz + 0.16 / z, top = hz - 0.42 / z, d = hypot(u - x, v - top);
      if (abs(u - x) < 0.004 / z + 0.0012 && v > top && v < base) { L = 0; A = 0; M = 0; }
      if (d < 0.022 / z + 0.003) { L = 0; A = 0; B = 1; M = 0; } else B = max(B, 0.5 * exp(-d * 17 * z) + (Y > 0.16 ? 0.4 * exp(-hypot((u - x) * 0.6, v - base) * 22 * z) : 0));
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- shore: gold moon, gold road on the water, an empty boat sitting in it
  S.shore = (u, v, f, o) => {
    const hz = 0.56, mx = 0.66, my = 0.22, mr = 0.078;
    const dm = hypot(u - mx, v - my);
    let L, A = 0, B = 0, M = v >= hz;
    if (v < hz) {
      const c = fbm(u * 2.6 + 1, v * 15 + 3);
      M = c > 0.52;
      L = 0.05 + 0.13 * ss(0, hz, v) + 0.22 * exp(-dm * 5) + 0.2 * ss(0.5, 0.74, c);
      if (c < 0.48 && hash(floor(u * 100), floor(v * 100) + 7) > 0.994) L = 1;
      if (dm < mr) { A = fbm(u * 24, v * 24) > 0.6 ? 0.55 : 1; L = 0; if (c > 0.66 && abs(v - my) > 0.02) A = 0.35; }
      else A = 0.5 * exp(-(dm - mr) * 15);
      const hl = hz - 0.115 * ss(0.44, 0, u) - 0.03 * fbm(u * 9, 1) * ss(0.44, 0.2, u);
      if (u < 0.44 && v > hl) { L = 0; A = 0; }
      // the house across the bay
      const hy = hz - 0.118;
      if (inBox(u, v, 0.1, hy - 0.05, 0.17, hy + 0.03) || (abs(u - 0.135) < 0.045 && v > hy - 0.05 - (0.045 - abs(u - 0.135)) * 0.9 && v < hy - 0.04)) { L = 0; A = 0; }
      if (inBox(u, v, 0.142, hy - 0.03, 0.156, hy - 0.012)) B = [1, 1, 0.5, 1][f];
    } else {
      const d = (v - hz) / (1 - hz);
      const w = fbm(u * (13 - 8 * d) + f * 0.3, v * 80 * (1 - 0.45 * d));
      L = 0.03 + 0.5 * ss(0.48, 0.76, w) * (0.3 + d);
      const half = 0.022 + 0.085 * d, rx = abs(u - mx + 0.014 * sin(v * 58 + f * 1.57));
      if (rx < half) { const g = fbm(u * 26 + f * 0.9, v * 120); A = g > 0.36 + 0.2 * (rx / half) ? 1 : 0; if (A) L = 0; }
      if (v - hz < 0.006) L = 0.3;
      // boat
      const bx = 0.615, by = 0.742 + (f % 2) * 0.004, k = (u - bx) / 0.1;
      if (abs(k) < 1 && v > by - 0.006 - 0.012 * k * k * k * k && v < by + 0.03 * (1 - k * k)) { L = 0; A = 0; }
      if (abs(k) < 0.92 && abs(v - (by - 0.006 - 0.012 * k * k * k * k)) < 0.0035) { L = 1; A = 0; }
      // sand
      const sl = 0.93 - 0.17 * ss(0.62, 0, u) + 0.012 * sin(u * 23);
      if (v > sl) { A = 0; L = v - sl < 0.008 + 0.004 * (f % 2) ? 0.9 : 0.14 + 0.2 * hash(floor(u * 150), floor(v * 150)); }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- kitchen: moonlit floor, the stain in the light, a drag mark leading to the dark doorway
  S.kitchen = (u, v, f, o) => {
    const h = 0.57;
    let L, A = 0, B = 0;
    if (v < h) {
      L = 0.17 + 0.07 * fbm(u * 5, v * 5);
      if (v > 0.39) L = fr(u * 24) < 0.09 ? 0.04 : 0.13;
      if (abs(v - 0.39) < 0.006) L = 0.5;
      if (v > h - 0.02) L = 0.34;
      // window
      if (inBox(u, v, 0.15, 0.07, 0.43, 0.33)) {
        const ix = abs(u - 0.29), iy = abs(v - 0.2);
        L = ix > 0.128 || iy > 0.118 ? 0.42 : ix < 0.006 || iy < 0.006 ? 0.03 : 0.97;
        if (L > 0.9 && dSeg(u, v, 0.16, 0.13, 0.33, 0.1) < 0.004 + 0.003 * fbm(u * 40, 1)) L = 0.03; // branch outside
        if (L > 0.9 && dSeg(u, v, 0.26, 0.115, 0.31, 0.16 + 0.004 * (f % 2)) < 0.003) L = 0.03;
      }
      // curtains, drawn back and tied. the folds fan out from the tie
      const cu = 0.29 - abs(u - 0.29), ci = 0.185 - 0.07 * ss(0.05, 0.27, v) + 0.035 * ss(0.27, 0.42, v), cp = (cu - 0.07) / (ci - 0.07);
      if (cp > 0 && cp < 1 && v > 0.045 && v < 0.425 + 0.008 * sin(cp * 25)) {
        L = 0.3 + 0.28 * sin(cp * 15 + 1.5 * sin(v * 6 + f * 0.5)) + 0.3 * cp * cp;
        if (abs(v - 0.27) < 0.007) L = 0.75;
      }
      if (abs(v - 0.042) < 0.005 && abs(u - 0.29) < 0.25) L = 0.6;
      // doorway
      if (inBox(u, v, 0.7, 0.09, 0.93, h)) {
        L = u < 0.714 || u > 0.916 || v < 0.104 ? 0.44 : 0;
        if (f === 2 && (hypot(u - 0.795, v - 0.265) < 0.0065 || hypot(u - 0.83, v - 0.265) < 0.0065)) B = 1;
      }
      // pendant lamp
      const sw = 0.005 * [0, 1, 0, -1][f], lx = 0.585 + sw * (v / 0.3);
      if ((abs(u - lx) < 0.002 && v < 0.25) || (v >= 0.25 && v < 0.3 && abs(u - lx) < (v - 0.25) * 0.9 + 0.008)) L = v > 0.29 ? 0.7 : 0;
      // table against the wall under it: a cup, and a plate nobody cleared
      if (quad(u, v, 0.485, 0.44, 0.675, 0.44, 0.69, 0.485, 0.465, 0.485)) { const k = ss(0.1, 0.02, u - 0.465 + (0.485 - v) * 1.4); L = ell(u, v, 0.57, 0.463, 0.04, 0.012) < 1 ? 0.7 : 0.26 + 0.7 * k; }
      else if (inBox(u, v, 0.465, 0.485, 0.69, 0.515)) L = v < 0.49 ? (u < 0.55 ? 0.95 : 0.35) : u < 0.53 ? 0.3 : 0.05;
      if (inBox(u, v, 0.615, 0.41, 0.64, 0.45)) L = u < 0.62 ? 0.95 : 0.7;
    }
    if (v >= h) {
      const t = (v - h) / (1 - h), z = 1 / (v - h + 0.07);
      const chk = (floor((u - 0.5) * z * 1.7) + floor(z * 1.5)) & 1;
      const wu = (u - (0.17 + 0.2 * t)) / (0.27 + 0.2 * t), wv = (t - 0.1) / 0.66;
      const lit = wu > 0 && wu < 1 && wv > 0 && wv < 1 && abs(wu - 0.5) > 0.025 && abs(wv - 0.5) > 0.03;
      L = lit ? 0.42 + 0.45 * chk : 0.025 + 0.085 * chk;
      const n = fbm(u * 10, v * 10);
      const r = hypot((u - 0.47) / 0.12, (v - 0.81) / 0.05) + 0.5 * (n - 0.5);
      if (lit && dSeg(u, v, 0.48, 0.69, 0.585, 0.9) < 0.006 + 0.03 * (v - 0.69)) L = 0.03;                                         // the near leg's shadow, thrown away from the window
      // the drag: thin streaks, running out as they near the door
      const dt = cl(((u - 0.55) * 0.26 - (v - 0.8) * 0.22) / 0.116), dp = ((u - 0.55) * 0.22 + (v - 0.8) * 0.26) / 0.34, dw = 0.026 - 0.012 * dt;
      if (abs(dp) < dw && u > 0.5 && v > h + 0.004) A = (lit ? 1 : 0.62 - 0.45 * dt) * ss(1, 0.4, abs(dp) / dw) * (0.3 + 0.7 * ss(0.38, 0.62, fbm(dp * 260 + 5, dt * 5)));
      const edge = r - 0.92 - 0.035 * f;
      if (edge < 0.3) { A = max(A, (lit ? 1 : 0.55) * ss(0.3, -0.06, edge)); if (edge < 0) L = 0; }
      if (hypot(u - 0.3 - 0.02 * f, v - 0.9) < 0.006 && lit) A = 1; // a drop, further each frame
    }
    for (const lx of [0.472, 0.683]) if (abs(u - lx) < 0.006 && v > 0.515 && v < 0.69) { L = lx > 0.5 ? 0.12 : u < lx ? 0.95 : 0.02; A = 0; }             // table legs
    // a chair pulled out from it, turned half away
    let c = -1;
    if (dSeg(u, v, 0.86, 0.6, 0.86, 0.91) < 0.004 || dSeg(u, v, 0.955, 0.8, 0.955, 0.93) < 0.005) c = 0.3;
    for (const sy of [0.63, 0.685, 0.74]) if (quad(u, v, 0.8, sy, 0.86, sy - 0.014, 0.86, sy + 0.012, 0.8, sy + 0.026)) c = v - sy + (u - 0.8) * 0.23 < 0.006 ? 0.9 : 0.4;
    if (quad(u, v, 0.8, 0.8, 0.86, 0.785, 0.955, 0.8, 0.9, 0.82)) c = 0.7;
    if (dSeg(u, v, 0.8, 0.61, 0.8, 0.95) < 0.006 || dSeg(u, v, 0.9, 0.82, 0.9, 0.975) < 0.006) c = 0.9;
    if (c >= 0) { L = c; A = 0; B = 0; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = v < h && L < 0.22;
  };

  // --- woods: something too tall is holding a lantern
  const MID = [[0.09, 0.02], [0.27, 0.026], [0.43, 0.018], [0.75, 0.024], [0.89, 0.017]], NEAR = [[0.015, 0.05], [0.955, 0.06]];
  const trunk = (u, v, list, k) => {
    for (const t of list) {
      const d = (u - t[0] - 0.014 * (vn(v * 5 + t[0] * 40, k) - 0.5)) / (t[1] * (1 + 1.6 * ss(0.76, 1, v)));
      if (abs(d) < 1) return d;
    }
    return 2;
  };
  S.woods = (u, v, f, o) => {
    const lx = 0.6 + 0.004 * [0, 1, 2, 1][f], ly = 0.57, fl = [1, 0.85, 1, 0.9][f];
    const dl = hypot(u - lx, v - ly);
    let L = 0.16 + 0.14 * fbm(u * 3, v * 2.4) + 0.45 * exp(-dl * 3.2) - 0.16 * ss(0.45, 0.05, v);
    let A = dl < 0.013 ? 1 : fl * 0.75 * exp(-dl * 17), M = 1;
    const fx = u * 12, fc = floor(fx);
    if (abs(fr(fx) - 0.3 - 0.4 * hash(fc, 3)) < 0.06 + 0.05 * hash(fc, 8)) L *= 0.35; // far trunks, lost in fog
    // the bearer
    const hxo = f === 3 ? 0.008 : 0, bx = lx - 0.034;
    if (hypot(u - bx - hxo, v - (ly - 0.24)) < 0.017 || (abs(u - bx) < 0.02 && abs(v - ly + 0.2) < 0.012) || (abs(u - bx) < 0.011 + 0.006 * ss(ly - 0.2, ly + 0.26, v) && v > ly - 0.22 && v < ly + 0.3) || dSeg(u, v, bx, ly - 0.18, lx, ly - 0.014) < 0.0035) { L = 0; M = 0; A = dl < 0.013 ? 1 : 0; }
    const gy = 0.87 - 0.04 * fbm(u * 4, 5);
    if (v > gy) { M = 0; L = fbm(u * 60, v * 34) > 0.58 ? 0.3 : 0.02; A = 0.55 * exp(-hypot(u - lx, (v - gy) * 2.5) * 8) * fl; }
    for (const [list, k, bark] of [[MID, 4, 0.3], [NEAR, 7, 0.5]]) {
      const t = trunk(u, v, list, k);
      if (t === 2) continue;
      M = 0;
      L = fbm(u * 90, v * 6 + k) > 0.6 ? bark : 0;
      A = k === 4 && v < gy && t * (lx - u) > 0 && abs(t) > 0.7 ? fl * exp(-abs(v - ly) * 5 - abs(u - lx) * 5) : 0;
    }
    if (v < 0.15 + 0.13 * fbm(u * 5, 2)) { L = fbm(u * 44, v * 44) > 0.6 ? 0.3 : 0; A = 0; M = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- lamp: fog street, one lamp, a figure at the rim of its light. it does not move. now and then the lamp dips to a quarter and so does what it reaches
  S.lamp = (u, v, f, o) => {
    const vy = 0.46, fl = f === 1 ? 0.25 : 1, lx = 0.245, ly = 0.3, px = 0.2;
    const du = abs(u - 0.5), dvp = hypot(u - 0.5, v - vy);
    let L = 0.1 + 0.55 * exp(-dvp * 2.6), A = 0, M = 1;
    const lg = Math.log(du + 0.02) * 5 + (u < 0.5 ? 0.5 : 0), bi = floor(lg);
    const slope = 0.95 + 1.5 * hash(bi, u < 0.5 ? 1 : 2);
    if (v < vy ? vy - v < du * slope : v - vy < du * 0.42) {
      L = 0.01 + 0.3 * exp(-du * 9); M = 0;
      const wy = fr(((v - vy) / (du + 0.02)) * 2.4), wx = fr(lg * 3);
      if (v < vy && wx > 0.3 && wx < 0.62 && wy > 0.25 && wy < 0.62) L += 0.16;
      if (fr(lg) < 0.05) L = 0;
    } else if (v > vy) {
      const z = 1 / (v - vy + 0.04), cob = hash(floor((u - 0.5) * z * 6), floor(z * 3.2));
      L = 0.03 + 0.16 * cob + 0.3 * exp(-dvp * 5);
      const kerb = du - (v - vy) * 0.75;
      if (kerb > 0) L = abs(kerb) < 0.007 ? 0.7 : fr(z * 1.4) < 0.1 || fr((du / (v - vy)) * 3) < 0.06 ? 0.04 : 0.2 + 0.2 * exp(-dvp * 5);
      const r = hypot(u - lx, (v - 0.82) * 3.83) / (0.23 * fl);
      if (r < 1) A = fl * (0.85 - 0.6 * r) * (0.55 + 0.45 * cob);
    }
    const cone = abs(u - lx) / ((v - ly) * 0.4 + 0.012);
    if (v > ly && v < ly + 0.52 * fl && cone < 1) A = max(A, fl * 0.34 * (1 - cone * cone) * (1 - ((v - ly) * 0.9) / fl));
    A = max(A, fl * 0.9 * exp((-hypot(u - lx, v - ly - 0.01) * 20) / fl));
    // post
    if ((abs(u - px) < 0.005 && v > 0.27 && v < 0.82) || (abs(v - 0.272) < 0.004 && u > px && u < lx) || (abs(u - px) < 0.012 && v > 0.78 && v < 0.825)) { L = 0; A = 0; }
    if (dBox(u, v, lx, ly + 0.012, 0.014, 0.02) === 0) { A = 0.4 + 0.6 * fl; L = 0; }
    if (abs(u - lx) < 0.022 - (ly - 0.012 - v) * 1.1 && v > ly - 0.03 && v < ly - 0.008) { L = 0; A = 0; }
    // the figure
    const fx = 0.393, fy = 0.845, bw = (0.008 + 0.012 * ss(fy - 0.183, fy, v)) * 1.22, head = hypot(u - fx, v - fy + 0.183) < 0.0153;
    if (fl > 0.5 && dSeg(u, v, fx, fy, fx + 0.3, fy + 0.07) < 0.006) { L = 0; A = 0; }
    if ((abs(u - fx) < bw && v > fy - 0.165 && v < fy) || head) { L = 0; A = u < fx - (head ? 0.007 : bw * 0.45) ? 0.95 * fl : 0; }       // lit down the side that faces the lamp
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- cellar: light under the door at the bottom of the stairs, and feet moving behind it
  S.cellar = (u, v, f, o) => {
    const db = 0.46, sx = [0, 0, 0.022, 0.03][f];
    const by = floor(v * 24), bxx = floor(u * 13 + (by & 1) * 0.5);
    let L = (fr(v * 24) < 0.14 || fr(u * 13 + (by & 1) * 0.5) < 0.07 ? 0.01 : 0.14 + 0.3 * hash(bxx, by)) * (1 - 1.1 * abs(u - 0.5)) * ss(0, 0.3, v);
    let A = 0.45 * exp(-hypot(u - 0.5, (v - db) * 1.4) * 17);
    const half = 0.09 + max(0, v - db) * 0.62;
    const foot = (x) => abs(u - 0.5 - (x - 0.5) * (half / 0.09)) < 0.014 * (half / 0.09);
    const feet = foot(0.462 + sx) || foot(0.515 + sx);
    if (v > db && abs(u - 0.5) < half) {
      const k = Math.pow((v - db) / (1 - db), 0.62) * 9, kf = fr(k);
      L = kf < 0.1 ? 0.85 : kf < 0.55 ? 0.2 : 0.02;
      A = exp(-(v - db) * 9) * (kf < 0.55 ? 1 : 0.3) * (0.75 + 0.25 * (f % 2));
      if (feet) A *= 0.12;
    } else if (inBox(u, v, 0.39, 0.13, 0.61, db)) {
      const ix = abs(u - 0.5);
      L = ix > 0.092 || v < 0.148 ? 0.75 : fr((u - 0.41) * 44) < 0.12 ? 0 : 0.07;
      A = 0;
      if (ix < 0.092 && v > db - 0.012) A = feet ? 0 : 1;
      if (hypot(u - 0.572, v - 0.315) < 0.006) A = 1;
      if (abs(u - 0.572) < 0.004 && v > 0.315 && v < 0.332) A = 1;
    } else if (v < 0.1 + 0.03 * abs(u - 0.5)) L = fr(u * 9) < 0.16 ? 0.4 : 0.02;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = v > db && abs(u - 0.5) < half;
  };

  // --- graves: a light walking between the stones
  const STONES = [[0.21, 0.05, 0.085, 0], [0.34, 0.04, 0.065, 0], [0.56, 0.05, 0.09, 0], [0.66, 0.036, 0.06, 0], [0.12, 0.07, 0.12, 0.13], [0.31, 0.08, 0.15, 0.17], [0.57, 0.085, 0.13, 0.2], [0.93, 0.07, 0.11, 0.15]];
  const TREE = [[0.8, 0.8, 0.79, 0.42, 0.017], [0.79, 0.42, 0.7, 0.25, 0.008], [0.79, 0.46, 0.9, 0.27, 0.008], [0.7, 0.25, 0.62, 0.2, 0.004], [0.7, 0.25, 0.72, 0.12, 0.004], [0.9, 0.27, 0.98, 0.2, 0.004], [0.9, 0.27, 0.88, 0.13, 0.004], [0.79, 0.52, 0.67, 0.43, 0.005], [0.795, 0.38, 0.83, 0.19, 0.005], [0.67, 0.43, 0.63, 0.36, 0.003]];
  const hill = (u) => 0.66 - 0.06 * sin(u * 3.1 + 0.4) - 0.03 * fbm(u * 3, 1);
  S.graves = (u, v, f, o) => {
    const wx = 0.445 + 0.014 * cos(f * PI / 2), wy = 0.585 + 0.012 * sin(f * PI / 2);
    const dw = hypot(u - wx, v - wy), gy = hill(u);
    let L = 0.1 + 0.4 * ss(0.05, 0.66, v) + 0.25 * ss(0.5, 0.78, fbm(u * 2.4 + f * 0.07, v * 11));
    const sp = abs(u - 0.15);
    if ((inBox(u, v, 0.09, 0.47, 0.29, 0.7) && v > 0.47 + (u > 0.2 ? 0.05 - min(0.05, abs(u - 0.245) * 1.2) * 0 : 0)) || (v > 0.2 && v <= 0.47 && sp < (v - 0.2) * 0.17) || (sp < 0.003 && v > 0.16) || (sp < 0.012 && abs(v - 0.18) < 0.003)) L = 0.01;
    for (const s of TREE) if (dSeg(u, v, s[0], s[1], s[2], s[3]) < s[4] * (1 + 0.5 * vn(v * 30, 3))) L = 0;
    if (v > gy) L = v - gy < 0.006 ? 0.7 : fbm(u * 80, v * 16) > 0.62 ? 0.2 : 0.02;
    let solid = v > gy;
    for (const s of STONES) {
      const base = hill(s[0]) + 0.02 + s[3], top = base - s[2], r = s[1] / 2, ix = abs(u - s[0]);
      if (ix < r && v < base && (v > top + r || hypot(ix, v - top - r) < r)) {
        solid = true;
        L = 0.02;
        if ((r - ix < 0.006 || (v < top + r && hypot(ix, v - top - r) > r - 0.006)) && (wx - s[0]) * (u - s[0]) > 0) L = 1;
        if (s[3] && ((ix < 0.004 && v > top + r * 0.6 && v < top + r * 2.6) || (ix < r * 0.5 && abs(v - top - r * 1.2) < 0.004))) L = 0.45;
      }
    }
    let A = dw < 0.011 ? 1 : 0.8 * exp(-dw * 19) * (solid ? 0.7 : 1) * [1, 0.85, 1, 0.9][f];
    if (dw < 0.011) L = 0;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = !solid;
  };

  // --- shared bits for the angled scenes ------------------------------------
  // a wall with vertical sides whose top and bottom edges slope: gives two-point perspective cheaply.
  // on a hit, W.s / W.t are the position across and down the wall, 0..1
  const W = { s: 0, t: 0 };
  const wall = (u, v, x0, x1, top0, top1, bot0, bot1) => {
    const s = (u - x0) / (x1 - x0);
    if (s < 0 || s >= 1) return false;
    const top = top0 + (top1 - top0) * s, t = (v - top) / (bot0 + (bot1 - bot0) * s - top);
    W.s = s; W.t = t;
    return t >= 0 && t < 1;
  };
  // three signs keep turning up. k = which one, w = how unsteady the hand was. x,y in a unit circle
  //   0 the lamp: ring, staff, chevron, a small circle under, a bar over
  //   1 the owed: a triangle with an eye in it and three drops beneath
  //   2 the door: a ring broken at the foot, a ladder of three bars, a horn on top
  const sigil = (x, y, k = 0, w = 0) => {
    if (w) { const nx = x + w * (vn(x * 3 + 7 + k, y * 3) - 0.5); y += w * (vn(x * 3, y * 3 + 9 + k) - 0.5); x = nx; }
    const r = hypot(x, y), t = 0.058 + (w ? 0.2 * w * (vn(x * 9, y * 9) - 0.5) : 0);
    if (k === 1) return abs(max(abs(x) * 1.6 - y * 0.9, y) - 0.55) < t || abs(hypot(x, y - 0.1) - 0.19) < t * 0.8 || hypot(x, y - 0.1) < 0.06 || hypot(abs(x) > 0.15 ? abs(x) - 0.3 : x, y - 0.82) < 0.075;
    if (k === 2) return (abs(r - 0.86) < t && !(y > 0.6 && abs(x) < 0.3)) || (abs(x) < t * 0.8 && y > -0.45 && y < 0.95) || (abs(y + 0.2) < t * 0.8 && abs(x) < 0.58) || (abs(y - 0.1) < t * 0.8 && abs(x) < 0.45) || (abs(y - 0.4) < t * 0.8 && abs(x) < 0.3) || (abs(hypot(x, y + 0.62) - 0.17) < t * 0.8 && y < -0.6);
    return abs(r - 0.86) < t || (r < 0.86 && ((abs(x) < t * 0.8 && y < 0.5) || (abs(y + 0.25 - abs(x) * 0.9) < t && abs(x) < 0.62) || abs(hypot(x, y - 0.5) - 0.2) < t * 0.8 || (abs(y + 0.55) < t * 0.8 && abs(x) < 0.3)));
  };
  // convex four-sided shape, corners in order; and how far into an ellipse a point is (1 = on its edge)
  const quad = (x, y, ax, ay, bx, by, cx, cy, dx, dy) => {
    const a = (bx - ax) * (y - ay) - (by - ay) * (x - ax), b = (cx - bx) * (y - by) - (cy - by) * (x - bx), c = (dx - cx) * (y - cy) - (dy - cy) * (x - cx), d = (ax - dx) * (y - dy) - (ay - dy) * (x - dx);
    return (a >= 0 && b >= 0 && c >= 0 && d >= 0) || (a <= 0 && b <= 0 && c <= 0 && d <= 0);
  };
  // a box in parallel projection. o = its near bottom corner, a and b = the two floor edges from there, h = height.
  // returns 1 (the face along a), 2 (the face along b), 3 (the top) or 0; W.s / W.t = across and down that face
  const iso = (u, v, ox, oy, ax, ay, bx, by, h) => {
    const x = u - ox, y = v - oy, d = ax * by - ay * bx;
    let s = x / ax, t = 1 - (s * ay - y) / h;
    if (s >= 0 && s < 1 && t >= 0 && t < 1) { W.s = s; W.t = t; return 1; }
    s = x / bx; t = 1 - (s * by - y) / h;
    if (s >= 0 && s < 1 && t >= 0 && t < 1) { W.s = s; W.t = t; return 2; }
    s = (x * by - (y + h) * bx) / d; t = (ax * (y + h) - ay * x) / d;
    if (s >= 0 && s < 1 && t >= 0 && t < 1) { W.s = s; W.t = t; return 3; }
    return 0;
  };
  const ell = (x, y, cx, cy, rx, ry) => hypot((x - cx) / rx, (y - cy) / ry);
  // scratch pixel for helpers that draw into the current sample
  const Q = { L: 0, A: 0, B: 0, M: 0 };
  // moss, willow, whatever hangs: n strands across the frame, down to about len. -1 = nothing here, else its ink
  const drape = (u, v, f, n, len) => {
    const col = floor(u * n);
    return v >= len * (0.5 + hash(col, 3)) || fr(u * n + 0.3 * sin(v * 6 + col + f * 0.5)) >= 0.3 ? -1 : fr(v * 50 + col * 0.3) < 0.2 ? 0.4 : 0.02;
  };
  // a pumpkin that has been out too long: squat, ribbed all the way round, moonlit from the upper left. a lit one scowls, and the light stays inside it
  const carved = (x, y) => { const ax = abs(x); return (ax > 0.15 && ax < 0.55 && y < -0.08 && y > -0.14 - (ax - 0.15) * 0.95) || (ax < 0.1 - (y - 0.02) * 0.9 && y > 0.02 && y < 0.13) || (ax < 0.62 && abs(y - 0.34 - 0.4 * x * x - 0.05 * sin(x * 11)) < 0.04 + 0.1 * abs(fr(x * 4.5) - 0.5)); };
  const pumpkin = (u, v, cx, cy, rx, ry, lit, fl) => {
    const dx = (u - cx) / rx, dy = (v - cy) / ry, r = Math.pow(Math.pow(abs(dx), 2.5) + Math.pow(abs(dy), 2.5), 0.4), st = dSeg(dx, dy, 0.04, -0.8, 0.26, -1.28);
    if (st < 0.1) { Q.L = dx < 0.1 + (dy + 0.8) * -0.45 ? 0.7 : 0.2; Q.M = 0; Q.A = 0; }
    if (r >= 1) { if (dy > 0.8 && ell(dx, dy, 0.3, 0.97, 1.2, 0.15) < 1) { Q.L = 0.01; Q.M = 0; Q.A = 0; } return; }       // and the shadow it sits in
    const th = Math.asin(cl(dx / Math.sqrt(max(0.05, 1 - dy * dy * 0.8)), -1, 1)) + 0.22, rib = fr(th * 2.1 + 0.5), lightd = cl(0.55 - 0.5 * dx - 0.4 * dy);
    Q.M = 0; Q.A = 0;
    Q.L = rib < 0.08 || rib > 0.92 ? 0.02 : (0.08 + 0.75 * lightd) * (0.4 + 0.6 * sin(rib * PI)) * (fbm(u * 40, v * 40) > 0.7 ? 0.5 : 1);
    if (hypot(dx - 0.08, (dy + 0.84) / 0.3) < 0.3) Q.L *= 0.35;                                                               // the dip the stalk comes out of
    if (!lit) return;
    const x = dx + 0.1;
    if (carved(x, dy)) { Q.L = 0; Q.A = carved(x + 0.035, dy - 0.045) ? (fl > 0.7 ? 1 : 0.75) : 0.35; }                        // the cut edge of the rind shows down one side of each hole
  };

  // a fifties pickup, three-quarter from the front: round cab, bulging hood and fenders, lamps in the wings, spare on the side.
  // x0,y0 = top-left of its box, w,h = size (about 1.65 : 1). lit = headlamps on (second accent), shine = moon from behind it, broken up, never on the nose (accent)
  const truck = (u, v, x0, y0, w, h, lit, shine) => {
    const x = (u - x0) / w, y = (v - y0) / h;
    if (x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02) return;
    let L = -1, B = 0, e;
    if (quad(x, y, 0, 0.31, 0.24, 0.3, 0.24, 0.5, 0, 0.47)) L = y < 0.335 ? 0.9 : fr(x * 22) < 0.1 ? 0.08 : 0.26;                       // bed
    if (ell(x, y, 0.096, 0.628, 0.032, 0.1) < 1) L = 0.04;
    if ((e = ell(x, y, 0.072, 0.63, 0.032, 0.105)) < 1) L = e < 0.45 ? 0.65 : 0;                                                     // rear wheel
    if ((e = ell(x, y, 0.085, 0.53, 0.082, 0.13)) < 1 && y < 0.57) L = e > 0.78 && y < 0.5 ? 0.9 : 0.22;                               // rear wing
    if (ell(x, y, 0.178, 0.468, 0.034, 0.1) < 1) L = 0.06;
    if ((e = ell(x, y, 0.155, 0.47, 0.034, 0.105)) < 1) L = e < 0.3 ? 0.9 : e < 0.55 ? 0.45 : 0.02;                                    // spare
    if (quad(x, y, 0.22, 0.09, 0.39, 0.07, 0.4, 0.67, 0.22, 0.6)) L = abs(y - 0.31) < 0.012 ? 0.8 : abs(x - 0.365) < 0.004 ? 0.02 : 0.2; // door
    if (quad(x, y, 0.24, 0.095, 0.365, 0.085, 0.37, 0.28, 0.24, 0.285)) L = 0.7;
    if (quad(x, y, 0.252, 0.11, 0.352, 0.1, 0.357, 0.265, 0.252, 0.27)) L = 0;                                                       // door glass
    if (quad(x, y, 0.37, 0.07, 0.63, 0.05, 0.64, 0.29, 0.38, 0.3)) L = 0.7;
    if (quad(x, y, 0.388, 0.09, 0.612, 0.072, 0.622, 0.272, 0.396, 0.282)) L = fr((x + y) * 5) < 0.12 ? 0.45 : 0;                     // windscreen
    if (quad(x, y, 0.235, 0.04, 0.56, 0, 0.635, 0.058, 0.25, 0.097) || ell(x, y, 0.255, 0.07, 0.035, 0.04) < 1) L = 0.95;             // roof
    if (quad(x, y, 0.395, 0.285, 0.665, 0.445, 0.665, 0.52, 0.4, 0.46)) L = 0.16;                                                    // hood side
    if (quad(x, y, 0.395, 0.285, 0.625, 0.275, 0.885, 0.375, 0.665, 0.445)) L = dSeg(x, y, 0.51, 0.28, 0.775, 0.41) < 0.006 ? 0.3 : 0.85 - 0.3 * (x - 0.4); // hood top
    if (quad(x, y, 0.665, 0.44, 0.99, 0.4, 1, 0.7, 0.68, 0.8)) L = 0.14;                                                             // nose
    if (ell(x, y, 0.955, 0.5, 0.06, 0.1) < 1) L = y < 0.47 ? 0.7 : 0.2;                                                              // far wing
    if ((e = ell(x, y, 0.585, 0.61, 0.175, 0.2)) < 1 && y < 0.8) L = e > 0.85 && y < 0.6 ? 1 : y < 0.5 ? 0.8 : y < 0.58 ? 0.45 : 0.16; // near wing
    if (ell(x, y, 0.52, 0.8, 0.105, 0.2) < 1 && y > 0.6) L = 0;
    if (ell(x, y, 0.535, 0.795, 0.06, 0.165) < 1) L = fr(y * 34) < 0.3 ? 0.14 : 0.02;                                                // tread, turned toward us
    if ((e = ell(x, y, 0.492, 0.8, 0.06, 0.17)) < 1) L = e < 0.28 ? 0.95 : e < 0.58 ? 0.5 : e > 0.88 ? 0.3 : 0;                        // front wheel
    if (quad(x, y, 0.2, 0.615, 0.4, 0.675, 0.39, 0.715, 0.19, 0.65)) L = 0.65;                                                       // running board
    if (quad(x, y, 0.7, 0.555, 0.945, 0.48, 0.945, 0.665, 0.705, 0.74)) L = 0.9;                                                     // grille panel
    if (quad(x, y, 0.775, 0.585, 0.92, 0.54, 0.92, 0.6, 0.775, 0.648)) L = fr(x * 40) < 0.2 ? 0.5 : 0.03;
    if (quad(x, y, 0.655, 0.8, 1, 0.675, 1, 0.735, 0.665, 0.86)) L = 0.1;                                                            // bumper
    if (quad(x, y, 0.655, 0.8, 1, 0.675, 1, 0.69, 0.657, 0.815)) L = 0.85;
    for (const [hx, hy, s] of [[0.695, 0.525, 1], [0.978, 0.47, 0.85]]) if ((e = ell(x, y, hx, hy, 0.036 * s, 0.06 * s)) < 1) { L = e > 0.8 ? 0.4 : 1; B = lit && e <= 0.8 ? 1 : 0; }
    if (L >= 0) { Q.L = L; Q.A = shine && L >= 0.85 && !(x > 0.64 && y > 0.43) ? (1.05 - 0.75 * x) * (0.35 + 0.9 * fbm(x * 16, y * 22)) : 0; Q.B = B; Q.M = 0; }
  };

  // the cat, sat facing you. x from the middle of its body, y from where it sits (up is negative), at the size it is on its own plate. rag = how shaggy here, lid = how open its eyes. 0 = not cat, 1 = cat, 2 = eye
  const mog = (x, y, rag, lid) => {
    const hx = x + 0.05, ear = (ex, top) => y > top && y < -0.34 && abs(hx - ex) < (y - top) * 0.3;
    for (const sx of [-1, 1]) { const ex = hx - sx * 0.023, ey = y + 0.312 + sx * ex * 0.3; if (lid && hypot(ex / 0.015, ey / (0.0085 * lid)) < 1) return abs(ex) < 0.0028 ? 1 : 2; }
    return (y < 0.006 && (hypot((x - 0.12 * (y + 0.14)) / 0.075, (y + 0.14) / 0.17) < 1 + rag || hypot((x - 0.045) / 0.07, (y + 0.05) / 0.075) < 1 + rag)) || hypot(hx, y + 0.305) < 0.056 * (1 + rag * 0.7) || ear(-0.034, -0.425) || ear(0.034, -0.39) ? 1 : 0;
  };
  // --- cat: thin, shaggy, on a wall. one eye is wrong
  S.cat = (u, v, f, o) => {
    const tail = [0, 0.02, 0.04, 0.02, 0.02, 0.02][f], lid = [1, 1, 1, 0.5, 0, 0.5][f], wall = 0.74, cx = 0.44, hx = cx - 0.05;
    let L = 0.2 + 0.3 * ss(0.1, wall, v) + 0.16 * ss(0.5, 0.8, fbm(u * 3, v * 12)), A = 0, M = 1;
    if (hypot(u - 0.76, v - 0.2) < 0.1) L = 1;
    if (v > wall) {
      const by = floor((v - wall) * 22), bx = u * 7 + (by & 1) * 0.5;
      M = 0; L = v - wall < 0.012 ? 0.85 : fr((v - wall) * 22) < 0.14 || fr(bx) < 0.05 ? 0.02 : 0.1 + 0.22 * hash(floor(bx), by);
    }
    const rag = 0.5 * (fbm(u * 46, v * 46) - 0.5) + 0.3 * (hash(floor(u * 80), floor(v * 80)) - 0.5);
    const m = mog(u - cx, v - wall, rag, lid);
    if (m || dSeg(u, v, cx + 0.08, wall - 0.02, cx + 0.15, wall + 0.1) < 0.006 + 0.008 * hash(floor(v * 70), 1) || dSeg(u, v, cx + 0.15, wall + 0.1, cx + 0.13 + tail, wall + 0.24) < 0.004 + 0.008 * hash(floor(v * 70), 2)) { L = 0; M = 0; }
    if (m === 2) A = 1;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- pumpkins: a doorstep from one side. four of them, one lit. the door behind opens on nothing
  S.pumpkins = (u, v, f, o) => {
    const fl = [1, 0.65, 1, 0.82][f], t1 = 0.5 + 0.06 * u, r1 = 0.585 + 0.07 * u, t2 = 0.68 + 0.085 * u, r2 = 0.83 + 0.1 * u;
    Q.L = 0.1 + 0.1 * fbm(u * 3, v * 9); Q.A = 0; Q.M = 1;
    if (wall(u, v, 0.08, 1.02, -0.05, 0.02, 0.5, 0.565)) {                                                                            // the wall, and the door in it
      const s = W.s, t = W.t;
      Q.M = 0; Q.L = fr(t * 22) < 0.2 ? 0.05 : 0.2 - 0.1 * s;
      if (s > 0.22 && s < 0.66 && t > 0.1) Q.L = s < 0.25 || s > 0.63 || t < 0.14 ? 0.65 : 0;
    }
    if (v > t1) { Q.M = 0; Q.L = v < r1 ? (v < t1 + 0.008 ? 0.8 : 0.3 + 0.08 * hash(floor(u * 60), floor(v * 90))) : v < t2 ? (v < r1 + 0.008 ? 0.9 : 0.07) : v < r2 ? (fr(u * 5 - v * 2) < 0.02 ? 0.1 : 0.34 + 0.08 * hash(floor(u * 60), floor(v * 90))) : v < r2 + 0.008 ? 0.9 : 0.05 + 0.06 * hash(floor(u * 90), floor(v * 90)); }
    pumpkin(u, v, 0.66, 0.485, 0.075, 0.062, 0, fl); pumpkin(u, v, 0.15, 0.7, 0.09, 0.075, 0, fl); pumpkin(u, v, 0.76, 0.735, 0.115, 0.095, 0, fl); pumpkin(u, v, 0.43, 0.66, 0.19, 0.16, 1, fl);
    o[0] = Q.L; o[1] = Q.A; o[2] = 0; o[3] = Q.M;
  };

  // --- skitter: 10 frames. something crosses the skirting board and leaves spots
  S.skitter = (u, v, f, o) => {
    let L, A = 0, M = 0;
    if (v < 0.5) { L = fr(u * 14) < 0.5 ? 0.44 : 0.26; M = 1; }
    else if (v < 0.535) L = 0.88;
    else L = fr((v - 0.535) * 30) < 0.12 || fr(u * 5 + floor((v - 0.535) * 30) * 0.37) < 0.03 ? 0.04 : 0.3;
    const x = -0.12 + 1.24 * (f / 6), y = 0.51;
    for (let k = 0; k < 5; k++) if (x > 0.12 + 0.19 * k && hypot(u - 0.12 - 0.19 * k, (v - 0.6 - 0.02 * (k & 1)) * 0.8) < 0.007) A = 1;
    if (f < 7) {
      let hit = hypot((u - x) / 0.055, (v - y) / 0.03) < 1 || hypot(u - x - 0.055, v - y + 0.006) < 0.022;
      for (let i = 0; i < 4 && !hit; i++) {
        const bx = x + (i - 1.5) * 0.028, tip = bx + ((i + f) & 1 ? 0.06 : -0.06), kx = (bx + tip) / 2;
        hit = dSeg(u, v, bx, y, kx, y - 0.065) < 0.004 || dSeg(u, v, kx, y - 0.065, tip, 0.6) < 0.004;
      }
      if (hit) { L = 0; A = 0; M = 0; }
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- marsh: 10 frames. a shapeless pale thing crosses the water at walking pace
  const wisp = (u, v, f, x0, dx, k) => {
    const x = x0 + dx * (f / 10), y = 0.4 + 0.035 * sin((f / 10) * 4 * PI);
    return cl((1 - hypot((u - x) / (u < x ? 0.26 : 0.09), (v - y) / 0.075) / k - 0.7 * (fbm(u * 10 - f * 0.6, v * 10) - 0.5)) * 2.2);
  };
  // x0, dx = where it starts and how far it gets in the ten frames, k = how big it is
  const marsh = (x0, dx, k) => (u, v, f, o) => {
    const hz = 0.56, c = floor(u * 70);
    let L, A, M = 1;
    if (v < hz) {
      L = 0.18 + 0.34 * ss(0, hz, v) + 0.2 * ss(0.5, 0.8, fbm(u * 2.5, v * 10));
      if (v > hz - 0.06 - 0.08 * fbm(u * 7, 3) - 0.12 * ss(0.3, 0, u)) { L = 0.01; M = 0; }
      A = wisp(u, v, f, x0, dx, k);
    } else {
      L = 0.04 + 0.32 * ss(0.5, 0.8, fbm(u * 5, v * 60));
      A = fr(v * 40 + f * 0.25) < 0.55 ? 0.7 * wisp(u, 2 * hz - v, f, x0, dx, k) : 0;
    }
    if (fbm(u * 2.5, 4) > 0.5 && fr(u * 70) < 0.4 && v > 0.52 + 0.36 * hash(c, 1)) { L = hash(c, 2) > 0.45 ? 0.6 : 0; A = 0; M = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };
  S.marsh = marsh(-0.25, 1.5, 1);
  S.fen = marsh(-0.9, 2.8, 0.45);   // for a long low strip, seen from a long way off

  // --- house: three-quarter view from the lane. moon, one window, a truck nobody has moved
  S.house = (u, v, f, o) => {
    const fl = [1, 0.8, 1, 0.9][f], dm = hypot(u - 0.82, v - 0.12);
    let L = 0.1 + 0.3 * ss(0, 0.62, v) + 0.25 * exp(-dm * 4) + 0.18 * ss(0.5, 0.8, fbm(u * 3, v * 11)), A = 0, M = 1;
    if (dm < 0.065) L = 1;
    if (v > 0.57 - 0.06 * fbm(u * 9, 2)) { L = 0.02; M = 0; }
    if (v > 0.66 + 0.05 * (u - 0.5)) {
      const z = 1 / (v - 0.58);
      M = 0; L = fbm(u * z * 2.5, z * 3) > 0.56 ? 0.22 : 0.04;
      if (abs(u - 0.36 - (v - 0.72) * 0.5) < 0.02 + (v - 0.7) * 0.12) L = 0.1 + 0.3 * hash(floor(u * 120), floor(v * 120));
    }
    if (inBox(u, v, 0.53, 0.18, 0.575, 0.3)) { L = 0.5; M = 0; }
    const yr = 0.2 + (u - 0.31) * 0.27;
    if (u > 0.31 + (v - 0.2) * 0.65 && u < 0.68 + (v - 0.3) * 0.77 && v > yr && v < 0.4 + (u - 0.44) * 0.153) { M = 0; L = v - yr < 0.008 ? 1 : fr((v - yr) * 42) < 0.5 ? 0.8 : 0.4; }
    if (wall(u, v, 0.44, 0.8, 0.4, 0.455, 0.7, 0.665)) {
      const wi = W.s < 0.5 ? 0.25 : 0.72, dx = abs(W.s - wi), dy = abs(W.t - 0.45);
      M = 0; L = fr(W.t * 13) < 0.25 ? 0.2 : 0.5;
      if (dx < 0.11 && dy < 0.2) { L = dx > 0.085 || dy > 0.165 ? 0.95 : 0; if (wi > 0.5 && !L) A = dx < 0.012 || dy < 0.015 ? 0 : 1; }
    }
    const tg = u < 0.31 ? 0.44 - (u - 0.18) * 1.85 : 0.2 + (u - 0.31) * 1.54;
    if (u > 0.18 && u < 0.44 && v > tg && v < 0.735 - (u - 0.18) * 0.135) {
      const t = (v - 0.42) / 0.3, s = (u - 0.18) / 0.26;
      M = 0; L = v - tg < 0.01 ? 0.9 : fr(v * 46) < 0.25 ? 0.14 : 0.03;
      if (abs(hypot(u - 0.31, v - 0.33) - 0.016) < 0.005) L = 0.6;
      if (s > 0.5 && s < 0.74 && t > 0.45) L = s < 0.53 || s > 0.71 || t < 0.5 ? 0.5 : 0;
      if (abs(s - 0.25) < 0.12 && abs(t - 0.62) < 0.14) L = abs(s - 0.25) > 0.09 || abs(t - 0.62) > 0.11 ? 0.5 : 0;
    }
    if (abs(v - 0.56 + (u - 0.13) * 0.07) < 0.008 && u > 0.12 && u < 0.47) { L = 0.9; M = 0; }
    if ((abs(u - 0.135) < 0.005 || abs(u - 0.29) < 0.005) && v > 0.56 && v < 0.75) { L = 0.8; M = 0; }
    if (!A) A = fl * 0.5 * exp(-hypot(u - 0.7, v - 0.546) * 22);
    Q.L = L; Q.A = A; Q.M = M;
    truck(u, v, 0.44, 0.67, 0.55, 0.32, 0, 0);
    o[0] = Q.L; o[1] = Q.A; o[2] = 0; o[3] = Q.M;
  };

  // --- porch: looking down its length. the chair is rocking
  S.porch = (u, v, f, o) => {
    const vx = 0.76, hy = 0.42, fl = [1, 0.7, 1, 0.85][f];
    const k = (v - hy) / (u - vx), z = 1 / (abs(v - hy) + 0.001), X = (u - vx) * z;
    let L, A = 0, M = 0;
    const floorL = fr(X * 6) < 0.1 ? 0.05 : fr(z * 0.9) < 0.35 ? 0.18 : 0.36;
    if (u < vx) {
      if (-k > 0.52) L = floorL;
      else if (-k < -0.52) L = fr(k * 5) < 0.12 ? 0.3 : 0.05;
      else if (u < 0.62) {
        L = fr(k * 16) < 0.22 ? 0.2 : 0.08;
        if (u > 0.3 && u < 0.43 && k < 0.4) L = u < 0.31 || u > 0.42 || k > 0.37 ? 0.6 : fr(u * 150) < 0.5 && fr(k * 40) < 0.5 ? 0.12 : 0;
        if (u > 0.06 && u < 0.22 && k < 0.3 && k > -0.12) { const e = u < 0.07 || u > 0.21 || k > 0.27 || k < -0.09; L = e ? 0.7 : 0; if (!e) A = abs(u - 0.14) < 0.004 ? 0 : 0.55 * fl; }
      } else { M = 1; L = 0.18 + 0.3 * ss(0.1, hy, v); if (v > hy - 0.04 - 0.03 * fbm(u * 20, 1)) { L = 0.02; M = 0; } }
    } else if (k > 2.2) L = floorL;
    else if (k < -1.9) L = 0.05;
    else {
      M = 1; L = 0.16 + 0.34 * ss(0.05, hy, v) + 0.15 * ss(0.5, 0.8, fbm(u * 3, v * 12));
      if (v > hy - 0.03 - 0.05 * fbm(u * 14, 3)) { L = v > hy && fbm(u * 40, v * 40) > 0.6 ? 0.15 : 0.02; M = 0; }
      if (abs(k - 0.9) < 0.07) { L = 0.75; M = 0; }
      for (const px of [0.985, 0.9, 0.845, 0.81]) if (abs(u - px) < (px - vx) * 0.07) { L = u < px ? 0.8 : 0.25; M = 0; }
    }
    const ra = 0.09 * [-1, 0, 1, 0][f], RR = 0.26, dx = (u - 0.5) / 1.3 - RR * ra, dy = (v - 0.8) / 1.3 + RR;
    if (rocker(dx * cos(ra) + dy * sin(ra), dy * cos(ra) - dx * sin(ra) - RR, RR)) { L = Q.L; A = 0; M = 0; }
    Q.L = L; Q.A = A; Q.M = M;
    pumpkin(u, v, 0.2, 0.87, 0.1, 0.085, 1, fl); pumpkin(u, v, 0.34, 0.92, 0.05, 0.042, 0, fl);
    o[0] = Q.L; o[1] = Q.A; o[2] = 0; o[3] = Q.M;
  };

  // a rocking chair in its own frame: x across, y up from where the rocker meets the boards (negative = up). far side first, then near
  const rocker = (x, y, R) => {
    let hit = false;
    for (const [ox, oy, w, l] of [[0.032, -0.014, 0.75, 0], [0, 0, 1, 0.8]]) {
      const p = x - ox, q = y - oy;
      if (w < 1 && quad(x, y, -0.045, -0.105, 0.055, -0.1, 0.087, -0.114, -0.013, -0.119)) { Q.L = 0.4; hit = true; }                  // seat, between the two sides
      for (const sy of [-0.29, -0.24, -0.19]) { const xp = -0.045 + (sy + 0.1) * 0.19; if (w < 1 && quad(x, y, xp, sy, xp + 0.032, sy - 0.014, xp + 0.036, sy - 0.034, xp + 0.004, sy - 0.02)) { Q.L = 0.55; hit = true; } }
      if ((abs(hypot(p, q + R) - R) < 0.005 * w && abs(p) < 0.115 && q > -0.1) || dSeg(p, q, -0.045, -0.1, -0.085, -0.31) < 0.007 * w || dSeg(p, q, -0.045, -0.1, -0.05, -0.006) < 0.005 * w || dSeg(p, q, 0.055, -0.095, 0.06, -0.008) < 0.005 * w
        || dSeg(p, q, -0.06, -0.175, 0.055, -0.168) < 0.005 * w || dSeg(p, q, 0.055, -0.168, 0.055, -0.095) < 0.004 * w) { Q.L = l; hit = true; }
    }
    return hit;
  };

  // --- yard: from an upstairs window. washing left out, a mark cut in the grass
  S.yard = (u, v, f, o) => {
    const sw = 0.006 * [0, 1, 2, 1][f], fy = 0.1 + u * 0.1, ly = 0.3 - 0.05 * u + 0.03 * sin(u * PI);
    let L = (fbm(u * 70, v * 40) > 0.6 ? 0.22 : 0.05) + 0.12 * ss(0.9, 0.2, hypot(u - 0.5, v - 0.55)), A = 0;
    if (sigil((u - 0.45) / 0.27, (v - 0.7) / 0.15, 0, 0.14) && fbm(u * 34, v * 34) < 0.66) { L = 0.01; A = 0.4; }
    if (v < fy) L = 0.02; else if (v < fy + 0.07) L = fr(u * 30 + v * 4) < 0.6 ? 0.55 : 0.05;
    if (wall(u, v, 0.74, 1.01, 0, 0.03, 0.26, 0.3)) L = W.t < 0.45 ? (fr(W.t * 12) < 0.5 ? 0.6 : 0.3) : fr(W.s * 9) < 0.12 ? 0.02 : 0.12;
    if ((abs(v - ly) < 0.004 && u > 0.1 && u < 0.72) || (abs(u - 0.1) < 0.006 && v > 0.24 && v < 0.5) || (abs(u - 0.72) < 0.005 && v > 0.22 && v < 0.42)) { L = 0.8; A = 0; }
    for (const [x0, x1, len, ghost] of [[0.17, 0.33, 0.2, 0], [0.41, 0.6, 0.25, 1]]) if (u > x0 && u < x1 && v > ly && v < ly + len + sw * sin(u * 40)) {
      A = 0; L = fr((u - x0) * 45 + (v - ly) * sw * 30) < 0.15 ? 0.5 : 0.92;
      if (ghost && (hypot(u - 0.505, v - ly - 0.075) < 0.03 || (abs(u - 0.505) < 0.055 && v > ly + 0.11))) L = 0.34;
    }
    if (hypot((u - 0.82) / 0.1, (v - 0.62) / 0.055) < 1) { A = 0; L = hypot((u - 0.79) / 0.1, (v - 0.605) / 0.055) < 1 ? (fr(u * 40) < 0.12 ? 0.1 : 0.5) : 0; }
    if (u < 0.05 || v > 0.95) { L = 0; A = 0; } else if (u < 0.065 || v > 0.935) { L = 0.6; A = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- window: looking in from the flowerbed. the set is on; its light only reaches so far. in one frame the chair is empty
  S.window = (u, v, f, o) => {
    const fl = [1, 0.7, 0.9, 0.8][f], k = (v - 0.45) / (u + 0.6);
    let L = fr(k * 22) < 0.22 ? 0.12 : 0.34, A = 0, M = 0;
    if (wall(u, v, 0.06, 0.94, 0.05, 0.16, 0.92, 0.8)) {
      const s = W.s, t = W.t, cx = 0.4, g = fl * exp(-hypot(s - 0.72, (t - 0.6) * 1.2) * 1.8);
      if (s < 0.03 || s > 0.97 || t < 0.035 || t > 0.965) L = 0.9;
      else if (abs(s - 0.5) < 0.012 || abs(t - 0.45) < 0.01) L = 0.75;
      else {
        L = (t < 0.72 ? (fr(s * 22) < 0.25 ? 0.14 : 0.06) : fr(((s - 0.74) / (t - 0.55)) * 2.2) < 0.1 ? 0.02 : 0.1) + 0.5 * g;
        A = 0.2 * g * g;
        if (abs(t - 0.72) < 0.008) L += 0.1;
        if (s > 0.07 && s < 0.2 && t > 0.3 && t < 0.72) { L = 0; A = 0; }                                                        // door to the hall
        for (const px of [0.3, 0.42]) if (abs(s - px) < 0.045 && abs(t - 0.3) < 0.06) L = abs(s - px) > 0.033 || abs(t - 0.3) > 0.046 ? 0.3 : 0.06;
        const rug = hypot((s - 0.5) / 0.3, (t - 0.86) / 0.07);
        if (rug < 1) L = fr(rug * 4) < 0.3 ? 0.12 : 0.04;
        if ((abs(s - 0.58) < 0.004 && t > 0.36 && t < 0.8) || (t > 0.28 && t < 0.37 && abs(s - 0.58) < 0.025 + (t - 0.28) * 0.3)) { L = 0.16; A = 0; }  // standard lamp, off
        if (s > 0.8 && s < 0.92 && t > 0.49 - (s - 0.8) * 0.2 && t < 0.72) { L = 0.02; A = 0; }                                    // the set's near side
        if (s > 0.63 && s <= 0.8 && t > 0.52 - (s - 0.63) * 0.17 && t < 0.705 + (s - 0.63) * 0.1) {
          const sx = (s - 0.715) / 0.07, sy = (t - 0.6) / 0.075;
          L = 0.2; A = 0;
          if (sx * sx * sx * sx + sy * sy * sy * sy < 1) { L = 0; A = hash(floor(s * 160), floor(t * 90) + f * 7) > 0.4 ? 1 : 0.35; }
        }
        if ((abs(s - 0.65) < 0.004 || abs(s - 0.9) < 0.004) && t > 0.71 && t < 0.8) { L = 0.1; A = 0; }
        const head = f !== 3 && hypot((s - cx - 0.01) / 0.04, (t - 0.49) / 0.05) < 1;
        if (head || (abs(s - cx) < 0.115 && t > 0.56 && t < 0.88) || hypot((s - cx) / 0.115, (t - 0.57) / 0.06) < 1 || (s > cx + 0.09 && s < cx + 0.16 && t > 0.66 && t < 0.88)) {
          L = 0; A = (head ? s > cx + 0.034 : s > cx + (t < 0.66 ? 0.098 : 0.146)) ? 0.75 * fl : 0;                                // rim of light on the side that faces the set
        }
        if (s < 0.1 + 0.02 * sin(t * 30) || s > 0.92 - 0.02 * sin(t * 26)) { L = (floor(s * 120) + floor(t * 120)) & 1 ? 0.3 : 0.05; A *= 0.3; }  // lace
        if (fr((s + t) * 3.1) < 0.07 && s + t < 0.6) { L = max(L, 0.22); M = 1; }
      }
    }
    if (wall(u, v, 0.04, 0.96, 0.925, 0.803, 0.955, 0.833)) L = 0.85;
    if (inBox(u, v, 0.14, 0.845, 0.21, 0.908)) L = 0.5;
    if (dSeg(u, v, 0.175, 0.845, 0.15, 0.74) < 0.003 || dSeg(u, v, 0.175, 0.845, 0.2, 0.76) < 0.003 || dSeg(u, v, 0.16, 0.79, 0.13, 0.77) < 0.003) L = 0;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- tv: the set stands on the recorder, fronts flush, every edge running to the same two vanishing points. seen from low down. static, and once a loop, a sign
  const TVH = 0.5, tvR = (x, y) => TVH + ((y - TVH) * (4 - x)) / 3.8, tvL = (x, xa, y) => TVH + ((y - TVH) * (x + 3)) / (xa + 3);
  S.tv = (u, v, f, o) => {
    const fy = tvR(u, 0.63), T0 = 0.22, T1 = 0.75, V1 = 0.9;   // set top, set foot = recorder top, recorder foot, each measured at x = 0.2
    let L, A = 0, B = 0;
    if (v > fy) { const z = 1 / (v - fy + 0.1); L = (floor((u - 1.6) * z * 2) + floor(z * 2.2)) & 1 ? 0.13 : 0.05; A = 0.55 * exp(-hypot(u - 0.42, (v - 0.98) * 1.6) * 3.6); }
    else { L = fr((u - v * 0.03) * 18) < 0.5 ? 0.1 : 0.04; A = 0.16 * exp(-hypot(u - 0.46, v - 0.48) * 5.5); }
    if (wall(u, v, 0.04, 0.13, tvL(0.04, 0.13, tvR(0.13, T1)), tvR(0.13, T1), tvL(0.04, 0.13, tvR(0.13, V1)), tvR(0.13, V1))) { L = W.t < 0.08 ? 0.3 : 0.14; A = 0; }
    if (quad(u, v, 0.04, tvL(0.04, 0.13, tvR(0.13, T1)), 0.13, tvR(0.13, T1), 0.82, tvR(0.82, T1), 0.73, tvR(0.82, T1) - 0.005)) { L = 0.42; A = 0; }
    if (wall(u, v, 0.13, 0.82, tvR(0.13, T1), tvR(0.82, T1), tvR(0.13, V1), tvR(0.82, V1))) {
      A = 0; L = W.t < 0.1 || W.s < 0.012 ? 0.7 : fr(W.t * 9) < 0.12 ? 0.08 : 0.24;
      if (abs(W.s - 0.35) < 0.22 && abs(W.t - 0.45) < 0.13) L = 0;
      if (W.s > 0.68 && W.s < 0.92 && abs(W.t - 0.5) < 0.2) { L = 0; if (f % 2 === 0 && fr((W.s - 0.68) * 17) < 0.6 && abs(W.s - 0.8) > 0.015) B = 1; }
    }
    if (wall(u, v, 0.11, 0.2, tvL(0.11, 0.2, T0), T0, tvL(0.11, 0.2, T1), T1)) { A = 0; L = W.s > 0.25 && W.s < 0.75 && W.t > 0.2 && W.t < 0.6 && fr(W.t * 30) < 0.4 ? 0.22 : 0.1; }
    if (wall(u, v, 0.2, 0.74, T0, tvR(0.74, T0), T1, tvR(0.74, T1))) {
      const s = W.s, t = W.t, sx = (s - 0.4) / 0.33, sy = (t - 0.48) / 0.38, sr = sx * sx * sx * sx + sy * sy * sy * sy;
      A = 0; L = s < 0.02 || t < 0.03 || t > 0.97 ? 0.6 : fr(t * 30) < 0.5 ? 0.3 : 0.2;
      if (sr < 1.25) L = 0.7;
      if (sr < 1) { L = 0; A = f === 3 ? (sigil(sx * 1.25, sy * 1.25, 2) ? 1 : 0.1) : (hash(floor(s * 70), floor(t * 60) + f * 17) > 0.5 ? 0.85 : 0.1) * (fr(t * 30 + f * 0.3) < 0.7 ? 1 : 0.3); }
      if (s > 0.8 && (hypot((s - 0.89) / 0.07, (t - 0.25) / 0.07) < 1 || hypot((s - 0.89) / 0.07, (t - 0.45) / 0.07) < 1)) L = 0.85;
      if (s > 0.83 && s < 0.95 && t > 0.6 && t < 0.9 && fr(t * 40) < 0.5) L = 0.02;
    }
    if (dSeg(u, v, 0.4, tvR(0.4, T0), 0.27, 0.03) < 0.004 || dSeg(u, v, 0.42, tvR(0.42, T0), 0.6, 0.05) < 0.004) L = 0.9;
    o[0] = L; o[1] = A; o[2] = B; o[3] = 0;
  };

  // --- cassette: on the kitchen table, from above. it is recording
  S.cassette = (u, v, f, o) => {
    let L = fr((u * 0.35 + v) * 26 + 0.4 * fbm(u * 6, v * 30)) < 0.2 ? 0.05 : 0.16, A = 0;
    if (wall(u, v, 0.2, 0.86, 0.32, 0.22, 0.84, 0.72)) L = 0;
    if (wall(u, v, 0.16, 0.8, 0.66, 0.56, 0.75, 0.65)) L = 0.08;
    if (wall(u, v, 0.16, 0.8, 0.26, 0.18, 0.66, 0.56)) {
      const s = W.s, t = W.t;
      L = s < 0.012 || s > 0.988 || t < 0.02 ? 0.9 : 0.45;
      if (s > 0.02 && s < 0.3) L = (floor(s * 60) + floor(t * 40)) & 1 ? 0.5 : 0.15;
      else if (s > 0.36 && s < 0.94 && t > 0.12 && t < 0.62) {
        L = 0.06;
        for (const cx of [0.5, 0.8]) { const dx = (s - cx) / 0.1, dy = (t - 0.37) / 0.17, r = hypot(dx, dy); if (r < 1) L = r < 0.3 || abs(fr(Math.atan2(dy, dx) / (PI / 3) + f * 0.25) - 0.5) < 0.12 ? 0.9 : 0.25; }
      } else if (s > 0.36 && t > 0.72) { const kx = (s - 0.36) * 8.6; L = fr(kx) < 0.12 ? 0.05 : floor(kx) === 1 ? 0.35 : 0.8; }
      if (hypot((s - 0.33) / 0.015, (t - 0.1) / 0.03) < 1) A = f % 2 ? 1 : 0.3;
    }
    if (wall(u, v, 0.56, 0.9, 0.78, 0.74, 0.95, 0.91)) {
      const s = W.s, t = W.t;
      L = 0.3;
      if (t > 0.12 && t < 0.5 && s > 0.08 && s < 0.92) L = fr(t * 16) < 0.3 ? 0.4 : 0.92;
      if (hypot((s - 0.3) / 0.08, (t - 0.72) / 0.15) < 1 || hypot((s - 0.7) / 0.08, (t - 0.72) / 0.15) < 1) L = 0;
    }
    if (dSeg(u, v, 0.05, 0.92, 0.32, 0.83) < 0.008) L = 0.7;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- sigil: the loft floor. chalk, three candles, and a shadow nothing is casting
  S.sigil = (u, v, f, o) => {
    const hy = 0.3, fl = [1, 0.75, 0.95, 0.6][f];
    let L, A = 0, M = 0;
    if (v < hy) {
      L = fr(u * 19) < 0.1 ? 0.02 : 0.1 + 0.06 * hash(floor(u * 19), 1);
      if (abs(fr((u + v * 1.2) * 3) - 0.5) < 0.04 && v < 0.2) L = 0.3;
      if (abs(u - 0.7) < 0.04 && v > 0.08 && v < 0.22) { L = abs(u - 0.7) < 0.004 || abs(v - 0.15) < 0.004 ? 0 : 0.85; M = 1; }
    } else {
      const z = 1 / (v - hy + 0.03), X = (u - 0.32) * z;
      L = fr(X * 3.5) < 0.07 ? 0.02 : 0.1 + 0.07 * hash(floor(X * 3.5), 2);
      if (abs(u - 0.62 - (v - hy) * 0.25) < 0.05 + (v - hy) * 0.12 && v < 0.62) L += 0.3;
      if (sigil((u - 0.5) / 0.36, (v - 0.7) / 0.15, 2, 0.16) && hash(floor(u * 140), floor(v * 140)) > 0.3 - 0.4 * fbm(u * 9, v * 9)) L = 0.95;
      if (abs(v - 0.7 - (u - 0.5) * 0.25) < 0.02 + 0.01 * sin(u * 30) && u > 0.2 && u < 0.95) L = 0;
    }
    for (const [cx, cy] of [[0.19, 0.69], [0.5, 0.86], [0.81, 0.71]]) {
      if (abs(u - cx) < 0.012 && v > cy - 0.07 && v < cy) { L = 0.8; A = 0; }
      const d = hypot((u - cx) * 1.6, v - cy + 0.09);
      A = max(A, d < 0.016 ? 1 : fl * 0.6 * exp(-d * 14));
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- barn: from the ground looking up. the sign under the peak
  S.barn = (u, v, f, o) => {
    const dm = hypot(u - 0.12, v - 0.16), wy = (x) => 0.08 + x * 0.2 + 0.03 * sin(x * PI);
    let L = 0.14 + 0.36 * ss(0, 0.9, v) + 0.2 * ss(0.5, 0.8, fbm(u * 3, v * 9)) + 0.3 * exp(-dm * 5), A = 0, M = 1;
    if (dm < 0.05) L = 1;
    if (abs(v - wy(u)) < 0.003 || abs(v - wy(u) - 0.035) < 0.003) { L = 0; M = 0; }
    for (const cx of [0.72, 0.8, 0.93]) if (hypot((u - cx) / 0.016, (v - wy(cx) + 0.02) / 0.024) < 1) { L = 0; M = 0; }
    if (wall(u, v, 0.62, 1.01, 0.4, 0.52, 1, 0.94)) { M = 0; L = fr(W.s * 14) < 0.1 ? 0 : 0.07; }
    const yr = 0.1 + (u - 0.37) * 0.47;
    if (u > 0.37 + (v - 0.1) * 0.83 && v > yr && v < 0.4 + (u - 0.62) * 0.31) { M = 0; L = fr((v - yr) * 30) < 0.5 ? 0.55 : 0.25; }
    const tg = u < 0.37 ? 0.42 - (u - 0.12) * 1.28 : 0.1 + (u - 0.37) * 1.2;
    if (u > 0.12 && u < 0.62 && v > tg) {
      const x = (u - 0.37) / 0.085, y = (v - 0.34) / 0.085, dx = (u - 0.37) / 0.17, dy = (v - 0.84) / 0.16;
      M = 0; L = v - tg < 0.012 ? 0.95 : fr(u * 34) < 0.12 ? 0.08 : 0.42 + 0.12 * hash(floor(u * 34), 3);
      if (hypot(x, y) < 1.08) { L = 0.9; if (sigil(x, y, 0, 0.07) && fbm(u * 60, v * 60) < 0.72) { L = 0; A = 1; } }
      if (abs(u - 0.37) < 0.06 && v > 0.48 && v < 0.6) L = 0;
      if (abs(dx) < 1 && v > 0.68) L = abs(abs(dx) - abs(dy)) < 0.07 || abs(dx) > 0.93 || abs(dx) < 0.03 || v < 0.695 ? 0.9 : 0.2;
    }
    if ((abs(u - 0.37) < 0.003 && v > 0.03 && v < 0.1) || (abs(v - 0.045) < 0.004 && abs(u - 0.37) < 0.04)) { L = 0; M = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- road: 10 frames. seen from the bank above the verge: the night bus comes down out of the west and goes by. every seat is taken
  S.road = (u, v, f, o) => {
    const vx = 0.42, hy = 0.44, dy = v - hy, X = (u - vx) / (dy + 1e-4) + 0.7;      // X = position across the road, 0 at its centre
    let L, A = 0, B = 0, M = 1;
    if (v < hy) {
      L = 0.12 + 0.4 * ss(0, hy, v) + 0.22 * ss(0.5, 0.8, fbm(u * 2.5, v * 10));
      if (v > hy - 0.025 - 0.03 * fbm(u * 12, 5)) { L = 0.02; M = 0; }
    } else {
      const z = 1 / (dy + 0.004);
      M = 0; L = abs(abs(X) - 0.5) < 0.025 ? 0.5 : abs(X) < 0.5 ? (abs(X) < 0.02 && fr(z * 0.35) < 0.5 ? 0.8 : 0.1 + 0.08 * hash(floor(u * 160), floor(v * 160))) : fr(X * 1.4) < 0.25 ? 0.2 : 0.04;
    }
    for (let k = 0; k < 6; k++) {
      const d = 0.5 * Math.pow(0.6, k), px = vx + d * 0.3, top = hy - d * 0.9, w = d * 0.02 + 0.0015, n = d * 0.6;
      if ((abs(u - px) < w && v > top && v < hy + d) || (abs(v - top - d * 0.1) < w && abs(u - px) < d * 0.14) || dSeg(u, v, px, top + d * 0.1, vx + n * 0.3, hy - n * 0.8) < 0.0012 + d * 0.003) { L = 0; M = 0; }
    }
    if (f < 8) {
      const d = 0.02 + 0.56 * Math.pow(f / 7, 1.8), r = d * 0.42, by = hy + d, cx = vx - d * 0.7;      // front of the bus is at depth d, its back at r
      const beam = hypot((u - cx + (v - by) * 0.7) / (d * 0.5 + 0.02), (v - by - d * 0.1) / (d * 0.5 + 0.02));
      if (v > by && beam < 1) A = 0.5 * (1 - beam);
      if (wall(u, v, vx - d * 0.53, vx - r * 0.53, hy + d * 0.38, hy + r * 0.38, by, hy + r) && W.t > 0.3 * Math.pow(W.s, 5) && (W.t < 0.9 || W.s < 0.96)) {      // flank
        const win = W.t > 0.14 && W.t < 0.46 && fr(W.s * 7) < 0.78;
        M = 0; L = W.t < 0.05 ? 0.9 : abs(W.t - 0.6) < 0.03 ? 0.7 : 0.22; A = 0;
        if (win) { L = 0; A = hypot((fr(W.s * 7) - 0.4) / 0.2, (W.t - 0.42) / 0.11) < 1 ? 0 : 0.9; }
        if (W.t > 0.8 && (hypot((W.s - 0.2) / 0.08, (W.t - 0.92) / 0.14) < 1 || hypot((W.s - 0.85) / 0.06, (W.t - 0.92) / 0.14) < 1)) L = 0;
      }
      const fx = (u - cx) / (d * 0.17), fy = (by - v) / (d * 0.62);
      if (fy > 0 && (fy < 0.55 ? abs(fx) < 0.93 + fy * 0.13 : Math.pow(abs(fx), 3.5) + Math.pow((fy - 0.55) / 0.5, 3.5) < 1)) {                                                         // front
        M = 0; A = 0; L = Math.pow(abs(fx), 3.5) + Math.pow((fy - 0.55) / 0.5, 3.5) > 0.8 && fy > 0.55 ? 0.9 : 0.3;
        if (hypot((abs(fx) - 0.45) / 0.4, (fy - 0.62) / 0.17) < 1) { L = 0; A = hypot((fx + 0.45) / 0.2, (fy - 0.52) / 0.12) < 1 ? 0 : 0.8; }
        if (fy > 0.86 && fy < 0.95 && abs(fx) < 0.42) B = 1;
        if (abs(fx) < 0.3 && fy > 0.14 && fy < 0.36 && fr(fx * 5) < 0.5) L = 0.85;
        if (fy < 0.07) L = 0.05;
      }
      for (const sx of [-0.62, 0.62]) { const q = hypot(u - cx - sx * d * 0.17, v - by + d * 0.16); A = max(A, q < d * 0.035 + 0.002 ? 1 : 0.8 * exp(-q / (d * 0.12 + 0.004))); }
    }
    // the verge we are standing on: long grass, and the top of a wire fence that drops away down the bank. its reflector catches the lamps as the bus comes close
    if (u > 0.5 && v > 0.95 - 0.1 * (u - 0.5) - 0.05 * fbm(u * 40, 3) * (0.4 + fr(u * 37))) { L = fbm(u * 70, v * 20) > 0.55 ? 0.4 : 0.03; M = 0; A = 0; }
    for (let k = 0; k < 3; k++) {
      const t = (u - 0.6) / 0.29, wy = 0.86 + k * 0.045 + (0.66 + k * 0.075 - 0.86 - k * 0.045) * t + 0.03 * sin(t * PI);
      if (t > -0.4 && t < 1 && abs(v - wy) < 0.003 + (fr(u * 34 + k * 0.3) < 0.08 ? 0.005 : 0)) { L = 0.55; M = 0; A = 0; }
    }
    for (const [ax, ay, bx, by, w] of [[0.91, 1.02, 0.885, 0.6, 0.02], [0.61, 1.02, 0.6, 0.82, 0.011]]) {
      const d = dSeg(u, v, ax, ay, bx, by);
      if (d < w) { M = 0; A = 0; L = u < bx + (v - by) * 0.06 - w * 0.3 ? 0.8 : fbm(u * 90, v * 12) > 0.55 ? 0.3 : 0.12; }
    }
    if (hypot(u - 0.888, v - 0.69) < 0.011) { L = 0; A = 0; M = 0; B = f > 3 && f < 8 ? 1 : 0.3; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- well: straight down. the moon is in it. once a loop, so is something else
  S.well = (u, v, f, o) => {
    const x = u - 0.5, y = v - 0.52, r = hypot(x, y), a = Math.atan2(y, x);
    let L, A = 0, B = 0, M = 0;
    if (r > 0.43) L = fbm(u * 7, v * 7) > 0.58 ? (fr(a * 3 + r * 30) < 0.5 ? 0.3 : 0.12) : fbm(u * 50, v * 50) > 0.58 ? 0.24 : 0.05;
    else if (r > 0.34) L = abs(fr((a * 9) / PI) - 0.5) > 0.44 || abs(r - 0.43) < 0.006 || abs(r - 0.34) < 0.006 ? 0.1 : 0.6 + 0.2 * hash(floor((a * 9) / PI), 4);
    else if (r > 0.1) { const d = Math.log(0.34 / r) * 5; L = fr(d) < 0.12 || abs(fr((a * 7) / PI + floor(d) * 0.5) - 0.5) > 0.45 ? 0.01 : 0.5 * Math.pow(r / 0.34, 2.2); }
    else {
      const mr = hypot(x - 0.02 + 0.006 * sin(f * 1.57), y + 0.02);
      M = 1; L = 0; A = mr < 0.035 ? (fr(v * 90 + f * 0.25) < 0.75 ? 1 : 0) : 0.4 * exp(-(mr - 0.035) * 60);
      if (f === 2 && (hypot(x + 0.045, y - 0.04) < 0.007 || hypot(x + 0.02, y - 0.05) < 0.007)) B = 1;
    }
    if (dSeg(u, v, 0.98, 0.1, 0.72, 0.36) < 0.007 || dSeg(u, v, 0.72, 0.36, 0.53, 0.5) < 0.004) { L = fr((u + v) * 60) < 0.5 ? 0.9 : 0.4; A = 0; M = 0; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- cards: three laid on the cloth and a candle on the same table, seen from where you would sit. the middle one is not from the deck
  S.cards = (u, v, f, o) => {
    const fl = [1, 0.85, 0.95, 0.75][f], Z = 1.3 / (v + 0.3), X = ((u - 0.5) * Z) / 1.3, dl = hypot(X + 0.36, (Z - 1.15) * 0.9), lit = fl * exp(-dl * 1.9), fd = hypot((u - 0.1) / 0.9, v - 0.5);
    let L = ((floor(X * 7 + Z * 2.3) + floor(Z * 7 - X * 2.3)) & 1 ? 0.1 : 0.03) + 0.3 * lit, A = 0, B = 0.6 * fl * exp(-dl * 3.4);
    if (Z > 2.75) { L = 0.02; B = 0; }                                                                                             // the far edge of the table
    [[-0.34, 1.86, 0.1, 0], [0.08, 1.76, -0.05, 1], [0.5, 1.86, 0.08, 2]].forEach(([cx, cz, a, g]) => {
      const x = ((X - cx) * cos(a) + (Z - cz) * sin(a)) / 0.175, y0 = ((cz - Z) * cos(a) + (X - cx) * sin(a)) / 0.29, y = (y0 + 0.1) * 1.3;
      if (abs(x - 0.1) < 1 && abs(y0 - 0.07) < 1 && !(abs(x) < 1 && abs(y0) < 1)) { L *= 0.3; B *= 0.3; }                             // what little shadow it throws, away from the flame
      if (abs(x) >= 1 || abs(y0) >= 1) return;
      const ink = g === 0 ? hypot(x, y) < 0.55 && hypot(x - 0.25, y - 0.1) > 0.5 : g === 1 ? sigil(x * 1.3, y, 1, 0.06)
        : abs(hypot(x, y + 0.45) - 0.2) < 0.07 || (abs(x) < 0.05 && y > -0.25 && y < 0.7) || (x > 0 && x < 0.28 && (abs(y - 0.5) < 0.05 || abs(y - 0.66) < 0.05));
      A = 0; B = 0; L = min(0.88, (abs(x) > 0.9 || abs(y0) > 0.93 ? 0.3 : 0.6) + 0.4 * lit);
      if (ink) { L = 0; if (g === 1) A = 1; }
      if (y0 > 0.78 && y0 < 0.86 && abs(x) < 0.6 && fr(x * 7) < 0.6) L = 0.1;
    });
    const ring = ell(u, v, 0.85, 0.88, 0.035, 0.016);
    if (ring < 1.3 && ring > 0.7) { L = 0.8; B = 0; }
    const sc = ell(u, v, 0.1, 0.83, 0.075, 0.03);
    if (sc < 1) { L = sc > 0.8 ? 0.8 : 0.4; B = 0.3 * fl; }                                                                          // saucer
    if (abs(u - 0.1) < 0.024 + 0.006 * (fbm(u * 3, v * 14) - 0.5) && v > 0.57 + 0.01 * sin(u * 200) && v < 0.83) { L = u < 0.095 ? 0.95 : 0.6; B = v < 0.65 ? 0.5 * fl : 0; }
    if (abs(u - 0.1) < 0.003 && v > 0.545 && v <= 0.57) { L = 0; B = 0; }
    const fe = ell(u, v, 0.1 + 0.004 * [0, 1, 0, -1][f], 0.515, 0.014 * (1 - (0.515 - v) * 9), 0.04);
    if (fe < 1) { L = 0; A = 0; B = 1; } else if (!A) B = max(B, 0.7 * fl * exp(-fd * 17));
    o[0] = L; o[1] = A; o[2] = B; o[3] = 0;
  };

  // --- tree: the bottle elm, from its foot, looking up. the trunk goes away from us into a roof of limbs. things have been hung in it. one of them is red, and moving
  const LIMB = [[0.48, 0.3, 0.14, -0.03, 0.05, 0.09], [0.56, 0.28, 0.94, 0.04, 0.05, 0.1], [0.45, 0.36, 0.16, 0.36, 0.045, 0.014], [0.59, 0.38, 0.9, 0.46, 0.042, 0.014], [0.52, 0.24, 0.5, -0.02, 0.034, 0.014], [0.5, 0.25, 0.34, 0.0, 0.024, 0.009], [0.55, 0.25, 0.7, -0.02, 0.024, 0.009], [0.3, 0.14, 0.24, 0.5, 0.012, 0.004], [0.76, 0.13, 0.8, 0.6, 0.014, 0.004]];
  const HUNG = [[0.4, 0.2, 0.7], [0.66, 0.4, 1.15], [0.31, 0.3, 0.5], [0.74, 0.24, 0.55], [0.6, 0.22, 0.4]];
  S.tree = (u, v, f, o) => {
    const dm = hypot(u - 0.3, v - 0.17), cx = 0.52 + 0.025 * sin(v * 3), t = cl((v - 0.2) / 0.8), c0 = Math.asin(cl((u - cx) / (0.1 + 0.26 * Math.pow(t, 1.8)), -1, 1)), w = (0.1 + 0.26 * Math.pow(t, 1.8)) * (1 + 0.3 * sin(c0 * 5 + 1) * ss(0.62, 1, v)), xt = (u - cx) / w;
    let L = 0.26 + 0.25 * exp(-dm * 4) + 0.16 * ss(0.45, 0.8, fbm(u * 3, v * 9)), A = 0, M = 1, near = 1;
    if (dm < 0.04) L = 1;
    for (const [ax, ay, bx, by, w0, w1] of LIMB) {
      const k = cl(((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)), d = dSeg(u, v, ax, ay, bx, by + 0.05 * sin(k * PI)) / (w0 + (w1 - w0) * k);
      if (d < 1) { M = 0; L = d > 0.6 && (u - ax) * (by - ay) - (v - ay) * (bx - ax) > 0 ? 0.6 : fr(k * 16 + d * 2) < 0.25 ? 0.01 : 0.1; }
      near = min(near, max(0, d - 1) * (w0 + (w1 - w0) * k));
    }
    if (near > 0 && v < 0.62 && fbm(u * 75, v * 75) > 0.5 + 0.34 * ss(0.02, 0.45, v) - max(0, 0.04 - near) * 3) { L = 0; M = 0; }                       // the roof of it
    const dr = drape(u, v, 0, 34, 0.26);
    if (dr >= 0 && abs(xt) > 1) { L = dr * 0.5; M = 0; }
    if (v > 0.2 && abs(xt) < 1) {                                                                                                  // the trunk, wider than the picture by the time it reaches us
      const c = Math.asin(xt);
      M = 0; L = xt < -0.95 ? 0.85 : fr(c * 9 + 1.6 * vn(v * 5, c * 3)) < 0.34 ? 0.01 : 0.12 + 0.55 * ss(0.3, -1, xt) + 0.08 * fbm(u * 50, v * 8);
      if (hypot((u - 0.6) / 0.05, (v - 0.68) / 0.08) < 1) L = fr(hypot((u - 0.6) / 0.05, (v - 0.68) / 0.08) * 3) < 0.4 ? 0.02 : 0.22;
      if (sigil((u - cx + 0.04) / 0.06, (v - 0.85) / 0.075, 0, 0.25)) L = 0.8;
    }
    HUNG.forEach(([bx, by, z], i) => {
      const x = (u - bx - (i === 1 ? 0.012 * [0, 1, 0, -1][f] * cl(v / by) : 0)) / z, y = (v - by) / z;
      if (abs(x) < 0.0022 && y < -0.05) { M = 0; L = 0.5; A = 0; }
      if (ell(x, y, 0, 0, 0.02, 0.036) < 1 || (abs(x) < 0.008 && y > -0.062 && y < 0)) { M = 0; L = i !== 1 && (x < -0.006 || abs(ell(x, y, 0, 0, 0.02, 0.036) - 0.9) < 0.1) ? 0.85 : 0.03; A = i === 1 ? (x < -0.008 && y > -0.03 ? 0.3 : 1) : 0; }
      else if (i === 1) A = max(A, 0.45 * exp(-hypot(x, y) * z * 24));
    });
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- field: rows running to the one lit house. the scarecrow is nearer than it should be
  S.field = (u, v, f, o) => {
    const vx = 0.72, hy = 0.44, tilt = f === 3 ? 0.02 : 0, sx = u - 0.27 - tilt;
    let L, A = 0, B = 0, M = 1;
    if (v < hy) {
      L = 0.14 + 0.4 * ss(0, hy, v) + 0.2 * ss(0.5, 0.8, fbm(u * 2.4, v * 9));
      if (inBox(u, v, 0.66, hy - 0.035, 0.72, hy) || (abs(u - 0.69) < 0.04 && v > hy - 0.06 + abs(u - 0.69) * 0.6 && v < hy - 0.03)) { L = 0; M = 0; }
      A = inBox(u, v, 0.695, hy - 0.025, 0.706, hy - 0.012) ? 1 : 0.4 * exp(-hypot(u - 0.7, v - hy + 0.018) * 40);
    } else {
      const z = 1 / (v - hy + 0.01);
      M = 0; L = fr((u - vx) * z * 1.1) < 0.5 ? (fbm(u * 90, v * 30) > 0.5 ? 0.3 : 0.06) * min(1, (v - hy) * 5 + 0.3) : 0.02;
    }
    if (dSeg(u, v, 0.27, 0.98, 0.27, 0.2) < 0.008 || (v > 0.325 && v < 0.365 + 0.05 * fr(u * 50) && u > 0.09 && u < 0.46)
      || (abs(u - 0.27) < 0.075 - (v - 0.34) * 0.02 + 0.012 * sin(v * 70) && v > 0.33 && v < 0.62 + 0.03 * fr(u * 37))
      || hypot(sx / 0.045, (v - 0.26) / 0.055) < 1 || (abs(v - 0.21) < 0.008 && abs(sx) < 0.075) || (abs(sx) < 0.04 && v > 0.15 && v < 0.21)) { L = 0; A = 0; M = 0; }
    if (f === 3 && (hypot(sx + 0.015, v - 0.26) < 0.007 || hypot(sx - 0.02, v - 0.262) < 0.007)) B = 1;
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- tub: from the doorway, looking down. for the worst endings
  S.tub = (u, v, f, o) => {
    const x = (u - 0.5) / 0.4, y = (v - 0.58) / 0.24, r = hypot(x, y), z = 1 / (v + 0.02);
    let L = v < 0.2 ? (fr(u * 12) < 0.06 || fr(v * 14) < 0.08 ? 0.05 : 0.3) : (floor((u - 0.5) * z * 5) + floor(z * 4)) & 1 ? 0.3 : 0.06, A = 0;
    if (v < 0.2 && fbm(u * 14, v * 30) > 0.6 && abs(u - 0.24) < 0.08) A = 0.6;
    if (hypot(x, (v - 0.68) / 0.24) < 1) L = 0.25 + 0.3 * (1 - abs(x));
    if (r < 1) {
      L = 0.92; A = 0;
      if (r < 0.88) { L = 0; A = fr(r * 14 - f * 0.25) < 0.12 ? 0.55 : 1; if (hypot(x, y + 0.5) < 0.6 && fbm(Math.atan2(y + 0.75, x) * 7, hypot(x, y + 0.75) * 2.5) > 0.5) A = 0; }
    }
    for (let k = 0; k < 4; k++) if (dSeg(u, v, 0.115, 0.535 + k * 0.024, 0.175, 0.545 + k * 0.024) < 0.007) { L = 1; A = 0; }
    if (inBox(u, v, 0.47, 0.26, 0.53, 0.33)) { L = 0.8; A = 0; }
    if (hypot(u - 0.5, v - 0.36 - 0.03 * f) < 0.008) A = 1;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- clearing: somebody left the truck running with its lamps on a door. there is no house. something red is on behind it
  S.clearing = (u, v, f, o) => {
    const fl = [1, 0.92, 1, 0.96][f], fx = u * 14, fc = floor(fx), dx = u - 0.5, gy = 0.74 + 0.03 * fbm(u * 4, 2);
    let L = 0.03 + 0.08 * fbm(u * 3, v * 3), A = 0, B = 0, M = 1;
    if (abs(fr(fx) - 0.3 - 0.4 * hash(fc, 3)) < 0.07 + 0.05 * hash(fc, 8)) { L = 0.13; M = 0; }
    if (v > gy) { M = 0; L = fbm(u * 60, v * 30) > 0.6 ? 0.2 : 0.04; A = 0.5 * exp(-hypot(u - 0.85, (v - 0.79) * 2) * 16); }
    if (wall(u, v, 0.74, 0.86, 0.395, 0.36, 0.765, 0.79)) {                                                                       // its face is turned to the lamps; the far edge is the one ajar
      const s = W.s, t = W.t;
      M = 0; L = 0; A = s > 0.86 && t > 0.03 ? 1 : 0;
      B = A ? 0 : s < 0.05 || t < 0.03 ? 1 : (abs(s - 0.44) < 0.26 && (abs(t - 0.28) < 0.17 || abs(t - 0.72) < 0.18) ? 0.5 : 0.92 - 0.35 * s) * fl;
      if (hypot((s - 0.14) / 0.05, (t - 0.52) / 0.022) < 1) B = 0;
    }
    for (const [tx, tw] of [[0.63, 0.018], [0.94, 0.03]]) if (abs(u - tx) < tw) { M = 0; L = 0; A = 0; B = u < tx - tw * 0.3 && v < gy + 0.03 ? 0.8 * fl * exp(-abs(v - 0.62) * 9) : 0; }
    if (abs(u - 0.03) < 0.07 + 0.012 * fbm(v * 6, 1)) { L = fbm(u * 90, v * 6) > 0.62 ? 0.14 : 0; A = 0; B = 0; M = 0; }
    Q.L = L; Q.A = A; Q.B = B; Q.M = M;
    truck(u, v, 0.08, 0.6, 0.47, 0.29, 1);
    for (const [lx, ly] of [[0.407, 0.752], [0.54, 0.736]]) {                                                                      // both lamps, an even cone straight ahead of each
      const t = u - lx - 0.012, c = abs(v - ly - t * 0.1) / (t * 0.3 + 0.012), b = fl * 0.75 * (1 - c * c) * (1 - t * 1.5);
      if (t > 0 && c < 1 && b > Q.B && (u < 0.74 || v > 0.775) && abs(u - 0.63) > 0.018) { Q.B = b; Q.M = 0; }
    }
    o[0] = Q.L; o[1] = Q.A; o[2] = Q.B; o[3] = Q.M;
  };

  // --- turnout: the truck on the bluff above the water, moon on its roof and wings. the keys are in it
  S.turnout = (u, v, f, o) => {
    const hz = 0.42, mx = 0.24, dm = hypot(u - mx, v - 0.16), d = (v - hz) / (1 - hz);
    let L, A = 0, M = 1;
    if (v < hz) { L = 0.08 + 0.2 * ss(0, hz, v) + 0.2 * exp(-dm * 5) + 0.18 * ss(0.5, 0.76, fbm(u * 2.6, v * 14)); if (dm < 0.06) { A = 1; L = 0; } else A = 0.4 * exp(-(dm - 0.06) * 18); }
    else { L = 0.04 + 0.4 * ss(0.5, 0.78, fbm(u * (12 - 7 * d) + f * 0.3, v * 80 * (1 - 0.4 * d))) * (0.3 + d); if (abs(u - mx + 0.012 * sin(v * 58 + f * 1.57)) < 0.02 + 0.07 * d && fbm(u * 26 + f * 0.9, v * 120) > 0.42) { A = 1; L = 0; } }
    if (v > 0.84 - 0.24 * u - 0.03 * fbm(u * 6, 2)) { M = 0; A = 0; L = fbm(u * 60, v * 30) > 0.6 ? 0.22 : 0.04; }
    for (const px of [0.06, 0.2, 0.34]) if (abs(u - px) < 0.012 && v > 0.76 - 0.24 * px && v < 0.88 - 0.24 * px) { L = u < px ? 0.7 : 0.2; A = 0; M = 0; }
    Q.L = L; Q.A = A; Q.B = 0; Q.M = M;
    truck(u, v, 0.36, 0.5, 0.62, 0.37, 0, 1);
    o[0] = Q.L; o[1] = Q.A; o[2] = 0; o[3] = Q.M;
  };

  // --- birches: from low down. the marks on the bark are eyes. one of them is not a mark
  const BIRCH = [[0.4, 0.018, 0.05], [0.75, 0.02, -0.2], [0.12, 0.05, 0.25], [0.3, 0.035, 0.12], [0.66, 0.03, -0.15], [0.85, 0.055, -0.3], [0.5, 0.06, -0.02]];
  S.birches = (u, v, f, o) => {
    const lid = [0, 0.4, 1, 1][f];
    let L = 0.1 + 0.25 * ss(0.6, 0, v) + 0.15 * ss(0.5, 0.8, fbm(u * 3, v * 9)), A = 0, M = 1;
    if (v < 0.34 && fbm(u * 60, v * 60) > 0.52 + v * 0.3) { L = 0; M = 0; }
    BIRCH.forEach(([bx, bw, lean], i) => {
      const cx = bx + lean * (1 - v) * 0.5, w = bw * (0.45 + 0.55 * v), x = (u - cx) / w;
      if (abs(x) >= 1) return;
      M = 0; A = 0; L = x > 0.45 ? 0.4 : 0.88;
      const row = floor(v * 46), ky = fr(v * (2.2 + i * 0.3) + i * 0.37) - 0.5;
      if (hash(row, i) > 0.72 && abs(x - 2 * hash(row, i + 5) + 1) < 0.5) L = 0;
      if (abs(ky) < 0.035 * (1 - x * x) * (2.2 + i * 0.3)) L = abs(x) < 0.3 ? 0 : 0.1;
      if (i === 6 && abs(v - 0.56) < 0.03 * lid * (1 - x * x * 2.2)) { L = 0; A = hypot(x - (f === 3 ? 0.25 : 0), (v - 0.56) / 0.022) < 0.5 ? 0 : 1; }
    });
    if (v > 0.92 - 0.04 * fbm(u * 5, 3)) { L = fbm(u * 60, v * 34) > 0.58 ? 0.25 : 0.02; M = 0; A = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- swing: an oak limb over the creek, a tyre on a rope, a ribbon tied to the rope. nobody is on it
  S.swing = (u, v, f, o) => {
    const a = 0.045 * [-1, 0, 1, 0][f], cxx = 0.62 + 0.5 * sin(a), cyy = 0.2 + 0.5 * cos(a), dm = hypot(u - 0.8, v - 0.58);
    let L = 0.22 + 0.25 * ss(0.9, 0.2, v) + 0.2 * ss(0.5, 0.8, fbm(u * 3, v * 10)) + 0.25 * exp(-dm * 4), A = 0, M = 1;
    if (dm < 0.11) { const fog = fbm(u * 5 + 3, v * 26); A = fog > 0.56 ? 0.25 : 0.95 - 0.5 * ss(0.4, 0.56, fog); L = 0.75; }
    if (v > 0.84 + 0.03 * fbm(u * 5, 1)) { L = 0.05 + 0.35 * ss(0.5, 0.8, fbm(u * 7, v * 70 + f * 0.3)); if (abs(u - 0.8) < 0.07 && fr(v * 50 + f * 0.25) < 0.5) L = 0.9; }
    if (v > 0.8 + 0.05 * fbm(u * 6, 4) + 0.5 * abs(u - 0.5) * (u < 0.5 ? 0.5 : 0.1) && u < 0.45) { L = fbm(u * 60, v * 30) > 0.6 ? 0.18 : 0.02; M = 0; }
    if (v < 0.24 - u * 0.1 && fbm(u * 50, v * 50) > 0.5) { L = 0; M = 0; }
    if (u < 0.15 + 0.05 * fbm(v * 3, 1) + 0.12 * ss(0.7, 1, v) || dSeg(u, v, 0.1, 0.3, 1, 0.15) < 0.05 * (1 - 0.55 * u) + 0.012 * fbm(u * 8, 2)) { L = fbm(u * 70, v * 9) > 0.64 ? 0.13 : 0; M = 0; }
    const ring = ell(u, v, cxx, cyy, 0.075, 0.09);
    if (dSeg(u, v, 0.62, 0.2, cxx, cyy - 0.08) < 0.0035 || (ring < 1 && ring > 0.52)) { L = 0; M = 0; }
    if (!M) A = 0;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- treeline: from the fire tower. forest to the horizon, one road, one light, and smoke where no one lives
  S.treeline = (u, v, f, o) => {
    const hy = 0.24, z = 1 / (abs(v - hy) + 0.03), n = fbm(u * z * 2.4 + 3, z * 4), lx = 0.63, ly = 0.52, d = hypot(u - lx, v - ly);
    let L, A = 0, M = 1;
    if (v < hy) { L = 0.2 + 0.3 * (v / hy) + 0.15 * ss(0.5, 0.8, fbm(u * 3, v * 14)); if (v > hy - 0.035 - 0.04 * fbm(u * 5, 1)) { L = 0.02; M = 0; } }
    else { M = 0; L = n > 0.5 ? min(0.6, (n - 0.5) * 3.2) * ss(1.1, 0.3, v) + 0.03 : 0; if (abs(u - 0.3 - 0.22 * sin(z * 0.55)) < 0.004 + 0.02 * (v - hy)) L = 0.55; }
    if (v < ly && v > 0.06 && abs(u - lx - 0.12 * (ly - v) - 0.02 * sin(v * 22 + f * 1.57)) < 0.008 + 0.05 * (ly - v)) { L = max(L, 0.5 * ss(0.06, 0.2, v)); M = 1; }
    A = d < 0.008 ? 1 : [1, 0.8, 1, 0.9][f] * 0.7 * exp(-d * 26);
    if (v > 0.94 || (abs(fr(u * 4) - 0.5) < 0.02 && v > 0.86) || abs(v - 0.87) < 0.006) { L = 0; A = 0; M = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- pier: down its length to the lantern at the end. once a loop there is somebody under it
  S.pier = (u, v, f, o) => {
    const vx = 0.68, hy = 0.4, dy = v - hy, X = (u - vx) / (dy + 1e-4), ex = vx - 0.84 * 0.07, ey = hy + 0.02, de = hypot(u - ex, v - ey), fl = [1, 0.85, 1, 0.9][f];
    let L, A = 0, M = 1;
    if (v < hy) { L = 0.12 + 0.34 * ss(0, hy, v) + 0.2 * ss(0.5, 0.8, fbm(u * 2.6, v * 12)); if (v > hy - 0.02 - 0.02 * fbm(u * 9, 4) && u < 0.4) { L = 0.02; M = 0; } }
    else { L = 0.04 + 0.4 * ss(0.5, 0.8, fbm(u * (12 - 7 * dy), v * 70 + f * 0.3)) * (0.3 + dy); if (abs(u - ex + 0.01 * sin(v * 60 + f * 1.57)) < 0.012 + dy * 0.05 && fr(v * 46 + f * 0.25) < 0.5) A = fl * exp(-dy * 2.4); }
    if (dy > 0.07 && X > -1.3 && X < -0.38) { M = 0; A = 0; L = fr(0.5 / dy) < 0.14 || abs(X + 0.84) < 0.01 ? 0.05 : 0.34 + 0.3 * exp(-de * 5) * fl; }
    for (let k = 0; k < 6; k++) for (const e of [-0.38, -1.3]) {
      const d = 0.6 * Math.pow(0.62, k) + 0.07, px = vx + e * d;
      if (abs(u - px) < d * 0.035 + 0.002 && v > hy + d - d * (e > -1 ? 0.42 : 0.3) && v < hy + d * 1.45) { L = 0; A = 0; M = 0; }
    }
    if (abs(u - ex) < 0.004 && v > ey - 0.07 && v < hy + 0.07) { L = 0; M = 0; }
    A = max(A, de < 0.012 ? 1 : fl * 0.8 * exp(-de * 16));
    if (f === 3 && (hypot(u - ex - 0.03, v - ey - 0.005) < 0.009 || (abs(u - ex - 0.03) < 0.008 && v > ey && v < hy + 0.07))) { L = 0; A = 0; M = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- lighthouse: from the rocks at its foot. the beam goes round
  S.lighthouse = (u, v, f, o) => {
    const lx = 0.62, ly = 0.135, cx = 0.62, w = 0.036 + 0.085 * (v - 0.18), x = (u - cx) / w, px = u - lx, py = v - ly;
    let L = 0.12 + 0.3 * ss(0, 0.7, v) + 0.22 * ss(0.5, 0.8, fbm(u * 2.6, v * 11)), A = 0, B = 0, M = 1;
    if (v > 0.7 && u < 0.5) L = 0.05 + 0.35 * ss(0.5, 0.8, fbm(u * 8, v * 80 + f * 0.3));
    for (const [dxx, dyy] of f === 0 ? [[-1, 0.12]] : f === 2 ? [[1, 0.2]] : []) {
      const t = (px * dxx + py * dyy) / hypot(dxx, dyy), q = abs(px * dyy - py * dxx) / hypot(dxx, dyy) / (0.015 + 0.17 * t);
      if (t > 0 && q < 1) A = 0.5 * (1 - q) * (1 - t * 0.5);
    }
    if (f === 1) A = 0.85 * exp(-hypot(px, py) * 4.5);
    if (v > 0.2 && abs(x) < 1) { M = 0; A = 0; L = (floor(v * 7.5) & 1 ? 0.75 : 0.14) * (x > 0.25 ? 0.45 : 1); if (abs(x + 0.2) < 0.12 && abs(fr(v * 3.75) - 0.5) < 0.05) L = 0; }
    if (v > 0.165 && v <= 0.2 && abs(u - cx) < 0.062) { L = 0; A = 0; M = 0; }
    if (v > 0.1 && v <= 0.165 && abs(u - lx) < 0.036) { M = 0; L = 0; A = abs(fr((u - lx) * 40) - 0.5) > 0.42 ? 0 : f === 3 ? 0.35 : 1; }
    if (ell(u, v, lx, 0.1, 0.045, 0.035) < 1 && v < 0.1) { L = 0; A = 0; M = 0; }
    if (inBox(u, v, 0.2, 0.62, 0.36, 0.72) || (abs(u - 0.28) < 0.1 && v > 0.56 + abs(u - 0.28) * 0.6 && v < 0.63)) { L = 0.04; M = 0; A = 0; if (inBox(u, v, 0.25, 0.65, 0.275, 0.685)) B = 1; }
    if (v > 0.8 - 0.1 * fbm(u * 6, 1) - 0.22 * ss(0.35, 1, u) + 0.04 * sin(u * 31)) { M = 0; A *= 0.3; L = fbm(u * 30, v * 30) > 0.62 ? 0.3 : 0.02; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- wrack: three prints in wet sand going away from us down to the water, seen from behind. the moon is low on the left so they hold their own shadow. and the shoe
  const foot = (x, y) => {
    let e = min(ell(x, y, 0, -0.3, 0.4, 0.42), ell(x, y, 0.07, 0.2, 0.26, 0.5), ell(x, y, 0.02, 0.62, 0.3, 0.32));
    for (let i = 0; i < 5; i++) e = min(e, hypot(x - 0.3 + 0.165 * i, y + 0.93 - 0.05 * i - 0.012 * i * i) / (i ? 0.085 : 0.13));
    return e;
  };
  // where each print is on the sand: across, how far off, which foot, how it is turned. the eye is low and behind, so they shorten as they go
  const PRINTS = [[-0.2, 2.3, 1, -0.14], [0.2, 3.3, -1, 0.12], [-0.2, 4.3, 1, -0.08]];
  S.wrack = (u, v, f, o) => {
    const hz = 0.06, Z = 1.7 / max(v - hz, 1e-3), X = ((u - 0.47) * Z) / 1.42, sea = 7 + 0.9 * sin(X * 1.2) + 0.4 * [0, 1, 2, 1][f];
    let L, A = 0, M = 0;
    if (v < hz) { M = 1; L = 0.1 + 0.2 * fbm(u * 3, v * 40); }
    else if (Z > sea) { M = 1; L = 0.05 + 0.32 * ss(0.5, 0.8, fbm(u * 6, v * 90 + f * 0.3)); }
    else if (Z > sea - 0.5) L = 0.95;
    else {
      L = 0.3 + 0.3 * ss(4, 6.5, Z) + 0.12 * (fbm(X * 5, Z * 3) - 0.5) + (hash(floor(u * 150), floor(v * 150)) > 0.985 ? 0.5 : 0);
      if (fr(Z * 2.2 + 0.25 * sin(X * 5)) < 0.07) L *= 0.6;                                                                       // ripple marks, running across
      PRINTS.forEach(([cx, cz, side, a], i) => {
        const pe = (x, z) => foot((((x - cx) * cos(a) + (z - cz) * sin(a)) / 0.4) * side, ((cz - z) * cos(a) + (x - cx) * sin(a)) / 0.4);
        const e = pe(X, Z), toMoon = pe(X - 0.08, Z + 0.03), away = pe(X + 0.08, Z - 0.03), far = pe(X, Z + 0.14);
        if (e < 1) {
          L = toMoon >= 1 ? 0 : away >= 1 ? 0.9 : far >= 1 ? 0.4 : 0.1 + 0.1 * hash(floor(u * 150), floor(v * 150));             // near wall dark, far wall lit, and the wall that faces us
          if (i === 2 && toMoon < 1 && away < 1) A = fbm(u * 40 + f * 0.6, v * 90) > 0.45 ? 0.9 : 0;                             // the last one has the tide in it
        } else if (pe(X + 0.04, Z - 0.04) < 1) L = 0.95;                                                                       // the lip the heel pushed up
        else if (toMoon < 1) L *= 0.45;
      });
    }
    const sv = v - 0.8 + (u - 0.86) * 0.35;                                                                                       // the shoe, from above: the opening, and the strap across it
    if (ell(u, sv, 0.86, 0, 0.085, 0.034) < 1) { L = 0; A = ell(u, sv, 0.895, 0, 0.04, 0.02) < 1 && abs(u - 0.885) > 0.007 ? 0 : 1; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- mainst: the main street, shut. the signal still changes. the picture house still has a show
  S.mainst = (u, v, f, o) => {
    const vx = 0.2, hy = 0.5, side = u > vx ? 1 : -1, du = abs(u - vx) + 0.012, k = (v - hy) / du, lg = Math.log(du) * (side > 0 ? 4.2 : 6), bi = floor(lg), top = -(0.75 + 0.6 * hash(bi, side)) * (side > 0 ? 1 : 0.7);
    let L = 0.14 + 0.36 * ss(0, hy, v) + 0.2 * ss(0.5, 0.8, fbm(u * 3, v * 11)), A = 0, M = 1;
    if (k > top && k < 0.5) {
      const bx = fr(lg);
      M = 0; L = side > 0 ? 0.13 + 0.1 * hash(bi, 7) : 0.04;
      if (k < -0.3 && k > top + 0.12 && abs(fr(bx * 3) - 0.5) < 0.22 && abs(fr(k * 3.2) - 0.5) < 0.3) L = 0.01;
      if (k > -0.14 && k < -0.02) L = fr(bx * 9) < 0.5 ? 0.6 : 0.2;
      if (k >= -0.02 && k < 0.42 && bx > 0.12 && bx < 0.88) L = bx < 0.15 || bx > 0.85 || k > 0.39 || abs(bx - 0.5) < 0.015 ? 0.5 : 0.02;
      if (bx < 0.04 || k - top < 0.03) L = side > 0 ? 0.5 : 0.1;
    } else if (k >= 0.5) {
      const z = 1 / (v - hy);
      M = 0; L = k < 0.66 ? (fr(z * 1.5) < 0.1 ? 0.08 : 0.34) : abs(k - 1.5) < 0.05 && fr(z * 0.4) < 0.5 ? 0.6 : 0.07 + 0.08 * hash(floor(u * 150), floor(v * 150));
      if (k > 0.68 && fbm(u * 40, v * 40) > 0.72) L = 0.25;
    }
    if (wall(u, v, 0.5, 0.74, 0.25, 0.19, 0.37, 0.33)) {
      M = 0; L = W.s < 0.03 || W.s > 0.97 || W.t < 0.08 || W.t > 0.9 ? 0.2 : W.t > 0.3 && W.t < 0.72 && fr(W.s * 9) < 0.66 && hash(floor(W.s * 9), 5) > 0.3 ? 0.03 : 0.85;
      if (W.t > 0.9 && fr(W.s * 14) < 0.4) A = floor(W.s * 14) === 9 ? (f > 1 ? 1 : 0.4) : 0;
    }
    if (dSeg(u, v, 0, 0.17, 1, 0.09) < 0.0025 || inBox(u, v, 0.335, 0.14, 0.375, 0.26)) { L = 0; M = 0; A = 0; }
    A = max(A, f % 2 ? (hypot(u - 0.355, v - 0.2) < 0.012 ? 1 : 0.6 * exp(-hypot(u - 0.355, v - 0.2) * 30)) : 0);
    Q.L = L; Q.A = A; Q.M = M;
    truck(u, v, 0.02, 0.68, 0.36, 0.22, 0);
    o[0] = Q.L; o[1] = Q.A; o[2] = 0; o[3] = Q.M;
  };

  // --- storefront: Dunn's, from the kerb, the front going away up the street. three dummies in the window. two have their backs to us. one does not
  const DUNN = [[6, 5, 5, 5, 6], [5, 5, 5, 5, 7], [5, 7, 7, 7, 5], [5, 7, 7, 7, 5], [0, 0, 0, 0, 0], [7, 4, 7, 1, 7]];   // D U N N ' S, three wide, five tall
  // a shop dummy in a coat on its stand. x across, y down, both in units of its height. face: 1 = toward the street. returns its ink, or -1
  const dummy = (x, y, face, f) => {
    const ax = abs(x), sh = 0.5 - x * 2.4, coat = y > 0.17 && y < 0.76 && ax < (y < 0.22 ? 0.06 + (y - 0.17) * 1.4 : y < 0.44 ? 0.13 - (y - 0.22) * 0.23 : 0.08 + (y - 0.44) * 0.16);
    if (ell(x, y, 0, 0.975, 0.1, 0.018) < 1) return y < 0.972 ? 0.5 : 0.15;                                                          // the foot of the stand
    if (ax < 0.009 && y > 0.74 && y < 0.975) return 0.45;
    if (face ? dSeg(x, y, -0.118, 0.23, -0.135, 0.38) < 0.022 || dSeg(x, y, -0.135, 0.38, -0.03, 0.33) < 0.019 || hypot(x + 0.022, y - 0.325) < 0.022 : dSeg(x, y, -0.122, 0.23, -0.132, 0.53) < 0.022) return hypot(x + 0.022, y - 0.325) < 0.022 && face ? 0.85 : 0.2 + 0.3 * sh;   // an arm. somebody has brought this one up
    if (dSeg(x, y, 0.122, 0.23, 0.132, 0.53) < 0.022) return y > 0.5 ? 0.7 : 0.12 + 0.2 * sh;
    if (coat) {
      if (face && y < 0.4 && abs(ax - (y - 0.17) * 0.22) < 0.007) return 0.03;                                                        // lapels
      if (face && ax < 0.006 && y > 0.4) return (fr(y * 14) < 0.2 ? 0.9 : 0.04);                                                     // buttons down the front
      if (!face && ax < 0.004 && y > 0.2) return 0.03;                                                                              // the seam down its back
      if (abs(y - 0.45) < 0.01) return 0.05;
      return cl(0.1 + 0.42 * sh + 0.06 * sin(y * 40 + x * 30) * (y > 0.5 ? 1 : 0));
    }
    if (ax < 0.017 && y > 0.115 && y <= 0.18) return 0.5;
    const hd = ell(x, y, 0, 0.065, 0.047, 0.064);
    if (hd < 1) {
      if (face && ell(ax, y, 0.019, 0.058, 0.011, 0.008) < 1) return f === 3 ? 2 : 0.04;                                              // where eyes would go. once a loop, something is in them
      if (face && ax < 0.016 && abs(y - 0.098) < 0.003) return 0.2;
      return cl(0.55 + 0.4 * sh - 0.3 * hd * hd);
    }
    return -1;
  };
  S.storefront = (u, v, f, o) => {
    wall(u, v, -0.02, 1.02, -0.08, 0.1, 1.1, 0.86);
    const p = (W.s * 0.76) / ((1 - W.s) * 1.18 + W.s * 0.76), t = W.t, by = floor(t * 34), bx = p * 22 + (by & 1) * 0.5;
    let L = fr(t * 34) < 0.14 || fr(bx) < 0.06 ? 0.03 : 0.13 + 0.1 * hash(floor(bx), by), A = 0, B = 0, M = 0;
    if (t > 0.05 && t < 0.185 && p > 0.04 && p < 0.96) {                                                                             // the board, and the name on it
      const lx = (p - 0.3) / 0.4 * 23, ly = (t - 0.085) / 0.065 * 5, k = floor(lx / 4), c = floor(lx - k * 4), r = floor(ly);
      L = t < 0.062 || t > 0.173 || p < 0.048 || p > 0.952 ? 0.6 : 0.05;
      if (lx >= 0 && k < 6 && c < 3 && r >= 0 && r < 5 && (DUNN[k][r] >> (2 - c)) & 1) L = hash(k, r) > 0.12 ? 0.8 : 0.2;
      if (k === 4 && c === 1 && r === 0 && lx >= 0) L = 0.8;
    }
    if (t > 0.2 && t < 0.235 && p > 0.05 && p < 0.74) L = fr(p * 30) < 0.5 ? 0.5 : 0.2;                                                 // a blind, rolled
    if (p > 0.07 && p < 0.71 && t > 0.24 && t < 0.9) {                                                                               // the window, and the box of a room behind the glass
      const fr_ = p < 0.085 || p > 0.695 || t < 0.255 || (t > 0.785 && t < 0.8), back = p < 0.63 && t > 0.275 && t < 0.755;
      if (t >= 0.8) L = abs(fr(p * 5 + 0.1) - 0.5) > 0.42 || t < 0.815 || t > 0.885 ? 0.4 : 0.1;                                         // the riser under it, panelled
      else if (fr_) L = 0.85;
      else {
        const fl = [1, 0.9, 1, 0.8][f];
        L = back ? (fr(p * 46) < 0.3 ? 0.02 : 0.07) : p >= 0.63 && t > 0.275 - (p - 0.63) * 0.28 && t < 0.755 + (p - 0.63) * 0.4 ? 0.2 : t > 0.5 ? 0.3 + 0.1 * hash(floor(p * 90), floor(t * 90)) : 0.03;   // a curtain at the back, the side wall, the boards, the ceiling
        A = 0.12 * fl * exp(-hypot((p - 0.38) * 1.5, t - 0.27) * 5);                                                                  // one bulb, up out of sight
        if (hypot((p - 0.57) / 0.03, (t - 0.765) / 0.008) < 1 || (abs(p - 0.57) < 0.016 && t > 0.745 && t < 0.765)) L = 0.6;            // a hat, come off
        if (abs(p - 0.14) < 0.035 && abs(t - 0.36) < 0.03) { L = abs(t - 0.36) < 0.004 || abs(t - 0.345) < 0.003 ? 0.1 : 0.8; A = 0; } else if (abs(p - 0.14 - (t - 0.3) * 0.3) < 0.002 && t < 0.33) L = 0.5;   // a card on a string. it says closed
        for (const [mx, base, h, face] of [[0.2, 0.752, 0.45, 0], [0.53, 0.752, 0.45, 0], [0.365, 0.782, 0.51, 1]]) {
          const d = dummy(((p - mx) * 1.15) / h, 1 - (base - t) / h, face, f);
          if (d === 2) { L = 0; A = 0; B = 1; } else if (d >= 0) { L = face ? d * 1.5 + 0.1 : d + 0.06; A = 0; B = 0; }
        }
        if (fr((p + t) * 2.3) < 0.07 && p - t < 0.12) { L = max(L, 0.3); M = 1; }                                                      // the street, in the glass
        if (hypot(p - 0.6, (t - 0.33) * 0.7) < 0.012) { B = 0.9; L = 0; }                                                              // and one lamp of it
      }
    }
    if (p > 0.76 && p < 0.95 && t > 0.24 && t < 0.905) {                                                                             // the door, set back
      const s = (p - 0.76) / 0.19;
      L = s < 0.07 || s > 0.93 || t < 0.26 ? 0.7 : s < 0.16 ? 0.05 : t < 0.6 ? (fr(t * 60) < 0.5 ? 0.3 : 0.2) : abs(s - 0.55) > 0.3 || t > 0.86 || t < 0.63 ? 0.2 : 0.09;
      if (hypot((s - 0.84) / 0.05, (t - 0.6) / 0.012) < 1) L = 0.9;
      if (abs(s - 0.55) < 0.16 && abs(t - 0.66) < 0.008) L = 0.02;                                                                    // letterbox
      if (hypot((s - 0.5) / 0.09, (t - 0.285) / 0.014) < 1 || (abs(s - 0.5) < 0.012 && t > 0.26 && t < 0.285)) L = 0.85;                // the bell
      if (t > 0.89) { L = 0; A = [1, 0.8, 1, 0.9][f]; }
    }
    if (t > 0.905) { L = fr(p * 9 + t * 2) < 0.04 || fr(t * 16) < 0.1 ? 0.05 : 0.26; if (p > 0.76 && p < 0.95) A = 0.6 * exp(-(t - 0.905) * 16); if (fbm(p * 50, t * 50) > 0.7) L = 0.02; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- gas: two old pumps on their island under the canopy. round shoulders, clock faces, glass globes. dry for years. one globe is lit
  const pump = (u, v, cx, base, s, lit, fl) => {
    const x = (u - cx) / (0.085 * s), y = (base - v) / (0.42 * s), gr = hypot(x / 0.56, (y - 1.21) / 0.113), hx = (u - cx) / s - 0.11, hy = (base - v) / s - 0.176, he = hypot(hx / 0.05, hy / 0.135), hd = (abs(he - 1) * he) / hypot(hx / 0.0025, hy / 0.018225);
    if (lit && gr >= 1) Q.A = max(Q.A, fl * 0.8 * exp(-(gr - 1) * 1.2));
    if (x > 1 && x < 1.3 && y > 0.03 + (x - 1) * 0.1 && y < 0.92 - (x - 1) * 0.25) { Q.L = 0.08; Q.A = 0; Q.M = 0; }                    // its side
    if (abs(x) < 1 && y > 0.04 && (y < 0.84 || ell(x, y, 0, 0.84, 1, 0.16) < 1)) {
      const r = hypot(x / 0.66, (y - 0.62) / 0.134), an = Math.atan2(y - 0.62, x * 0.203);
      Q.M = 0; Q.A = lit && y > 0.9 ? 0.5 * fl : 0; Q.L = x < -0.82 ? 0.9 : x > 0.72 ? 0.24 : 0.5;
      if (r < 1) Q.L = r > 0.86 ? 0.04 : r < 0.1 || (r < 0.62 && abs(an - (lit ? 2.2 : 0.6)) < 0.14) || (r > 0.66 && fr((an * 6) / PI) < 0.16) ? 0.06 : 0.95;
      if (abs(x) < 0.52 && y > 0.33 && y < 0.42) Q.L = fr(x * 2.9 + 0.5) < 0.7 && y > 0.345 && y < 0.405 ? 0.85 : 0.03;                 // the price it stopped at
      if (y > 0.25 && y < 0.29) Q.L = 0.92;
      if (y < 0.21 && (abs(abs(x) - 0.72) < 0.05 || y > 0.185 || y < 0.075) && abs(x) < 0.77) Q.L = 0.2;
    }
    if (hx > -0.003 && hd < 0.0085) { Q.L = hd < 0.0045 ? 0.75 : 0.02; Q.A = 0; Q.M = 0; }                                                // the hose, bowed out from the foot of the pump and back up to the nozzle
    if (x > 1 && x < 1.3 && y > 0.68 && y < 0.88) { Q.L = 0.35; Q.A = 0; Q.M = 0; }                                                     // the boot the nozzle hangs in
    if ((x > 1.1 && x < 1.66 && y > 0.72 && y < 0.8) || (x > 1.06 && x < 1.24 && y >= 0.8 && y < 0.93) || (x > 1.3 && x < 1.58 && y > 0.655 && y <= 0.72 && !(x > 1.36 && x < 1.52 && y > 0.675))) { Q.L = y > 0.775 || x < 1.14 ? 0.95 : 0.6; Q.A = 0; Q.M = 0; }
    if (abs(x) < 1.2 && y > -0.02 && y <= 0.04) { Q.L = 0.75; Q.A = 0; Q.M = 0; }
    if (abs(x) < 0.15 && y >= 1 && y < 1.11) { Q.L = 0.4; Q.A = 0; Q.M = 0; }
    if (gr < 1) { Q.M = 0; Q.L = lit ? 0 : gr > 0.85 ? 0.6 : hypot(x + 0.2, (y - 1.24) * 4) < 0.14 ? 0.8 : 0.22; Q.A = !lit ? 0 : abs(y - 1.21) < 0.018 && abs(x) < 0.38 ? 0.15 : gr > 0.86 ? 0.55 * fl : fl; }
  };
  S.gas = (u, v, f, o) => {
    const fl = [1, 0.85, 1, 0.6][f], gy = 0.7 + 0.05 * u, z = 1 / (v - gy + 0.08);
    let L = 0.1 + 0.3 * ss(0, 0.6, v) + 0.18 * ss(0.5, 0.8, fbm(u * 3, v * 10)), A = 0, M = 1;
    if (v > 0.52 - 0.06 * fbm(u * 6, 2)) { L = 0.02; M = 0; }
    if (wall(u, v, -0.02, 0.36, 0.36, 0.4, 0.72, 0.71)) {                                                                             // the station
      const s = W.s, t = W.t;
      M = 0; L = t < 0.06 ? 0.6 : fr(t * 14) < 0.2 ? 0.05 : 0.14;
      if (s > 0.08 && s < 0.5 && t > 0.3) L = fr(t * 9) < 0.1 || abs(s - 0.29) < 0.008 ? 0.3 : 0.03;                                      // the bay door
      if (s > 0.6 && s < 0.9 && t > 0.3 && t < 0.62) L = abs(s - 0.75) < 0.01 || abs(t - 0.46) < 0.012 || s < 0.62 || s > 0.88 ? 0.5 : 0;
    }
    if (v > gy) { M = 0; L = fr(z * 0.9) < 0.05 || fr((u - 0.5) * z * 0.8) < 0.03 ? 0.02 : 0.07 + 0.08 * hash(floor(u * 90), floor(v * 90)); if (fbm(u * 9, v * 30) > 0.7) L = 0.01; A = 0.45 * fl * exp(-hypot((u - 0.7) / 0.3, (v - 0.87) / 0.07) * 1.6); }
    if (quad(u, v, 0.14, 0.17, 1.05, 0.1, 1.05, 0.2, 0.3, 0.26)) { M = 0; L = 0.04; A = 0.25 * fl * exp(-hypot(u - 0.68, v - 0.2) * 7); }      // canopy, from underneath
    if (quad(u, v, 0.14, 0.1, 1.05, 0, 1.05, 0.1, 0.14, 0.17)) { M = 0; A = 0; L = v > 0.17 - (u - 0.14) * 0.077 - 0.012 ? 0.8 : 0.3; }
    if (abs(u - 0.53) < 0.011 && v > 0.22 && v < 0.79) { M = 0; A = 0; L = u < 0.53 ? 0.6 : 0.2; }
    if (ell(u, v, 0.55, 0.81, 0.4, 0.04) < 1) { M = 0; L = v < 0.81 ? 0.45 : 0.16; }                                                    // island
    for (let k = 0; k < 3; k++) { const e = ell(u, v, 0.93, 0.8 - k * 0.035, 0.06, 0.028); if (e < 1) { M = 0; A = 0; L = e < 0.4 ? 0.02 : e > 0.85 ? 0.4 : 0.1; } }   // tyres nobody collected
    Q.L = L; Q.A = A; Q.M = M;
    pump(u, v, 0.33, 0.78, 0.72, 0, fl); pump(u, v, 0.7, 0.82, 1, 1, fl);
    o[0] = Q.L; o[1] = Q.A; o[2] = 0; o[3] = Q.M;
  };

  // --- stop: the shelter on the quarry road. a bench, a timetable with one time on it, foxgloves up through the tarmac
  const FOX = [[0.07, 0.4, 0.02], [0.15, 0.56, -0.03], [0.9, 0.36, -0.02], [0.96, 0.58, 0.03]];
  S.stop = (u, v, f, o) => {
    const C = [0.52, 0.1, 0.8], F = [-1.97, 4.82, 0.33], E = 4.2, fl = [1, 0.85, 1, 0.92][f];
    let L = 0.1 + 0.26 * ss(0, 0.6, v) + 0.16 * ss(0.5, 0.8, fbm(u * 3, v * 10)), A = 0, M = 1, k;
    // a street lamp, out of the picture, high and in front and to the right. what it reaches under the roof, and how hard
    const lit = () => { const s = (E - 3.9 - H.y) / (E - 5.1 - H.y), z = H.z + s * (-3.5 - H.z); return fl * (z < -0.3 || H.y < E - 3.95 ? 1 : 0.05) * exp(-max(0, 3.7 - H.x) * 0.62) * exp(-max(0, H.x - 4.4) * 1.2); };
    const ink = (t, l, am = 0.16) => { L = t * (am + (1 - am) * l); A = 0.34 * l * l * l * t; M = 0; };
    if (v > 0.12 - 0.05 * fbm(u * 5, 2) - 0.04 * u) { L = fbm(u * 40, v * 40) > 0.62 ? 0.12 : 0.02; M = 0; }
    if (gp(u, v, C, F, E)) {                                                                                                           // the road, the kerb, the slab the shelter stands on
      const in_ = H.x > 0 && H.x < 4 && H.z > 0 && H.z < 1.4, l = lit() * ss(-3.5, -0.5, H.z);
      ink(abs(H.z + 0.9) < 0.05 ? 0.8 : in_ ? (fr(H.x * 1.2) < 0.04 ? 0.2 : 0.55) : 0.1 + 0.16 * hash(floor(H.x * 30), floor(H.z * 30)), l * (in_ && H.x > 0.4 && H.x < 2.7 && H.z > 0.55 ? 0.1 : 1));
      L = max(L, (0.05 + 0.08 * hash(floor(H.x * 30), floor(H.z * 30)) + (abs(H.z + 0.9) < 0.05 ? 0.25 : 0)) * ss(30, 4, H.d));
    }
    if (rb(u, v, C, F, 0, 4, E - 3.9, E, 1.4, 1.5) === 3) {                                                                                // the back: boards, the timetable in its frame, a rail to lean on
      const x = H.x, y = H.y, l = lit(), a = (x - 2.75) / 0.85, b = (y - E + 3.12) / 1.3, r = fr(b * 9), row = floor(b * 9);
      ink(fr(x * 3.2) < 0.06 ? 0.3 : 0.62 + 0.2 * fbm(x * 2, y * 9), l * (y > E - 0.5 && x > 0.5 && x < 2.7 ? 0.2 : 1), 0.03);
      if (abs(y - E + 1.7) < 0.05 && x < 2.6) ink(1, l);
      if (a > -0.06 && a < 1.06 && b > -0.04 && b < 1.04) {
        ink(a < 0 || a > 1 || b < 0 || b > 1 ? 0.08 : 1, max(l, 0.12), 0.3); A *= 0.35;
        if (a > 0.05 && a < 0.95 && b > 0.03 && (row === 0 ? r > 0.25 && r < 0.75 && a > 0.2 && a < 0.8 : r < 0.12 || abs(a - 0.36) < 0.015 || abs(a - 0.68) < 0.015)) L *= row ? 0.35 : 0.06;   // a heading, ruled for a day's buses
        if (row === 5 && r > 0.3 && r < 0.8 && a > 0.42 && a < 0.62 && fr(a * 22) > 0.25) { L = 0; A = 1; }                              // and one time on it
      }
    }
    if ((k = rb(u, v, C, F, -0.08, 0, E - 3.9, E, 0, 1.5))) ink(k === 2 ? (fr(H.s * 4.2) < 0.08 ? 0.1 : 0.34) : 0.5, 0, 1);   // the end wall
    for (const lx of [0.62, 2.42]) if ((k = rb(u, v, C, F, lx, lx + 0.1, E - 0.46, E, 0.66, 1.34))) ink(k === 3 ? 0.55 : 0.25, lit() * 0.3, 0.8);   // the bench: two frames, three slats
    for (const z0 of [0.62, 0.82, 1.02, 1.22]) if ((k = rb(u, v, C, F, 0.5, 2.62, E - 0.54, E - 0.46, z0, z0 + 0.16))) ink(k === 5 ? 1 : 0.08, k === 5 ? lit() * 0.6 : 0, k === 5 ? (fr(H.s * 9) < 0.06 ? 0.3 : 0.75) : 1);
    if ((k = rb(u, v, C, F, -0.25, 4.25, E - 4.02, E - 3.9, -0.35, 1.6))) ink(k === 6 ? 0.2 : k === 3 ? 1 : 0.5, k === 3 ? lit() * 0.5 : 0, k === 6 ? 0.3 : 0.85);   // the roof
    for (const px of [0, 3.92]) if ((k = rb(u, v, C, F, px, px + 0.08, E - 3.9, E, -0.04, 0.04))) ink(k === 3 ? 1 : 0.45, px ? 0.5 * fl : 0, 0.8);   // posts
    FOX.forEach(([x, top, lean], i) => {
      const sx = x + lean * (0.98 - v), d = u - sx, k = floor((v - top) / 0.032), by = top + (k + 0.5) * 0.032, bw = 0.009 + 0.0013 * k, side = k & 1 ? 1 : -1;
      if (v <= top) return;
      if (abs(d) < 0.004) { M = 0; L = 0.3; A = 0; }
      if (k < 9 && ell(u, v, sx + side * (bw + 0.004), by, bw, 0.015) < 1) { M = 0; A = 0; L = v > by + 0.005 ? 0.3 : 0.92; }
      if (v > top + 0.3 && abs(d) < (v - top - 0.3) * 0.3 * (0.5 + 0.5 * abs(sin(v * 60 + i)))) { M = 0; A = 0; L = fr(d * 70 + v * 20) < 0.3 ? 0.04 : 0.24; }
    });
    o[0] = min(L, 1); o[1] = min(A, 1); o[2] = 0; o[3] = M;
  };

  // --- phone: the call box in the shelter, a chrome three-slot on the wall. the receiver has been off its hook long enough for ivy, and it is not quite still
  const chrome = (s, q) => (abs(s - 0.5) > 0.47 || q < 0.03 || q > 0.97 ? 0.95 : fr(s * 2.3 + q * 0.5) < 0.2 ? 0.1 : 0.5 + 0.25 * sin(q * 9));
  S.phone = (u, v, f, o) => {
    const a = 0.035 * [-1, 0, 1, 0][f], sa = sin(a), ca = cos(a), px = u - 0.4, py = v - 0.635, t = px * sa + py * ca, d = px * ca - py * sa;
    let L = hypot(fr(u * 20) - 0.5, fr(v * 20) - 0.5) < 0.13 ? 0.02 : 0.11 + 0.05 * fbm(u * 5, v * 5), A = 0, M = 0;
    if (wall(u, v, 0, 0.17, -0.06, 0.05, 1.06, 0.95)) { M = 1; L = W.s > 0.86 || W.s < 0.1 || fr(W.t * 3 + 0.1) < 0.035 ? 0.55 : 0.08 + 0.2 * fbm(W.s * 3, W.t * 9); M = L < 0.5; }   // the shelter's side pane
    if (abs(u - 0.78) < 0.003 && v > 0.5 && v < 0.8 && fr(v * 60) < 0.6) L = 0.6;
    if (wall(u, v, 0.69, 0.87, 0.8, 0.8, 0.97, 0.96)) L = W.s < 0.12 ? 0.6 : fr(W.t * 16) < 0.25 ? 0.15 : 0.4;                            // the directory, on its chain
    if (wall(u, v, 0.265, 0.74, 0.0, 0.025, 0.68, 0.665)) L = W.s < 0.02 || W.t > 0.985 ? 0.3 : 0.03;                                    // the board it is bolted to
    if (wall(u, v, 0.4, 0.43, 0.052, 0.04, 0.118, 0.106)) L = 0.1;                                                                     // the head, and its three slots
    if (quad(u, v, 0.4, 0.052, 0.43, 0.04, 0.62, 0.05, 0.59, 0.06)) L = 0.8;
    if (wall(u, v, 0.43, 0.62, 0.04, 0.05, 0.106, 0.116)) {
      L = chrome(W.s, W.t);
      for (const kx of [0.2, 0.5, 0.8]) { const r = hypot((W.s - kx) / 0.13, (W.t - 0.5) / 0.38); if (r < 1) L = r > 0.68 ? 0.95 : 0.02; }
    }
    if (wall(u, v, 0.3, 0.36, 0.125, 0.105, 0.425, 0.43)) L = W.s < 0.14 ? 0.6 : abs(W.s - 0.6) < 0.1 ? 0.3 : 0.07;                        // the upper case: its side, top and face
    if (quad(u, v, 0.3, 0.125, 0.36, 0.105, 0.68, 0.12, 0.62, 0.14)) L = 0.75;
    if (wall(u, v, 0.36, 0.68, 0.105, 0.12, 0.43, 0.425)) {
      const s = W.s, q = W.t, r = hypot((s - 0.6) / 0.36, (q - 0.37) / 0.34), an = Math.atan2(q - 0.37, (s - 0.6) * 0.95);
      L = chrome(s, q);
      if (s < 0.2 && q > 0.08 && q < 0.62) L = s > 0.18 || q < 0.1 ? 0.9 : 0.06;                                                         // where the hook is
      if (r < 1) L = r > 0.9 ? 0.95 : r > 0.82 ? 0.04 : r < 0.36 ? (r > 0.3 ? 0.08 : 0.7) : abs(r - 0.62) < 0.14 && abs(fr((an * 5) / PI) - 0.5) < 0.3 && abs(an - 0.9) > 0.45 ? 0.03 : 0.85;   // the dial
      if (s > 0.3 && s < 0.93 && q > 0.75 && q < 0.965) L = s < 0.32 || s > 0.91 || q < 0.77 || q > 0.945 ? 0.95 : fr(q * 42) < 0.35 && s < 0.84 ? 0.3 : 0.85;   // the card: local call, long distance
    }
    if (wall(u, v, 0.285, 0.345, 0.437, 0.427, 0.635, 0.645)) L = W.s < 0.14 ? 0.6 : 0.07;                                               // the vault under it, a little wider
    if (quad(u, v, 0.285, 0.437, 0.345, 0.427, 0.7, 0.422, 0.66, 0.434)) L = 0.85;
    if (wall(u, v, 0.345, 0.7, 0.427, 0.422, 0.645, 0.63)) {
      const s = W.s, q = W.t, lk = hypot((s - 0.68) / 0.05, (q - 0.3) / 0.085);
      L = chrome(s, q);
      if (s > 0.42 && s < 0.94 && q > 0.13 && q < 0.88) L = s < 0.435 || s > 0.925 || q < 0.15 || q > 0.86 ? 0.04 : 0.42 + 0.2 * sin(q * 6 + s * 3);
      if (lk < 1) L = lk > 0.6 ? 0.95 : 0.02;
      if (s > 0.07 && s < 0.34 && q > 0.4 && q < 0.8) L = s < 0.09 || s > 0.32 || q < 0.43 || q > 0.77 ? 0.95 : q < 0.58 ? 0.55 : 0.02;       // coin return
      if (s > 0.08 && s < 0.33 && q > 0.85 && q < 0.94) L = abs(q - 0.895) < 0.012 ? 0.2 : 0.85;
    }
    if (inBox(u, v, 0.235, 0.24, 0.3, 0.255) || ((abs(u - 0.24) < 0.006 || abs(u - 0.275) < 0.006) && v > 0.2 && v < 0.25)) L = 0.8;     // the empty cradle
    if (t > 0 && t < 0.1 && abs(d) < 0.003 + 0.005 * (fr(t * 90) < 0.5)) L = 0.65;                                                     // cord
    const bow = d - 0.03 * sin((PI * (t - 0.1)) / 0.26);
    if (t > 0.1 && t < 0.36 && abs(bow) < 0.02) L = bow < -0.006 ? 0.95 : 0.55;
    for (const e of [0.135, 0.325]) {
      const c = hypot((t - e) / 0.045, (d + 0.04) / 0.05);
      if (c < 1) { L = c > 0.8 ? 0.95 : 0.6; if (d < -0.07) L = 0.15; if (e > 0.3 && hypot(t - e, d + 0.075) < 0.01) { L = 0; A = f % 2 ? 1 : 0.4; } }
    }
    for (let k = 0; k < 9; k++) {
      const ly = 0.02 + k * 0.07, lx = 0.9 - 0.06 * sin(ly * 6) + (k & 1 ? 0.04 : -0.04), e = hypot((u - lx) / 0.04, (v - ly) / 0.03) + 0.35 * abs(sin(Math.atan2(v - ly, u - lx) * 2.5));
      if (abs(u - 0.9 + 0.06 * sin(v * 6)) < 0.004 && v < 0.62) L = 0.3;
      if (e < 1.05 && v < 0.64) { L = abs(u - lx) < 0.003 ? 0.75 : 0.25 + 0.3 * (1 - e); A = 0; }
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- ashtray: on the bench. one cigarette, still lit, and a matchbook with the lamp sign on it
  S.ashtray = (u, v, f, o) => {
    let L = fr((v + u * 0.2) * 12 + 0.5 * fbm(u * 3, v * 20)) < 0.12 ? 0.04 : 0.13, A = 0, M = 0;
    const e = ell(u, v, 0.42, 0.68, 0.3, 0.17), e2 = ell(u, v, 0.42, 0.66, 0.225, 0.11), d = dSeg(u, v, 0.47, 0.64, 0.8, 0.5), t = (u - 0.47) / 0.33;
    if (e < 1) L = e > 0.9 ? 0.9 : e2 < 1 ? (fbm(u * 34, v * 34) > 0.58 ? 0.4 : 0.06) : 0.55 - 1.2 * (v - 0.55);
    if (dSeg(u, v, 0.3, 0.68, 0.36, 0.63) < 0.012 || dSeg(u, v, 0.4, 0.72, 0.5, 0.71) < 0.011) L = 0.6;                               // older ends
    if (quad(u, v, 0.05, 0.84, 0.27, 0.79, 0.31, 0.93, 0.08, 0.99)) { L = 0.62; if (sigil((u - 0.18 - (v - 0.89) * 0.25) / 0.075, (v - 0.89 + (u - 0.18) * 0.22) / 0.06, 0, 0.1)) L = 0.03; if (v - 0.84 + (u - 0.05) * 0.227 < 0.018) L = 0.2; }
    if (d < 0.019) { L = t < 0.14 ? (fbm(u * 60, v * 60) > 0.5 ? 0.5 : 0.2) : t > 0.76 ? 0.55 : abs(t - 0.74) < 0.012 ? 0.2 : 0.97; if (t < 0.06) { A = [1, 0.7, 1, 0.85][f]; L = 0; } }
    else A = max(A, 0.5 * [1, 0.7, 1, 0.85][f] * exp(-hypot(u - 0.47, v - 0.64) * 22));
    const sy = 0.62 - v, sx = 0.47 + 0.05 * sin(v * 11 + f * 1.57) * sy * 2.4 + 0.1 * sy * sy;
    if (sy > 0 && abs(u - sx) < 0.008 + 0.07 * sy && fbm(u * 9, v * 14 - f * 0.4) > 0.42) { L = max(L, 0.55 * (1 - sy * 1.1)); M = 1; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- booth: the picture house kiosk, lit, on an empty pavement, drawn to two vanishing points: the wall behind, the tiles and the bulbs overhead all go to the same two.
  // the doors are chained. a ticket is already through the slot. what light there is falls out of the glass onto the tiles in front of each face
  const kiosk = (p, t, front, fl) => {
    Q.A = 0; Q.B = 0; Q.L = t < 0.06 ? 0.85 : t > 0.955 ? 0.06 : 0.3;
    if (t > 0.09 && t < 0.5 && p > 0.08 && p < 0.92) {
      Q.L = 0; Q.A = 0.8 * fl;
      if (p < 0.11 || p > 0.89 || t < 0.11 || abs(p - 0.5) < 0.012 && !front) { Q.L = 0.7; Q.A = 0; }                                    // the frame
      if (abs(p - (front ? 0.22 : 0.74)) < 0.014 || abs(t - 0.14) < 0.008) Q.A = 0.15;                                                 // the far corner post, through the glass
      if (front && (abs(hypot((p - 0.5) / 0.09, (t - 0.3) / 0.06) - 0.8) < 0.2 || hypot((p - 0.68) / 0.09, (t - 0.43) / 0.03) < 1 || (abs(p - 0.68) < 0.02 && t > 0.43))) Q.A = 0;   // the speaking hole, and the stool pushed back
    }
    if (t >= 0.5 && t < 0.55) Q.L = 0.95;
    if (t > 0.6 && t < 0.92 && abs(fr(p * 2) - 0.5) < 0.38) Q.L = abs(fr(p * 2) - 0.5) > 0.34 || t < 0.62 || t > 0.9 ? 0.5 : 0.14;        // panels
    if (front && abs(p - 0.5) < 0.1 && t > 0.555 && t < 0.585) Q.L = 0;
    if (front && abs(p - 0.5) < 0.06 && t > 0.565 && t < 0.63) { Q.L = 0; Q.B = 1; }                                                    // the ticket
    if (!front) Q.L *= 0.6;
  };
  S.booth = (u, v, f, o) => {
    const fl = [1, 0.9, 1, 0.75][f], hz = 0.5, mL = (v - hz) / (u + 1), mR = (v - hz) / (2.15 - u);
    Q.A = 0; Q.B = 0;
    if (mR < -0.2326) {                                                                                                            // under the marquee. most of the bulbs have gone
      const i = floor(mL * 34), j = floor(mR * 34);
      Q.L = 0.03;
      if (hypot(fr(mL * 34) - 0.5, fr(mR * 34) - 0.5) < 0.24) { Q.L = 0.22; if (hash(i, j) > 0.86) { Q.L = 0; Q.A = (i + j + f) % 5 ? 1 : 0.2; } }
    } else if (mR < 0.105) {                                                                                                       // the front of the house: doors, and a case with half a poster in it
      const t = (mR + 0.2326) / 0.3376, sw = (2.15 / (2.15 - u) - 1) * 2.6 + 0.2, c = fr(sw), k = floor(sw), ax = abs(c - 0.5);
      Q.L = t < 0.04 ? 0.5 : fr(t * 18) < 0.12 || c < 0.04 ? 0.03 : 0.1;
      if (k === 2) { if (ax < 0.36 && t > 0.3 && t < 0.78) Q.L = ax > 0.32 || t < 0.32 || t > 0.76 ? 0.55 : c + t * 0.8 > 1.1 ? 0.02 : 0.2 + 0.1 * fbm(c * 6, t * 6); }
      else if (t > 0.28) {
        Q.L = ax > 0.44 || ax < 0.015 || t < 0.31 ? 0.42 : t < 0.7 && ax > 0.07 && ax < 0.38 ? 0.01 : 0.09;
        if (ax < 0.36 && abs(t - 0.76) < 0.008) Q.L = 0.6;
        if (k === 0 && ((ax < 0.12 && abs(t - 0.8 - 0.6 * (0.12 - ax)) < 0.008) || hypot(ax / 0.035, (t - 0.88) / 0.016) < 1)) Q.L = 0.85;  // the chain
      }
    } else {                                                                                                                       // the pavement
      const i = floor(mL * 30), j = floor(mR * 30);
      Q.L = fr(mL * 30) < 0.07 || fr(mR * 30) < 0.07 ? 0.02 : 0.08 + 0.07 * hash(i, j);
      if (mL > 0.1715 && mL < 0.2267 && mR > 0.206) Q.A = 0.6 * fl * exp(-(mR - 0.206) * 16) * ss(0.1715, 0.185, mL) * ss(0.2267, 0.213, mL);   // light out of the front glass
      if (mR > 0.1595 && mR < 0.206 && mL > 0.2267) Q.A = 0.4 * fl * exp(-(mL - 0.2267) * 16) * ss(0.1595, 0.172, mR) * ss(0.206, 0.194, mR);   // and out of the side
      if (hypot((u - 0.3) / 0.03, (v - 0.93) / 0.011) < 1 || hypot((u - 0.78) / 0.02, (v - 0.9) / 0.008) < 1) Q.L = 0.5;
    }
    if (wall(u, v, 0.5, 0.7, 0.105, 0.14, 0.158, 0.19)) { Q.L = 0.14; Q.B = 0; Q.A = hypot(fr(W.s * 7) - 0.5, (W.t - 0.5) * 0.8) < 0.22 && hash(floor(W.s * 7), 2) > 0.5 ? 0.9 * fl : 0; if (W.t < 0.1 || W.t > 0.9) Q.L = 0.6; }   // its sign: a few bulbs, no letters
    if (wall(u, v, 0.285, 0.5, 0.2, 0.155, 0.245, 0.205)) { Q.L = 0.45; Q.A = 0; Q.B = 0; }                                             // the cap, overhanging
    if (wall(u, v, 0.5, 0.735, 0.155, 0.2, 0.205, 0.245)) { Q.L = W.t < 0.2 ? 0.95 : 0.7; Q.A = 0; Q.B = 0; }
    if (wall(u, v, 0.3, 0.5, 0.24, 0.2, 0.795, 0.84)) kiosk((W.s * 0.64) / ((1 - W.s) * 0.555 + W.s * 0.64), W.t, 0, fl);
    if (wall(u, v, 0.5, 0.72, 0.2, 0.24, 0.84, 0.795)) kiosk((W.s * 0.555) / ((1 - W.s) * 0.64 + W.s * 0.555), W.t, 1, fl);
    if (abs(u - 0.5) < 0.004 && v > 0.2 && v < 0.84) { Q.L = 0.9; Q.A = 0; Q.B = 0; }                                                   // the corner nearest us
    o[0] = Q.L; o[1] = Q.A; o[2] = Q.B; o[3] = 0;
  };

  // --- cinema: from the back row. every seat is taken by a coat. what is showing is a staircase
  const EXIT = [[7, 4, 6, 4, 7], [5, 5, 2, 5, 5], [7, 2, 2, 2, 7], [7, 2, 2, 2, 2]];
  // what is showing: a staircase from its foot, a runner up the middle, the rail and its spindles, the door at the top ajar and lit, and somebody stood at the head of it. x across (1.8 to 1 up), y down
  const film = (x, y, f, o) => {
    const C = [0.86, 0.86, 1.5], F = [0.2, 1.5, -0.2], E = 1.5, top = E - 2.34, dr = pj(C, F, 0.3, top - 1, 4.5), gl = exp(-hypot(x - dr.u, y - dr.v) * 5);
    let L = 0.03, A = 0, k;
    if ((k = rb(x, y, C, F, -0.75, 3, -4, E, -3, 4.55, 1))) {                                                                           // the hall: paper on the wall beside the stair, the wall across the head of it
      if (k === 1) { const rise = H.y - (E - (H.z / 0.27) * 0.18); L = rise > -0.85 ? (rise > -0.9 && rise < -0.8 ? 0.8 : 0.12) : fr(H.z * 3 + H.y * 0.2) < 0.4 ? 0.4 : 0.24; if (abs(H.z - 1.6) < 0.4 && abs(H.y + 0.75) < 0.3) L = abs(H.z - 1.6) > 0.33 || abs(H.y + 0.75) > 0.24 ? 0.6 : 0.02; L *= 0.5 + 0.8 * gl; }
      else if (k === 4) {
        L = (fr(H.x * 3) < 0.4 ? 0.3 : 0.18) + 0.3 * gl;
        if (abs(H.x) < 0.48 && H.y > top - 2.05 && H.y < top) { L = abs(H.x) > 0.42 || H.y < top - 1.98 ? 0.6 : 0.2; if (H.x > 0.24 && H.x < 0.42 && H.y > top - 1.98) { L = 0; A = [1, 0.9, 1, 0.7][f]; } if (hypot(H.x + 0.3, H.y - top + 1) < 0.035) L = 1; }   // the door, a hand's width open
      } else if (k === 5) L = 0.05;
    }
    if (rb(x, y, C, F, -0.75, 0.75, top, E, 3.24, 4.55) === 5) L = 0.25 + 0.5 * gl;                                                       // the landing
    for (let i = 11; i >= 0; i--) if ((k = rb(x, y, C, F, -0.75, 0.75, E - (i + 1) * 0.18, E, i * 0.27, i * 0.27 + 0.27))) {              // twelve steps. nosing, riser, tread; the runner and its rods
      const run = abs(H.x) < 0.3, l = 0.65 + 0.35 * (i / 11);
      L = k === 5 ? (run ? (fr(H.x * 12) < 0.5 ? 0.4 : 0.22) : 0.95) * l : k === 3 ? (H.y < E - (i + 1) * 0.18 + 0.03 ? 0.8 * l : run ? 0.1 : 0.2 * l) : 0.06;
      A = k === 5 ? 0.35 * ss(6, 11, i) : 0;
    }
    for (let i = 0; i < 12; i++) { const a = pj(C, F, 0.75, E - (i + 1) * 0.18, i * 0.27 + 0.13); if (abs(x - a.u) < 0.004 * a.k && y < a.v && y > a.v - 0.88 * a.k) { L = 0.6; A = 0; } }   // spindles
    const r0 = pj(C, F, 0.75, E - 1.1, -0.05), r1 = pj(C, F, 0.75, top - 0.9, 3.3);
    if (dSeg(x, y, r0.u, r0.v, r1.u, r1.v) < 0.012) { L = 0.95; A = 0; }                                                                // the rail
    if ((k = rb(x, y, C, F, 0.68, 0.84, E - 1.25, E, -0.16, 0))) { L = k === 3 ? 0.8 : 0.3; A = 0; }                                      // the newel
    const h = pj(C, F, 0.02, top - 1.52, 3.3), hx = (x - h.u) / h.k, hy = (y - h.v) / h.k;                                              // whoever it is. they have not moved
    if (hypot(hx / 0.11, hy / 0.13) < 1 || (hy > 0.1 && hy < 1.52 && abs(hx) < (hy < 0.2 ? 0.05 : 0.2 - 0.04 * ss(0.3, 1.5, hy)))) { L = 0; A = 0; }
    o[0] = L; o[1] = A;
  };
  const T4 = [0, 0, 0, 0];
  S.cinema = (u, v, f, o) => {
    let L = 0.03 + 0.05 * fbm(u * 4, v * 4), A = 0, B = 0, M = 1;
    const bx = u - 0.48, by = v - 0.3, q = abs(by + (1 - u) * 0.5 - 0.02) / (0.02 + (1 - u) * 0.16);
    if (u > 0.3 && q < 1) L += 0.3 * (1 - q) * (0.6 + 0.4 * fbm(u * 20 + f, v * 20));
    if (wall(u, v, 0.12, 0.84, 0.1, 0.14, 0.52, 0.5)) {
      const s = W.s, t = W.t;
      film(s * 1.8, t, f, T4);
      M = 0; L = (0.1 + 0.9 * T4[0]) * (hash(floor(s * 90), f) > 0.97 ? 0.5 : 1); A = T4[1];                                             // scratched, a little
      if (s < 0.015 || s > 0.985 || t < 0.02 || t > 0.98) { L = 0.3; A = 0; }
    }
    if (inBox(u, v, 0.862, 0.292, 0.978, 0.352)) { const cx = floor((u - 0.87) / 0.0065), cy = floor((v - 0.3) / 0.0088); M = 0; L = 0; B = cx >= 0 && cx < 15 && cy >= 0 && cy < 5 && cx % 4 < 3 && (EXIT[cx >> 2][cy] >> (2 - (cx % 4))) & 1 ? 1 : 0.12; }   // EXIT
    else if (inBox(u, v, 0.89, 0.37, 0.96, 0.6)) { M = 0; L = u < 0.895 || v < 0.378 ? 0.2 : 0.01; }
    else B = 0.4 * exp(-hypot(u - 0.925, v - 0.33) * 22);
    for (let k = 0; k < 5; k++) {
      const y0 = 0.64 + k * 0.1, n = 8 - k * 1.2, hk = 0.05 * (1 + k * 0.35), i = floor(u * n + k * 0.37), c = (fr(u * n + k * 0.37) - 0.5) / 0.42;
      if (abs(c) >= 1) continue;
      const top = y0 - hk * (1 - 0.5 * c * c * c * c), sh = top - 0.55 * hk * (1 - c * c * 1.4);
      if (hash(i, k) > 0.2 && v > sh && v <= top) { M = 0; A = 0; B = 0; L = abs(c) < 0.12 - (v - sh) * 2 ? 0.02 : v - sh < 0.007 ? 0.75 : 0.34; }     // a coat over the back, collar open, nobody in it
      if (v > top) { M = 0; A = 0; B = 0; L = v - top < 0.007 ? 0.6 : 0.08 + 0.03 * k; }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- reel: the projector, running, seen from behind and above. both spools are bare and the can beside it is empty
  S.reel = (u, v, f, o) => {
    const fl = [1, 0.85, 1, 0.9][f], ox = 0.66, oy = 0.7, bx = -0.3, by = -0.116, h = 0.2;
    let L = 0.04 + 0.05 * fbm(u * 5, v * 5), A = 0, M = 1;
    const tb = iso(u, v, 0.62, 1.2, 0.5, -0.15, -0.75, -0.29, 0.45);                                                                  // the bench
    if (tb) { M = 0; L = tb === 3 ? (W.t < 0.012 || W.s < 0.02 ? 0.6 : fr(W.s * 7) < 0.04 ? 0.04 : 0.15 + 0.1 * fbm(W.s * 3, W.t * 70)) : tb === 1 ? 0.08 : 0.03; if (tb === 3) A = 0.4 * fl * exp(-hypot(u - 0.78, v - 0.71) * 11); }
    const can = ell(u, v, 0.27, 0.535, 0.075, 0.034);
    if (ell(u, v, 0.27, 0.555, 0.075, 0.034) < 1 || can < 1) { M = 0; A = 0; L = can > 1 ? 0.3 : can > 0.8 ? 0.85 : 0.02; }
    const al = (u - 0.285) * -0.933 + (v - 0.397) * -0.36, pp = (u - 0.285) * 0.36 - (v - 0.397) * 0.933, ac = abs(pp) / (0.028 + al * 0.3);
    if (al > 0 && ac < 1) { A = 0.6 * (1 - ac * ac) * (0.5 + 0.5 * fbm(u * 14 + f * 0.7, v * 14)) * fl; if (hash(floor(u * 90), floor(v * 90) + f) > 0.985) A = 1; }   // the throw, and the dust in it
    if (dSeg(u, v, 0.43, 0.453, 0.285, 0.397) < 0.034) { M = 0; A = 0; L = abs(fr(al * 30) - 0.5) < 0.12 ? 0.05 : cl(0.3 + 9 * pp, 0.06, 0.85); }      // the lens barrel
    const gl = ell(u + (v - 0.397) * 0.3, v, 0.279, 0.397, 0.015, 0.032);
    if (gl < 1) { M = 0; L = gl > 0.7 ? 0.8 : 0; A = gl > 0.7 ? 0 : fl; }
    const k = iso(u, v, ox, oy, 0.14, -0.042, bx, by, h), s = W.s, t = W.t;
    if (k) {
      M = 0; A = 0;
      if (k === 3) L = t > 0.96 || s < 0.05 ? 0.85 : 0.5 - 0.15 * t;
      else if (k === 1) {                                                                                                          // the back of the lamp house, and its little window
        const r = hypot((s - 0.5) * 0.8, t - 0.45);
        L = s < 0.07 || t < 0.05 ? 0.5 : t > 0.93 ? 0.03 : 0.1;
        if (r < 0.2) { L = r > 0.15 ? 0.7 : 0; A = r > 0.15 ? 0 : 0.9 * fl; }
      } else {
        const r = hypot((s - 0.68) * 2, t - 0.52);
        L = t < 0.05 || s < 0.02 ? 0.8 : t > 0.93 ? 0.06 : abs(s - 0.4) < 0.008 ? 0.04 : 0.28;
        if (s > 0.06 && s < 0.34 && t > 0.2 && t < 0.78 && fr(t * 11) < 0.45) { L = 0; A = 0.85 * fl; }                                // vents
        if (r < 0.3) L = r > 0.25 ? 0.85 : r < 0.06 ? 0.95 : 0.42;
        if (hypot((s - 0.9) * 2, t - 0.7) < 0.05) L = 0.9;
      }
    }
    for (const [s0, as] of [[0.92, 0.7], [0.12, 0.3]]) {                                                                             // two arms, two bare spools, turning
      const ps = (u - ox) / bx, dx = (ps - s0) * 0.4, dy = (ps * by - (v - oy)) - 1.3 * h, r = hypot(dx, dy) / 0.088, an = Math.atan2(dy, dx) + (f * PI) / 6;
      if (dSeg(u, v, ox + as * bx, oy + as * by - h, ox + s0 * bx, oy + s0 * by - 1.3 * h) < 0.011) { M = 0; A = 0; L = 0.45; }
      if (r < 1 && (r > 0.86 || r < 0.22 || abs(fr(an / ((2 * PI) / 3)) - 0.5) < 0.1)) { M = 0; A = 0; L = r > 0.86 ? 0.9 : r < 0.08 ? 0.05 : 0.6; }
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- reeds: the creek from the bank, through cattails. a boat nobody has bailed. something long goes by under the surface
  S.reeds = (u, v, f, o) => {
    const hz = 0.3, d = (v - hz) / (1 - hz), ph = f < 4 ? f : (f - 4) % 4, p = f - 4;   // ph = where the sway is, p = how far across it has got (under 0: not here)
    let L, A = 0, M = 1;
    if (v < hz) { L = 0.24 + 0.28 * ss(0, hz, v) + 0.18 * ss(0.5, 0.8, fbm(u * 3, v * 12)); if (v > hz - 0.05 - 0.05 * fbm(u * 7, 2)) { L = 0.02; M = 0; } }
    else {
      L = 0.17 + 0.36 * ss(0.4, 0.75, fbm(u * (12 - 7 * d) + ph * 0.25, v * 70)) * (0.4 + d);
      const wk = p < 0 ? 9 : (u + 0.4 - p * 0.28) / 0.34;
      if (wk > 0 && wk < 1 && abs(v - 0.47 - 0.012 * sin(wk * 9)) < 0.014 * sin(wk * PI)) { L = 0; M = 0; }                             // it
      if (wk > -0.5 && wk < 0.05 && abs(v - 0.47) < 0.006 - 0.012 * wk && hash(floor(u * 150), floor(v * 150) + p) > 0.9) A = 1;                        // and what it leaves on the water
      const k = (u - 0.66) / 0.2, by = 0.62 + 0.004 * (ph % 2);
      if (abs(k) < 1 && v > by - 0.025 - 0.035 * k * k * k * k + 0.025 * k && v < by + 0.06 * (1 - k * k)) { M = 0; const in_ = v < by - 0.008 + 0.025 * k; L = in_ ? (abs(k + 0.4) < 0.03 || abs(k - 0.28) < 0.03 ? 0.25 : abs(k) < 0.3 && v > by - 0.02 + 0.025 * k ? 0.5 : 0.95) : fr((v - by) * 55 - k * k * 2) < 0.22 ? 0.2 : 0.03; if (abs(k - 0.1) < 0.5 && v > by + 0.006 && v < by + 0.014) L = 0.6; }   // thwarts, and the water in her
      if (dSeg(u, v, 0.585, 0.612, 0.83, 0.545) < 0.0035 || ell(u, v, 0.845, 0.54, 0.022, 0.009) < 1) { M = 0; L = 0.8; }                // an oar, shipped
      if (abs(u - 0.47 - 0.01 * sin(v * 60)) < 0.002 && v > by - 0.03 && v < by + 0.05) { M = 0; L = 0.7; }                              // her painter, down into the water
    }
    for (let i = 0; i < 8; i++) {
      const x0 = 0.04 + i * 0.13 + 0.05 * hash(i, 4), top = 0.12 + 0.4 * hash(i, 9), lean = (hash(i, 2) - 0.5) * 0.16, sx = x0 + (lean + 0.012 * sin(ph * 1.57 + i)) * (1 - v);
      if (i === 5) continue;                                                                                                       // leave the boat in view
      if (v > top && abs(u - sx) < 0.005 + 0.004 * v) { L = 0; M = 0; }
      if (ell(u, v, sx, top + 0.08, 0.017, 0.065) < 1) { L = u < sx - 0.004 ? 0.55 : 0.02; M = 0; }                                    // the heads
      for (const sd of [-1, 1]) if (dSeg(u, v, x0 + sd * 0.01, 1, x0 + sd * (0.07 + 0.05 * hash(i, sd + 5)), top + 0.25 + 0.1 * hash(i, sd)) < 0.006 * (0.4 + v)) { L = 0.03; M = 0; }
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- willow: it has grown over the footbridge until the bridge is mostly willow. something is tied to the rail
  S.willow = (u, v, f, o) => {
    const arch = 0.72 - 0.08 * (1 - ((u - 0.55) / 0.5) ** 2), col = floor(u * 40), len = (0.25 + 0.45 * hash(col, 3)) * ss(0.95, 0.5, u) + 0.12;
    let L = 0.34 + 0.3 * ss(0.8, 0.1, v) + 0.2 * ss(0.5, 0.8, fbm(u * 3, v * 10)), A = 0, M = 1;
    if (v > 0.56 - 0.05 * fbm(u * 6, 3) && v < 0.66) { L = 0.03; M = 0; }                                                            // the far bank
    if (v >= 0.66) L = 0.14 + 0.4 * ss(0.45, 0.8, fbm(u * 8, v * 70 + f * 0.3));
    if (u > 0.08) {
      if (v > arch && v < arch + 0.04) { M = 0; L = v < arch + 0.01 ? 0.95 : fr(u * 26) < 0.12 ? 0.03 : 0.3; }
      if (v > arch - 0.11 && v < arch && (fr(u * 12) < 0.09 || abs(v - arch + 0.11) < 0.008)) { M = 0; L = 0.85; }
    }
    if (hypot(u - 0.66, v - arch + 0.11) < 0.014 || (abs(u - 0.66 - 0.01 * sin(v * 40 + f * 1.57)) < 0.006 && v > arch - 0.11 && v < arch - 0.02)) { A = 1; L = 0; M = 0; }
    if (v > 0.9 - 0.2 * u + 0.03 * fbm(u * 8, 5) && u < 0.4) { L = fbm(u * 50, v * 30) > 0.6 ? 0.2 : 0.03; M = 0; }
    if (abs(u - 0.2 - 0.06 * (v - 0.5)) < 0.045 + 0.06 * ss(0.6, 1, v) + 0.04 * ss(0.3, 0, v)) { M = 0; A = 0; L = fbm(u * 80, v * 7) > 0.62 ? 0.16 : 0.01; }
    if (v < 0.12 + 0.08 * fbm(u * 6, 1) && u < 0.9) { M = 0; L = fbm(u * 40, v * 40) > 0.6 ? 0.2 : 0.02; }
    if (v < len && fr(u * 40 + 0.3 * sin(v * 6 + col + f * 0.5)) < 0.3) { M = 0; A = 0; L = fr(v * 50 + col * 0.3) < 0.2 ? 0.5 : 0.02; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- stairs: from the foot. the door at the top is ajar and the light behind it is bathroom light
  S.stairs = (u, v, f, o) => {
    const t = (1 - v) / 0.62, xl = 0.14 + 0.24 * t, xr = 0.8 - 0.2 * t, st = Math.log(1 - 0.78 * cl(t)) * -7;
    let L = fr(u * 16 + 0.3 * sin(v * 30)) < 0.3 ? 0.14 : 0.07, A = 0;
    if (inBox(u, v, 0.06, 0.2, 0.2, 0.36) && u < 0.14 + 0.24 * ((1 - v) / 0.62) - 0.03) L = abs(u - 0.13) > 0.055 || abs(v - 0.28) > 0.065 ? 0.6 : 0.03;
    if (v < 0.38) {
      L = fr(u * 16) < 0.3 ? 0.11 : 0.05;
      if (inBox(u, v, 0.4, 0.06, 0.6, 0.38)) { L = u < 0.41 || u > 0.59 || v < 0.075 ? 0.5 : 0.16; if (u > 0.55 && u < 0.59 && v > 0.075) { L = 0; A = [1, 0.9, 1, 0.6][f]; } if (hypot(u - 0.43, v - 0.24) < 0.008) L = 0.9; }
      else A = 0.45 * exp(-hypot(u - 0.57, (v - 0.3) * 0.6) * 9);
    } else if (u > xl && u < xr) {
      L = fr(st) < 0.42 ? 0.5 * (0.4 + 0.6 * ss(xl, xr, u)) + 0.1 : 0.04;
      if (abs(u - (xl + xr) / 2) < (xr - xl) * 0.22) L = fr(st) < 0.42 ? (fr(u * 40) < 0.5 ? 0.3 : 0.14) : 0.02;                          // the runner
      A = 0.3 * ss(0.62, 0.38, v) * (fr(st) < 0.42 ? 1 : 0);
    }
    const rd = dSeg(u, v, 0.86, 1.02, 0.63, 0.34);
    if (u > xr && v > 0.38 && v > 1.02 - (0.86 - u) * 2.96 + 0.02 && fr(v * 26) < 0.25) L = 0.55;                                    // spindles
    if (rd < 0.013) L = 0.85;
    if (inBox(u, v, 0.84, 0.72, 0.9, 1) || hypot(u - 0.87, v - 0.7) < 0.04) L = u < 0.87 ? 0.8 : 0.3;                                 // newel
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- hall: nine hooks by the mirror, eight keys. in one frame the mirror has somebody in it
  S.hall = (u, v, f, o) => {
    let L = v > 0.8 + 0.08 * u ? (fr((u - v) * 9) < 0.08 ? 0.03 : 0.16) : fr(u * 20 + v * 2) < 0.5 ? 0.12 : 0.07, A = 0;
    if (wall(u, v, 0.05, 0.62, 0.3, 0.33, 0.46, 0.5)) L = W.t < 0.1 || W.t > 0.9 ? 0.7 : 0.3;
    for (let i = 0; i < 9; i++) {
      const hx = 0.09 + i * 0.062, hy = 0.37 + i * 0.0035;
      if (hypot(u - hx, v - hy) < 0.008) L = 0.95;
      if (i === 6) { if (abs(u - hx) < 0.004 && v > hy + 0.05 && v < hy + 0.13 || abs(hypot(u - hx, v - hy - 0.035) - 0.013) < 0.004) A = 0.6; continue; }   // where the ninth hung, the paper has not faded
      if (abs(hypot(u - hx, v - hy - 0.035) - 0.013) < 0.005 || (abs(u - hx) < 0.004 && v > hy + 0.045 && v < hy + 0.14) || (u > hx && u < hx + 0.014 && (abs(v - hy - 0.12) < 0.004 || abs(v - hy - 0.135) < 0.004))) L = 0.9;
    }
    const mr = ell(u, v, 0.8, 0.36, 0.13, 0.22);
    if (mr < 1) {
      L = mr > 0.86 ? 0.85 : 0.2 + 0.25 * fbm(u * 4, v * 9);
      if (mr <= 0.86 && inBox(u, v, 0.74, 0.24, 0.83, 0.6)) L = 0.02;
      if (mr <= 0.86 && f === 3 && (hypot(u - 0.785, v - 0.34) < 0.022 || (abs(u - 0.785) < 0.035 && v > 0.37))) { L = 0.02; A = hypot(abs(u - 0.785) - 0.008, v - 0.337) < 0.004 ? 1 : 0; }
    }
    if (abs(v - 0.8 - 0.08 * u) < 0.012) L = 0.5;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- radio: a wireless on a dresser, seen from above its corner. warm, tuned between stations. the needle will not stay
  S.radio = (u, v, f, o) => {
    const fl = [1, 0.85, 1, 0.7][f], sl = v + 0.3 * u, glow = fl * exp(-hypot(u - 0.75, (v - 0.53) * 1.6) * 7), pf = ell(u, sl, 0.17, 0.36, 0.07, 0.115);
    let L = fr(u * 9) < 0.3 ? 0.12 : 0.06, A = 0.2 * fl * exp(-hypot(u - 0.72, v - 0.33) * 7);
    if (abs(sl - 0.19) < 0.012) L = 0.4;                                                                                           // picture rail
    if (pf < 1) { L = pf > 0.78 ? 0.7 : 0.1; A = 0; if (pf <= 0.78 && (hypot(u - 0.17, sl - 0.34) < 0.024 || (abs(u - 0.17) < 0.042 && sl > 0.38))) L = 0.02; }   // somebody, in an oval frame
    const d = iso(u, v, 0.3, 1.25, 0.9, -0.27, -0.26, -0.1, 0.58);                                                                 // the dresser
    if (d === 3) {
      const s = W.s, t = W.t;
      L = t < 0.035 || s < 0.012 ? 0.85 : 0.34 + 0.06 * fbm(s * 60, t * 4); A = 0.55 * glow;
      if (s > 0.16 && s < 0.86 && t > 0.14 && t < 0.88) L = s < 0.175 || t < 0.17 || t > 0.85 ? ((floor(s * 140) + floor(t * 40)) & 1 ? 0.9 : 0.2) : (floor(s * 70) + floor(t * 20)) & 1 ? 0.8 : 0.5;   // a runner, and its lace edge
    } else if (d === 1) {
      const cs = fr(W.s * 2.2 + 0.08), ct = fr(W.t * 4 + 0.02);
      A = 0; L = cs < 0.03 || ct < 0.07 ? 0.02 : 0.17 + 0.05 * fbm(W.s * 40, W.t * 4);
      if (hypot((cs - 0.5) / 0.07, (ct - 0.52) / 0.13) < 1) L = 0.9;                                                                 // drawer pulls
    } else if (d === 2) { A = 0; L = W.s < 0.1 || W.s > 0.9 || W.t < 0.04 ? 0.03 : 0.08; }
    const r = iso(u, v, 0.433, 0.586, 0.378, -0.113, -0.143, -0.055, 0.3), s = W.s, t = W.t;
    if (r === 3) { A = 0; L = t < 0.1 || s < 0.04 ? 0.9 : 0.5 - 0.2 * t; }
    else if (r === 2) { A = 0; L = t < 0.05 ? 0.5 : s < 0.08 || s > 0.92 || t > 0.94 ? 0.04 : 0.12 + 0.04 * fbm(s * 3, t * 30); }
    else if (r === 1) {
      const dr = hypot((s - 0.75) * 1.3, t - 0.42), an = Math.atan2(0.42 - t, (s - 0.75) * 1.3);
      A = 0; L = s < 0.035 || s > 0.965 || t < 0.05 ? 0.85 : t > 0.94 ? 0.06 : 0.3 + 0.1 * fbm(s * 3, t * 40);
      if (hypot(max(abs(s - 0.3) - 0.14, 0) * 1.3, max(abs(t - 0.5) - 0.26, 0)) < 0.09) L = fr(s * 40) < 0.4 ? 0.02 : 0.45;             // cloth
      if (dr < 0.24) { L = dr > 0.19 ? 0.9 : 0; if (dr <= 0.19) A = dr < 0.03 || abs(an - PI * (0.35 + 0.1 * [0, 1, 3, 1][f])) < 0.09 ? 0 : (dr > 0.13 && abs(fr((an * 7) / PI) - 0.5) < 0.14 ? 0.3 : 0.95) * fl; }
      for (const kx of [0.2, 0.42]) { const kr = hypot((s - kx) * 1.3, t - 0.86); if (kr < 0.06 && L < 0.6) L = 0.02; }
      for (const kx of [0.64, 0.86]) { const kr = hypot((s - kx) * 1.3, t - 0.82); if (kr < 0.075) L = kr > 0.055 ? 0.9 : abs(s - kx + (t - 0.82)) < 0.012 ? 0.02 : 0.55; }
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- ferns: the forest floor. the mushrooms have come up in a ring and one of them is lit
  const FROND = [[0.02, 0.6, 0.5, -0.5, 0.5], [0.98, 0.56, -0.48, -0.42, 0.46], [0.3, 1.02, -0.28, -0.4, 0.4], [0.72, 1.04, 0.24, -0.42, 0.42], [0.5, 0.36, -0.36, -0.3, 0.36], [0.56, 0.34, 0.4, -0.26, 0.38], [0.1, 0.2, 0.3, -0.24, 0.3], [0.9, 0.18, -0.3, -0.2, 0.3]];
  S.ferns = (u, v, f, o) => {
    let L = fbm(u * 26, v * 26) > 0.6 ? 0.14 : 0.03, A = 0;
    const draw = ([bx, by, dx, dy, w]) => {
      const n = hypot(dx, dy), t = ((u - bx) * dx + (v - by) * dy) / (n * n), d = ((u - bx) * dy - (v - by) * dx) / n + 0.12 * t * t;
      if (t < 0 || t > 1) return;
      if (abs(d) < 0.004) L = 0.5;
      else if (abs(d) < w * 0.3 * (1 - t) * (0.12 + abs(sin(t * 44)))) L = sin(t * 44) * d > 0 ? 0.62 : 0.3;
    };
    FROND.slice(4).forEach(draw);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 2 * PI + 0.3, s = 1 + 0.5 * sin(a), cx = 0.5 + 0.27 * cos(a), cy = 0.68 + 0.11 * sin(a) + 0.004 * hash(i, 1), r = 0.03 * s, lit = i === 2;
      if (abs(u - cx) < r * 0.22 && v > cy && v < cy + r * 1.3) { L = 0.75; A = 0; }
      if (ell(u, v, cx, cy, r, r * 0.75) < 1 && v < cy + r * 0.12) { L = lit ? 0 : v < cy - r * 0.35 ? 0.92 : 0.5; A = lit ? [1, 0.8, 1, 0.9][f] : 0; }
      else if (lit) A = max(A, 0.55 * [1, 0.8, 1, 0.9][f] * exp(-hypot(u - cx, v - cy) * 16));
    }
    FROND.slice(0, 4).forEach(draw);
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- armchair: turned a little away. the standard lamp beside it lights one half and the rest goes to the dark. a little red behind it, and fingers over the top of the back
  const FING = [[-0.012, 0.03], [0.008, 0.044], [0.028, 0.04], [0.048, 0.026]];
  S.armchair = (u, v, f, o) => {
    const fl = [1, 0.9, 1, 0.95][f], fy = 0.76 - 0.05 * u, x = u - 0.44, ax = abs(x), y = 0.5 + (v - 0.5) / (1 - 0.22 * x), sh = 0.075, xb = x + sh, ab = abs(xb), g = fl * exp(-hypot(xb, (v - 0.27) * 1.3) * 9);
    const cn = abs(u - 0.8) / (0.09 + (v - 0.3) * 0.26), cone = v > 0.3 && cn < 1 ? (1 - cn * cn * cn) * ss(0.64, 0.3, v) : 0, lit = ss(-0.26, 0.2, x);
    let L = v > fy ? (fr(((u - 0.4) / (v - fy + 0.25)) * 3) < 0.07 ? 0.02 : 0.07) : fr(u * 12 + 0.3 * sin(v * 16)) < 0.25 ? 0.08 : 0.04, A = v > fy ? 0 : g, B = 0.5 * cone;
    const rug = ell(u, v, 0.45, 0.92, 0.46, 0.08);
    if (rug < 1) L = fr(rug * 5) < 0.3 ? 0.2 : 0.08;
    if (v > fy) B = max(B, 0.12 * ss(1, 0.2, hypot((u - 0.8) / 0.19, (v - 0.87) / 0.06)));
    if ((abs(u - 0.8) < 0.005 && v > 0.3 && v < 0.875) || ell(u, v, 0.8, 0.88, 0.05, 0.014) < 1) { L = u < 0.8 ? 0.15 : 0.5; A = 0; B = 0; }
    if (v > 0.17 && v <= 0.3 && abs(u - 0.8) < 0.035 + (v - 0.17) * 0.42) { L = 0; A = 0; B = 0.45 + 0.5 * ss(0.17, 0.3, v); }           // the shade
    let c = -1, rim = 0;
    const sd = (x + 0.248) / sh;                                                                                                    // 0 at the front of the near arm, -1 at the back of it
    if (sd > -1 && sd <= 0 && y > 0.6 + 0.09 * sd && y < 0.835 + 0.04 * sd) c = y < 0.615 + 0.09 * sd ? 0.3 : 0.13;                      // the side of the chair we can see round
    if (abs(xb + 0.2) < 0.012 && y >= 0.79 && y < 0.83) c = 0.2;
    if (xb > -0.225 && ab < 0.2 && y > 0.22 && y < 0.66 && !(ab > 0.14 && y < 0.28 && hypot(ab - 0.14, y - 0.28) > 0.06)) {              // the back, buttoned
      const dq = abs(fr(xb * 7 + y * 7) - 0.5), de = abs(fr(xb * 7 - y * 7) - 0.5), top = y < 0.245 || (ab > 0.14 && y < 0.28 && hypot(ab - 0.14, y - 0.28) > 0.035);
      c = top || ab > 0.185 ? 0.8 : dq < 0.035 || de < 0.035 ? 0.2 : 0.5; rim = top || xb < -0.185;
      if (!top && ab < 0.185 && hypot(dq, de) < 0.06) c = 0.95;
    }
    const xa = x + sh * cl((0.6 - y) / 0.1), aa = abs(xa);
    if (aa > 0.14 && aa < 0.24 && y > 0.5 && y < 0.6) c = xa < 0 ? 0.5 : 0.6;                                                          // the tops of the arms, going back
    if (x > 0.15 - sh * cl((0.7 - y) / 0.1) && x < 0.16 && y >= 0.55 && y < 0.7) c = 0.24;                                              // the inside of the far arm
    if (y >= 0.6 && y < 0.7 && abs(x + sh * (0.7 - y) * 10) < 0.15 + (y - 0.6) * 0.25) c = 0.62 - (y - 0.6) * 1.5;                       // the seat
    if (y >= 0.7 && y < 0.74 && ax < 0.175) c = y < 0.708 ? 0.9 : 0.36;
    if (y >= 0.74 && y < 0.83 && ax < 0.16) c = y > 0.815 ? 0.5 : 0.2;
    if (abs(ax - 0.2) < 0.048 && y >= 0.6 && y < 0.835) c = abs(ax - 0.2) > 0.04 ? 0.6 : 0.3;                                          // the fronts of the arms, and their scrolls
    const sc = hypot(ax - 0.2, y - 0.6) / 0.054;
    if (sc < 1) c = sc > 0.8 ? 0.85 : sc < 0.2 ? 0.9 : abs(sc - 0.5) < 0.08 ? 0.2 : 0.42;
    if (abs(ax - 0.2) < 0.014 && y >= 0.835 && y < 0.875) c = 0.4;
    if (c >= 0) { L = c * (0.1 + Math.pow(lit, 1.4)); B = c > 0.25 ? 0.42 * lit * lit * c : 0; A = rim ? 1.4 * g : 0; }
    for (const [fx, len] of FING) {                                                                                                // they do not move
      const d = dSeg(xb, y, fx, 0.203, fx + (fx - 0.018) * 0.18, 0.222 + len) + 0.003 * cl((y - 0.215) / len);
      if (d < 0.0065 || hypot(xb - fx, y - 0.202) < 0.0085) { L = 0; A = 0; B = 0; } else if (d < 0.0095 && xb > fx && y > 0.225) { L = 0.7; A = 0; B = 0; }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = 0;
  };

  // --- mantel: a stopped clock. every photograph turned to the wall but one
  S.mantel = (u, v, f, o) => {
    const sy = 0.56 - 0.06 * u;
    let L = fr(u * 12 + 0.2 * sin(v * 20)) < 0.25 ? 0.13 : 0.07, A = 0;
    if (v > sy + 0.05) { L = fr(u * 5 + v * 0.4) < 0.05 || fr((v - sy) * 6) < 0.08 ? 0.03 : 0.2; if (inBox(u, v, 0.26, sy + 0.16, 0.8, 1)) L = fbm(u * 20, v * 20) > 0.66 ? 0.07 : 0; }
    if (v > sy && v <= sy + 0.05) L = v < sy + 0.012 ? 0.9 : 0.4;
    [[0.1, 0], [0.24, 0], [0.56, 1], [0.72, 0], [0.88, 0]].forEach(([fx, face], i) => {
      const by = 0.56 - 0.06 * fx, w = 0.055, h = 0.17 - 0.02 * (i & 1), x = (u - fx) / w, y = (by - v) / h;
      if (abs(x) >= 1 || y <= 0 || y >= 1) return;
      L = abs(x) > 0.82 || y < 0.07 || y > 0.93 ? 0.8 : 0.34;
      if (!face) { if (abs(abs(x) - y * 0.6) < 0.08 && y < 0.7) L = 0.1; return; }                                                  // the back of it, and its strut
      if (abs(x) <= 0.82 && y >= 0.07 && y <= 0.93) { L = 0.75; if (hypot(x / 0.34, (y - 0.62) / 0.16) < 1 || (abs(x) < 0.6 - (y - 0.1) * 0.6 && y < 0.44)) { L = 0.03; if (hypot(abs(x) - 0.13, (y - 0.63) * 2.2) < 0.06 && f === 3) A = 1; } }
    });
    const cy = sy - 0.132, r = hypot(u - 0.39, v - cy) / 0.115;
    if (r < 1 || inBox(u, v, 0.3, sy - 0.035, 0.48, sy)) { L = r > 0.87 ? 0.9 : 0.7; if (r < 0.87 && (dSeg(u, v, 0.39, cy, 0.39, cy - 0.078) < 0.007 || dSeg(u, v, 0.39, cy, 0.44, cy + 0.026) < 0.007 || r < 0.07 || (abs(fr((Math.atan2(v - cy, u - 0.39) * 6) / PI) - 0.5) > 0.44 && r > 0.68))) L = 0.02; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- ceiling: looking up into the corner of the room. the lamp hangs dark and throws its light down, none up. the stain is where the bath is, and it drips
  S.ceiling = (u, v, f, o) => {
    const hz = 0.75, Z = 0.45 / max(hz - v, 1e-3), X = (u - 0.6) * Z, left = X < -0.744, cn = abs(u - 0.4) / (0.075 + (v - 0.43) * 0.5), cone = v > 0.43 && cn < 1 ? (1 - cn * cn) * ss(1.05, 0.45, v) : 0;
    let L, A = 0, B = 0.6 * cone;
    if (v < 0.52 && !left) {                                                                                                       // the ceiling, going away from us
      const r = hypot((X - 0.12) / 0.3, (Z - 1.02) / 0.32) + 0.7 * (fbm(X * 5 + 2, Z * 5) - 0.5);
      L = fr(Z * 5) < 0.03 || fr(X * 5) < 0.02 ? 0.2 : 0.3 + 0.1 * fbm(X * 3, Z * 3);
      if (r < 0.95) { L = r > 0.9 ? 0.09 : fr(r * 4.2) < 0.15 ? 0.13 : 0.26 + 0.04 * fbm(X * 9, Z * 9); A = r < 0.3 ? 0.3 * ss(0.3, 0.05, r) : 0; }
      if (v > 0.5 || X < -0.7) L = 0.7;                                                                                             // cornice
      if (hypot(X + 0.3, (Z - 1.42) * 0.9) < 0.06) L = 0.55;                                                                         // the rose the flex comes out of
    } else if (left) { const t = (v - hz) / (u - 0.6); L = abs(t - 0.4) < 0.012 ? 0.3 : fr(Z * 7) < 0.3 ? 0.07 : 0.04; }                // the near wall
    else L = abs(v - 0.6) < 0.008 ? 0.4 : fr(u * 14) < 0.3 ? 0.13 : 0.07;                                                           // the far wall
    if (abs(u - 0.4) < 0.004 && v > 0.115 && v < 0.33) { L = 0; A = 0; }
    if (v >= 0.32 && v < 0.43 && abs(u - 0.4) < 0.02 + (v - 0.32) * 0.5) { L = 0; A = 0; B = 0; }                                       // the shade, from below and to one side: dark
    const op = ell(u, v, 0.4, 0.43, 0.075, 0.017);
    if (op < 1) { L = 0; B = op > 0.75 ? 0.5 : 0.95; }                                                                              // and up inside it, the bulb
    if (hypot(u - 0.665, (v - 0.4 - 0.13 * f) * 0.6) < 0.011 && v > 0.36) { A = 1; L = 0; B = 0; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = 0;
  };

  // --- gorse: the path up the head to the foot of the light. the padlock is hanging open
  S.gorse = (u, v, f, o) => {
    const gy = 0.5 - 0.16 * u + 0.03 * fbm(u * 5, 1), dm = hypot(u - 0.16, v - 0.14), px = 0.78 - 0.3 * (v - 0.43) + 0.2 * sin((v - 0.43) * 6) * (1 - v), pw = 0.02 + 0.2 * (v - gy) * (v - gy) + 0.05 * (v - gy);
    let L = 0.1 + 0.25 * ss(0, 0.5, v) + 0.2 * exp(-dm * 5) + 0.16 * ss(0.5, 0.8, fbm(u * 3, v * 12)), A = 0, M = 1;
    if (dm < 0.05) { A = 1; L = 0; } else A = 0.4 * exp(-(dm - 0.05) * 16);
    if (v > 0.4 && v <= gy + 0.2 && u < 0.5) { L = 0.05 + 0.3 * ss(0.5, 0.8, fbm(u * 12 + f * 0.3, v * 90)); A = abs(u - 0.16) < 0.03 + (v - 0.4) * 0.2 && fbm(u * 26 + f, v * 120) > 0.5 ? 1 : 0; }
    if (v > gy) {
      M = 0; A = 0; L = fbm(u * 50, v * 26) > 0.58 ? 0.2 : 0.04;
      if (abs(u - px) < pw) L = 0.5 + 0.3 * hash(floor(u * 70), floor(v * 70));
      else if (fbm(u * 7 + 3, v * 9) > 0.5) { const b = fbm(u * 60, v * 60); L = b > 0.66 ? 0.02 : 0.1; if (hash(floor(u * 110), floor(v * 110)) > 0.9 && b < 0.6) { L = 0; A = 0.9; } }   // gorse, in flower
    }
    const tx = (u - 0.8) / (0.1 + 0.12 * v);
    if (abs(tx) < 1 && v < 0.43) {
      M = 0; A = 0; L = (floor((v + 0.08) / 0.17) & 1 ? 1 : 0.1) * (tx > 0.35 ? 0.4 : 1);
      const dx = (u - 0.78) / 0.045, dy = (v - 0.36) / 0.07;
      if (abs(dx) < 1 && dy < 1 && (dy > -0.4 || hypot(dx, (dy + 0.4) / 0.6) < 1)) { L = abs(dx) > 0.8 || dy < -0.75 ? 0.9 : 0; if (sigil(dx * 1.7, (dy - 0.05) * 2.2, 0, 0.1) && abs(dx) < 0.6) L = 0.7; if (hypot(dx - 0.55, (dy - 0.5) * 1.5) < 0.17) L = 1; }
    }
    // an old thorn at our shoulder: we are looking round it. the moon is on its near edge
    const te = 0.915 - 0.03 * sin(v * 4 + 1) - 0.1 * ss(0.55, 0.95, v) * ss(0.55, 0.95, v), xc = (u - te) / 0.3 - 1, bt = (0.97 - u) / 0.4, bd = v - 0.2 + 0.14 * bt + 0.05 * bt * bt;
    if (bt > 0 && bt < 1.1 && abs(bd) < 0.04 - 0.028 * bt) { M = 0; A = 0; L = bd < -(0.04 - 0.028 * bt) * 0.4 ? 0.3 : fr(bt * 9 + bd * 30) < 0.25 ? 0.02 : 0.08; }   // a bough, out over the path
    for (let k = 0; k < 6; k++) { const tx = 0.6 + k * 0.055, ty = 0.2 - 0.14 * ((0.97 - tx) / 0.4); if (dSeg(u, v, tx, ty, tx - 0.02 + 0.012 * (k & 1), ty + 0.05 + 0.04 * hash(k, 3)) < 0.004) { M = 0; A = 0; L = 0.02; } }
    if (xc > -1) {
      const c = Math.asin(cl(xc, -1, 1)), kn = ell(u, v, 0.955, 0.52, 0.03, 0.05);
      M = 0; A = 0; L = xc < -0.96 ? 0.85 : fr(c * 8 + 1.3 * vn(v * 6, c * 3)) < 0.3 ? 0.02 : 0.08 + 0.4 * ss(-0.55, -1, xc) + 0.06 * fbm(u * 60, v * 9);
      if (kn < 1) L = kn < 0.35 ? 0 : fr(kn * 3) < 0.4 ? 0.03 : 0.3;
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- doors: it stops. it has never stopped. the door at the front folds open. nobody is at the wheel. in every window a face, side on
  // a head side on, facing +x, in units of its own half width. k picks the hair or the hat
  const profile = (x, y, k) => {
    const fx = y < 0 ? 0.78 : y < 0.38 ? 0.78 + 0.9 * y : y < 0.5 ? 0.78 + 2.85 * (0.5 - y) : y < 0.62 ? 0.75 : y < 0.82 ? 0.85 : y < 0.92 ? 0.74 : 0.84 - (y - 0.92) * 1.2;
    if (ell(x, y, -0.05, -0.1, 0.95, 0.9) < 1 || (y > -0.3 && y < 1.16 - 0.3 * cl((0.6 - x) / 1.1) && x > -0.5 && x < fx)) return true;
    if ((x > -0.55 && x < 0.2 && y > 0.6 && y < 1.5) || ell(x, y, -0.2, 2.02, 2.1, 0.8) < 1) return true;
    if (k < 0.22) return false;
    if (k < 0.45) return hypot(x + 1.05, y - 0.2) < 0.45 || ell(x, y, -0.15, -0.25, 1.02, 0.9) < 1;                                    // a bun
    if (k < 0.68) return (abs(y + 0.52) < 0.1 && x > -1.3 && x < 1.5) || (abs(x) < 0.92 && y > -1.3 - 0.1 * x && y < -0.5);            // a hat
    if (k < 0.85) return x > -1.1 && x < -0.2 && y > -0.6 && y < 1.5;                                                                 // long hair
    return ell(x, y, 0.1, -0.75, 1.0, 0.45) < 1;                                                                                    // a quiff
  };
  S.doors = (u, v, f, o) => {
    const fl = [1, 0.95, 1, 0.9][f], gy = 0.735 + 0.07 * u;
    let L = 0.07 + 0.12 * ss(0.5, 0.8, fbm(u * 3, v * 9)), A = 0, B = 0, M = 1;
    if (v > 0.26 - 0.1 * fbm(u * 5, 3) && v < gy) { L = fbm(u * 46, v * 46) > 0.66 ? 0.09 : 0.015; M = 0; }                             // the hedge it came along
    if (v >= gy) {
      const sp = hypot((u - 0.62 - (v - gy) * 0.5) / (0.09 + (v - gy) * 1.1), (v - gy) / 0.2);
      M = 0; L = abs(v - gy - 0.035) < 0.004 ? 0.3 : 0.03 + 0.07 * hash(floor(u * 80), floor(v * 80)); B = 0.34 * fl * ss(1, 0.1, sp);
    }
    for (const hx of [0.77, 0.87]) B = max(B, 0.5 * fl * exp(-hypot(u - hx, (v - 0.69) * 1.2) * 16));
    // the side, in its own plane: X along the bus in body heights (0 at the back, 3.5 at the front), Y down from the roof line
    const s = (u - 0.02) / 0.72, hh = 0.285 + 0.29 * s, Y = (v - 0.37 + 0.17 * s) / hh, X = (2.0125 * s) / hh;
    if (s >= 0 && s < 1 && Y > -0.05 && Y < 1.09) {
      const wr = min(hypot(X - 0.7, Y - 0.93), hypot(X - 2.5, Y - 0.93));
      if (wr < 0.15) { M = 0; B = 0; L = wr < 0.045 ? 0.7 : wr < 0.085 ? 0.25 : wr > 0.135 ? 0.12 : 0.02; }
      else if (Y < 0.94 && !(X < 0.3 && Y < 0.25 && hypot(X - 0.3, Y - 0.25) > 0.3) && !(X < 0.14 && Y > 0.8 && hypot(X - 0.14, Y - 0.8) > 0.14)) {
        const c = fr((X - 0.25) / 0.506), id = floor((X - 0.25) / 0.506), R = 0.058 + 0.008 * hash(id, 1);
        M = 0; B = 0;
        L = wr < 0.2 ? 0.01 : Y < 0 ? 0.5 : Y < 0.1 ? 0.42 - 2.6 * Y : abs(Y - 0.5) < 0.018 ? 0.8 : abs(Y - 0.76 - 0.03 * sin(X * 1.8)) < 0.008 ? 0.45 : Y > 0.9 ? 0.07 : 0.2 + 0.25 * ss(3.3, 3.5, X);
        if (abs(wr - 0.21) < 0.012 && Y < 0.94) L = 0.5;                                                                             // the lip of the arch
        if (X > 0.25 && X < 2.78 && Y > 0.125 && Y < 0.465) {
          L = 0.34;
          if (hypot(max(abs(c - 0.51) * 0.506 - 0.165, 0), max(abs(Y - 0.295) - 0.105, 0)) < 0.05) {                                   // glass, and who is behind it
            L = 0.3 - 0.55 * (Y - 0.19); B = 0.03 * fl;
            if (profile((X - 0.25 - (id + 0.42 + 0.14 * hash(id, 2)) * 0.506) / R, (Y - 0.32 - 0.025 * hash(id, 3)) / R, hash(id, 4))) { L = 0; B = 0; }
          }
        }
        if (X > 2.9 && X < 3.4 && Y > 0.1) {                                                                                         // the door, folded back on itself
          L = 0; B = fl * (0.5 - 0.25 * Y);
          if (X < 2.925 || X > 3.375 || Y < 0.125) { B = 0; L = 0.75; }
          else if (X < 3.0 || X > 3.3) { B = Y < 0.5 && abs(fr(X * 20) - 0.5) < 0.3 ? 0.15 * fl : 0; L = B ? 0 : abs(Y - 0.5) < 0.012 ? 0.7 : 0.4; }
          else if (abs(X - 3.15) < 0.012 && Y < 0.72) { B = 0; L = 0.9; }
          else if (Y > 0.72) { const st = fr((Y - 0.72) / 0.074); B = st < 0.3 ? 0 : 0.26 * fl; L = st < 0.3 ? 0.12 : 0; }
        }
        if (Y > 0.89 && X > 3.25) L = 0.75;
      }
    }
    // its face, rounded, turned away up the road
    const s2 = (u - 0.74) / 0.16, t2 = (v - 0.2 - 0.05 * s2) / (0.575 - 0.085 * s2);
    if (s2 >= 0 && s2 < 1 && t2 > -0.05 - 0.035 * sin(PI * s2) && t2 < 0.97 && !(s2 > 0.7 && t2 < 0.12 && hypot((s2 - 0.7) / 0.3, (t2 - 0.12) / 0.2) > 1) && !(s2 > 0.82 && t2 > 0.87 && hypot((s2 - 0.82) / 0.18, (t2 - 0.87) / 0.1) > 1)) {
      const gr = ell(s2, t2, 0.5, 0.67, 0.3, 0.085);
      M = 0; B = 0; L = s2 < 0.07 ? 0.5 : t2 < 0.015 ? 0.38 : 0.2 - 0.13 * s2;
      if (t2 > 0.025 && t2 < 0.125 && s2 > 0.12 && s2 < 0.88) { L = 0.6; if (t2 > 0.038 && t2 < 0.112 && s2 > 0.15 && s2 < 0.85) { L = 0; A = fr(s2 * 9) < 0.6 ? 0.9 : 0.15; } }   // the blind
      if (hypot(max(abs(abs(s2 - 0.5) - 0.225) - 0.14, 0), max(abs(t2 - 0.315) - 0.12, 0) * 0.3) < 0.04) { B = 0.07 * fl; L = abs(s2 + t2 * 0.6 - 0.75) < 0.03 ? 0.2 : abs(ell(s2, t2, 0.74, 0.455, 0.13, 0.035) - 1) < 0.3 && t2 < 0.455 ? 0.4 : 0.06; }   // two panes, barely lit. a wheel, and nobody at it
      if (abs(t2 - 0.52) < 0.012) L = 0.7;
      if (gr < 1) L = gr > 0.85 ? 0.7 : fr(t2 * 50) < 0.45 ? 0.55 : 0.03;
      if (t2 > 0.9 && t2 < 0.955) L = 0.8;
      for (const hx of [0.17, 0.83]) { const r = hypot((s2 - hx) / 0.13, (t2 - 0.81) / 0.045); if (r < 1) { L = 0; B = r > 0.75 ? 0.5 : 1; } }
    }
    if (dSeg(u, v, 0.742, 0.345, 0.722, 0.315) < 0.004 || ell(u, v, 0.716, 0.3, 0.011, 0.024) < 1) { M = 0; L = 0.55; B = 0; }               // mirror
    if (abs(u - 0.955) < 0.005 && v > 0.36 && v < gy + 0.05) { L = 0.6; B = 0; M = 0; }
    const sr = hypot(u - 0.955, (v - 0.33) * 0.9);
    if (sr < 0.045) { M = 0; B = 0; L = sr > 0.037 || sigil((u - 0.955) / 0.034, (v - 0.33) / 0.038, 1) ? 0.03 : 0.85; }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- spiral: inside the light, looking up. the stair goes round further than the tower is tall
  S.spiral = (u, v, f, o) => {
    const x = u - 0.5, y = v - 0.46, r = hypot(x, y), a = Math.atan2(y, x), lr = Math.log(r + 1e-4), w = fr((a / (2 * PI)) * 14 + lr * 2.6 + f * 0.25), band = fr(lr * 2.2 - a / (2 * PI));
    let L = 0.04, A = 0;
    if (r < 0.52) L = (w < 0.5 ? 0.5 : 0.12) * ss(0.04, 0.3, r) * (band < 0.12 ? 0.2 : 1) + (w < 0.06 ? 0.3 : 0);
    else L = fr(a * 9 + lr * 3) < 0.5 ? 0.1 : 0.05;
    if (abs(band - 0.06) < 0.03 && r > 0.07) L = 0.85;                                                                              // the rail
    if (r < 0.05) { L = 0; A = [0.5, 0.7, 1, 0.7][f]; } else A = [0.5, 0.7, 1, 0.7][f] * 0.5 * exp(-r * 11);
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- bus: every seat is taken but one. shadow people, no two the same, every one of them looking at you while the lamps outside go by
  // a head from the front, in units of its own half width. k picks the hair or the hat
  const head = (x, y, k) => {
    const a = abs(x);
    if (ell(x, y, 0, -0.25, 1, 1.05) < 1 || (y > -0.3 && y < 1.3 && a < 0.98 - 0.56 * Math.pow(cl(y / 1.3), 1.7)) || ell(a, y, 1, 0.12, 0.16, 0.3) < 1 || (a < 0.42 && y > 1 && y < 2.3)) return true;
    if (k < 0.25) return false;
    if (k < 0.45) return ell(x, y, 0, -0.45, 1.32, 1.12) < 1;                                                                        // a lot of hair
    if (k < 0.65) return a < 1.22 && y < 2 && ell(x, min(y, -0.3), 0, -0.3, 1.22, 1.15) < 1;                                           // long hair
    if (k < 0.82) return (abs(y + 0.6) < 0.12 && a < 1.75) || (a < 0.95 && y > -1.5 && y < -0.6);                                       // a hat
    return hypot(x, y + 1.5) < 0.42;                                                                                               // a bun
  };
  S.bus = (u, v, f, o) => {
    const vx = 0.5, vy = 0.34, dx = u - vx, dy = v - vy, t = dy / (abs(dx) + 1e-4), lg = Math.log(abs(dx) + 0.02);
    let L, A = 0, B = 0;
    if (t < -0.55) { L = 0.16; if (abs(dx) < -dy * 0.1) { L = 0; B = fr(Math.log(-dy) * 2.5) < 0.6 ? 0.9 : 0.15; } }                   // ceiling, and its lamps
    else if (t > 1.1) L = fr(Math.log(dy) * 5) < 0.12 ? 0.08 : 0.26;                                                               // aisle
    else { L = 0.3; if (t > -0.42 && t < 0.1) { L = fr(lg * 2.2) < 0.12 ? 0.5 : 0; if (L === 0 && hash(floor(lg * 2.2 + f * 0.5), 3) > 0.75 && abs(t + 0.2) < 0.04) A = 1; } }   // windows, a lamp going by
    if (abs(dx) < 0.07 && abs(dy) < 0.075) { L = abs(dx) > 0.062 || abs(dy) > 0.067 ? 0.5 : 0.02; A = 0; B = 0; }                   // the windscreen. nobody at the wheel
    for (let k = 5; k >= 0; k--) for (const side of [-1, 1]) {
      const s = 0.72 ** k, cx = vx + side * 0.3 * s, top = vy + 0.28 * s, hw = 0.19 * s, x = (u - cx) / hw, empty = k === 0 && side < 0;
      if (abs(x) < 1 && v > top) { A = 0; B = empty && v < top + 0.02 * s ? 0.9 : 0; L = v < top + 0.02 * s ? 0.8 : abs(x) > 0.93 ? 0.5 : 0.34; }
      if (empty || v > top || abs(x) > 1.3) continue;
      for (const h of [-0.47, 0.47]) {
        const id = k * 4 + side + (h > 0 ? 3 : 1), R = (0.046 + 0.024 * hash(id, 1)) * s, hx = cx + (h + 0.1 * (hash(id, 4) - 0.5)) * hw, hy = top - (1.2 + 0.3 * hash(id, 3)) * R;
        const body = hypot((u - hx) / ((0.38 + 0.14 * hash(id, 5)) * hw), (v - top) / (0.05 * s)) < 1;
        if (!body && (abs(u - hx) > 3 * R || abs(v - hy) > 3 * R)) continue;
        const tl = hash(id, 7) > 0.5 ? (hash(id, 8) - 0.5) * 0.9 : 0, ct = cos(tl), st = sin(tl), X = ((u - hx) * ct + (v - hy) * st) / R, Y = ((v - hy) * ct - (u - hx) * st) / R;   // some hold their heads to one side
        if (body || head(X, Y, hash(id, 6))) { B = 0; L = Y < -0.6 && abs(ell(X, Y, 0, -0.25, 1, 1.05) - 0.93) < 0.07 ? 0.3 : 0.015; A = hypot(abs(X) - 0.4, Y - 0.1) * R < 0.0032 * s + 0.0012 ? 0.8 : 0; }
      }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = 0;
  };

  // --- lens: the lamp room, from the hatch. a round room of glass, the great lens on its pedestal in the middle. it takes. the beam shows you only what it is about to take
  S.lens = (u, v, f, o) => {
    const fl = [1, 0.8, 1, 0.9][f], x = (u - 0.5) / 0.47, q = Math.sqrt(max(0, 1 - x * x)), top = 0.14 - 0.14 * q, flo = 0.8 - 0.14 * q, fe = ell(u, v, 0.5, 0.8, 0.47, 0.14), glow = fl * exp(-hypot(u - 0.5, v - 0.42) * 3.6);
    let L = 0.015, A = 0, M = 0;
    if (abs(x) < 1 && v < top) L = abs(fr((Math.atan2(u - 0.5, v + 0.3) * 30) / PI) - 0.5) < 0.06 ? 0.3 : 0.07;                          // the dome, and its ribs
    else if (abs(x) < 1 && v < flo) {                                                                                              // the far half of the wall: glass above, iron below
      const t = (v - top) / 0.66, th = Math.asin(x), bc = abs(v - 0.42 + (u - 0.5) * 0.14) / (0.04 + (u - 0.6) * 0.3);
      if (t > 0.72) L = t < 0.745 ? 0.75 : abs(fr((th * 12) / PI + 0.5) - 0.5) < 0.03 ? 0.03 : 0.12 + 0.2 * q * glow;
      else {
        M = 1; A = 0.3 * glow;
        L = v < 0.31 ? 0.1 + 0.22 * ss(0.45, 0.8, fbm(u * 3, v * 12)) : hash(floor(u * 70), floor(v * 110)) > (t > 0.55 ? 0.95 : 0.985) ? 0.6 : 0.03;   // sky, then sea, then the town a long way down
        if (u > 0.6 && bc < 1) { A = max(A, 0.85 * (1 - bc * bc) * fl); M = 0; }
        if (abs(fr((th * 12) / PI + 0.5) - 0.5) < 0.035 || abs(t - 0.36) < 0.012 || t < 0.03) { M = 0; L = 0.3 + 0.5 * q * glow; A *= 0.4; }   // glazing bars
      }
    } else if (fe < 1) {
      const an = Math.atan2((v - 0.8) / 0.14, x), hatch = ell(u, v, 0.26, 0.86, 0.075, 0.03);
      L = fr(fe * 4) < 0.07 || abs(fr((an * 10) / PI) - 0.5) < 0.04 ? 0.03 : 0.14 + 0.3 * (1 - fe); A = 0.45 * fl * (1 - fe);
      if (hatch < 1) { L = hatch > 0.8 ? 0.6 : 0; A = 0; }                                                                           // the way you came up
    }
    if ((abs(abs(u - 0.26) - 0.03) < 0.005 && v > 0.76 && v < 0.86) || (abs(u - 0.26) < 0.03 && abs(v - 0.8) < 0.004)) { L = 0.8; A = 0; M = 0; }
    if ((abs(u - 0.5) < 0.07 && v > 0.61 && v < 0.8) || ell(u, v, 0.5, 0.8, 0.1, 0.032) < 1) { M = 0; A = 0; L = cl(0.32 - 3.5 * (u - 0.5), 0.05, 0.7) * (fr(v * 30) < 0.15 ? 0.3 : 1); }   // pedestal
    if (ell(u, v, 0.5, 0.62, 0.17, 0.05) < 1 || ell(u, v, 0.5, 0.605, 0.17, 0.05) < 1) { M = 0; A = 0; L = ell(u, v, 0.5, 0.605, 0.17, 0.05) < 1 ? (ell(u, v, 0.5, 0.605, 0.17, 0.05) > 0.85 ? 0.9 : 0.5) : 0.15; }
    const yn = (v - 0.4) / 0.2, w = 0.15 * Math.sqrt(max(0, 1 - 0.72 * yn * yn)), xl = (u - 0.5) / w;
    if (abs(yn) < 1 && abs(xl) < 1) {                                                                                              // the lens: rings of glass stacked like a hive, brass between
      const c = Math.asin(xl), vb = v - 0.032 * Math.sqrt(1 - xl * xl), belt = abs(vb - 0.385) < 0.05;
      M = 0; L = fr(vb * 20) < 0.2 ? 0.03 : 0.5 + 0.4 * cos(c * 3); A = 0.25 * fl;
      if (belt) { L = 0.04; A = fl * ss(1.15, 0.2, hypot(xl * 1.2, (vb - 0.385 + 0.012 * (f % 2)) / 0.05)); }
      if (abs(fr((c * 4) / PI + 0.5) - 0.5) < 0.05 || abs(yn) > 0.94) { L = 0.03; A = 0; }
    }
    if (ell(u, v, 0.5, 0.2, 0.075, 0.03) < 1 || (abs(u - 0.5) < 0.012 && v > 0.14 && v < 0.2)) { M = 0; A = 0; L = 0.6; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- rungs: looking up the shaft. a long way up, the moon, and once a loop somebody looking down
  S.rungs = (u, v, f, o) => {
    const x = u - 0.52, y = v - 0.4, r = hypot(x, y), a = Math.atan2(y, x), lr = Math.log(r + 1e-4) * 6, ring = floor(lr);
    let L = (fr(lr) < 0.1 || fr((a * 9) / PI + ring * 0.5) < 0.07 ? 0.02 : 0.1 + 0.34 * hash(floor((a * 9) / PI + ring * 0.5), ring)) * ss(0.06, 0.5, r) * 1.5, A = 0;
    if (abs(x) < r * 0.24 && y > 0 && fr(lr * 1.5 + 0.5) < 0.2) L = 0.92;
    if (y > 0 && abs(abs(x) - r * 0.24) < 0.004 + r * 0.02) L = 0.75;
    if (r < 0.09) { L = 0.35 + 0.3 * fbm(u * 20, v * 20); A = hypot(x + 0.03, y + 0.025) < 0.03 ? 1 : 0; if (f === 3 && (hypot(x - 0.04, y - 0.06) < 0.03 || (abs(x - 0.04) < 0.045 && y > 0.07))) { L = 0; A = 0; } }
    else A = 0.3 * exp(-(r - 0.09) * 14);
    o[0] = L; o[1] = A; o[2] = 0; o[3] = 0;
  };

  // --- pond: from the bank, through willow. pads, rings where something went under. in the water somebody is standing on the far bank. on the far bank nobody is
  S.pond = (u, v, f, o) => {
    const hz = 0.3, tr = (x) => abs(x - 0.33) > 0.07 && abs(fr(x * 7 + 0.3 * hash(floor(x * 7), 1)) - 0.5) < 0.1 + 0.12 * hash(floor(x * 7), 2);
    let L, M = 1;
    if (v < hz) {
      L = 0.36 + 0.14 * fbm(u * 3, v * 8);
      if (tr(u)) { L = 0.03 + 0.16 * ss(0.05, hz, v); M = 0; }
      if (v < 0.09 + 0.09 * fbm(u * 6, 1)) { L = fbm(u * 40, v * 40) > 0.6 ? 0.14 : 0.02; M = 0; }
      if (v > hz - 0.02 - 0.02 * fbm(u * 9, 3)) { L = 0.02; M = 0; }
    } else {
      const Z = 0.5 / (v - hz), X = (u - 0.5) * Z, d = v - hz, ur = u + 0.006 * sin(v * 70 + f * 1.57) * (1 + d * 8), dd = hypot(X + 0.5, Z - 1.9);
      L = 0.34 * ss(0.95, 0.3, v) + (fbm(X * 2, Z * 7 + f * 0.2) > 0.62 ? 0.16 : 0);
      if (tr(ur) && d < 0.3) L *= 0.2 + 2.6 * d;                                                                                     // the far trunks, upside down
      if (d < 0.2 && (abs(ur - 0.33) < 0.007 + 0.05 * d * (d < 0.13 ? 1 : 0) || hypot(ur - 0.33, (d - 0.16) * 0.8) < 0.017)) L = 0;       // and somebody
      if (dd < 0.6 && abs(fr(dd * 5 - f * 0.25) - 0.5) < 0.1) L = 0.65 * (1 - dd / 0.6) + 0.1;                                         // rings
      const i = floor(X / 0.5), j = floor(Z / 0.55), big = hypot(X - 0.12, Z - 0.95);
      if (Z < 4.5 && hash(i, j) > 0.5) {
        const px = X - (i + 0.3 + 0.4 * hash(i, j + 7)) * 0.5, pz = Z - (j + 0.3 + 0.4 * hash(j, i + 3)) * 0.55, r = hypot(px, pz) / (0.09 + 0.1 * hash(i + 5, j));
        if (r < 1 && abs(Math.atan2(pz, px) - 1 + 2 * hash(i, j + 1)) > 0.3) { M = 0; L = r > 0.85 ? 0.2 : abs(fr(Math.atan2(pz, px) * 1.6) - 0.5) < 0.05 ? 0.4 : 0.6; }
      }
      if (big < 0.24 && abs(Math.atan2(Z - 0.95, X - 0.12) - 2.4) > 0.22) { M = 0; L = big > 0.21 ? 0.2 : abs(fr(Math.atan2(Z - 0.95, X - 0.12) * 1.6) - 0.5) < 0.04 ? 0.45 : 0.68; }
    }
    const bk = 0.84 + 0.55 * min(u, 1 - u), bl = floor(u * 46), dr = drape(u, v, f, 44, 0.2 + 2.4 * (u - 0.5) * (u - 0.5));
    if (v > bk - (0.05 + 0.12 * hash(bl, 2)) * (1 - 2 * abs(fr(u * 46) - 0.5))) { L = v > bk ? (fbm(u * 50, v * 30) > 0.62 ? 0.16 : 0.03) : 0.02; M = 0; }   // the bank at our feet
    if (dr >= 0) { L = dr; M = 0; }                                                                                                // willow, hanging in round the frame
    for (const [ax, ay, bx, by, w] of [[-0.02, 0.5, 0.08, -0.02, 0.03], [1.02, 0.42, 0.9, -0.02, 0.035]]) if (dSeg(u, v, ax, ay, bx, by) < w * (1 + 0.3 * vn(v * 9, ax))) { M = 0; L = fbm(u * 90, v * 7) > 0.6 ? 0.14 : 0.01; }
    o[0] = L; o[1] = 0; o[2] = 0; o[3] = M;
  };

  // --- oak: older than the town. a hollow you could stand in, a path worn to it, and on strings from the bough the bottles people have brought
  const BOT = [[0.6, 0.22, 0.7], [0.7, 0.33, 1], [0.81, 0.44, 1.4], [0.93, 0.56, 2], [0.12, 0.18, 0.6], [0.2, 0.27, 0.8]];
  const ROOT = [[0.26, 0.8, -0.05, 0.9], [0.32, 0.83, 0.1, 1.02], [0.47, 0.85, 0.6, 1.04], [0.53, 0.82, 0.95, 0.93]];
  S.oak = (u, v, f, o) => {
    const gy = 0.74 - 0.05 * u, cx = 0.38 + 0.04 * sin(v * 2.2), fl = ss(0.58, 0.95, v), w = 0.16 + 0.24 * fl * fl + 0.12 * ss(0.3, 0, v), xt = (u - cx) / w, fc = floor(u * 11);
    let L = 0.5 + 0.14 * fbm(u * 3, v * 3) - 0.2 * ss(0.4, 0, v), M = 1;
    if (v < gy && abs(fr(u * 11) - 0.3 - 0.4 * hash(fc, 3)) < 0.05 + 0.05 * hash(fc, 8)) L *= 0.5;                                      // others, a long way back
    if (v > gy) {
      const Z = 0.4 / (v - gy + 0.02);
      M = 0; L = fbm(u * Z * 3, Z * 4) > 0.56 ? 0.26 : 0.05;
      if (abs(u - 0.4 - (v - 0.78) * 0.9) < 0.02 + (v - 0.78) * 0.5 && v > 0.78) L = 0.3 + 0.3 * hash(floor(u * 110), floor(v * 110));   // the path
    }
    for (const [ax, ay, bx, by] of ROOT) { const d = dSeg(u, v, ax, ay, bx, by) / (0.016 + 0.07 * max(0, v - 0.8)); if (d < 1) { M = 0; L = v < ay + (by - ay) * ((u - ax) / (bx - ax)) - 0.004 ? 0.34 : 0.03; } }
    for (const [ax, ay, bx, by, t0, t1] of [[0.5, 0.26, 1.05, 0.0, 0.04, 0.085], [0.3, 0.24, -0.05, 0.08, 0.04, 0.03]]) {                  // boughs. the one on the right comes out over us
      const t = cl((u - ax) / (bx - ax)), d = dSeg(u, v, ax, ay, bx, by), th = t0 + (t1 - t0) * t;
      if (d < th) { M = 0; L = v > ay + (by - ay) * t + th * 0.45 ? 0.4 : fr(t * 14 + d * 40) < 0.25 ? 0.02 : 0.07; }
    }
    if (abs(xt) < 1 && v < 0.93) {
      const c = Math.asin(xt), hol = ell(u, v, 0.4, 0.66, 0.065, 0.12) < 1 || (abs(u - 0.4) < 0.065 && v > 0.66 && v < 0.79 + 0.3 * (u - 0.4));
      M = 0; L = xt > 0.95 ? 0.8 : fr(c * 6 + 1.2 * vn(v * 5, c * 3)) < 0.3 ? 0.02 : 0.08 + 0.6 * ss(0.1, 1, xt) + 0.06 * fbm(u * 50, v * 8);
      if (hypot((u - 0.27) / 0.05, (v - 0.45) / 0.07) < 1) L = fr(hypot((u - 0.27) / 0.05, (v - 0.45) / 0.07) * 3) < 0.4 ? 0.02 : 0.2;        // a burr
      if (hol) { L = abs(ell(u, v, 0.4, 0.66, 0.075, 0.13) - 1) < 0.08 && v < 0.66 ? 0.3 : 0; if (f === 3 && hypot(abs(u - 0.4) - 0.012, v - 0.62) < 0.0045) L = 1; }   // once a loop, something in it has its eyes open
    }
    if (v < 0.1 + 0.08 * fbm(u * 6, 1)) { M = 0; L = fbm(u * 40, v * 40) > 0.6 ? 0.16 : 0.02; }
    const B = M ? 0.1 * exp(-hypot(u - 0.42, (v - 0.56) * 0.8) * 3) * (0.6 + 0.8 * fbm(u * 6, v * 6)) : 0;                                                          // something is lit, a long way behind it
    BOT.forEach(([bx, by, z], i) => {                                                                                              // nearer ones hang lower and bigger
      const x = (u - bx - 0.005 * z * sin(f * 1.57 + i * 2) * cl((v - 0.05) / by)) / z, y = (v - by) / z;
      if (abs(x) < 0.0025 && v > 0.03 && y < -0.05) { M = 0; L = 0.5; }
      if (ell(x, y, 0, 0, 0.02, 0.036) < 1 || (abs(x) < 0.008 && y > -0.062 && y < 0)) { M = 0; L = x < -0.008 && y > -0.03 ? 0.85 : ell(x, y, 0.004, 0.012, 0.011, 0.016) < 1 ? 0.35 : 0.04; }   // each with something in it
    });
    o[0] = L; o[1] = 0; o[2] = M ? B : 0; o[3] = M;
  };

  // --- grove: an avenue nobody planted. the same sign cut into the nearest trunk, and at the far end a cross the wrong way up, lit
  const AVE = [[1.9, 8.5, 0.2], [-2.2, 7.5, 0.2], [0.75, 9, 0.16], [-0.75, 8.5, 0.16], [3.2, 7, 0.22], [0.75, 6.4, 0.16], [-0.75, 6, 0.16], [-2.4, 5, 0.2], [0.75, 4.6, 0.16], [2.8, 4.2, 0.22], [-0.75, 4.2, 0.16], [0.75, 3.3, 0.16], [-0.75, 2.9, 0.16], [0.75, 2.3, 0.16], [-0.75, 1.9, 0.16], [0.75, 1.5, 0.16]];
  S.grove = (u, v, f, o) => {
    const hz = 0.56, vx = 0.36;
    const fl = [1, 0.85, 1, 0.9][f], dc = hypot(u - vx, v - hz + 0.04), dr = drape(u, v, f, 40, 0.16 + 1.5 * (u - 0.5) * (u - 0.5));
    let L = 0.52 + 0.12 * fbm(u * 3 + f * 0.05, v * 3) - 0.2 * ss(0.3, 0, v), A = 0.35 * fl * exp(-dc * 30), M = 1;
    if (v > hz) {
      const Z = 0.45 / (v - hz), X = (u - vx) * Z, fog = cl(Z / 10);
      M = 0; L = abs(X) < 0.3 ? (abs(abs(X) - 0.17) < 0.035 ? 0.04 : 0.12 + 0.24 * hash(floor(X * 40), floor(Z * 30))) : fbm(X * 3, Z * 3) > 0.55 ? 0.22 : 0.05;
      L += (0.5 - L) * fog; if (fog > 0.75) M = 1;
      if (abs(X) < 0.3) A = max(A, 0.13 * fl * exp(-(v - hz) * 5));
    }
    if ((abs(u - vx) < 0.0045 && v > hz - 0.08 && v < hz + 0.004) || (abs(v - hz + 0.022) < 0.0045 && abs(u - vx) < 0.018)) { L = 0; A = 1; M = 0; }
    for (const [X, Z, r] of AVE) {
      const base = hz + 0.45 / Z, hw = r / Z, sx = vx + X / Z + hw * 0.5 * sin(v * 3 + X + Z), xt = (u - sx) / (hw * (1 + 0.9 * ss(base - hw * 1.6, base + hw * 0.4, v)));
      if (abs(xt) >= 1 || v > base + hw * 0.4 * (1 - xt * xt)) continue;
      const c = Math.asin(xt), fog = cl(Z / 10) * 0.9, sg = Z === 1.5 && sigil((xt - 0.05) / 0.5, (v - 0.47) / (hw * 0.55), 2, 0.12);
      let t = xt < -0.93 ? 0.6 : fr(c * 5 + 1.2 * vn(v * 6 + Z, c * 3)) < 0.3 ? 0.02 : 0.06 + 0.45 * ss(0.1, -1, xt);
      if (sg) t = 0.85;
      L = t + (0.3 - t) * fog; A = 0; M = 0;
    }
    for (const [ax, ay, bx, by, w] of [[-0.02, 0.3, 0.46, 0.1, 0.02], [1.02, 0.2, 0.5, 0.08, 0.018], [-0.02, 1.02, 0.03, -0.02, 0.05]]) if (dSeg(u, v, ax, ay, bx, by) < w * (1 + 0.4 * vn(u * 9 + v * 9, ax))) { M = 0; A = 0; L = fbm(u * 90, v * 7) > 0.6 ? 0.14 : 0.01; }   // boughs over, and a trunk at our elbow
    if (dr >= 0) { L = dr; A = 0; M = 0; }
    if (v < 0.13 + 0.1 * fbm(u * 5, 2) || v > 0.93 - 0.5 * (u - 0.5) * (u - 0.5) - (0.03 + 0.07 * hash(floor(u * 50), 4)) * (1 - 2 * abs(fr(u * 50) - 0.5))) { M = 0; A = 0; L = fbm(u * 40, v * 40) > 0.6 ? 0.15 : 0.02; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- mound: the yard behind the washing. soft ground the length of a person, a spade standing in it, a bag packed, and the mark from the kitchen door
  S.mound = (u, v, f, o) => {
    const hz = 0.3, Z = 0.5 / max(v - hz, 1e-3), X = (u - 0.4) * Z, e = ell(X, Z, 0.1, 1.35, 0.3, 0.55), dg = dSeg(X, Z, 0.3, 1.7, 2.1, 5.2);
    let L = 0.14 + 0.18 * fbm(u * 3, v * 9), A = 0, M = 1;
    if (v > hz - 0.07 - 0.06 * fbm(u * 6, 2)) { L = fbm(u * 44, v * 44) > 0.64 ? 0.1 : 0.02; M = 0; }
    if (v > hz) {
      M = 0; L = (fbm(X * 6, Z * 6) > 0.55 ? 0.24 : 0.06) * ss(9, 2, Z);
      if (dg < 0.16) L = fr(dg * 30 + Z * 2) < 0.4 ? 0.01 : 0.04;                                                                     // dragged, from the door
      if (e < 1) L = e > 0.82 && X > 0.05 ? 0.01 : 0.14 + 0.42 * ss(0.5, -0.9, (X - 0.1) / 0.3) * ss(1, 0.3, e) + 0.2 * hash(floor(X * 60), floor(Z * 60));   // turned earth, heaped
    }
    for (let k = 0; k < 6; k++) { const z = 1.6 + k * 0.9, x = 0.4 - 1.4 / z, b = hz + 0.5 / z, h = 0.34 / z; if (abs(u - x) < 0.012 / z + 0.002 && v > b - h && v < b) { M = 0; L = u < x ? 0.5 : 0.12; } }   // fence, going back
    for (const r of [0.3, 0.75]) if (abs(v - hz - (0.5 - 0.34 * r) * ((0.4 - u) / 1.4)) < 0.004 && u < 0.4 - 1.4 / 6.2 && u > -0.1) { M = 0; L = 0.4; }
    if (wall(u, v, 0.66, 1.02, 0.0, -0.06, 0.37, 0.52)) {                                                                            // the back of the house, and the kitchen door, open
      const s = W.s, t = W.t;
      M = 0; L = fr(t * 15) < 0.2 ? 0.04 : 0.2 - 0.12 * s;
      if (s > 0.22 && s < 0.6 && t > 0.36) L = s < 0.25 || s > 0.57 || t < 0.39 ? 0.6 : 0;
    }
    if (dSeg(u, v, 0.455, 0.57, 0.66, 0.635) < 0.005 && e < 1.4) L = 0;                                                               // the spade's shadow, across what it dug
    if (quad(u, v, 0.428, 0.5, 0.478, 0.5, 0.47, 0.585, 0.44, 0.585)) { M = 0; L = u < 0.447 ? 0.95 : 0.4; }                             // its blade, half in
    if (dSeg(u, v, 0.453, 0.5, 0.438, 0.2) < 0.0065) { M = 0; L = u < 0.453 - (0.5 - v) * 0.05 ? 0.85 : 0.25; }
    if (abs(hypot((u - 0.436) / 0.022, (v - 0.175) / 0.028) - 0.8) < 0.22) { M = 0; L = 0.7; }
    const rb = (u - 0.444) / 0.1;
    if (rb > 0 && rb < 1 && abs(v - 0.3 - 0.05 * rb * rb - 0.012 * sin(rb * 9 - f * 1.57) * rb) < 0.007 - 0.003 * rb) { M = 0; L = 0; A = 1; }   // a ribbon, tied below the grip
    const bag = iso(u, v, 0.74, 0.9, 0.17, -0.045, -0.09, -0.04, 0.1);                                                              // a bag, packed
    if (bag) { M = 0; L = bag === 3 ? (abs(W.t - 0.5) < 0.05 ? 0.05 : 0.5) : bag === 1 ? (W.t < 0.08 ? 0.6 : 0.22) : 0.08; }
    if (abs(ell(u, v, 0.78, 0.775, 0.045, 0.03) - 1) < 0.14 && v < 0.78) { M = 0; L = 0.5; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- drowned: kneeling at the pond. the face in the water is yours. it has its hands on the bank
  S.drowned = (u, v, f, o) => {
    const wob = 0.011 * sin(v * 42 + f * 1.57) + 0.007 * sin(u * 30 + v * 22 - f * 1.57), x = u - 0.5 + wob * (1 - 0.7 * ss(0.6, 0.85, v)), y = v - 0.4 + wob * 0.5, jaw = 0.15 - 0.09 * ss(0.02, 0.24, y), dr = drape(u, v, f, 40, 0.14 + 1.6 * (u - 0.5) * (u - 0.5));
    let L = 0.07 + (fbm(u * 3, v * 16 + f * 0.2) > 0.6 ? 0.16 : 0), A = 0, M = 1;
    if (fbm(x * 9 + 3, y * 3) > 0.52 && ell(x, y, 0, -0.08, 0.3, 0.3) < 1) L = 0.02;                                                    // hair, gone loose in the water
    if (abs(x) < 0.2 - 0.3 * ss(0.5, 0.2, y) && y > 0.2 && y < 0.5) L = 0.2 + 0.2 * fbm(x * 30, y * 30);                                 // shoulders, further down
    if ((y < 0.02 ? ell(x, y, 0, 0.02, 0.15, 0.2) < 1 : abs(x) < jaw && y < 0.26)) {
      L = 0.72 - 1.6 * abs(x) - 0.5 * max(0, y - 0.1) + 0.1 * fbm(x * 40, y * 40);
      const eye = ell(abs(x), y, 0.062, -0.03, 0.04, 0.028);
      if (eye < 1) { L = 0; if (f === 3 && eye < 0.14) L = 1; }                                                                       // once a loop they are open
      if (ell(x, y, 0, 0.14, 0.05, 0.075) < 1) L = 0;                                                                                // a mouth, wider than yours goes
      if (abs(x) < 0.012 && y > 0.0 && y < 0.07) L *= 0.6;
    }
    for (const sd of [-1, 1]) {
      const rr = hypot((u - 0.5 - sd * 0.24) / 1.6, v - 0.82);
      if (abs(fr(rr * 26 - f * 0.25) - 0.5) < 0.12 && rr < 0.09) L = 0.5;                                                              // the water, broken round each wrist
      for (let k = 0; k < 4; k++) {
        const fx = 0.5 + sd * (0.19 + k * 0.032), top = 0.8 + 0.012 * abs(k - 1.4), dd = dSeg(u, v, fx, top, fx + sd * 0.004 * k, 0.93 + 0.01 * (k & 1));
        if (dd < 0.011) { M = 0; L = dd > 0.007 ? 0.25 : v < top + 0.05 ? 0.9 : 0.62; }
      }
    }
    const bk = 0.905 + 0.02 * fbm(u * 8, 3);
    if (v > bk) { M = 0; L = v < bk + 0.006 ? 0.4 : fbm(u * 50, v * 30) > 0.62 ? 0.14 : 0.03; }
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const fx = 0.5 + sd * (0.19 + k * 0.032) + sd * 0.004 * k; if (dSeg(u, v, fx, 0.905, fx, 0.935 + 0.01 * (k & 1)) < 0.0105) { M = 0; L = v > 0.93 ? 0.5 : 0.85; } }   // fingers, over the edge
    if (dr >= 0) { L = dr; M = 0; }
    for (const [px, py, r] of [[0.1, 0.62, 0.11], [0.92, 0.5, 0.1], [0.84, 0.75, 0.07]]) { const p = ell(u, v, px, py, r, r * 0.45); if (p < 1 && abs(Math.atan2(v - py, u - px) - 0.6) > 0.3) { M = 0; L = p > 0.85 ? 0.15 : 0.5; } }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // <<works
  // --- things stood in real space ------------------------------------------------
  // C = the eye: [centre across the page, horizon, focal length]. F = a frame on the floor plan: [x, z, turn]; everything built in one frame shares its vanishing points.
  // rb = a box in that frame (x across, y down from the eye, z away), hit by the ray through this pixel. inn = seen from inside, so the far side is what shows.
  // returns 0, or the face: 1 / 2 = its two x ends, 3 / 4 = its near and far z sides, 5 = top, 6 = underside. H = where: s, t across and down the face, x y z in the frame, d = how far
  const H = { s: 0, t: 0, x: 0, y: 0, z: 0, d: 0 };
  const rb = (u, v, C, F, x0, x1, y0, y1, z0, z1, inn) => {
    const a = (u - C[0]) / C[2], b = (v - C[1]) / C[2] || 1e-6, c = cos(F[2]), s = sin(F[2]), ox = -F[0] * c - F[1] * s, oz = F[0] * s - F[1] * c, dx = a * c + s || 1e-6, dz = c - a * s || 1e-6;
    let tn = -1e9, tf = 1e9, an = 0, af = 0, p = (x0 - ox) / dx, q = (x1 - ox) / dx;
    if (p > q) { const w = p; p = q; q = w; } tn = p; tf = q;
    p = y0 / b; q = y1 / b; if (p > q) { const w = p; p = q; q = w; } if (p > tn) { tn = p; an = 1; } if (q < tf) { tf = q; af = 1; }
    p = (z0 - oz) / dz; q = (z1 - oz) / dz; if (p > q) { const w = p; p = q; q = w; } if (p > tn) { tn = p; an = 2; } if (q < tf) { tf = q; af = 2; }
    const t = inn ? tf : tn, ax = inn ? af : an;
    if (tn >= tf || t < 1e-3) return 0;
    const x = ox + dx * t, y = b * t, z = oz + dz * t;
    H.d = t; H.x = x; H.y = y; H.z = z;
    if (ax === 0) { H.s = (z - z0) / (z1 - z0); H.t = (y - y0) / (y1 - y0); return abs(x - x0) < abs(x - x1) ? 1 : 2; }
    if (ax === 2) { H.s = (x - x0) / (x1 - x0); H.t = (y - y0) / (y1 - y0); return abs(z - z0) < abs(z - z1) ? 3 : 4; }
    H.s = (x - x0) / (x1 - x0); H.t = (z - z0) / (z1 - z0); return abs(y - y0) < abs(y - y1) ? 5 : 6;
  };
  // the ground (or any level y) in a frame: sets H.x, H.z, H.d. 0 if the ray never gets there
  const gp = (u, v, C, F, y) => {
    const b = (v - C[1]) / C[2], t = y / b;
    if (!(t > 0) || t > 400) return 0;
    const a = (u - C[0]) / C[2], c = cos(F[2]), s = sin(F[2]);
    H.x = -F[0] * c - F[1] * s + (a * c + s) * t; H.z = F[0] * s - F[1] * c + (c - a * s) * t; H.y = y; H.d = t;
    return t;
  };
  // where a point in a frame lands on the page: u, v, and k = how big a unit is there
  const pj = (C, F, x, y, z) => { const c = cos(F[2]), s = sin(F[2]), k = C[2] / (F[1] + x * s + z * c); return { u: C[0] + (F[0] + x * c - z * s) * k, v: C[1] + y * k, k }; };
  // how much of a lamp at (x, y, z) reaches the last hit: 1 at the lamp, falling off fast. r = its reach
  const lamp = (x, y, z, r) => { const d2 = (H.x - x) ** 2 + (H.y - y) ** 2 + (H.z - z) ** 2; return (r * r) / (r * r + d2 * 3); };
  const brick = (s, t, n) => (fr(t * n) < 0.14 || fr(s * n * 0.5 + (floor(t * n) & 1) * 0.5) < 0.07 ? 0.5 : 1);
  const deep = (s, h0, h1) => (s * h1) / ((1 - s) * h0 + s * h1);

  // --- works: the works from the quarry road, over its wall. shut forty years. one bay is lit, the gatehouse is lit, and the stack is drawing
  S.works = (u, v, f, o) => {
    const C = [0.4, 0.4, 0.95], F = [-1.6, 9.5, 0.6], E = 3.6, fl = [1, 0.85, 1, 0.9][f];
    let L = 0.02 + 0.16 * ss(0.05, 0.4, v) * (0.5 + fbm(u * 2.5, v * 9)), A = 0, M = 1, D = 1e9, k;
    const sm = pj(C, F, 9.6, E - 13.2, 7.6), sx = u - sm.u, sn = fbm(sx * 7 - f * 0.4, v * 9 + f * 0.2);
    if (sx > 0 && abs(v - sm.v + 0.12 * sx) < (0.01 + 0.26 * sx) * sn * 1.4) L = 0.34 * sn + 0.1;                                       // smoke, lit a little from under
    if ((k = rb(u, v, C, F, 9, 10.2, E - 13, E, 7, 8.2))) { M = 0; L = (k === 1 ? 0.75 : 0.12) * brick(H.s, H.t * 6, 5) * (H.t < 0.03 ? 1.3 : 1); }   // the stack
    if (gp(u, v, C, F, E)) {                                                                                                         // the yard and the road: setts, and the siding run in through the gate
      const lg = lamp(1.2, E, -6.2, 2.2);
      M = 0; L = (hash(floor(H.x * 3 + (floor(H.z * 3) & 1) * 0.5), floor(H.z * 3)) > 0.5 ? 0.2 : 0.07) * ss(40, 6, H.d) + 0.6 * lg; A = 0.5 * lg * fl;
      if (abs(abs(H.x - 3.5) - 0.42) < 0.07 && H.z < -0.3) { L = 0.85 * ss(30, 5, H.d); A = 0; }
    }
    for (let i = 7; i >= 0; i--) if ((k = rb(u, v, C, F, i * 2, i * 2 + 0.12, E - 6.6, E - 5.2, 0, 6)) === 1) { M = 0; L = fr(H.s * 6) < 0.1 || abs(H.t - 0.5) < 0.05 ? 0.2 : 0.7 - 0.03 * i; }   // north lights: the glass
    if ((k = rb(u, v, C, F, 0, 16, E - 6.6, E - 5.2, 0, 0.3)) === 3 && H.t > fr(H.x / 2)) { M = 0; L = 0.26 * brick(H.x * 0.25, H.y * 0.25, 9); }                // and the saw of the wall under them
    if ((k = rb(u, v, C, F, 0, 16, E - 5.2, E, 0, 6))) {
      M = 0; A = 0;
      if (k === 3) {                                                                                                                  // the long side: eight bays
        const bx = fr(H.x / 2), bay = floor(H.x / 2), wy = (H.y - E + 4.3) / 2.7;
        L = (0.72 - 0.025 * H.x) * brick(H.x * 0.25, H.y * 0.25, 9);
        if (H.t < 0.03 || abs(bx - 0.03) < 0.03) L *= 1.6;                                                                             // coping, and a pier between each
        if (bx > 0.22 && bx < 0.84 && wy > 0 && wy < 1) { const bar = fr((bx - 0.22) * 6.5) < 0.16 || fr(wy * 6) < 0.13; L = bar ? 0.85 - 0.03 * H.x : hash(bay * 9 + floor((bx - 0.22) * 6.5), floor(wy * 6)) < 0.25 ? 0 : 0.07; if (bay === 5 && !bar) { L = 0; A = fl; } }
        if (H.t > 0.9) L *= 0.5;
      } else if (k === 1) {                                                                                                           // the end wall, in its own shadow: the big door on its rail, and the lamp sign
        L = 0.13 * brick(H.z * 0.25, H.y * 0.25, 9);
        if (sigil((H.z - 3) / 0.85, (H.y - E + 4) / 0.85, 0, 0.15)) L = 0.9;
        if (H.z > 1.6 && H.z < 4.4 && H.y > E - 2.6) L = H.y < E - 2.45 ? 0.75 : fr(H.z * 2.2) < 0.08 ? 0.02 : 0.06;
        if (H.z > 3.2 && H.z < 4.4 && H.y > E - 2.45) L = 0;                                                                              // run back a yard
      }
    }
    if ((k = rb(u, v, C, F, 5.6, 8, E - 2.8, E, -5, -3.3))) {                                                                              // the gatehouse
      M = 0; A = 0; L = (k === 3 ? 0.55 : k === 1 ? 0.2 : 0.75) * (k === 5 ? 1 : brick(H.s * 0.6, H.t * 0.7, 9));
      if (k === 3 && abs(H.s - 0.5) < 0.2 && H.t > 0.2 && H.t < 0.5) { L = abs(H.s - 0.5) < 0.012 || abs(H.t - 0.35) < 0.012 ? 0.3 : 0; if (L === 0) A = 0.9 * fl; }
      if (k === 3 && H.t < 0.06) L = 1;
    }
    for (const [x0, x1] of [[-12, 2.2], [4.8, 5.6], [8, 26]]) {                                                                          // the wall along the road, and railings on it
      if ((k = rb(u, v, C, F, x0, x1, E - 1.1, E, -5, -4.7))) { M = 0; A *= 0.3; L = (k === 5 ? 1 : k === 3 ? 0.5 + 0.4 * lamp(1.2, E - 3, -6.2, 2.5) : 0.2) * (k === 5 ? 1 : brick(H.x * 0.25, H.y * 0.25, 9)); }
      if (rb(u, v, C, F, x0, x1, E - 2.1, E - 1.1, -4.88, -4.82) === 3 && (fr(H.x * 3.2) < 0.2 || H.t < 0.08 || (H.t > 0.5 && H.t < 0.56))) { M = 0; L = 0.03; A = 0; }
    }
    for (const gx of [2.2, 4.4]) if ((k = rb(u, v, C, F, gx, gx + 0.4, E - 2.6, E, -5.05, -4.65))) { M = 0; A = 0; L = (k === 3 ? 0.8 : k === 5 ? 1 : 0.25) * brick(H.s, H.t * 3, 5); }   // gate piers
    if ((k = rb(u, v, C, F, 2.6, 2.66, E - 2.1, E, -4.9, -2.9)) && (fr(H.s * 7) < 0.25 || H.t < 0.07 || abs(H.t - 0.6) < 0.035)) { M = 0; L = k === 2 ? 0.5 : 0.04; A = 0; }   // one leaf, standing open into the yard
    const lp = pj(C, F, 1.2, E - 4, -6.2), lr = hypot(u - lp.u, v - lp.v), ft = pj(C, F, 1.2, E, -6.2).v;
    if (abs(u - lp.u) < 0.005 && v > lp.v && v < ft) { M = 0; L = u < lp.u ? 0.9 : 0.15; A = 0; }                                         // the lamp at the gate
    if (inBox(u, v, lp.u - 0.018, lp.v - 0.034, lp.u + 0.018, lp.v + 0.004)) { M = 0; L = abs(u - lp.u) > 0.013 || v < lp.v - 0.028 ? 0.1 : 0; A = L ? 0 : fl; }
    else A = max(A, 0.6 * fl * exp(-lr * 26));
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- whistle: the boiler-house corner from the yard, looking up. the clock has no hands. the whistle goes at the same minute anyway
  S.whistle = (u, v, f, o) => {
    const C = [0.5, 0.86, 0.9], F = [0, 6.2, 0.785], E = 1.6, top = -3.2;
    let L = 0.03 + 0.14 * ss(0, 0.7, v) * (0.5 + fbm(u * 3, v * 8)), A = 0, M = 1, k, D = 1e9;
    if (gp(u, v, C, F, E)) { M = 0; L = (hash(floor(H.x * 2.5), floor(H.z * 2.5 + (floor(H.x * 2.5) & 1) * 0.5)) > 0.5 ? 0.24 : 0.1) * ss(30, 4, H.d); }
    if ((k = rb(u, v, C, F, 0, 9, top, E, 0, 9))) {
      M = 0; D = H.d;
      if (k === 3) {                                                                                                                  // the side the moon is on
        L = (0.62 - 0.03 * H.x) * brick(H.x * 0.3, H.y * 0.3, 8);
        for (const [wx, wy] of [[2.2, -2.5], [5.2, -2.5], [2.2, -0.3]]) if (abs(H.x - wx - 0.7) < 0.7 && H.y > wy && H.y < wy + 1.7) L = abs(H.x - wx - 0.7) > 0.62 || H.y < wy + 0.08 || fr((H.x - wx) * 2.15) < 0.1 || fr((H.y - wy) * 1.8) < 0.09 ? 0.75 : 0.02;   // windows, small paned
        if (H.y > 1.25) L *= 0.6;
      } else if (k === 1) {                                                                                                           // the side it is not
        const d = hypot(H.z - 3, H.y + 1.55) / 1.05, an = Math.atan2(H.y + 1.55, H.z - 3);
        L = 0.17 * brick(H.z * 0.3, H.y * 0.3, 8);
        if (d < 1.14) { L = d > 1 ? 0.95 : 0; A = d > 1 ? 0 : d < 0.08 || (d > 0.72 && d < 0.9 && abs(fr((an * 6) / PI + 0.5) - 0.5) < 0.1) ? 0 : 0.92; }   // the clock: twelve marks, a boss, and nothing to point with
        if (abs(H.z - 6.2) < 0.75 && H.y > -0.75) { L = abs(H.z - 6.2) > 0.63 || H.y < -0.62 ? 0.5 : abs(H.z - 6.2) < 0.02 || abs(H.y - 0.3) < 0.03 ? 0.14 : 0.03; A = 0; }   // the boiler-house door
        if (abs(H.z - 6.2) < 0.95 && H.y > 1.42) L = 0.45;
      }
    }
    if ((k = rb(u, v, C, F, -0.35, 9, top - 0.3, top, -0.35, 9)) && H.d < D) { M = 0; A = 0; L = k === 6 ? 0.03 : k === 3 ? 0.95 : 0.4; }           // the eaves
    const w = pj(C, F, 0.5, top - 0.3, 0.5), x = (u - w.u) / (w.k * 1.5), y = (v - w.v) / (w.k * 1.5) - 0.85;                                                // the whistle, on its pipe, above the corner: stem, valve, bell, cap
    if (abs(x) < 0.07 && y > -1.3 && y < -0.85) { M = 0; L = x < -0.02 ? 0.9 : 0.25; }
    if (abs(x) < 0.2 && y > -1.42 && y < -1.26) { M = 0; L = x < -0.08 ? 1 : 0.35; }
    if (abs(x) < 0.17 && y > -2.2 && y < -1.56) { M = 0; L = (x < -0.07 ? 1 : x < 0.06 ? 0.55 : 0.2) * (abs(y + 1.9) < 0.025 ? 0.4 : 1); }
    if (hypot(x, (y + 2.2) * 1.5) < 0.17 && y < -2.2) { M = 0; L = x < -0.05 ? 1 : 0.4; }
    if (abs(x) < 0.03 && y > -2.5 && y < -2.3) { M = 0; L = 0.8; }
    const jx = x - 0.17, jy = y + 1.49;                                                                                               // what comes out of it: hard, flat, straight
    if (jx > 0 && jx < 3.4 && abs(jy + jx * 0.12) < 0.03 + jx * 0.2) { const ray = (jy + jx * 0.12) / (0.03 + jx * 0.2); if (fr(ray * 4.5 + f * 0.5) < 0.42 && hash(floor(ray * 4.5 + f * 0.5), floor(jx * 5 - f * 2)) > 0.25) L = ss(3.4, 1, jx) * [1, 1, 0.9, 0.5][f]; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- chain: the gate, close to. the lock is still locked. it is the chain that has been cut: one link gone through on the slant, the metal still white
  const LINKS = (u, v, x0, y0, n, o) => { for (let i = 0; i < n; i++) { const cy = y0 + i * 0.058, fl = i & 1, e = fl ? ell(u, v, x0, cy, 0.008, 0.04) : ell(u, v, x0, cy, 0.03, 0.04); if (e < (fl ? 1.3 : 1.2) && e > (fl ? 0 : 0.74)) { o[0] = e > (fl ? 1.08 : 1.12) ? 0 : fl ? (u < x0 ? 1 : 0.5) : u < x0 - 0.008 ? 0.95 : u > x0 + 0.012 ? 0.3 : 0.65; o[1] = 0; o[3] = 0; } } };
  S.chain = (u, v, f, o) => {
    const fl = f ? 0.55 : 1, lr = hypot(u - 0.9, v - 0.2);
    let L = 0.03 + 0.1 * fbm(u * 3, v * 6) * ss(1, 0.2, v), A = 0.55 * fl * exp(-lr * 11), M = 1;
    if (lr < 0.028) { L = 0; A = fl; }
    if (abs(u - 0.9) < 0.004 && v > 0.22) L = 0.25;
    if (wall(u, v, -0.05, 1.05, -0.4, 0.12, 1.5, 0.98)) {                                                                              // the gate, going away to the right
      const q = deep(W.s, 1.9, 0.86), t = W.t, b = fr(q * 4.6);
      if (b < 0.17) { M = 0; L = b < 0.045 ? 1 : b > 0.13 ? 0.02 : 0.28 + 0.1 * fbm(q * 9, t * 90); A = b > 0.13 ? A * 1.5 : 0; }
      if (abs(t - 0.36) < 0.025 || abs(t - 0.86) < 0.025) { M = 0; L = fr(t * 20 - 0.25) < 0.5 ? 0.9 : 0.06; A = 0; }
    }
    o[0] = L; o[1] = A; o[3] = M;
    for (const [x, y, n] of [[0.27, 0.3, 5], [0.62, 0.371, 4]]) { if (ell(u, v, x, y - 0.03, 0.062, 0.03) < 1 && ell(u, v, x, y - 0.03, 0.062, 0.03) > 0.7) { o[0] = v < y - 0.03 ? 0.9 : 0.3; o[1] = 0; o[3] = 0; } LINKS(u, v, x, y, n, o); }   // each end still wound round its bar
    const kx = 0.62, ky = 0.603, sl = u - kx + (v - ky - 0.008) * 0.9, cu = v > ky + 0.008 && sl > 0 ? u + 0.006 : u, cv = v - (sl > 0 ? 0.012 : 0), ce = ell(cu, cv, kx, ky, 0.03, 0.04);   // the sheared link: gone through on the slant, and sprung
    if (ce < 1.2 && ce > 0.74 && !(v > ky + 0.008 && abs(sl - 0.004) < 0.006)) { o[0] = v > ky + 0.008 && abs(sl - 0.004) < 0.011 ? 1 : ce > 1.12 ? 0 : u < kx - 0.008 ? 0.95 : u > kx + 0.012 ? 0.3 : 0.65; o[1] = 0; o[3] = 0; }
    const lx = 0.27, ly = 0.66, sh = ell(u, v, lx, ly - 0.035, 0.04, 0.062);
    if (sh < 1.28 && sh > 0.62 && v < ly + 0.01) { o[0] = sh > 1.1 ? 0 : u < lx ? 1 : 0.5; o[1] = 0; o[3] = 0; }                             // the padlock, hung on the last link
    if (inBox(u, v, lx - 0.072, ly, lx + 0.072, ly + 0.15)) { o[1] = 0; o[3] = 0; o[0] = u < lx - 0.056 || v < ly + 0.014 ? 1 : u > lx + 0.058 || v > ly + 0.138 ? 0.08 : 0.42 + 0.14 * fbm(u * 40, v * 40); if (hypot(u - lx, v - ly - 0.06) < 0.02 || (abs(u - lx) < 0.008 && v > ly + 0.06 && v < ly + 0.11)) o[0] = 0; if (hypot(abs(u - lx) - 0.055, abs(v - ly - 0.075) - 0.058) < 0.008) o[0] = 1; }
    o[2] = 0;
  };

  // --- flywheel: the engine house. bed, cylinder, crosshead, crank, and the big wheel going round. nothing is driving it. somebody has hung a red lamp on the steam chest
  S.flywheel = (u, v, f, o) => {
    const cx = 0.37, cy = 0.47, ph = f * 0.2618, bx = 0.89, by = 0.34, br = hypot(u - bx, v - by), red = exp(-br * 4);
    let L = 0.04, A = 0, M = 0, k;
    const lit = (l, sp) => { L = l; A = l > 0.45 ? sp * red * 0.9 : 0; if (A > 0.3) L *= 0.5; };
    if (wall(u, v, -0.05, 1.05, -0.2, 0.04, 0.84, 0.66)) {                                                                             // the back wall, and the arch the moon comes through
      const q = deep(W.s, 1.04, 0.62), t = W.t, ar = hypot((q - 0.2) / 0.085, (t - 0.38) / 0.2);
      lit(0.16 * brick(q * 3, t, 18) * (1 - 0.5 * q), 0);
      if ((ar < 1 && t < 0.38) || (abs(q - 0.2) < 0.085 && t >= 0.38 && t < 0.62)) { M = 1; A = 0; L = abs(q - 0.2) < 0.005 || fr(t * 11) < 0.12 ? 0.1 : 0.7; }
    } else { const Z = 0.25 / max(v - 0.6, 1e-3), X = (u - 1.4) * Z; lit(fr(X * 1.5) < 0.05 || fr(Z * 1.5) < 0.05 ? 0.04 : 0.17 * ss(4, 0.4, Z), 0); if (ell(u, v, 0.45, 0.93, 0.36, 0.045) < 1) L = 0.01; }
    for (const sd of [-1, 1]) if (dSeg(u, v, cx - 0.07 + sd * 0.015, cy - sd * 0.325, 0.02 + sd * 0.012, 0.02 - sd * 0.1) < 0.012) lit(fr((u - v) * 16 * sd - f * 0.25) < 0.5 ? 0.6 : 0.25, 0);   // the belt, away up through the wall
    const far = hypot((u - cx + 0.075) / 0.19, (v - cy + 0.012) / 0.335), near = hypot((u - cx) / 0.19, (v - cy) / 0.335), an = Math.atan2((v - cy) / 0.335, (u - cx) / 0.19) + ph;
    if (far < 1 && near > 0.86) lit(far > 0.86 ? 0.14 : 0.03, 0.3);                                                                    // the far rim, and the dark inside the wheel
    if (near < 1 && far >= 1) lit(0.85, 0.9);
    if (far < 1 && near >= 1) lit(u < cx - 0.1 ? 1 : 0.5 + 0.3 * fr((an * 12) / PI), 0.4);                                              // the face of the rim, a hand wide
    if (near < 1) {
      const sp = abs(fr((an * 3) / PI) - 0.5) * (near + 0.05);
      if (near > 0.86) lit(near > 0.97 ? 0.3 : 0.92, 1);                                                                                // the near rim
      else if (near < 0.2) lit(near < 0.07 ? 1 : near > 0.17 ? 0.3 : 0.6, 1);                                                           // the boss
      else if (sp < 0.03) lit(sp < 0.01 ? 1 : 0.5, 0.8);                                                                                // six arms, oval, the light running down one edge of each
    }
    const px = cx + 0.19 * 0.34 * cos(ph * 4 * 0 + f * 1.5708), py = cy + 0.335 * 0.34 * sin(f * 1.5708), hx = 0.7 + 0.05 * cos(f * 1.5708);      // crank pin, connecting rod, crosshead
    const bed = iso(u, v, 0.26, 0.97, 0.7, -0.17, -0.1, -0.05, 0.13);                                                                // the bed
    if (bed) lit(bed === 3 ? 0.6 : bed === 1 ? (W.t < 0.12 ? 0.9 : fr(W.s * 9) < 0.08 ? 0.5 : 0.24) : 0.08, bed === 3 ? 0.7 : 0.3);
    for (const sd of [-1, 1]) if (quad(u, v, cx - 0.012 + sd * 0.01, cy, cx + 0.02 + sd * 0.01, cy, cx + 0.07 + sd * 0.085, 0.84, cx - 0.01 + sd * 0.085, 0.84) && near > 0.2) lit(sd < 0 ? 0.75 : 0.32, 0.5);   // the pedestal, astride the shaft
    if (dSeg(u, v, px, py, hx, 0.6) < 0.013) lit(dSeg(u, v, px, py - 0.006, hx, 0.594) < 0.006 ? 1 : 0.4, 1);
    if (hypot(u - px, v - py) < 0.024) lit(1, 1);
    if (inBox(u, v, hx - 0.03, 0.57, hx + 0.03, 0.635)) lit(v < 0.585 ? 1 : 0.5, 1);
    if (inBox(u, v, 0.62, 0.64, 0.8, 0.655) || inBox(u, v, 0.62, 0.552, 0.8, 0.566)) lit(0.8, 1);                                         // slide bars
    if (inBox(u, v, 0.8, 0.5, 0.97, 0.7)) { const y = (v - 0.6) / 0.1; lit((0.9 - 0.7 * abs(y + 0.3)) * (fr(u * 34) < 0.16 ? 0.5 : 1), 1.2); }   // the cylinder, lagged and banded
    if (inBox(u, v, 0.83, 0.4, 0.95, 0.5)) lit(u < 0.845 || v < 0.415 ? 1 : 0.35, 1.2);                                                 // steam chest
    if (ell(u, v, 0.985, 0.6, 0.03, 0.1) < 1) lit(0.25, 0.6);
    if (abs(u - bx) < 0.004 && v > by && v < 0.4) lit(0.8, 0);
    if (br < 0.022) { L = 0; A = 1; M = 0; } else A = max(A, 0.75 * exp(-br * 22));
    o[0] = L; o[1] = min(A, 1); o[2] = 0; o[3] = M;
  };

  // --- the works, the ground under it, and the rooms nobody goes up or down to ---
  // a box in true perspective. C = [centre, horizon, focal]; x across (0 = the eye), y down from the eye, z away.
  // returns 1 (front), 2 (the side toward the eye), 3 (top, or underside if it is overhead) or 0; W.s / W.t = across and down (or away along) that face
  const pb = (u, v, C, x0, x1, y0, y1, z0, z1) => {
    const a = (u - C[0]) / C[2], b = (v - C[1]) / C[2];
    let X = a * z0, Y = b * z0;
    if (X >= x0 && X < x1 && Y >= y0 && Y < y1) { W.s = (X - x0) / (x1 - x0); W.t = (Y - y0) / (y1 - y0); return 1; }
    const xs = x1 < 0 ? x1 : x0 > 0 ? x0 : 0, ys = y0 > 0 ? y0 : y1 < 0 ? y1 : 0;
    if (xs && a * xs > 0) { const Z = xs / a; Y = b * Z; if (Z >= z0 && Z < z1 && Y >= y0 && Y < y1) { W.s = (Z - z0) / (z1 - z0); W.t = (Y - y0) / (y1 - y0); return 2; } }
    if (ys && b * ys > 0) { const Z = ys / b; X = a * Z; if (Z >= z0 && Z < z1 && X >= x0 && X < x1) { W.s = (X - x0) / (x1 - x0); W.t = (Z - z0) / (z1 - z0); return 3; } }
    return 0;
  };
  // --- looms: the weaving shed, down the alley beside the frames, from the overlooker's step. every one of them running. once a loop somebody is minding the last
  const SHED = [0.7, 0.26, 0.85];
  S.looms = (u, v, f, o) => {
    const C = SHED, a = (u - C[0]) / C[2], b = (v - C[1]) / C[2];
    let L = 0.03, A = 0, M = 1;
    if (b > 0) {                                                                                                                      // boards, and the moon laid across them through the bays
      const Z = 2.2 / b, X = a * Z, bay = fr(Z * 0.3 - X * 0.3);
      M = 0; L = (fr(X * 2.5) < 0.1 ? 0.06 : 0.2) * ss(16, 2, Z);
      if (X > -0.5 && X < 1.3 && bay < 0.45 && Z < 15) L = (abs(fr(bay * 6.7) - 0.5) > 0.4 ? 0.3 : 0.85) * ss(17, 4, Z);
    } else { const Z = -1.4 / b; M = 0; L = fr(Z * 0.3) < 0.08 && Z < 16 ? 0.4 : 0.07; }                                               // the roof, truss by truss
    if (a > 0) { const Z = 1.3 / a, Y = b * Z, wq = fr(Z * 0.3); if (Y > -1.4 && Y < 2.2 && Z < 16) { M = 0; L = 0.12; if (wq < 0.5 && Y > -1 && Y < 1) { M = 1; L = fr(wq * 6) < 0.14 || fr(Y * 2.1) < 0.12 ? 0.12 : 0.75 * ss(16, 2, Z); } } }   // the window wall
    for (let k = 6; k >= 0; k--) {
      const z = 2.3 + k * 1.9, dim = ss(17, 3, z), fc = pb(u, v, C, -2.5, -0.55, 1.1, 2.2, z, z + 1.2), s = W.s, t = W.t, by = 0.3 + 0.1 * [0, 1, 2, 1][(f + k) & 3];
      if (fc === 1) { M = 0; L = (s > 0.95 || t < 0.07 ? 0.8 : t > 0.3 && t < 0.6 ? 0.55 - 1.5 * abs(t - 0.45) : fr(s * 9) < 0.12 ? 0.3 : 0.05) * dim; }   // the breast beam and the cloth wound on under it
      else if (fc === 2) { M = 0; L = (t < 0.07 || s < 0.05 || s > 0.95 ? 0.5 : abs(ell(s, t, 0.5, 0.6, 0.3, 0.3) - 0.8) < 0.2 || abs(s - 0.5) < 0.03 ? 0.4 : 0.1) * dim; }   // the end frame, and its wheel
      else if (fc === 3) { M = 0; L = (s < 0.03 || s > 0.97 ? 0.9 : abs(t - by) < 0.05 ? 1 : t > 0.75 ? 0.75 : fr(s * 30) < 0.45 ? 0.6 : 0.12) * dim; }   // warp, cloth, and the lay beating up
      const sc = C[2] / (z + 0.6), bx = C[0] - 1.5 * sc, bt = C[1] - 1.4 * sc, bb = C[1] + 1.1 * sc;
      if (v > bt && v < bb && abs(abs(u - bx) - 0.05 * sc) < 0.012 * sc + 0.002) { M = 0; L = (fr(v * 30 * (u < bx ? 1 : -1) - f * 0.25) < 0.5 ? 0.6 : 0.2) * dim; }   // its belt down from the shaft, running
      if (k === 6 && f === 3 && (hypot((u - bx - 0.075) * 1.6, v - C[1] - 0.012) < 0.012 || inBox(u, v, bx + 0.065, C[1] + 0.02, bx + 0.086, C[1] + 0.11))) { M = 0; L = 0; }
    }
    const lr = hypot(u - 0.22, (v - 0.1) * 1.2);
    if (abs(u - 0.22) < 0.003 && v < 0.08) { M = 0; L = 0.5; }
    if (lr < 0.03) { M = 0; L = 0; A = 1; } else A = 0.55 * exp(-lr * 15) * (v > 0.08 ? 1 : 0.3);
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };
  // works>>

  // <<works2
  // --- paywin: the pay office hatch. brass bars, a lamp lit behind them, the packets set out on the sill. now and then somebody looks round the side of it
  const PAY = [[7, 5, 7, 4, 4], [7, 5, 7, 5, 5], [5, 5, 2, 2, 2]];
  S.paywin = (u, v, f, o) => {
    const C = [0.5, 0.54, 1.05], F = [0.45, 3.3, -0.45], E = 1.5, fl = [1, 0.9, 1, 0.94, 0.9, 1, 0.94][f];
    let L = 0.02, A = 0, B = 0, M = 0, k;
    if (gp(u, v, C, F, E) && H.z < 0) L = (fr(H.x * 3) < 0.07 ? 0.03 : 0.13) * ss(8, 1.5, H.d);                                           // boards
    if ((k = rb(u, v, C, F, -9, 9, -5, E, 0, 1)) === 3) {
      const x = H.x, y = H.y, lg = lamp(0, -0.1, -0.1, 0.75), ar = y < -0.45 ? hypot(x, y + 0.45) : abs(x), lx = floor(((x + 0.45) / 0.9) * 11), ly = floor(((y + 1.66) / 0.32) * 5);
      L = (y > 0.62 ? 0.07 : 0.15) * (fr(x * 4.5) < 0.07 ? 0.4 : 1) + 0.5 * lg;                                                          // matchboard, and a dado under it
      if (abs(y - 0.62) < 0.035) L = 0.5 + 0.4 * lg;
      if (abs(x) < 0.55 && y > -1.74 && y < -1.26) L = 0.04;
      if (lx >= 0 && lx < 11 && ly >= 0 && ly < 5 && lx % 4 < 3 && (PAY[lx >> 2][ly] >> (2 - (lx % 4))) & 1) L = 0.9;                    // PAY
      if (ar < 0.68 && y > -1.13 && y < 0.25) {
        L = 0.95 - 0.5 * ss(0.58, 0.68, ar);                                                                                           // the architrave
        if (ar < 0.56 && y > -1.01) {
          L = x < -0.47 ? 0.3 : 0; A = L ? 0 : fl * (0.03 + 0.97 * exp(-hypot(x - 0.16, (y + 0.3) * 0.8) * 6.5));                           // inside: one lamp, and not much of the room
          if (f > 2) { const d = f > 3 ? 0.17 : 0.07, hx = 0.6 - d + (y + 0.3) * 0.2; if (hypot((x - hx) / 0.17, (y + 0.42) / 0.22) < 1 || (y > -0.27 && x > hx - 0.05 - max(0, y + 0.16) * 0.7)) { L = 0; A = 0; } }   // a face, round the edge
          if (fr(x * 5.4 + 0.5) < 0.14 || abs(y + 0.45) < 0.02) { L = fr(x * 5.4 + 0.5) < 0.05 ? 1 : 0.45; A = 0; }                        // the bars
        }
      }
    }
    for (const bx of [-0.6, 0.52]) if ((k = rb(u, v, C, F, bx, bx + 0.08, 0.32, 0.62, -0.3, 0)) && H.t < 1 - H.s * 0.8) L = k === 3 ? 0.5 : 0.2;   // brackets
    if ((k = rb(u, v, C, F, -0.78, 0.78, 0.24, 0.32, -0.42, 0))) {                                                                      // the sill, and what is owing
      L = k === 5 ? 0.92 : k === 3 ? 0.4 : 0.18; A = 0;
      if (k === 5) { const e = fr(H.s * 6), n = floor(H.s * 6); if (e > 0.16 && e < 0.84 && H.t > 0.2 && H.t < 0.8) { L = e < 0.22 || H.t > 0.74 ? 0.15 : abs(H.t - 0.45 - abs(e - 0.5) * 0.5) < 0.03 ? 0.3 : 0.6; if (n === 3) { L = 0; B = 1; } } }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- keys: the key board in the pay office. a hook for every door in the works, a brass tag on each. one hook is bare. one key will not hang still
  S.keys = (u, v, f, o) => {
    const C = [0.4, 0.5, 1.0], F = [-0.4, 3.0, 0.5], E = 1.6;
    let L = 0.02, A = 0, B = 0, M = 0;
    if (rb(u, v, C, F, -9, 9, -5, E, 0, 1) === 3) {
      const x = H.x, y = H.y, lg = lamp(-1.5, -0.9, -1.1, 1.5);
      L = 0.05 * (fr(x * 4) < 0.07 ? 0.4 : 1) + 0.16 * lg;
      if (abs(x) < 2.42 && abs(y) < 1.47) {
        const i = floor((x + 2.3) / 0.46), j = floor((y + 1.35) / 0.54), py = fr((y + 1.35) / 0.54) * 0.54, sw = i === 6 && j === 2 && f === 3 ? 0.07 : 0, px = (fr((x + 2.3) / 0.46) - 0.5) * 0.46 - sw * max(0, py - 0.07), lt = 0.5 + 0.5 * lg;
        L = abs(x) > 2.3 || abs(y) > 1.35 ? 0.3 + 0.6 * lg : 0.03 + 0.1 * lg * (0.6 + 0.8 * fbm(x * 3, y * 40));                             // the board, dark wood in a moulded frame
        if (abs(x) < 2.3 && abs(y) < 1.35) {
          const bare = i === 3 && j === 3, mine = i === 7 && j === 1, rg = hypot(px, py - 0.18);
          if (hypot(px + sw * max(0, py - 0.07), py - 0.07) < 0.03) L = 1;                                                               // the hook
          else if (!bare && ((rg < 0.07 && rg > 0.036) || (abs(px) < 0.016 && py > 0.24 && py < 0.45) || (px > 0 && px < 0.07 && py > 0.37 && py < 0.45 && fr(py * 26) < 0.6))) { L = (px < -0.004 ? 1 : 0.6) * lt; if (mine) { L = 0; A = abs(py - 0.16 - 0.1 * (f % 3)) < 0.03 ? 0.6 : 1; } }   // ring, shank, bit. the one that is lit has a light going down it
          else if (!bare && hypot(px + 0.12, py - 0.33) < 0.055) { L = (hypot(px + 0.12, py - 0.33) > 0.042 ? 0.5 : 0.85 - 0.3 * hash(i, j)) * lt; if (hypot(px + 0.12, py - 0.31) < 0.012) L = 0; }   // its tag
          else if (!bare && dSeg(px, py, -0.03, 0.2, -0.1, 0.29) < 0.006) L = 0.35 * lt;
          else if (!bare && (hypot(px - 0.03, py - 0.2) < 0.07 || (abs(px - 0.03) < 0.016 && py > 0.24 && py < 0.47))) L = 0.01;            // and its shadow, thrown right
        }
      }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- coat: the pegs by the door. one coat, a cap, a tin and a mug on the bench under them. the tea is still hot
  S.coat = (u, v, f, o) => {
    const C = [0.46, 0.5, 1.0], F = [0.25, 3.3, -0.42], E = 1.5, bl = pj(C, F, -0.55, -1.0, -0.8), bu = bl.u, bv = bl.v, br = hypot(u - bu, v - bv);
    let L = 0.02, A = 0, M = 0, k;
    if (gp(u, v, C, F, E) && H.z < 0) L = (fr(H.x * 2.6) < 0.07 ? 0.03 : 0.1 + 0.3 * lamp(-0.55, E, -0.8, 1.2)) * ss(8, 1.5, H.d);
    if (rb(u, v, C, F, -9, 9, -5, E, 0, 1) === 3) {
      const x = H.x, y = H.y, lg = lamp(-0.55, -1.0, -0.8, 1.3), yy = y + 0.6, cx = x - 0.1, hw = yy < 0 ? 0 : 0.1 + 0.26 * ss(0, 0.16, yy) + 0.07 * ss(0.3, 1.5, yy);
      L = (y > 0.45 ? 0.05 : 0.1) * (fr(x * 4.5) < 0.07 ? 0.35 : 1) + (y > 0.45 ? 0.3 : 0.62) * lg * (fr(x * 4.5) < 0.07 ? 0.5 : 1);        // matchboard, lit only near the bulb
      if (abs(y - 0.45) < 0.03) L = 0.3 + 0.6 * lg;
      if (y > -0.74 && y < -0.6) L = y < -0.72 ? 0.5 + 0.5 * lg : 0.12 + 0.5 * lg;                                                        // the peg rail
      for (let i = -3; i < 4; i++) { const px = i * 0.8 + 0.1; if (hypot(x - px, y + 0.62) < 0.045) L = hypot(x - px + 0.012, y + 0.632) < 0.022 ? 1 : 0.02; }
      if (yy > 0 && yy < 1.56 && abs(cx) < hw && !(yy > 1.5 && fr(cx * 7) < 0.4)) {                                                       // the coat, heavy, the shoulders still in it
        L = cx < -hw + 0.05 ? 0.75 + 0.25 * lg : 0.03 + 0.07 * fbm(cx * 12, yy * 3) + (abs(fr(cx * 4.2 + 0.2 * sin(yy * 3)) - 0.5) < 0.05 && yy > 0.4 ? 0.18 : 0);
        if (yy < 0.42 && abs(abs(cx) - 0.02 - yy * 0.3) < 0.02) L = 0.6;                                                                 // lapels
        if (abs(cx - 0.03) < 0.022 && fr(yy * 3.2) < 0.14 && yy > 0.45) L = 0.95;                                                         // buttons
        if (abs(cx + hw - 0.15) < 0.012 && yy > 0.25 && yy < 1.2) L = 0.35;                                                               // the sleeve, hanging
        if (yy < 0.1 && abs(cx) < 0.06) L = 0.01;
      } else if (yy > 0 && yy < 1.56 && abs(cx - 0.09) < hw) L *= 0.3;                                                                   // its shadow
      const kx = x - 0.9, ky = y + 0.45;
      if ((ky > -0.14 && ky < 0 && abs(kx) < 0.19 - (ky + 0.14) * 0.2) || (ky >= 0 && ky < 0.05 && kx > -0.3 && kx < 0.2)) L = ky < -0.1 ? 0.6 + 0.3 * lg : 0.02;   // a cap
    }
    for (const lx of [-1.15, 1.25]) if ((k = rb(u, v, C, F, lx, lx + 0.1, E - 0.5, E, -0.62, -0.12))) L = k === 3 ? 0.3 : 0.08;            // bench
    if ((k = rb(u, v, C, F, -1.3, 1.45, E - 0.56, E - 0.5, -0.66, -0.08))) L = k === 5 ? 0.35 + 0.65 * lamp(-0.55, E - 0.56, -0.8, 1.1) : k === 3 ? 0.5 : 0.15;
    if ((k = rb(u, v, C, F, 0.25, 0.8, E - 0.8, E - 0.56, -0.5, -0.22))) L = k === 5 ? (abs(H.s - 0.5) < 0.2 && abs(H.t - 0.5) < 0.15 ? 0.35 : 0.9) : k === 3 ? (H.t < 0.3 ? 0.75 : 0.4) : 0.12;   // dinner tin
    const m = pj(C, F, -0.42, E - 0.56, -0.36), mx = (u - m.u) / m.k, my = (v - m.v) / m.k;                                             // the mug
    if ((abs(mx) < 0.11 && my > -0.24 && my < 0.045) || (abs(hypot(mx - 0.1, (my + 0.1) * 1.1) - 0.055) < 0.034 && mx > 0.085)) L = 0.01;                  // dark all round it, so it stands off the bench
    if (abs(mx) < 0.085 && my > -0.2 && my < 0.02 * (1 - (mx / 0.085) ** 2)) L = mx < -0.04 ? 1 : mx > 0.045 ? 0.3 : 0.8;
    if (abs(hypot(mx - 0.1, (my + 0.1) * 1.1) - 0.055) < 0.014 && mx > 0.085) L = 0.9;
    if (hypot(mx / 0.085, (my + 0.2) / 0.028) < 1) L = hypot(mx / 0.085, (my + 0.2) / 0.028) > 0.72 ? 1 : 0;
    const sy = -my - 0.22, sxx = mx + 0.05 * sy * sin(sy * 3 + f * 0.6);                                                               // and what comes off it: thin, breaking up as it rises
    if (sy > 0 && sy < 1.5 && abs(sxx) < 0.03 + 0.11 * sy && fbm(sxx * 14 + f * 0.3, sy * 7 - f * 0.8) > 0.46 + 0.1 * sy + 1.6 * abs(sxx) / (0.03 + 0.11 * sy) * 0.1) { L = 0.55 + 0.45 * ss(1.5, 0.2, sy); M = 1; }
    if (abs(u - bu) < 0.003 && v < bv) L = 0.4;
    if (br < 0.024) { L = 0; A = 1; } else A = 0.85 * exp(-br * 27);
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- ledger: the wages book, open on the desk under a lantern. forty years of the same names. the last line is still wet
  S.ledger = (u, v, f, o) => {
    const fl = [1, 0.9, 0.97, 0.85][f], Z = 1.3 / (v + 0.3), X = ((u - 0.5) * Z) / 1.3, dl = hypot(X + 0.34, (Z - 1.2) * 0.9), lit = fl * exp(-dl * 1.15), fd = hypot((u - 0.13) / 0.9, v - 0.63), a = -0.14, bk = (dz) => { const c = cos(a), s = sin(a), x = ((X - 0.26) * c + (Z + dz - 1.68) * s) / 0.6, y = ((1.68 - Z - dz) * c + (X - 0.26) * s) / 0.4; return [x, y]; };
    let L = (0.03 + 0.06 * fbm(X * 3, Z * 40)) * (1 + 6 * lit), A = 0, M = 0;
    if (Z > 2.75) L = 0.01;                                                                                                          // the far edge of the desk
    const [x, y0] = bk(0), [x2, y2] = bk(0.07), px = abs(x), hump = exp(-(((px - 0.2) / 0.15) ** 2)), y = y0 + 0.1 * hump - 0.13 * exp(-px * 13) * (px < 1 ? 1 : 0), row = floor((1 - y) * 8), ry = fr((1 - y) * 8);   // the leaves lift off the boards, crest, and go down into the gutter
    if (abs(x2 - 0.12) < 1.1 && abs(y2) < 1.1 && !(px < 1.06 && abs(y) < 1.08)) L *= 0.2;                                               // the shadow it throws away from the flame
    if (px < 1.06 && abs(y2) < 1.08 && y < -1) L = px > 1 ? 0.2 : fr(y2 * 22) < 0.5 ? 0.75 * (0.4 + 0.6 * lit) : 0.35;                     // the fore-edge: forty years of leaves
    if (px < 1.06 && (abs(y0) < 1.08 || (px < 1 && abs(y) < 1))) {
      L = 0.03 + 0.1 * lit;                                                                                                            // the boards, an inch proud of the paper all round
      if (px < 1 && abs(y) < 1) {
        L = (0.62 + 0.38 * lit) * (1 - 0.85 * exp(-px * 13)) * (1 - 0.25 * ss(0.7, 1, px)) * (x < 0 ? 1 + 0.3 * hump * ss(0.2, 0.08, px) - 0.35 * hump * ss(0.2, 0.34, px) : 1 - 0.3 * hump * ss(0.2, 0.08, px) + 0.25 * hump * ss(0.2, 0.34, px));   // lit on the slope that faces the lantern                                                // the page, rolling down into the gutter
        if (ry < 0.09 || abs(px - 0.66) < 0.007 || abs(px - 0.82) < 0.007) L *= 0.6;                                                    // ruled, and cash columns
        const last = x > 0 && row === 9;
        if (row === 0 ? ry > 0.3 && px > 0.25 && px < 0.75 && hash(floor(px * 12), 3) > 0.3 : row < (x > 0 ? 10 : 15) && ry > 0.4 && ry < 0.7 && px > 0.07 && px < 0.94 && hash(floor(x * 44), row) > (px > 0.64 ? 0.55 : 0.3) && hash(floor(x * 7.5), row + 20) > 0.2) { L = 0.02; if (last) A = 1; }
        if (last && x > 0.5 && x < 0.56 && ry > 0.1) { L = 0; A = 1; }
      }
      if (px < 0.012) L = 0.03;
    }
    if (dSeg(X, Z, 0.52, 1.36, 0.9, 1.62) < 0.012) { L = X < 0.6 ? 0.02 : 0.95; A = 0; }                                                 // the pen, put down across the corner
    const iw = ell(u, v, 0.84, 0.3, 0.05, 0.028);
    if (inBox(u, v, 0.79, 0.3, 0.89, 0.37) || ell(u, v, 0.84, 0.37, 0.05, 0.028) < 1) L = u < 0.81 ? 0.6 : 0.2;                          // inkwell
    if (iw < 1) L = iw > 0.7 ? 0.7 : 0;
    const lx = 0.13, gy = (v - 0.63) / 0.1, gw = 0.052 * Math.sqrt(max(0, 1 - gy * gy * 0.8)) + 0.01;                                 // the lantern: tank, burner, globe in its wires, cap, bail
    if (ell(u, v, lx, 0.84, 0.075, 0.028) < 1 || inBox(u, v, lx - 0.075, 0.77, lx + 0.075, 0.84)) { L = u < lx - 0.045 ? 1 : 0.5 - 2 * (u - lx); A = 0; }
    if (ell(u, v, lx, 0.77, 0.075, 0.028) < 1) L = 0.85;
    if (inBox(u, v, lx - 0.03, 0.725, lx + 0.03, 0.775)) { L = u < lx - 0.01 ? 0.9 : 0.35; A = 0; }
    if (abs(gy) < 1 && abs(u - lx) < gw) { L = abs(u - lx) > gw - 0.006 ? 0.9 : 0; A = L ? 0 : 0.75 * fl; }
    if (abs(gy) < 1.15 && (abs(abs(u - lx) - gw - 0.012) < 0.0035)) { L = 0.8; A = 0; }
    if (inBox(u, v, lx - 0.04, 0.5, lx + 0.04, 0.535) || inBox(u, v, lx - 0.02, 0.47, lx + 0.02, 0.5)) { L = u < lx - 0.015 ? 0.9 : 0.3; A = 0; }
    if (abs(ell(u, v, lx, 0.47, 0.085, 0.13) - 1) < 0.045 && v < 0.5) { L = 0.75; A = 0; }
    const fe = ell(u, v, lx + 0.003 * [0, 1, 0, -1][f], 0.66, 0.014, 0.04);
    if (fe < 1) { L = 0; A = 1; } else if (A < 0.9 && !(L > 0.3 && A === 0)) A = max(A, 0.6 * fl * exp(-fd * 19));
    o[0] = L; o[1] = min(A, 1); o[2] = 0; o[3] = M;
  };

  // --- timeclock: the clock by the wicket, and the rack beside it under one shaded bulb. every pocket has a card in it. the pale one has been punched tonight
  S.timeclock = (u, v, f, o) => {
    const C = [0.5, 0.52, 1.0], F = [-0.35, 3.0, 0.45], E = 1.5, lp = [0.25, -1.28, -0.6], bl = pj(C, F, lp[0], lp[1], lp[2]), br = hypot(u - bl.u, v - bl.v), fl = [1, 0.92, 1, 0.96][f];
    let L = 0.02, A = 0, B = 0, M = 0, k;
    const lg = (r) => fl * lamp(lp[0], lp[1], lp[2], r || 2.1);
    if (gp(u, v, C, F, E) && H.z < 0) L = (fr(H.x * 2.6) < 0.07 ? 0.03 : 0.08 + 0.3 * lg()) * ss(8, 1.5, H.d);
    if (rb(u, v, C, F, -9, 9, -5, E, 0, 1) === 3) {
      L = (0.02 + 0.42 * lg(1.7)) * brick(H.x * 0.5, H.y * 0.5, 7);
      if ((abs(H.x - 0.14) < 0.52 && H.y > -1.05 && H.y < 0.82) || (H.x > 0.88 && H.x < 2.34 && H.y > -0.95 && H.y < 0.98)) L *= 0.12;         // what the case and the rack throw on the wall
    }
    if ((k = rb(u, v, C, F, 0.8, 2.12, -1.0, 0.76, -0.1, 0))) {                                                                          // the rack: two rows of ten
      const l = 0.45 + 0.55 * lg();
      if (k !== 3) L = k === 1 ? 0.12 : l;
      else {
        const i = floor(H.s * 2), j = floor(H.t * 10), cx = fr(H.s * 2), cy = fr(H.t * 10), mine = i === 0 && j === 6;
        L = (cx < 0.06 || cx > 0.94 ? 1 : 0.02) * l;
        if (cx > 0.1 && cx < 0.9) {
          if (cy < 0.6) { L = (cy < 0.1 ? 1 : 0.78 - 0.2 * hash(i, j)) * l; if (cy > 0.2 && cy < 0.5 && hash(floor(cx * 16), i * 31 + j) > 0.45 && cx < 0.72) L = 0.08; if (mine) { B = cy > 0.2 && cy < 0.5 && cx < 0.7 && hash(floor(cx * 16), 7) > 0.4 ? 0 : 1; L = 0; } }   // a card, its name end up
          else L = (cy < 0.68 ? 1 : cy > 0.92 ? 0.02 : 0.14 + 0.16 * fr(cx * 3)) * l;                                                                      // the tin pocket it sits in
        }
      }
    }
    if ((k = rb(u, v, C, F, -0.42, 0.42, -1.1, 0.55, -0.34, 0))) {                                                                       // the clock, in its oak case
      const l = 0.45 + 0.55 * lg(), x = H.x, y = H.y, d = hypot(x, y + 0.6) / 0.33, an = Math.atan2(y + 0.6, x);
      if (k === 5) L = l;
      else if (k === 1) L = H.t < 0.03 || H.s < 0.06 ? 0.6 * l : 0.05 + 0.05 * fbm(H.s * 4, H.t * 50);
      else if (k === 3) {
        L = (abs(x) > 0.38 || y < -1.05 || y > 0.5 ? 1 : abs(x) > 0.345 || y < -1.01 || y > 0.46 ? 0.06 : 0.3 + 0.14 * fbm(x * 6, y * 40)) * l;                                         // moulded edge, figured panel
        if (d < 1.2) { L = (d > 1.12 ? 0.04 : d > 1 ? 0.6 : hypot(x + 0.1, y + 0.72) < 0.1 ? 1.3 : 1) * l; if (d < 1 && ((d > 0.76 && d < 0.9 && abs(fr((an * 6) / PI + 0.5) - 0.5) < 0.09) || d < 0.07 || (d < 0.5 && abs(fr((an + 2.2) / (2 * PI) + 0.5) - 0.5) < 0.016 / max(d, 0.1)) || (d < 0.72 && abs(fr((an + 0.3 - f * 0.105) / (2 * PI) + 0.5) - 0.5) < 0.011 / max(d, 0.1)))) L = 0; }   // the dial
        if (abs(y + 0.08) < 0.06 && abs(x) < 0.3) L = abs(y + 0.08) < 0.022 && abs(x) < 0.24 ? 0 : 0.95 * l;                              // brass, and the slot the card goes in
        if (abs(y - 0.24) < 0.1 && abs(x) < 0.22) L = (abs(y - 0.24) > 0.08 || abs(x) > 0.2 ? 0.05 : fr(y * 40) < 0.4 ? 1 : 0.5) * l;     // the maker's plate
      }
    }
    if ((k = rb(u, v, C, F, -0.6, -0.42, -0.14, -0.05, -0.24, -0.16))) L = (k === 5 ? 1 : 0.5) * (0.3 + 0.7 * lg());                      // the lever
    const kn = pj(C, F, -0.62, -0.1, -0.2); if (hypot(u - kn.u, v - kn.v) < 0.05 * kn.k) L = hypot(u - kn.u + 0.004, v - kn.v + 0.004) < 0.02 * kn.k ? 1 : 0.35;
    if (abs(u - bl.u) < 0.003 && v < bl.v - 0.03) L = 0.4;
    if (v > bl.v - 0.04 && v < bl.v && abs(u - bl.u) < 0.012 + (v - bl.v + 0.04) * 1.1) { L = u < bl.u ? 0.7 : 0.2; A = 0; }                // its shade, enamel, a cone
    else if (hypot(u - bl.u, (v - bl.v - 0.008) * 1.2) < 0.016) { L = 0; A = fl; } else A = 0.6 * fl * exp(-br * 22) * (v > bl.v ? 1 : 0.15);
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- halt: the works halt, from the platform. the name on the board painted out, and a steel freight box stood on the flags with its doors a hand apart. there is a light on inside it, low down. once a loop somebody stands in it
  const DOOR = (s, t) => (t < 0.03 || t > 0.97 || s < 0.04 || s > 0.96 ? 0.95 : abs(abs(s - 0.5) - 0.2) < 0.022 ? (abs(t - 0.56) < 0.05 ? 0.3 : 1) : abs(t - 0.56) < 0.016 && abs(s - 0.5) < 0.3 ? 0.9 : s > 0.9 && fr(t * 4.5) < 0.22 ? 0.9 : fr(t * 9) < 0.14 ? 0.1 : 0.34);   // a leaf: frame, two lock rods and their handles, hinges, ribs
  S.halt = (u, v, f, o) => {
    const C = [0.4, 0.36, 0.95], F = [-0.09, 4.94, 1.035], P = 1.6, R = 2.6, T = P - 2.6, G = [F[0] - sin(F[2]), F[1] + cos(F[2]), F[2] - 0.32], fl = [1, 0.92, 1, 1][f];
    let L = 0.02 + 0.12 * ss(0, 0.36, v) * (0.5 + fbm(u * 2, v * 9)), A = 0, M = 1, k;
    if (v > C[1] - 0.012 - 0.016 * fbm(u * 6, 1)) { M = 0; L = 0.02; }                                                                  // the quarry side, a long way off
    if (gp(u, v, C, F, R) && H.z > 2.2) { M = 0; L = (abs(abs(H.z - 3.5) - 0.72) < 0.05 ? 0.9 : abs(H.z - 3.5) < 1.3 && fr(H.x * 1.5) < 0.32 ? 0.03 : 0.06 + 0.12 * hash(floor(H.x * 9), floor(H.z * 9))) * ss(40, 6, H.d); }   // metals, sleepers, ballast
    if (rb(u, v, C, F, -40, 60, P, R, -30, 2.2) === 5) {                                                                                // the platform: flags, and its white edge
      const w = 0.06 - H.x * 0.26, dz = abs(H.z - 0.06 + H.x * 0.1), sp = H.x < 0 ? ss(w, w * 0.45, dz) * exp(H.x * 0.3) * fl : 0, own = f === 3 && dz < w * 0.4 ? 0.2 : 1;
      M = 0; L = H.z > 1.95 ? 0.8 * ss(40, 8, H.d) : (fr(H.x * 1.1) < 0.04 || fr(H.z * 1.1) < 0.04 ? 0.03 : 0.1 + 0.05 * hash(floor(H.x * 1.1), floor(H.z * 1.1)) + 0.6 * sp * own) * ss(40, 5, H.d);
      A = 0.36 * sp * own * ss(-6, -0.3, H.x);                                                                                         // what comes out between the doors, lying across them
      if (H.x > 0 && H.x < 6.6 && H.z > -1.7 && H.z < -1) L *= 0.3;
    }
    for (const px of [8.6, 11.1]) if ((k = rb(u, v, C, F, px, px + 0.12, -0.3, P, 1.5, 1.6))) { M = 0; A = 0; L = 0.4; }                   // the name board. it has been painted out
    if ((k = rb(u, v, C, F, 8.2, 11.6, -0.7, 0.1, 1.48, 1.56))) { M = 0; A = 0; L = k === 3 ? (H.s < 0.02 || H.s > 0.98 || H.t < 0.07 || H.t > 0.93 ? 0.12 : 0.6 - 0.3 * fbm(H.s * 14, H.t * 2.5)) : 0.25; }
    if ((k = rb(u, v, C, F, 0, 6, T, P, -1, 1))) {                                                                                       // the box
      M = 0; A = 0;
      if (k === 3) { const s = H.s, t = H.t; L = t < 0.05 || t > 0.95 || s < 0.025 || s > 0.975 ? 0.6 : (fr(s * 22) < 0.5 ? 0.3 : 0.1) * (0.6 + 0.4 * fbm(s * 9, t * 3)); if (hypot((s - 0.01) * 6, abs(t - 0.5) - 0.48) < 0.05) L = 1; L *= ss(1.6, -0.2, s); }   // its side, pressed in ribs, the corner castings
      else if (k === 1) {
        const z = H.z, t = H.t;
        if (z < -0.03) L = DOOR((z + 1) / 0.97, t);
        else { L = 0; A = fl * (0.25 + 0.75 * ss(0.3, 1, t)) * exp(-abs(z - 0.03) * 2.2); if (f === 3 && (hypot((z - 0.1) / 0.09, (t - 0.4) / 0.045) < 1 || (t > 0.44 && abs(z - 0.1) < 0.12 + 0.05 * ss(0.44, 0.52, t)))) A = 0; }   // inside
        if (t < 0.03 || t > 0.975 || abs(z) > 0.97) L = 0.75;
      }
    }
    if ((k = rb(u, v, C, G, -0.05, 0, T + 0.07, P - 0.06, -0.95, 0))) { M = 0; A = 0; L = k === 1 ? DOOR(H.s, H.t) * 0.8 : k === 3 ? 0 : 0.2; if (k === 3) A = fl * (0.3 + 0.7 * H.t); }   // the other leaf, swung out, its edge catching it
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- signal: the halt's home signal, from the foot of its post. arm, spectacle, lamp, ladder, landing. nothing has been due for forty years. it comes off
  S.signal = (u, v, f, o) => {
    const C = [0.42, 0.88, 0.9], F = [0.5, 4.6, 0.6], E = 1.6, th = [0, 0.03, 0.42, 0.8][f], top = E - 5.4, pv = pj(C, F, 0, top + 0.9, -0.2), K = pv.k, x = (u - pv.u) / K, y = (v - pv.v) / K, c = cos(th), s = sin(th), ax = x * c - y * s, ay = x * s + y * c;
    let L = 0.02 + 0.2 * ss(0.1, 0.9, v) * (0.4 + fbm(u * 2 + 3, v * 7)), A = 0, B = 0, M = 1, k;
    if (gp(u, v, C, F, E)) { M = 0; L = (abs(abs(H.z + 2.2) - 0.72) < 0.06 ? 0.9 : abs(H.z + 2.2) < 1.3 && fr(H.x * 1.5) < 0.32 ? 0.04 : 0.08 + 0.12 * hash(floor(H.x * 8), floor(H.z * 8))) * ss(40, 5, H.d); }
    if ((k = rb(u, v, C, F, -0.16, 0.16, top, E, -0.16, 0.16))) { M = 0; L = (k === 3 ? 0.9 : k === 1 ? 0.28 : 0.5) * (fr(H.y * 0.9) < 0.04 ? 0.5 : 1) * (H.y > E - 1.3 ? 0.25 : 1); }   // the post: pitch pine, tarred at the foot
    if (rb(u, v, C, F, 0.3, 0.32, top + 1.6, E, -0.75, -0.35) === 1 && (H.s < 0.12 || H.s > 0.88 || fr(H.y * 3.2) < 0.14)) { M = 0; L = 0.35; }   // the ladder up to it
    if (hypot(x, (y + 1.05) * 0.8) < 0.13 || (abs(x) < 0.035 && y > -1.5 && y < -0.9)) { M = 0; L = 0.6; }                                 // finial
    if (ax < 0.25 && ax > -2.0 && abs(ay) < 0.17) { M = 0; L = ax < -1.45 && ax > -1.68 ? 0.04 : ay < -0.11 ? 1 : 0.86; if (ax < -1.94 || abs(ay) > 0.15) L = 0.3; }   // the arm, and the band across it
    for (const [g, an] of [[0, 0], [1, -0.78]]) {                                                                                     // the spectacle: a red glass and a green
      const gx = 0.62 * cos(an), gy = 0.62 * sin(an), d = hypot(ax - gx, ay - gy);
      if (d < 0.27) { M = 0; L = d > 0.17 ? 0.14 : 0; const on = g === 0 ? f < 2 : f === 3; if (d <= 0.17) { if (g) B = on ? 1 : 0.22; else A = on ? 1 : 0.22; } }
    }
    if (ax > 0 && ax < 0.5 && abs(ay) < 0.1 && !A && !B && L !== 0.14) { M = 0; L = 0.14; }
    const lr = hypot(x - 0.62, y);
    if (f < 2) A = max(A, 0.55 * exp(-lr * 5)); else if (f === 3) B = max(B, 0.55 * exp(-lr * 5));
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };
  // works2>>

  // <<under
  // --- shaft: inside the well, a third of the way down, looking across and down. iron rungs, and on the stones beside them hands, wet, all going the same way
  // a hand laid flat, fingers up the page: heel, four fingers of width w, a thumb out to the right. pr = as a print: hollow in the palm, broken at the joints
  const paw = (dx, dy, pr, w) => {
    if (hypot(dx / 0.5, (dy - 0.38) / 0.42) < 1 && !(pr && hypot((dx - 0.04) / 0.2, (dy - 0.36) / 0.17) < 1)) return true;
    for (let i = 0; i < 4; i++) { const fx = -0.38 + i * 0.25; if (dSeg(dx, dy, fx, 0, fx * 1.45, -[0.78, 1.02, 1.08, 0.92][i]) < w && (!pr || abs(fr(dy * 2.6 + i * 0.3) - 0.5) < 0.43)) return true; }
    return dSeg(dx, dy, 0.42, 0.5, 0.92, 0.02) < w + 0.015;
  };
  S.shaft = (u, v, f, o) => {
    const x = (u - 0.46) / 0.62, ar = Math.sqrt(max(0, 1 - x * x)), wl = 0.9 - 0.2 * ar + 0.006 * sin(u * 34 + f * 1.57) + 0.012 * (fbm(u * 9, f) - 0.5), wet = v > wl, vv = wet ? 2 * wl - v + 0.012 * sin(v * 150 + u * 22 + f * 1.57) : v;
    const w = vv + (0.1 + 0.16 * vv) * ar, k = floor(w * 8);
    let L = 0, A = 0, B = 0, M = 0;
    if (abs(x) < 1) {
      L = (0.08 + 0.85 * ss(-0.9, 0.4, x) * ss(1, 0.5, x)) * (fr(w * 8) < 0.1 || fr(Math.asin(x) * 3.2 + (k & 1) * 0.5) < 0.05 ? 0.15 : 0.75 + 0.5 * hash(k, floor(Math.asin(x) * 3.2 + (k & 1) * 0.5))) * ss(1.2, 0.35, w);   // the steining, course under course
      if (abs(x + 0.08) < 0.13 && fr(w * 8) > 0.42 && fr(w * 8) < 0.6) { L = 1; A = 0; }                                                 // rungs
      if (abs(x + 0.08) < 0.13 && fr(w * 8) >= 0.6 && fr(w * 8) < 0.72) { L = 0; A = 0; }
      for (const [hx, hw, sd, tl] of [[-0.36, 0.27, 1, 0.2], [0.15, 0.41, -1, -0.15], [-0.38, 0.6, 1, 0.08], [0.14, 0.72, -1, -0.28], [-0.35, 0.88, 1, 0.3]]) {       // hands, put flat, wet and black: heel, four fingers, a thumb, and what ran down off them
        const px = (x - hx) / 0.12, py = (w - hw) / 0.08, dx = (px * cos(tl) + py * sin(tl)) * sd, dy = py * cos(tl) - px * sin(tl);
        const h = paw(dx, dy, 1, 0.095) || (dy > 0.7 && dy < 0.8 + 1.6 * hash(floor(dx * 5 + 9), hw) && fr(dx * 5) < 0.3 && abs(dx) < 0.45);
        if (h && hash(floor(x * 190), floor(w * 190)) < 0.9) { L = 0; A = 0; }
      }
      const e = hypot((x - 0.56) / 0.2, (w - 0.5) / 0.2);
      if (x > 0.36 && x < 0.76 && w < 0.72 && (w > 0.5 || e < 1)) { L = 0; A = hypot((x - 0.6) / 0.03, (w - 0.56) / 0.022) < 1 ? [1, 0.8, 1, 0.9][f] : 0.35 * exp(-hypot(x - 0.6, w - 0.56) * 16); }       // a way off, bricked round. there is a light some way along it
      else if (x > 0.3 && x < 0.82 && w < 0.75 && (w > 0.5 ? 1 : e < 1.3)) { L = 0.9; A = 0; }
    }
    if (wet && abs(x) < 1) {                                                                                                          // the water: the wall again, upside down and broken, and the passage light lying down it
      const d = v - wl, gx = abs(u - 0.832);
      M = 1; L = d < 0.006 && hash(floor(u * 50), f) > 0.35 ? 0.85 : L * 0.85 * ss(0.4, 0, d); if (fr(v * 60) < 0.3) L *= 0.35;
      if (hash(floor(v * 120), floor(u * 12 + f * 0.5)) > 0.82) L = 0.6 * ss(0.3, 0, d) * ss(1, 0.3, abs(x + 0.1));
      A = gx < (0.01 + 0.2 * d) * (0.25 + hash(floor(v * 120), f)) ? 0.95 * ss(0.3, 0.02, d) : 0.3 * exp(-gx * 30) * ss(0.2, 0, d);
    }
    if (abs(u - 0.6 - 0.012 * sin(v * 5 + f * 1.57) * v) < 0.006 && !wet) { L = u < 0.6 ? 1 : 0.3; A = 0; B = 0; }                          // the rope. it is taut
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // a round tunnel going away: what it is cut through, where the eye is. sets T.z (how far), T.w (0 floor 1 left 2 right 3 roof), T.x / T.y (where on that face)
  const T = { z: 0, w: 0, x: 0, y: 0 };
  const bore = (u, v, C, hw, up, dn) => {
    const a = (u - C[0]) / C[2], b = (v - C[1]) / C[2], zs = hw / max(abs(a), 1e-4), zf = (b > 0 ? dn : -up) / (abs(b) > 1e-4 ? b : 1e-4);
    if (zs < zf) { T.z = zs; T.w = a < 0 ? 1 : 2; T.x = b * zs; T.y = b * zs; } else { T.z = zf; T.w = b > 0 ? 0 : 3; T.x = a * zf; T.y = 0; }
    return T.z;
  };

  // --- adit: the level, timbered, running in under the works. tub rails. a long way in somebody has a light, and once a loop it is nearer
  S.adit = (u, v, f, o) => {
    const C = [0.6, 0.47, 0.75], Z = bore(u, v, C, 1, 1.15, 1), set = fr(Z * 0.55), dim = ss(15, 1.5, Z), r = hypot(u - C[0], v - C[1]);
    let L = (0.05 + 0.5 * fbm(Z * 2.2, T.x * 2.2 + T.w * 7) ** 1.6) * dim * (1 + (f === 3 ? 0.5 : 0)), A = 0, M = 0;
    if (T.w === 0) {
      L = (0.1 + 0.16 * hash(floor(T.x * 14), floor(Z * 14))) * dim;
      if (abs(T.x) < 0.75 && fr(Z * 1.3) < 0.28) L = 0.32 * dim;                                                                        // sleepers
      if (abs(abs(T.x) - 0.42) < 0.045) L = 1 * ss(20, 3, Z);                                                                            // the rails
      if (T.x < -0.6 && fbm(Z * 0.8, 3) > 0.55) { L = 0.02; A = abs(T.x + 0.75) < 0.06 ? 0.5 * ss(12, 3, Z) : 0; }                                                               // standing water, along the low side
    }
    if (set < 0.14 && T.w) { L = (T.w === 1 ? 0.25 : T.w === 2 ? 0.95 : 0.6) * (set < 0.03 ? 0.5 : 1) * ss(18, 2, Z); if (T.w !== 3 && fr(T.x * 3 + Z) < 0.08) L *= 0.5; }   // a set: two legs and a cap
    else if (set < 0.2 && T.w) L *= 0.3;
    const lr = f === 3 ? 0.03 : 0.012;
    A = max(A, (r < lr ? 1 : 0.45 * exp(-r * (f === 3 ? 11 : 22))) * [1, 0.85, 1, 1][f]);
    if (r < lr) L = 0;
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- ledge: where the level widens. somebody has stood a lamp on the rock and gone on without it. the roof drips into the same place it has always dripped
  S.ledge = (u, v, f, o) => {
    const C = [0.2, 0.36, 0.7], Z = bore(u, v, C, 1.2, 1, 1.1), dim = ss(9, 1, Z), lx = 0.62, ly = 0.6, lr = hypot(u - lx, (v - ly) * 1.1), dy = fr(f / 4 + 0.001);
    let L = (0.04 + 0.5 * fbm(Z * 2.4 + T.w * 5, T.x * 2.4)) * dim * (0.25 + 1.5 * exp(-lr * 3.5)), A = 0.45 * exp(-lr * 17), M = 0;
    if (hypot(u - C[0], v - C[1]) < 0.05) L = 0;
    const lg = iso(u, v, 0.34, 0.93, 0.62, -0.1, -0.2, -0.09, 0.2 + 0.03 * fbm(u * 9, 2));                                              // the ledge
    if (lg) { const k = 0.2 + 1.3 * exp(-lr * 3.5); L = (lg === 3 ? 0.5 + 0.3 * fbm(u * 30, v * 30) : lg === 1 ? 0.14 + 0.14 * fbm(u * 14, v * 30) : 0.03) * k; }
    if (ell(u, v, 0.585, 0.672, 0.07, 0.016) < 1 && u < lx) { L = 0; A = 0; }
    if (inBox(u, v, lx - 0.04, ly - 0.085, lx + 0.04, ly + 0.065)) {                                                                   // a safety lamp: brass, gauze, glass
      const y = v - ly;
      L = y > 0.03 || y < -0.06 ? (u < lx - 0.015 ? 1 : 0.4) : 0; A = 0;
      if (y <= 0.03 && y >= -0.02) A = abs(u - lx) < 0.012 && y > -0.012 ? 1 : 0.75; else if (y < -0.02 && y >= -0.06) L = (floor(u * 240) + floor(v * 240)) & 1 ? 0.9 : 0.1;
      if (abs(abs(u - lx) - 0.036) < 0.005 && y < 0.03 && y > -0.06) { L = 0.9; A = 0; }
    }
    if (abs(ell(u, v, lx, ly - 0.11, 0.03, 0.035) - 1) < 0.22 && v < ly - 0.085) { L = 0.9; A = 0; }
    if (abs(u - 0.37) < 0.004 && abs(v - (0.1 + dy * 0.62)) < 0.02 && dy < 0.95) { L = 0.85; A = 0.32 * ss(0, 0.6, dy); }                                         // the drip
    const pr = hypot((u - 0.37) / 2.2, v - 0.745);
    if (pr < 0.045 && lg === 3) { L = abs(fr(pr * 60 - f * 0.25) - 0.5) < 0.2 ? 1 : 0.02; A = L > 0.5 ? 0.25 : 0; }                                       // and the cup it has worn
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- cart: a tub off the road, down on one side. iron-bound elm, wider at the top than the bottom. it was bringing out boots. all left ones. one of them is not empty
  // a boot, side on: x heel to toe, y down from the ankle, both in boot lengths. lt = how lit. returns its ink, or -1
  const boot = (x, y, lt) => {
    const sole = 0.62 - 0.26 * ss(0.3, 1.25, x), top = x < -0.12 ? -1.5 : x < 0.7 ? -0.55 * (1 - (x + 0.12) / 0.82) ** 1.5 : 0;               // the leg, then the instep coming down to the toe
    if (x < -1 || x > 1.25 || y < top || y > sole || (x > 0.95 && hypot((x - 0.95) / 0.3, (y - 0.2) / 0.25) > 1) || (y > sole - 0.07 && x > -0.5 && x < -0.2)) return -1;
    if (y > sole - 0.13) return 0.02;                                                                                                // sole and heel, the waist cut up between them
    if (y > sole - 0.18 || (x < -0.12 && y < -1.36) || x < -0.82) return 1;                                                            // welt, the top of it, the back seam
    if (abs(x - 0.72) < 0.03 || (y < 0 ? x > -0.34 && x < -0.14 && fr(y * 5) < 0.35 : y < top + 0.16 && x < 0.4 && fr(x * 7) < 0.35)) return 0.05;   // toe cap, and the lacing
    return (0.62 - 0.25 * x) * lt;
  };
  S.cart = (u, v, f, o) => {
    const C = [0.52, 0.26, 1.0], F = [0.3, 4.2, 0.62], E = 1.5, lt = 0.35 + 0.85 * ss(1.1, -0.1, u * 0.7 + (1 - v) * 0.5), pv = pj(C, F, 0.6, E, -0.4), ca = cos(-0.085), sa = sin(-0.085), ru = pv.u + (u - pv.u) * ca + (v - pv.v) * sa, rv = pv.v - (u - pv.u) * sa + (v - pv.v) * ca;
    let L = (0.02 + 0.5 * fbm(u * 5, v * 9) ** 1.6 + (abs(fr(v * 14 + 2 * fbm(u * 3, 1)) - 0.5) < 0.05 ? 0.12 : 0)) * ss(-0.1, 0.25, v) * lt, A = 0, M = 0, k;
    if (gp(u, v, C, F, E)) {                                                                                                           // the floor, and the road it came off
      const z = H.z - 0.75, dim = ss(9, 2, H.d) * lt;
      L = (0.05 + 0.4 * hash(floor(H.x * 16), floor(H.z * 16)) ** 2) * dim;
      if (abs(z) < 0.72 && fr(H.x * 1.05) < 0.24) L = 0.34 * dim;
      if (abs(abs(z) - 0.42) < 0.035) L = ss(9, 2.5, H.d);
      if (hypot((H.x - 0.25) / 1.35, (H.z + 0.15) / 0.75) < 1) L *= 0.1;                                                                 // its shadow
    }
    if ((k = rb(ru, rv, C, F, -0.8, 0.8, E - 0.52, E - 0.36, -0.4, 0.4))) L = k === 3 ? (fr(H.s * 8) < 0.12 ? 0.2 : 0.8) : 0.15;                                     // the frame under it
    for (const wx of [-0.48, 0.48]) if (rb(ru, rv, C, F, wx - 0.28, wx + 0.28, E - 0.56, E, -0.46, -0.42) === 3) {                        // wheels: cast, flanged, four holes
      const d = hypot(H.x - wx, H.y - E + 0.28) / 0.28, an = Math.atan2(H.y - E + 0.28, H.x - wx);
      if (d < 1) L = d > 0.84 ? 1 : d > 0.74 ? 0.25 : d < 0.2 ? (d < 0.09 ? 0.1 : 0.9) : d > 0.36 && d < 0.62 && abs(fr((an * 2) / PI) - 0.5) < 0.28 ? 0.02 : 0.5;
    }
    for (let j = 0; j < 5; j++) {                                                                                                       // the body, a plank to a course
      const hl = 0.7 + 0.045 * j, hw = 0.4 + 0.035 * j;
      if (!(k = rb(ru, rv, C, F, -hl, hl, E - 0.72 - j * 0.2, E - 0.52 - j * 0.2, -hw, hw))) continue;
      const s = H.s, t = H.t;
      if (k === 3) {
        L = (t > 0.9 ? 0.08 : 0.6 + 0.28 * fbm(s * 5 + j * 7, t * 2)) * lt;
        if (abs(abs(s - 0.5) - 0.3) < 0.03 || s < 0.035 || s > 0.965 || (j === 4 && t < 0.3)) L = hypot((fr(s * 12) - 0.5) / 4, t - 0.55) < 0.1 && !(j === 4 && t < 0.3) ? 0.15 : 1;   // straps, corner irons, the rim, a rivet to each plank
      } else if (k === 1) {
        L = t > 0.9 ? 0.04 : 0.2 + 0.08 * fbm(s * 5 + j * 7, t * 2);
        if (abs(abs(s - 0.5) - 0.28) < 0.04 || s > 0.95 || (j === 4 && t < 0.3)) L = 0.5;
        if (j < 2 && abs(s - 0.5) < 0.1) L = 0.7;                                                                                      // the drawplate
      } else if (k === 5 && j === 4) L = s < 0.03 || s > 0.97 || t < 0.06 || t > 0.94 ? 1 : hash(floor(s * 13), floor(t * 7)) > 0.6 && s < 0.8 ? 0.22 : 0.01;   // down into it: not quite empty
    }
    const h0 = pj(C, F, -0.72, E - 0.56, 0), h1 = pj(C, F, -1.12, E - 0.2, 0);                                                          // drawbar and hook
    if (dSeg(ru, rv, h0.u, h0.v, h1.u, h1.v) < 0.007 || abs(hypot(ru - h1.u + 0.01, rv - h1.v - 0.018) - 0.02) < 0.006) L = 0.85;
    for (const [bx, by, sz, tl, hit] of [[0.34, 0.9, 1.25, 0.2, 0], [0.15, 0.82, 1.0, -0.3, 1], [0.1, 0.6, 0.72, 0.5, 0], [0.26, 0.5, 0.6, 0, 0], [0.07, 0.45, 0.52, -0.4, 0], [0.9, 0.95, 1.15, 0.4, 0]]) {
      const c = cos(tl), sn = sin(tl), x = ((u - bx) * c + (v - by) * sn) / (0.06 * sz), y = (-(u - bx) * sn + (v - by) * c) / (0.06 * sz), b = boot(x, y, lt);
      if (b >= 0) { L = b; if (hit && x < -0.12 && y < -1.2) { L = 0; A = 1; } }
    }
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- junction: three ways on. somebody has chalked a sign over each. one of them is lit from inside
  S.junction = (u, v, f, o) => {
    let L = 0.03, A = 0, M = 0;
    if (wall(u, v, -0.05, 1.05, -0.3, 0.14, 1.12, 0.74)) {
      const q = deep(W.s, 1.42, 0.6), t = W.t;
      L = (0.04 + 0.75 * fbm(q * 9, t * 7) ** 1.5 + (abs(fr(t * 9 + 0.6 * fbm(q * 4, 2)) - 0.5) < 0.04 ? 0.25 : 0)) * (1 - 0.55 * q) * (t > 0.44 && t < 0.5 ? 1.4 : 1);
      for (let k = 0; k < 3; k++) {
        const cx = 0.18 + k * 0.31, hx = (q - cx) / 0.1, e = t < 0.62 ? hypot(hx, (t - 0.62) / 0.16) : abs(hx);
        if (e < 1 && t > 0.44) { L = k === 1 ? 0 : abs(abs(hx) - 0.5) < 0.06 && t > 0.8 ? 0.3 : 0; A = k === 1 ? [0.85, 0.7, 0.85, 0.4][f] * ss(0.75, 0.1, e) * ss(0.95, 0.6, t) : 0; if (k === 1 && f === 3 && hypot(hx * 1.6, (t - 0.7) / 0.05) < 1) A = 0; if (k === 1 && f === 3 && abs(hx) < 0.28 && t > 0.74) A = 0; }
        else if (e < 1.22 && t > 0.42) { L = fr(Math.atan2(t - 0.62, hx * 0.1) * 3) < 0.14 ? 0.2 : 0.85 - 0.3 * q; A = 0; }                // stone round each mouth
        if (sigil((q - cx) / 0.075, (t - 0.3) / 0.085, k, 0.3)) { L = 1; A = 0; }
      }
    } else {
      const Z = 0.25 / max(v - 0.55, 1e-3), X = (u - 1.3) * Z;
      L = (0.05 + 0.3 * hash(floor(X * 12), floor(Z * 12))) * ss(5, 0.5, Z); if (fbm(X * 1.4, Z * 1.4) > 0.62) L = 0.01;
      for (const off of [-0.5, 0.1]) if (abs(X * 0.5 + Z * 0.6 + off - 1.2) < 0.03) L = 1;                                              // the road, coming up to the points
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- cavern: the level breaks into something that was already here. water, dead still. steps cut down to it. across it, a light, and its twin
  S.cavern = (u, v, f, o) => {
    const wl = 0.6, mir = v > wl, y = mir ? 2 * wl - v + 0.004 * sin(u * 60 + v * 90 + f * 1.57) : v, far = 0.36 + 0.1 * fbm(u * 3, 5), lr = hypot(u - 0.66, (y - 0.52) * 1.2);
    let L = 0.02, A = 0, B = 0, M = 1;
    if (y > far - 0.2) L = (0.06 + 0.95 * fbm(u * 7, y * 12) ** 1.7) * ss(0.64, 0.3, y) * ss(far - 0.2, far + 0.05, y) * (0.4 + 1.2 * exp(-abs(u - 0.66) * 4));                               // the far wall, its foot in the water
    for (let k = 0; k < 3; k++) {                                                                                                     // what hangs from the roof, three deep
      const n = 7 + k * 5, c = floor(u * n + k * 0.4), tip = (0.2 + 0.36 * hash(c, k)) * (1.25 - 0.3 * k) * (0.8 + 0.5 * abs(u - 0.5)), x = abs(fr(u * n + k * 0.4) - 0.5);
      if (y < tip && x < 0.4 * (1 - y / tip) + 0.02) { M = 0; L = [0.3, 0.12, 0.01][k] * (fr(u * n + k * 0.4) < 0.5 - 0.2 * (1 - y / tip) ? 2.8 : 0.3); }
    }
    if (lr < 0.014) { L = 0; A = 1; M = 0; } else A = 0.5 * exp(-lr * 20) * [1, 0.9, 1, 0.8][f];
    if (mir) { L *= 0.45; A = abs(u - 0.66) < (0.012 + 0.16 * (v - wl)) * (0.3 + hash(floor(v * 120), f)) && v < wl + 0.3 ? 0.95 * ss(wl + 0.3, wl + 0.05, v) : 0; if (fr(v * 60) < 0.3) L *= 0.4; if (abs(v - wl) < 0.004) L = 0.9; }
    for (let k = 0; k < 5; k++) { const st = iso(u, v, 0.02 + k * 0.035, 1.12 - k * 0.075, 0.36, -0.09, -0.2, -0.07, 0.075); if (st) { M = 0; A *= 0.3; L = st === 3 ? 0.85 - 0.12 * k : st === 1 ? 0.3 - 0.04 * k : 0.06; if (k === 4 && st !== 3 && v > wl + 0.085) L = 0.02; } }   // the steps. the last one is under
    const rp = hypot((u - 0.5) / 3.2, v - 0.8); if (rp < 0.034 && rp > 0.004 && abs(fr(rp * 70 - f * 0.25) - 0.5) < 0.17) { L = 1; A = 0; M = 0; }   // something has just gone in off them
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- tally: the wall by the water. somebody has been keeping count in fives, right the way back. the last gate wants one stroke, and once a loop it gets it
  S.tally = (u, v, f, o) => {
    let L = 0.03, A = 0, M = 0;
    if (wall(u, v, -0.05, 1.05, -0.3, 0.18, 1.3, 0.8)) {
      const q = deep(W.s, 1.6, 0.62), t = W.t, i = floor(q * 11), j = floor(t * 8), x = fr(q * 11), y = fr(t * 8), jx = x + 0.06 * (hash(i, j) - 0.5), last = i === 2 && j === 5, n = last ? 4 : 5;
      L = (0.03 + 0.3 * fbm(q * 8, t * 7) ** 1.4) * (0.35 + 1.1 * exp(-hypot(q - 0.25, t - 0.7) * 2.2));
      if (!(j === 5 && i < 2) && !(j > 5 && i < 4) && j < 8 && y > 0.16 && y < 0.84 && (last || hash(i * 3, j * 5) > 0.06)) {
        const st = fr(jx * 6.2 - 0.6), sk = floor(jx * 6.2 - 0.6);
        if ((st < 0.3 && sk >= 0 && sk < 4 && (last || hash(floor(y * 9), i + j * 13 + sk) > 0.14)) || (n === 5 && abs(y - 0.2 - (jx - 0.05) * 0.75) < 0.05 && jx > 0.05 && jx < 0.85) || (last && f === 3 && abs(y - 0.2 - (jx - 0.05) * 0.75) < 0.05 && jx > 0.05 && jx < 0.85)) { L = last ? 0 : (1 - 0.6 * q) * (0.45 + 0.8 * exp(-hypot(q - 0.25, t - 0.7) * 2)); A = last ? 1 : 0; }
      }
    } else { const Z = 0.25 / max(v - 0.6, 1e-3); L = (0.04 + 0.2 * fbm(u * Z * 4, Z * 4)) * ss(4, 0.4, Z); }
    const ch = iso(u, v, 0.3, 0.955, 0.09, -0.02, -0.02, -0.012, 0.014);                                                              // the chalk, where it was put down
    if (ch) { L = 0; A = ch === 3 ? 1 : 0.5; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };
  // under>>

  // <<house1
  // --- basement: under Dunn's, from the foot of the stair. one bulb on its flex. the stair goes up the wall to the shop door, and the door is being held to
  S.basement = (u, v, f, o) => {
    const C = [0.56, 0.46, 0.8], F = [-1.22, 1.15, -0.45], E = 1.5, TOP = -2.8, lp = [0.4, -1.5, 3.4], fl = [1, 0.92, 1, 0.7][f], bl = pj(C, F, lp[0], lp[1], lp[2]), br = hypot(u - bl.u, v - bl.v);
    let L = 0.02, A = 0, M = 0, k;
    const lg = (r) => fl * lamp(lp[0], lp[1], lp[2], r || 6);
    if ((k = rb(u, v, C, F, -3, 3, TOP, E, -2, 7, 1))) {
      const l = 0.1 + 1.4 * lg();
      if (k === 6) L = (fr(H.x * 0.9) < 0.035 || fr(H.z * 0.9) < 0.035 ? 0.04 : 0.34 + 0.12 * hash(floor(H.x * 0.9), floor(H.z * 0.9))) * l;   // flags
      else if (k === 5) L = (fr(H.z * 1.4) < 0.16 ? 0.5 : 0.05) * l;                                                                    // joists, and the shop floor on them
      else if (k === 4) {                                                                                                             // the far wall, and the arch somebody bricked up
        const ar = H.y < -0.1 ? hypot(H.x - 1.2, H.y + 0.1) : abs(H.x - 1.2);
        L = 0.4 * brick(H.x * 0.4, H.y * 0.4, 6) * l;
        if (ar < 0.95) { L = (ar > 0.8 ? 0.7 : 0.3 * brick(H.x * 0.9 + 0.3, H.y * 0.9, 6)) * l; if (ar <= 0.8 && hash(floor(H.x * 3.6), floor(H.y * 5.4)) > 0.86) L = 0; }
        if (H.x > -2.9 && H.x < -1.95 && H.y > -2.7 && H.y < -0.6) { L = H.x > -2.02 ? 0 : 0.12 * l + (abs(H.x + 2.42) < 0.02 || abs(H.y + 1.6) < 0.03 ? 0.1 : 0); if (H.x > -2.02) A = [0.9, 0.9, 0.9, 0][f]; if (H.x < -2.84 || H.y < -2.64) L = 0.5 * l; }   // the door at the top, and the shop's light down one edge of it
      } else L = (k === 2 ? 0.34 : 0.3) * brick(H.z * 0.4, H.y * 0.4, 6) * l;
    }
    if ((k = rb(u, v, C, F, -3, -1.9, -0.6, E, 4.35, 7))) { const l = 0.1 + lg(); L = (k === 5 ? 0.6 : k === 2 ? 0.3 * brick(H.s * 1.2, H.t, 6) : 0.16) * l; }   // the half-landing
    for (let i = 6; i >= 0; i--) if ((k = rb(u, v, C, F, -3, -1.9, E - (i + 1) * 0.3, E, 1.2 + i * 0.45, 1.65 + i * 0.45))) { const l = 0.1 + lg(); L = (k === 5 ? 0.8 : k === 3 ? (H.t < 0.1 ? 0.9 : 0.36) : 0.14) * l; }   // the stair, up the left-hand wall
    if ((k = rb(u, v, C, F, -1.92, -1.8, E - 1.2, E, 1.15, 1.27))) L = (k === 3 ? 0.8 : 0.3) * (0.1 + lg());                                 // newel
    if (rb(u, v, C, F, -1.88, -1.84, -1.6, E - 1.1, 1.2, 4.4) === 2 && abs(H.t - 0.02 - (1 - H.s) * 0.84) < 0.035) L = 0.7 * (0.1 + lg());   // and the rail
    for (const [x0, x1, z0, z1, h] of [[0.4, 1.5, 4.8, 5.9, 0.95], [0.1, 1.1, 3.6, 4.5, 0.8], [0.6, 1.3, 5, 5.7, 1.65]]) if ((k = rb(u, v, C, F, x0, x1, E - h, h > 1 ? E - 0.95 : E, z0, z1))) { const l = 0.1 + lg(); L = (k === 5 ? 0.85 : k === 1 ? (H.s < 0.06 || H.s > 0.94 || H.t < 0.08 || H.t > 0.92 ? 0.95 : 0.5 + 0.1 * fbm(H.s * 3, H.t * 30)) : (H.s < 0.06 || H.s > 0.94 || H.t < 0.08 ? 0.5 : 0.2)) * l; }   // tea chests
    if (abs(u - bl.u) < 0.003 && v < bl.v) L = 0.5;
    if (br < 0.02) { L = 0; A = fl; } else A = max(A, 0.6 * fl * exp(-br * 24));
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- spares: the racking at the back. heads on the top shelf, turned to the wall. arms and legs stood on end under them. a box of hands. once a loop one head is not turned
  S.spares = (u, v, f, o) => {
    const C = [0.42, 0.6, 1.0], F = [-0.5, 3.1, 0.5], E = 1.6, lp = [-1.0, -1.3, -1.6];
    let L = 0.02, A = 0, M = 0, k;
    const lg = (r) => lamp(lp[0], lp[1], lp[2], r || 5);
    if (gp(u, v, C, F, E) && H.z < 0) L = (fr(H.x * 1.2) < 0.05 || fr(H.z * 1.2) < 0.05 ? 0.03 : 0.2) * (0.1 + lg()) * ss(8, 1.5, H.d);
    if (rb(u, v, C, F, -9, 9, -5, E, 0, 1) === 3) L = 0.22 * brick(H.x * 0.4, H.y * 0.4, 6) * (0.1 + lg());
    if (rb(u, v, C, F, -2.6, 2.6, -1.9, E, -0.3, -0.29) === 3) {                                                                         // what stands on the shelves
      const x = H.x, y = H.y, l = 0.25 + 1.5 * lg(), j = y < -0.75 ? 0 : y < 0.45 ? 1 : 2, sy = j === 0 ? (y + 1.9) / 1.15 : j === 1 ? (y + 0.75) / 1.2 : (y - 0.45) / 1.15;
      if (j === 0) {                                                                                                                  // heads, on their stumps
        const i = floor(x / 0.72 + 4), cx = fr(x / 0.72) - 0.5, turned = i === 5 && f === 3, d = hypot(cx / 0.3, (sy - 0.52) / 0.33), sh = cl(0.5 - cx / 0.6 - (sy - 0.5) * 0.5);
        if (d < 1) { L = (0.1 + 0.9 * sh * sh) * l; if (!turned && cx > 0.2 && abs(sy - 0.55) < 0.07) L = (cx > 0.25 ? 0.3 : 0.9) * l; if (turned && (hypot((abs(cx + 0.03) - 0.11) / 0.055, (sy - 0.47) / 0.04) < 1 || (abs(cx + 0.03) < 0.09 && abs(sy - 0.68) < 0.014) || (abs(cx + 0.03) < 0.015 && sy > 0.5 && sy < 0.6))) L = 0; }
        else if (abs(cx) < 0.13 - 0.04 * (sy - 0.8) && sy > 0.78) L = (cx < -0.04 ? 0.8 : 0.25) * l;
      } else if (j === 1) {                                                                                                           // arms and legs
        const i = floor(x / 0.42 + 7), cx = fr(x / 0.42) - 0.5, leg = i % 3 === 1, w = leg ? 0.26 - 0.13 * sy + 0.06 * sin(sy * 6.5) : 0.15 - 0.05 * sy, bend = 0.1 * sin(i * 2.3) * (sy - 0.5), xx = cx - bend, sh = cl(0.5 - xx / w / 2);
        if (abs(xx) < w && sy > 0.1 && sy < 0.97) { L = (0.08 + 0.92 * sh * sh) * l; if (abs(sy - (leg ? 0.55 : 0.5)) < 0.012) L = 0.03; }
        if (!leg && sy <= 0.12 && sy > 0 && abs(xx) < 0.2 && fr(xx * 8 + 0.5) < 0.62 && sy > 0.02 + 0.06 * abs(xx * 4)) L = (xx < 0 ? 0.9 : 0.5) * l;   // fingers
        if (leg && sy <= 0.12 && sy > 0.02 && xx > -0.2 && xx < 0.34) L = 0.6 * l;                                                       // a foot, sole up
      } else if (x < 0.4 && x > -1.8) {                                                                                               // a box of hands
        const cx = fr(x / 0.24);
        if (sy > 0.5 && sy < 0.97) L = (sy < 0.55 ? 1 : fr(x * 3) < 0.05 ? 0.15 : 0.45) * l;
        else if (sy > 0.2 + 0.2 * hash(floor(x / 0.24), 2) && sy <= 0.5 && cx < 0.75) L = (fr(cx * 5.4) < 0.72 ? (cx < 0.3 ? 0.95 : 0.6) : 0.05) * l;
      }
    }
    for (const sy of [-0.75, 0.45, E - 0.02]) if ((k = rb(u, v, C, F, -2.7, 2.7, sy, sy + 0.07, -0.55, 0))) L = (k === 5 ? 0.6 : k === 3 ? 1 : 0.3) * (0.15 + 1.2 * lg());   // the shelves themselves
    for (const ux of [-2.7, -0.9, 0.9, 2.62]) if ((k = rb(u, v, C, F, ux, ux + 0.08, -2.1, E, -0.57, -0.49))) L = (k === 3 ? 0.75 : 0.25) * (0.15 + 1.2 * lg());   // uprights
    const bl = pj(C, F, lp[0], lp[1], lp[2]), br = hypot(u - bl.u, v - bl.v);
    if (abs(u - bl.u) < 0.003 && v < bl.v) L = 0.4;
    if (br < 0.02) { L = 0; A = 1; } else A = 0.55 * exp(-br * 24);
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- boiler: the furnace under the shop. the shop has been shut since the war. it is alight, and somebody has just fed it
  S.boiler = (u, v, f, o) => {
    const fl = [1, 0.75, 0.95, 0.6][f], cx = 0.55, x = (u - cx) / 0.24, gl = fl * exp(-hypot(u - 0.5, (v - 0.8) * 1.4) * 4.2);
    let L = 0.04, A = 0.5 * gl * gl, M = 0;
    if (wall(u, v, -0.05, 1.05, -0.2, 0.05, 0.9, 0.7)) L = (0.1 + 0.5 * gl) * brick(deep(W.s, 1.1, 0.65) * 2.5, W.t, 14);
    else { const Z = 0.25 / max(v - 0.62, 1e-3), X = (u - 1.2) * Z; L = (fr(X) < 0.05 || fr(Z) < 0.05 ? 0.03 : 0.1 + 0.5 * gl) * ss(4, 0.4, Z); A = 0.8 * gl * gl; }
    for (const [px, w] of [[0.5, 0.02], [0.63, 0.014]]) if (abs(u - px) < w && v < 0.2) { L = u < px ? 0.9 : 0.3; A = 0; }                // flues, up through the shop floor
    if (dSeg(u, v, 0.63, 0.1, 1.05, 0.02) < 0.014) { L = v < 0.1 - (u - 0.63) * 0.19 ? 0.9 : 0.3; A = 0; }
    if (abs(x) < 1 && v > 0.16 - 0.05 * Math.sqrt(1 - x * x) && v < 0.9 + 0.06 * Math.sqrt(1 - x * x)) {                                 // the shell, riveted in bands
      const band = fr((v + 0.05 * Math.sqrt(1 - x * x)) * 5.5);
      A = 0; L = 0.04 + 0.95 * ss(0.2, -0.85, x) ** 1.5 + 0.5 * ss(0.6, 1, x) * gl;
      if (band < 0.1) L *= fr(Math.asin(x) * 9) < 0.3 ? 1.5 : 0.5;
      const d = hypot((x + 0.25) / 0.3, (v - 0.4) / 0.065), fd = hypot((x + 0.1) / 0.42, (v - 0.74) / 0.085);
      if (d < 1) { L = d > 0.78 ? 1 : 0.85; if (d <= 0.78 && abs(Math.atan2(v - 0.4, x + 0.25) + 0.7 + 0.1 * sin(f * 1.57)) < 0.12 / max(d, 0.15)) L = 0; }   // the gauge. it is in the red
      if (fd < 1.2) { L = fd > 1 ? 1 : 0; if (fd <= 1) A = fl * (0.6 + 0.4 * fbm(u * 30, v * 30 - f * 0.9)); }                                  // the fire door, open
    }
    if (quad(u, v, 0.26, 0.6, 0.345, 0.64, 0.345, 0.82, 0.26, 0.78)) { L = u < 0.275 ? 1 : 0.3; A = 0.5 * gl; }                           // and the door itself, swung back
    const hp = v - 0.92 + 0.6 * abs(u - 0.13) - 0.03 * fbm(u * 30, 1);
    if (hp > 0) { L = hash(floor(u * 70), floor(v * 70)) > 0.75 ? 0.6 : 0.02; A = hash(floor(u * 70 + 3), floor(v * 70)) > 0.85 ? gl : 0; }  // coal
    if (dSeg(u, v, 0.22, 0.95, 0.36, 0.36) < 0.007) { L = 1; A = 0; }                                                                    // the shovel, stood in it
    if (quad(u, v, 0.19, 0.93, 0.25, 0.97, 0.265, 0.86, 0.215, 0.83)) { L = 0.6; A = 0; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- chute: the coal hole, from the bottom. a square of street up there, and the marks of whatever came down it last. once a loop something is looking in
  S.chute = (u, v, f, o) => {
    const C = [0.36, 0.26, 0.7], Z = bore(u, v, C, 1, 0.8, 1), end = Z > 6.5, dim = ss(8, 1, Z);
    let L = 0, A = 0, B = 0, M = 0;
    if (end) { M = 1; B = 0.95; if (fr((u - C[0]) * 26) < 0.14) { B = 0; L = 0.1; } const e0 = C[0] - 0.108, d = f === 5 ? 0.052 : 0.016, hy = C[1] + 0.005; if (f > 3 && (ell(u, v, e0 + d - 0.014 + (hy - v) * 0.12, hy, 0.04, 0.046) < 1 || (v > hy + 0.03 && u < e0 + d * 0.8 - 0.012 + (v - hy - 0.03) * 0.25) || (f === 5 && v > hy - 0.085 && v < hy - 0.05 && u < e0 + 0.016 && fr(v * 120) > 0.28))) { B = 0; L = 0; M = 0; } }   // the grating. a head, round the edge of it, and the fingers it holds on by
    else if (T.w === 0) { L = (0.3 + 0.3 * fbm(T.x * 3, Z * 1.5)) * dim; if (abs(fr(T.x * 2.4 + 0.25 * sin(Z * 2)) - 0.5) < 0.1 && Z > 1.6) L = 0.03; B = 0.5 * ss(3, 6.5, Z) * ss(0.7, 0, abs(T.x)); }   // the slide, and what was dragged down it, or up
    else { L = (T.w === 2 ? 0.5 : T.w === 3 ? 0.1 : 0.2) * brick(Z * 0.5, T.x * 0.5, 5) * dim; B = T.w === 2 ? 0.3 * ss(2, 6.5, Z) : 0; }
    const hp = v - 0.8 + 0.3 * abs(u - 0.6) - 0.05 * fbm(u * 20, 2);
    if (hp > 0) { B = 0; L = hash(floor(u * 60), floor(v * 60)) > 0.7 ? 0.7 : 0.02; }                                                     // what is left of the last load
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- attic: under the roof, from the hatch. rafters going away to the gable, the moon through the round light, and where it falls the dust has been walked in
  S.attic = (u, v, f, o) => {
    const C = [0.36, 0.52, 0.8], a = (u - C[0]) / C[2], b = (v - C[1]) / C[2], up = 1.25, m = 1.15, zf = b > 0 ? 0.8 / b : 99, zr = (up * m) / max(a - b * m, 1e-4), zl = (up * m) / max(-a - b * m, 1e-4), Z = min(zf, zr, zl, 7), X = a * Z, wy = C[1] - 0.075, wd = hypot(u - C[0], (v - wy) * 1.05), dp = drape(u, v, f, 26, 0.09);
    let L = 0.04, A = 0, M = 0;
    if (Z === 7) {                                                                                                                    // the gable end
      L = 0.22 * brick(X * 0.4, b * 2.8, 6); if (wd < 0.06) { M = 1; L = abs(u - C[0]) < 0.005 || abs(v - wy) < 0.005 || wd > 0.05 ? 0.1 : 1; }
    } else if (Z === zf) {
      const pool = ell(X, Z, 0.3, 3.4, 0.6, 1.5);
      L = (fr(X * 2.2) < 0.08 ? 0.03 : 0.16) * ss(8, 1, Z);                                                                              // boards
      if (pool < 1) { L = abs(X - 0.3) < 0.04 || abs(Z - 3.4) < 0.12 ? 0.3 : 1; for (let k = 0; k < 5; k++) if (ell(X, Z, 0.3 + (k & 1 ? 0.16 : -0.16), 2.3 + k * 0.42, 0.075, 0.17) < 1) L = 0.1; }   // the moon on them, and where somebody has been walking up and down in it
    } else { const rz = fr(Z * 1.1); L = (rz < 0.16 ? (Z === zr ? 1 : 0.36) * (rz < 0.04 ? 0.4 : 1) : Z === zr ? 0.12 : 0.03) * ss(8.5, 1.5, Z); }   // rafters, and the slates' backs between
    const ch = pb(u, v, C, -1.0, -0.35, -1.3, 0.8, 4.2, 5);                                                                           // the stack, coming up through
    if (ch) L = (ch === 1 ? 0.16 : 0.6) * brick(W.s, W.t * 2.4, 5);
    const bx = pb(u, v, C, 0.75, 1.5, 0.3, 0.8, 2.6, 3.4);
    if (bx) L = bx === 3 ? 0.75 : bx === 1 ? (W.t < 0.08 ? 0.9 : 0.14) : 0.4;
    if (dp >= 0 && v < 0.18) L = dp * 2;                                                                                               // web
    if (abs(u - 0.5 - 0.004 * sin(f * 1.57)) < 0.003 && v < 0.33) L = 0.8;
    L *= ss(0.78, 0.28, hypot(u - 0.42, (v - 0.55) * 1.1));
    if (hypot(u - 0.5 - 0.005 * sin(f * 1.57), (v - 0.345) * 0.8) < 0.014) { L = 0; A = 1; }                                               // the light pull, with a red bead on it. moving
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- trunk: a dome-top trunk with the lid thrown back. slats, straps, brass corners, a paper lining. a child's things, folded. on top a red coat, and it is wet
  S.trunk = (u, v, f, o) => {
    const C = [0.5, 0.26, 1.0], F = [0.25, 3.0, 0.55], E = 1.9, T = E - 0.78, lg = () => lamp(-1.6, -0.6, -1.2, 4);
    let L = 0.02, A = 0, M = 0, k;
    if (gp(u, v, C, F, E)) { L = (fr(H.z * 2 + H.x * 0.1) < 0.06 ? 0.03 : 0.2 + 0.06 * fbm(H.x * 30, H.z * 3)) * (0.08 + 1.1 * lg()) * ss(9, 2, H.d); if (H.x > -0.7 && H.x < 1.9 && H.z > -0.1 && H.z < 1.5) L *= 0.15; }   // boards, and the shadow it stands in
    if ((k = rb(u, v, C, F, -0.85, 0.85, T - 1.0, T, 0.92, 1.1))) {                                                                     // the lid, stood up: its inside, papered, with a likeness pinned to it
      const s = H.s, t = H.t, l = 0.2 + 1.1 * lg();
      if (k === 3) { L = (s < 0.04 || s > 0.96 || t < 0.05 || t > 0.97 ? 0.9 : (floor(s * 14 + t * 8) + floor(s * 14 - t * 8)) & 1 ? 0.5 : 0.34) * l; if (abs(abs(s - 0.5) - 0.25) < 0.02 && t > 0.05) L = 0.15 * l; if (abs(s - 0.5) < 0.13 && abs(t - 0.45) < 0.2) L = (abs(s - 0.5) > 0.11 || abs(t - 0.45) > 0.17 ? 0.15 : hypot((s - 0.5) / 0.05, (t - 0.42) / 0.09) < 1 ? 0.2 : 0.85) * l; }
      else L = (k === 5 ? 0.8 : 0.22) * l;
    }
    if ((k = rb(u, v, C, F, -0.85, 0.85, T, E, 0, 0.95))) {
      const s = H.s, t = H.t, l = 0.2 + 1.1 * lg(), cn = (s < 0.08 || s > 0.92) && (t < 0.16 || t > 0.84);
      if (k === 3) {                                                                                                                  // the front: canvas, slats, a hasp and two catches
        L = (0.2 + 0.07 * fbm(s * 60, t * 40)) * l;
        if (abs(t - 0.3) < 0.055 || abs(t - 0.78) < 0.055 || abs(s - 0.045) < 0.045 || abs(s - 0.955) < 0.045) L = (fr(s * 40 + t * 3) < 0.15 ? 0.4 : 0.66) * l;
        if (t < 0.06) L = 0.9 * l;
        if (cn || (abs(s - 0.5) < 0.05 && t < 0.3) || (abs(abs(s - 0.5) - 0.3) < 0.03 && t < 0.2)) L = l;                                   // brass
        if (hypot((s - 0.5) * 2, t - 0.2) < 0.03 || (abs(s - 0.5) < 0.008 && t > 0.2 && t < 0.27)) L = 0;
        if ((abs(t - 0.3) < 0.055 || abs(t - 0.78) < 0.055) && fr(s * 9) < 0.06) L = 0.05;
      } else if (k === 1) {                                                                                                           // the end, and its leather handle
        L = (0.09 + 0.04 * fbm(s * 60, t * 40)) * l; if (abs(t - 0.3) < 0.055 || abs(t - 0.78) < 0.055 || s < 0.06 || s > 0.94) L = 0.28 * l; if (cn) L = 0.5 * l;
        if (abs(hypot((s - 0.5) / 0.22, (t - 0.42) / 0.13) - 1) < 0.2 && t > 0.42) L = 0.45 * l;
      } else if (k === 5) {                                                                                                           // looking in
        L = s < 0.035 || s > 0.965 || t < 0.06 || t > 0.94 ? 0.95 * l : 0.02;
        if (s > 0.07 && s < 0.93 && t > 0.12 && t < 0.9) {
          L = (s < 0.42 ? (fr(t * 5) < 0.12 ? 0.25 : 0.85 - 0.3 * fr(t * 5)) : 0.5) * l;                                                 // linen, in a pile
          if (s > 0.44) { const fold = fr(s * 5 + t * 1.5); L = fold < 0.1 ? 0.25 : 0; A = L ? 0 : 0.55 + 0.45 * fbm(s * 9, t * 9) + (hash(floor(s * 50), floor(t * 30) + f) > 0.93 ? 0.5 : 0); if (hypot((s - 0.62) * 1.8, t - 0.3) < 0.025 || hypot((s - 0.62) * 1.8, t - 0.55) < 0.025) { L = 1; A = 0; } }   // the coat: its buttons, its wet
        }
      }
    }
    o[0] = min(L, 1); o[1] = min(A, 1); o[2] = 0; o[3] = M;
  };
  // house1>>

  // <<house2
  // --- form: a dressmaker's form in the dormer, under a sheet. it has no head. the shadow it throws on the slope of the roof has
  S.form = (u, v, f, o) => {
    const cx = 0.4, y = v - 0.2, x = u - cx, hw = y < 0 ? 0 : 0.11 * ss(0, 0.07, y) + 0.035 * ss(0.05, 0.2, y) - 0.04 * ss(0.16, 0.32, y) + 0.1 * ss(0.3, 0.62, y) + 0.012 * sin(y * 40) * ss(0.3, 0.6, y);
    let L = 0.05, A = 0, M = 0;
    if (wall(u, v, 0.3, 1.05, -0.4, 0.3, 0.74, 0.62)) {                                                                                // the slope of the roof, lathed, the plaster gone in places
      const q = deep(W.s, 1.14, 0.32), t = W.t, sx = (q - 0.5) / 0.17, sy = t - 0.3 - 0.1 * q;
      L = (fbm(q * 7, t * 5) > 0.56 ? (fr(t * 30) < 0.5 ? 0.5 : 0.08) : 0.62) * ss(1.0, 0.05, q) * ss(1.05, 0.3, t);
      if ((sy > 0 && abs(sx) < 0.6 + 0.5 * ss(0, 0.1, sy) - 0.2 * ss(0.15, 0.3, sy) + 0.5 * ss(0.3, 0.6, sy)) || hypot(sx / 0.5, (sy + 0.1) / 0.1) < 1 + 0.06 * sin(f * 1.57)) L = 0.04;   // the shadow. it is a little late
    } else if (u < 0.3) {                                                                                                             // the dormer, and the moon in it
      M = 1; L = v < 0.74 - 0.16 * (0.3 - u) ? (abs(u - 0.13) < 0.006 || abs(v - 0.34) < 0.006 || u < 0.012 ? 0.1 : 0.95) : 0.2;
      if (v > 0.74 - 0.16 * (0.3 - u)) M = 0;
    }
    if (v > 0.62 + 0.3 * (1.05 - u) * 0.55 || (u < 0.3 && v > 0.78)) { const Z = 0.2 / max(v - 0.55, 1e-3), X = (u - 0.9) * Z; L = (fr(X * 2.4) < 0.08 ? 0.03 : 0.2) * ss(4, 0.4, Z) * ss(1, 0.3, u); if (ell(u, v, 0.6, 0.93, 0.26, 0.04) < 1) L = 0.01; }
    if (y > 0 && y < 0.62 && abs(x) < hw) { L = x < -hw * 0.45 ? 1 : x < -hw * 0.1 ? 0.5 : 0.1 + 0.12 * sin(x * 90 + y * 9) * ss(0.25, 0.6, y); if (y > 0.6 - 0.02 * sin(x * 60)) L = 0.04; }   // the sheet, and what is under it
    if (y >= 0.6 && abs(x) < 0.008 && v < 0.93) L = 0.9;
    for (const sd of [-1, 0.4, 1]) if (dSeg(u, v, cx, 0.86, cx + sd * 0.1, 0.94 + (sd === 0.4 ? 0.015 : 0)) < 0.006) L = 0.8;             // its stand
    if (hypot(x - 0.02, y - 0.2) < 0.012 || hypot(x - 0.02, y - 0.27) < 0.012) { L = 0; A = 1; }                                             // pins
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- cradle: a hooded cradle on its rockers, on the boards, in what moon comes in. it has been set going. the blanket is turned back off the shape of what was under it
  S.cradle = (u, v, f, o) => {
    const C = [0.5, 0.3, 1.0], F = [0.05, 3.4, 0.9], E = 1.7, a = 0.035 * sin(f * 0.628), pv = pj(C, F, 0, E, 0), ca = cos(a), sa = sin(a), ru = pv.u + (u - pv.u) * ca + (v - pv.v) * sa, rv = pv.v - (u - pv.u) * sa + (v - pv.v) * ca, B0 = E - 0.16, B1 = E - 0.8;
    let L = 0.01, A = 0, M = 0, k;
    const rocker = (rx) => { if ((k = rb(ru, rv, C, F, rx, rx + 0.07, E - 0.4, E + 0.03, -0.74, 0.74)) && hypot(H.z, H.y - E + 1.12) < 1.12 && hypot(H.z, H.y - E + 1.5) > 1.36) L = k === 1 ? (hypot(H.z, H.y - E + 1.5) < 1.385 ? 1 : 0.7) : 0.3; };   // a rocker: a crescent, its horns turned up
    if (gp(u, v, C, F, E)) {
      const pool = hypot((H.x + 0.9) / 1.5, (H.z + 1.6) / 1.0);
      L = (fr(H.x * 2.2 + H.z * 0.15) < 0.06 ? 0.02 : 0.1) * ss(8, 2, H.d);
      if (pool < 1) L = (abs(H.z + 1.6) < 0.035 || abs(H.x + 0.9) < 0.04 ? 0.2 : fr(H.x * 2.2 + H.z * 0.15) < 0.06 ? 0.4 : 0.95) * ss(1, 0.8, pool);   // the moon on the boards, and the bars of the window in it
      if (hypot((H.x - 0.3) / 1.0, (H.z - 0.3 + a * 3) / 0.62) < 1) L *= 0.15;                                                           // its shadow, going to and fro with it
    }
    rocker(0.5);
    for (let j = 0; j < 6; j++) {                                                                                                       // the hood, bent over like a wagon tilt
      const hw = 0.44 * Math.sqrt(1 - ((j + 0.5) / 6.2) ** 2);
      if ((k = rb(ru, rv, C, F, 0.22, 0.78, B1 - (j + 1) * 0.075, B1 - j * 0.075, -hw, hw))) L = k === 1 ? (abs(H.z) < hw - 0.07 && j < 5 ? 0.01 : 0.95) : k === 5 ? 0.8 - 0.05 * j : k === 3 ? 0.14 + 0.09 * j + 0.05 * fbm(H.s * 5, j) : 0.1;
    }
    for (let j = 0; j < 4; j++) {                                                                                                       // the body, wider at the rail than at the floor, like a boat
      const hw = 0.3 + 0.035 * j, hl = 0.66 + 0.03 * j;
      if (!(k = rb(ru, rv, C, F, -hl, hl, B0 - (j + 1) * 0.16, B0 - j * 0.16, -hw, hw))) continue;
      const s = H.s, t = H.t;
      if (k === 3) L = j === 3 ? (t < 0.45 ? 0.75 : 0.4) : j === 2 ? (fr(s * 15) < 0.4 ? 0.42 : 0.02) : (t < 0.1 ? 0.12 : 0.26 + 0.1 * fbm(s * 5, j * 3 + t));   // rail, spindles, board
      else if (k === 1) L = 0.5;
      else if (k === 5 && j === 3) {                                                                                                  // down into it
        L = s < 0.03 || s > 0.97 || t < 0.07 || t > 0.93 ? 0.9 : 0.01;
        if (s > 0.05 && s < 0.7 && t > 0.12 && t < 0.88) {
          L = s > 0.5 ? 0.5 - 0.9 * hypot((s - 0.6) / 0.14, (t - 0.5) / 0.5) * 0.3 : 0.3 + 0.2 * sin(s * 40 + t * 5);                      // sheet; and the blanket, pushed down to the foot
          if (s > 0.5 && hypot((s - 0.6) / 0.07, (t - 0.5) / 0.26) < 1) L = 0.08;                                                       // the dint
          if (s <= 0.5 && s > 0.44) L = 0.75;
        }
      }
    }
    if (rb(ru, rv, C, F, -0.8, -0.75, B1 - 0.22, B0, -0.46, 0.46) === 1) {                                                                // the foot board, shaped, with a heart cut in it
      const z = H.z, y = H.y, top = B1 - 0.2 * Math.sqrt(max(0, 1 - (z / 0.46) ** 2)), hw = 0.33 + 0.12 * ss(B0, B1, y);
      if (y > top && abs(z) < hw) { L = y < top + 0.035 || abs(z) > hw - 0.03 ? 1 : 0.62 + 0.1 * fbm(z * 5, y * 30); if (hypot(abs(z) - 0.045, (y - B1 - 0.1) * 1.1) < 0.06 || (y > B1 + 0.1 && abs(z) < 0.1 - (y - B1 - 0.1) * 0.9)) L = 0.02; }
    }
    rocker(-0.57);
    L *= ss(0.82, 0.3, hypot(u - 0.48, v - 0.56));
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- stubble: the big field after it has been cut, from the gate. the poles go off along one side. a long way out, one light, low down, where there is no house
  S.stubble = (u, v, f, o) => {
    const C = [0.24, 0.4, 0.8], a = (u - C[0]) / C[2], b = (v - C[1]) / C[2], Z = 1.4 / max(b, 1e-3), X = a * Z, mr = hypot(u - 0.78, v - 0.16), lr = hypot(u - 0.34, (v - C[1] - 0.012) * 1.4);
    let L = 0.02 + 0.3 * fbm(u * 2 + 5, v * 8) ** 1.5 * ss(0.02, 0.36, v), A = 0, M = 1;
    if (mr < 0.055) L = hypot(u - 0.795, v - 0.15) < 0.05 ? 0.3 : 1;                                                                    // the moon, a paring
    if (v > C[1] - 0.018 - 0.014 * fbm(u * 7, 3)) { M = 0; L = 0.03; }
    if (b > 0) { M = 0; L = (abs(fr(X * 3.4) - 0.5) < 0.13 ? 0.06 : fr(Z * 6 + hash(floor(X * 3.4), 1) * 3) < 0.45 ? 0.75 : 0.3) * ss(30, 5, Z) + 0.03; if (fbm(u * 3, v * 40 - 2) > 0.62 && Z > 9) { M = 1; L = 0.45; } }   // the rows, and ground mist lying in the far end of them
    for (let k = 7; k >= 0; k--) {
      const z = 2.5 + k * 2.6, sc = C[2] / z, x = C[0] + 2.3 * sc, top = C[1] - 2.6 * sc, bot = C[1] + 1.4 * sc;
      if (abs(u - x) < 0.02 * sc + 0.001 && v > top && v < bot) { M = 0; L = u < x ? 0.75 : 0.04; }
      if (abs(v - top - 0.25 * sc) < 0.014 * sc + 0.001 && abs(u - x) < 0.4 * sc) { M = 0; L = 0.04; }                                   // poles, and no wire on them
    }
    if (lr < 0.006) { L = 0; A = 1; M = 0; } else A = 0.5 * exp(-lr * 30) * [1, 0.7, 1, 0.4][f];
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- post: where the scarecrow was. the post, the crosspiece, the cords that held it cut through. its coat is on the ground, laid out, arms straight
  S.post = (u, v, f, o) => {
    const hz = 0.7, Z = 0.3 / max(v - hz, 1e-3), X = (u - 0.3) * Z, sw = 0.014 * sin(f * 1.57);
    let L = (0.1 + 0.5 * fbm(u * 2.4, v * 6 + 2)) * ss(0.66, 0.05, v), A = 0, M = 1;
    if (v > hz - 0.012) { M = 0; L = (abs(fr(X * 4.5 - Z * 1.2) - 0.5) < 0.13 ? 0.06 : fr(Z * 9) < 0.5 ? 0.7 : 0.3) * ss(8, 1, Z) + 0.03; }
    const pw = 0.03 + 0.012 * (v - 0.1);
    if (v > 0.08 && v < 0.82 && abs(u - 0.44 - 0.03 * (v - 0.08)) < pw) { M = 0; L = u < 0.44 + 0.03 * (v - 0.08) - pw * 0.3 ? 1 : 0.03 + 0.08 * fbm(u * 9, v * 60); }   // the post, from below
    if (quad(u, v, 0.1, 0.33, 0.86, 0.2, 0.86, 0.255, 0.1, 0.375)) { M = 0; L = v < 0.345 - (u - 0.1) * 0.171 ? 1 : 0.03; }            // the crosspiece
    for (const [cx, cy, ln] of [[0.16, 0.37, 0.2], [0.78, 0.265, 0.26], [0.46, 0.3, 0.1]]) if (abs(u - cx - sw * (v - cy) / ln) < 0.004 && v > cy && v < cy + ln) { M = 0; L = 0.05; }   // cords
    if (hypot(u - 0.3, v - 0.34) < 0.008 || hypot(u - 0.62, v - 0.29) < 0.008) { M = 0; L = 0; A = 1; }                                    // nails, bright
    if (v > hz) {
      const cx = X - 0.55, cz = Z - 1.5, body = abs(cx) < 0.3 && abs(cz) < 0.5, arm = abs(cz - 0.3) < 0.1 && abs(cx) < 0.95;
      if (body || arm) { M = 0; L = abs(cx) < 0.02 && body ? 0.5 : 0.04; }                                                              // the coat
      if (hypot(cx / 0.2, (cz - 0.72) / 0.12) < 1) { M = 0; L = hypot(cx / 0.2, (cz - 0.72) / 0.12) > 0.55 ? 0.5 : 0.04; }                  // and its hat, where a head would be
    }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- ring: a ring trodden in the stubble, wide as a house. nothing leads to it. in the middle, a boot
  S.ring = (u, v, f, o) => {
    const hz = 0.14, Z = 0.55 / max(v - hz, 1e-3), X = (u - 0.6) * Z, r = hypot(X + 0.2, (Z - 2.3) * 1), st = abs(fr(X * 6 + Z * 1.2) - 0.5) < 0.12;
    let L = 0.3 + 0.3 * fbm(u * 3, v * 9), A = 0, B = 0, M = 1;
    if (v > hz - 0.01) {
      M = 0; L = (st ? 0.03 : fr(Z * 7 + hash(floor(X * 6 + Z * 1.2), 2) * 3) < 0.4 ? 0.6 : 0.16) * ss(9, 1.2, Z) + 0.02;
      if (abs(r - 1.05 - 0.04 * fbm(Math.atan2(Z - 2.3, X + 0.2) * 3, 1)) < 0.17) L = 0.95 - 0.3 * hash(floor(X * 40), floor(Z * 40)) * (fr(Math.atan2(Z - 2.3, X + 0.2) * 9) < 0.3 ? 1.6 : 0.4);    // trodden flat
      if (r < 0.8 && f === 3 && abs(fr(r * 5 + 0.25) - 0.5) < 0.1) L = 0.9;                                                                   // once a loop there are more of them, inside
      const sx = (u - 0.42) / 0.105, sy = (v - 0.4) / 0.105;                                                                             // a boot, stood up in the middle of it. a child's, and done for
      if (hypot((sx - 1.5) / 2.6, (sy - 0.55) / 0.2) < 1) L = 0;                                                                        // the long shadow of it
      if (sx > -1.3 && sx < 1.9 && sy > -2 && sy < 0.8) {
        const bt = (x, y) => boot(x + (y < 0 ? 0.1 * sin(y * 3.2) : 0), y, 1.6), far = (x, y) => { for (let i = 1; i < 7; i++) if (bt(x - i * 0.057, y + i * 0.035) >= 0) return i; return 0; };   // the same boot again and again going away: its far side, its top
        const b = bt(sx, sy), t = b < 0 ? far(sx, sy) : 0;
        if (b >= 0 || t) {
          L = b >= 0 ? (sx > 0.5 && abs(sy - 0.33 + 0.1 * sx) < (sx - 0.5) * 0.16 ? 0 : min(b, 1)) : sy + t * 0.035 < -1.3 ? 0 : sy < -0.2 || sx > 0.9 ? 0.16 : 0.5;   // the toe has come away from the sole. the leg is empty
          if (bt(sx + 0.05, sy - 0.05) < 0 && !far(sx + 0.05, sy - 0.05)) { L = 0; B = 1; }                                             // what light there is, along the far edge of it
        }
      }
    }
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // --- fdoor: the door from the trees, stood in its frame in the middle of the field now, seen from behind. it is not quite shut. what comes through the gap is not moonlight
  S.fdoor = (u, v, f, o) => {
    const C = [0.74, 0.5, 0.8], a = (u - C[0]) / C[2], b = (v - C[1]) / C[2], Z = 1.5 / max(b, 1e-3), X = a * Z, fl = [1, 0.9, 1, 0.7][f];
    let L = (0.04 + 0.42 * fbm(u * 2.2 + 9, v * 7)) * ss(0.44, 0.02, v), A = 0, M = 1;
    if (hypot(u - 0.2, v - 0.14) < 0.05) L = 1;
    if (v > C[1] - 0.016 - 0.012 * fbm(u * 8, 4)) { M = 0; L = 0.03; }
    if (b > 0) {
      M = 0; L = (abs(fr(X * 3) - 0.5) < 0.13 ? 0.06 : fr(Z * 6) < 0.45 ? 0.72 : 0.3) * ss(22, 3, Z) + 0.03;
      const sh = X + 1.55 - (Z - 5) * 0.55;                                                                                           // its shadow, the long way, toward us
      if (Z < 5 && Z > 1.2 && sh > -0.02 && sh < 1.0 + (5 - Z) * 0.12) L = 0.03;
      const wg = (X + 0.72) + (5 - Z) * 0.1;
      if (Z < 5 && Z > 1.5 && abs(wg) < 0.03 + (5 - Z) * 0.09) { L = 0; A = fl * ss(1.2, 4.6, Z); }                                         // and the light through the gap, the short way
    }
    const fr0 = pb(u, v, C, -1.7, -0.6, -1.9, 1.5, 5, 5.12), s = W.s, t = W.t;
    if (fr0 === 1) { M = 0; L = s < 0.07 || s > 0.93 || t < 0.04 ? 0.5 : 0.1 + 0.05 * fbm(s * 5, t * 40); if (s >= 0.07 && s <= 0.93 && t > 0.04) { if (abs(fr(t * 2.6 + 0.15) - 0.5) > 0.4 || abs(s - 0.5) < 0.03) L = 0.2; if (s > 0.86) { L = 0; A = fl; } if (hypot((s - 0.16) * 1.1 / 3.4 * 3.4, (t - 0.55) * 3.1) < 0.045) L = 0.8; } }
    else if (fr0 === 2) { M = 0; L = 0.9; }
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // --- hatch: a hatch in the headland, one leaf flat on the grass and one stood up. steps down. it is lit down there, and warm coming up, and somebody has left their shoes at the top
  S.hatch = (u, v, f, o) => {
    const C = [0.5, 0.06, 0.95], F = [0.25, 4.3, 0.5], E = 2.3, fl = [1, 0.92, 1, 0.85][f];
    let L = 0.02, A = 0, B = 0, M = 0, k;
    if (gp(u, v, C, F, E)) {
      const x = H.x, z = H.z, d = H.d, open = abs(x) < 0.9 && abs(z) < 0.6;
      L = (0.04 + 0.5 * fbm(x * 6, z * 6) ** 2 + (hash(floor(x * 40), floor(z * 40)) > 0.9 ? 0.35 : 0)) * ss(14, 3, d);                    // rough grass
      if (abs(x) < 1.04 && abs(z) < 0.74 && !open) L = fr((abs(x) > 0.9 ? z : x) * 3) < 0.06 ? 0.2 : 0.9;                                 // the curb
      if (open) {
        k = rb(u, v, C, F, -0.9, 0.9, E, E + 2.4, -0.6, 0.6, 1);                                                                       // down the hole: boarded sides, the light coming up them
        const dp = (H.y - E) / 2.4;
        L = k === 6 ? 0 : (fr(H.y * 4) < 0.1 ? 0.03 : 0.3) * (1 - dp) * (k === 4 ? 1 : 0.5); A = fl * (k === 6 ? 0.95 : 0.2 + 0.75 * dp * dp);
        for (let i = 5; i >= 0; i--) if ((k = rb(u, v, C, F, -0.9 + i * 0.3, -0.6 + i * 0.3, E + 0.12 + i * 0.36, E + 2.4, -0.6, 0.6))) { A = k === 5 ? 0.12 : k === 2 ? fl * 0.75 : 0.3 * fl; L = k === 5 ? 0.85 - 0.12 * i : k === 3 ? 0.3 - 0.04 * i : 0; }   // treads, each one lit on the riser from under
      }
    } else L = 0.02 + 0.12 * fbm(u * 3, v * 30);
    if ((k = rb(u, v, C, F, -0.9, 0.9, E - 0.07, E, 0.78, 2.0))) { L = k === 5 ? (fr(H.s * 6) < 0.06 ? 0.1 : abs(H.t - 0.2) < 0.05 || abs(H.t - 0.8) < 0.05 ? 0.95 : 0.6 + 0.1 * fbm(H.s * 40, H.t * 3)) : 0.25; A = 0; if (k === 5 && abs(hypot((H.s - 0.5) * 1.5, H.t - 0.5) - 0.07) < 0.018) L = 0.05; }   // one leaf, flat on the grass: boards, two ledges, a ring
    if ((k = rb(u, v, C, F, 0.98, 1.05, E - 1.25, E, -0.6, 0.6))) { L = k === 1 ? (fr(H.s * 6) < 0.06 ? 0.02 : abs(H.t - 0.2) < 0.05 || abs(H.t - 0.8) < 0.05 ? 0.3 : 0.12) : 0.5; A = k === 1 ? fl * (0.25 + 0.6 * H.t) * (fr(H.s * 6) < 0.06 ? 0 : 1) : 0; }   // the other, stood up, the light on the inside of it
    if (rb(u, v, C, F, 0.5, 1.02, E - 1.2, E, -0.75, -0.7) === 3 && abs(H.t - 1 + H.s * 0.95) < 0.05) { L = 0.8; A = 0; }                    // and the prop holding it
    for (const [sx, sz] of [[-0.42, -1.12], [-0.12, -1.16]]) if ((k = rb(u, v, C, F, sx, sx + 0.2, E - 0.11, E, sz, sz + 0.5))) {         // shoes, side by side, toes to the edge
      const e = hypot(H.s * 2 - 1, H.t * 2 - 1.1); L = 0; A = 0; B = k === 5 ? (e > 1.15 ? 0 : H.t < 0.55 && hypot((H.s - 0.5) / 0.3, (H.t - 0.3) / 0.24) < 1 ? 0 : 1) : 0.8;
      if (k === 5 && e > 1.15) { B = 0; L = 0.3; } if (k !== 5 && H.t > 0.7) { B = 0; L = 0.03; }
    }
    L *= ss(0.9, 0.35, hypot(u - 0.5, v - 0.55));
    o[0] = min(L, 1); o[1] = min(A, 1); o[2] = B; o[3] = M;
  };
  // house2>>

  // <<who
  // --- who is reading: one plate for each way in. a thing left where its owner would know it
  const seg = (u, v, a, b) => { const ex = b.u - a.u, ey = b.v - a.v, n = ex * ex + ey * ey, t = ((u - a.u) * ex + (v - a.v) * ey) / n; return [t, ((u - a.u) * ey - (v - a.v) * ex) / Math.sqrt(n)]; };   // along a to b (0..1), and how far off to one side
  const glyph = (G, s, t) => { const cx = floor(s * (G.length * 4 - 1)), cy = floor(t * 5); return s >= 0 && s < 1 && t >= 0 && t < 1 && cx % 4 < 3 && (G[cx >> 2][cy] >> (2 - (cx % 4))) & 1; };
  // watcher: a brass glass on its legs at an unlit window, laid on the one lit window across the water
  S.watcher = (u, v, f, o) => {
    const C = [0.52, 0.5, 1.0], F = [0.35, 3.3, -0.4], E = 1.5;
    let L = 0.02, A = 0, M = 0, k;
    if (gp(u, v, C, F, E) && H.z < 0) { const m = abs(H.x + 0.2 * H.z) < 0.85 && H.z > -2.7, bar = abs(H.x + 0.2 * H.z) < 0.035 || abs(H.z + 1.3) < 0.05; L = (fr(H.x * 2.4) < 0.06 ? 0.02 : m && !bar ? 0.6 * ss(-2.7, -1.2, H.z) + 0.1 : 0.07) * ss(8, 1.5, H.d); }   // boards, and what moon the window lets in
    if (rb(u, v, C, F, -9, 9, -5, E, 0, 1) === 3) {
      const x = H.x, y = H.y;
      L = 0.045 * (fr(x * 4.5) < 0.07 ? 0.4 : 1);
      if (abs(x) < 1.02 && y > -1.77 && y < 0.3) {
        L = x < -0.9 || y < -1.65 ? 0.85 : 0.4;                                                                                         // the sash
        if (abs(x) < 0.9 && y > -1.65 && y < 0.22) {
          const roof = -0.42 - 0.1 * hash(floor(x * 10), 3) - (fr(x * 10) < 0.5 ? 0.05 : 0), gx = abs(x - 0.33);
          M = 1; L = y < -0.42 ? 0.1 + 0.14 * fbm(x * 3, y * 8) : fr(y * 40) < 0.2 ? 0.16 * ss(0.3, -0.4, y) : 0.01;                        // sky; the water
          if (y > roof && y < -0.42) { L = 0.01; M = 0; }                                                                               // the town, across it
          if (gx < 0.03 && abs(y + 0.48) < 0.035) { L = 0; A = [1, 1, 0.7, 1][f]; M = 0; }                                                // and the one window
          else if (y > -0.4 && gx < 0.035 * (0.3 + hash(floor(y * 70), f))) A = 0.85 * ss(0.2, -0.4, y);
          else A = 0.4 * exp(-hypot(gx, y + 0.48) * 22);
          if (abs(x) < 0.022 || abs(y + 0.72) < 0.022) { L = 0.6; A = 0; M = 0; }
        }
      }
    }
    if ((k = rb(u, v, C, F, -1.12, 1.12, 0.3, 0.38, -0.24, 0))) L = k === 5 ? 0.9 : k === 3 ? 0.35 : 0.2;                                 // the sill
    const hd = pj(C, F, 0.02, -0.26, -1.0);
    for (const [fx, fz] of [[-0.5, -1.45], [0.5, -1.3], [0.05, -0.45]]) { const ft = pj(C, F, fx, E, fz), [t, d] = seg(u, v, hd, ft); if (t > 0 && t < 1 && abs(d) < 0.007 * (hd.k + t * (ft.k - hd.k)) * 3) L = d < 0 ? 0.85 : 0.3; }   // its legs
    const a = pj(C, F, -0.2, -0.2, -1.55), b = pj(C, F, 0.2, -0.52, -0.42), [t, d] = seg(u, v, a, b), r = (a.k + t * (b.k - a.k)) * (t < 0.24 ? 0.06 : t < 0.6 ? 0.08 : 0.1), q = d / r;
    if (t > 0 && t < 1 && abs(q) < 1) { L = abs(t - 0.24) < 0.012 || abs(t - 0.6) < 0.012 || t > 0.975 || t < 0.02 ? 0.05 : q > 0.45 ? 1 : q > -0.35 ? 0.6 : 0.14; if (t < 0.035 && t >= 0.02 && q > 0.2) { L = 0; A = 1; } }   // the glass: three draws, brass, bright along the top
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
  };

  // knocker: a front door, close to. the knocker is brass, an eagle with its wings out and a bail hung from its feet, the kind every porch on the street had. now and then the bail is lifted. over it a spy hole; down on the lock side a knob and the keyhole under it; and through both holes a little of what is on behind the door
  const eagle = (x, y, rr) => {
    const ax = abs(x), e = ell(x, y, 0, -0.34, 0.25, rr);
    if (hypot(x + 0.03, y + 0.86) < 0.1 || (x < -0.1 && x > -0.26 && y > -0.9 && y < -0.9 + (x + 0.26) * 0.75) || ell(x, y, 0, -0.62, 0.11, 0.2) < 1) return 2;   // head, beak, breast
    if (ax > 0.05 && ax < 0.56 && y > -0.86 + 0.42 * ax ** 1.5 && y < -0.56 + 0.06 * ax - 0.035 * abs(sin(ax * 28)) - max(0, ax - 0.42) * 2) return 3;   // wings, the feathers cut along the lower edge
    if (y > -0.47 && y < -0.3 && ax < 0.05 + (y + 0.47) * 0.45 && fr(ax * 16) < 0.8) return 2;                                           // tail
    if (hypot(ax - 0.25, y + 0.34) < 0.05) return 4;                                                                                   // the two bosses the bail swings on
    if ((e < 1.08 && e > 0.84 && y > -0.34) || hypot(x, y + 0.34 - rr) < 0.065) return 5;                                               // the bail, and the knob it strikes with
    return ell(x, y, 0, -0.46, 0.2, 0.27) < 1 ? 1 : 0;                                                                                 // the plate behind it all
  };
  S.knocker = (u, v, f, o) => {
    const C = [0.57, 0.6, 1.0], F = [0, 2.55, 0.72], fl = [1, 0.85, 1, 0.92][f], rr = f === 3 ? 0.2 : 0.36, off = f === 3 ? 0.1 : 0.05;
    let L = 0.02, A = 0, M = 0;
    if (rb(u, v, C, F, -9, 9, -5, 5, 0, 1) === 3) {
      const x = H.x, y = H.y, lg = lamp(-0.7, -0.9, -1.1, 2.6), l = min(1.4, 0.3 + 2 * lg), pd = hypot(x, y + 1.28), k = eagle(x, y, rr), kx = x + 0.87, kd = hypot(kx, (y - 0.63) / 1.5), hole = hypot(kx, y - 0.6) < 0.028 || (abs(kx) < 0.013 && y > 0.6 && y < 0.69), nd = hypot(kx, y - 0.27);
      L = (abs(x) > 1.2 ? 0.5 * brick(x * 0.5, y * 0.5, 7) : abs(x) > 1.05 ? (x < -1.17 ? 1 : 0.7) : abs(abs(x) - 0.72) < 0.03 || (abs(x) < 0.72 && (abs(y + 1.62) < 0.03 || abs(y - 1.0) < 0.03)) ? (x < -0.7 || y < -1.6 || (y > 0.97 && y < 1) ? 0.04 : 0.6) : abs(x) > 0.72 || y < -1.62 || y > 1 ? 0.2 + 0.08 * fbm(x * 3, y * 40) : 0.09 + 0.07 * fbm(x * 5, y * 50)) * l;   // brick, the case, and the door: paint over grain, one long panel sunk in it
      if (eagle(x - off * 1.2, y - off, rr)) L *= 0.1;                                                                                   // what it throws on the paint
      if (hypot(x, y - 0.03) < 0.06) L = 0.8 * l;                                                                                       // where the knob comes down
      if (k) {
        const lit = !eagle(x + 0.035, y + 0.035, rr), shade = !eagle(x - 0.035, y - 0.035, rr);
        L = (lit ? 1 : shade ? 0.1 : k === 1 ? 0.3 : k === 3 ? (fr(abs(x) * 14 + y * 5) < 0.25 ? 0.3 : 0.8) : k === 5 ? 0.9 : 0.72) * min(1, 0.55 + l);
        if (k === 2 && hypot(x + 0.06, y + 0.89) < 0.02) L = 0;                                                                         // its eye
      }
      if (kd < 0.09) L = kd > 0.072 ? 0.9 * l : 0.45 * l;                                                                               // the escutcheon
      if (hypot(kx - 0.07, y - 0.32) < 0.1 && nd > 0.1) L *= 0.1;                                                                         // the knob: a rose, and a brass ball stood off it
      if (nd < 0.125) L = nd > 0.1 ? (y < 0.27 ? 0.8 : 0.3) * l : hypot(kx + 0.03, y - 0.235) < 0.03 ? 1 : nd > 0.078 ? 0.12 : kx + (y - 0.27) > 0.04 ? 0.35 : 0.8;
      if (pd < 0.07) L = pd > 0.05 ? 0.9 * l : 0.3 * l;                                                                                // the spy hole, in its brass
      if (hole || pd < 0.028) { L = 0; A = fl; } else A = 0.4 * fl * max(exp(-hypot(kx, y - 0.63) * 26), exp(-pd * 30));
    }
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };

  // stray: a pole on the road in. a bill nailed to it, LOST, the picture torn off, and the sign chalked under it. the cat is sat in the road. a long way behind it, two lamps coming
  const LOST = [[4, 4, 4, 4, 7], [7, 5, 5, 5, 7], [7, 4, 7, 1, 7], [7, 2, 2, 2, 2]];
  S.stray = (u, v, f, o) => {
    const C = [0.36, 0.6, 1.0], F = [0.1, 1.9, 1.2], E = 1.6, hl = pj(C, F, 34, E - 0.8, 3.0), ct = pj(C, F, 3.2, E, 0.2);
    let L = 0.06 + 0.2 * ss(0, 0.4, v) * (0.5 + fbm(u * 2, v * 9)), A = 0, B = 0, M = 1, k;
    if (v > C[1] - 0.03 - 0.03 * fbm(u * 7, 3)) { M = 0; L = 0.02; }
    if (gp(u, v, C, F, E)) {
      const l = lamp(0.3, E, -0.4, 1.5), z = H.z;
      M = 0; L = (z < 0.7 ? (abs(z - 0.62) < 0.07 ? 0.8 : 0.16 + 0.3 * hash(floor(H.x * 40), floor(z * 40))) : z > 5.3 ? 0.03 : abs(z - 3) < 0.07 && fr(H.x * 0.4) < 0.5 ? 0.9 : 0.3 + 0.25 * hash(floor(H.x * 20), floor(z * 20))) * (1.1 + 1.5 * l) * ss(70, 8, H.d);   // verge, kerb, the road and its line
      if (hypot((H.x - 0.5) / 0.9, (z - 0.25) / 0.2) < 1 || hypot((H.x - 2.6) / 0.7, (z - 0.2) / 0.09) < 1) L *= 0.15;
    }
    for (const sd of [-1, 1]) { const d = hypot(u - hl.u - sd * 0.014, v - hl.v); if (d < 0.006) { L = 0; B = 1; M = 0; } else B = max(B, 0.5 * exp(-d * 60) * [1, 0.9, 1, 1][f]); }   // the bus
    if ((k = rb(u, v, C, F, -0.14, 0.14, -6, E, -0.14, 0.14))) {                                                                         // the pole
      const y = H.y, s = 1 - H.s, b = (y + 1.08) / 0.9;
      M = 0; B = 0; L = k === 1 ? (fr(s * 5 + 0.3 * sin(y * 2)) < 0.12 ? 0.1 : 0.42 + 0.14 * fbm(s * 3, y * 6)) * (0.5 + 0.5 * ss(-2.5, -0.3, y)) : 0.1;
      if (k === 1 && s > 0.06 && s < 0.94 && b > 0 && b < 1) {                                                                          // the bill
        L = 1;
        if (glyph(LOST, (s - 0.2) / 0.6, (b - 0.07) / 0.2)) L = 0;
        if (s > 0.24 && s < 0.76 && b > 0.34 && b < 0.72) L = b > 0.66 - 0.05 * hash(floor(s * 22), 1) || s < 0.27 || s > 0.73 || b < 0.36 ? 0.5 : 0.04;   // where the picture was
        if (b > 0.78 && fr(b * 18) < 0.4 && s > 0.16 && s < 0.84 && hash(floor(s * 20), floor(b * 18)) > 0.25) L = 0.1;
      } else if (k === 1 && hypot((s - 0.5) / 0.48, (y - 0.2) / 0.15) < 1 + 0.25 * (fbm(s * 9, y * 9) - 0.5)) L = sigil((s - 0.5) / 0.44, (y - 0.2) / 0.125, 0, 0.12) ? 0.02 : 1;   // the sign, on a daub of whitewash
    }
    const mx = (u - ct.u) / (ct.k * 1.5), my = (v - ct.v) / (ct.k * 1.5), m = mog(mx, my, 0.5 * (fbm(mx * 46, my * 46) - 0.5), f === 3 ? 0.4 : 1) || (my > -0.445 && my < -0.34 && abs(mx + 0.016) < (my + 0.445) * 0.3 ? 1 : 0);   // the cat. at this size its near ear wants help   // the cat
    if (m) { M = 0; B = 0; A = m === 2 ? 1 : 0; L = m === 1 && !mog(mx + 0.012, my - 0.004, 0, 0) ? 0.9 : 0; }                                   // the lamps behind it catch one edge
    o[0] = L; o[1] = A; o[2] = B; o[3] = M;
  };

  // hand: the bench by the looms. a pair of gloves put down the way they came off, and a brass check with a number nobody can read
  S.hand = (u, v, f, o) => {
    const C = [0.5, 0.1, 1.0], F = [-0.05, 2.0, 0.4], Y = 0.95, fl = [1, 0.93, 1, 0.97][f], bl = pj(C, F, 0, -0.1, 0.25), br = hypot(u - bl.u, v - bl.v);
    let L = 0.02, A = 0, M = 0, k;
    if (gp(u, v, C, F, 2.0)) L = (fr(H.x * 2.2) < 0.06 ? 0.02 : 0.07) * ss(8, 2, H.d);
    if ((k = rb(u, v, C, F, -1.9, 1.9, Y, Y + 0.12, -0.8, 0.8))) {
      if (k !== 5) L = k === 3 ? 0.3 : 0.1;
      else {
        const x = H.x, z = H.z, l = fl * lamp(0, Y, 0.1, 1.1);
        let t = fr(z * 3.1) < 0.05 ? 0.25 : 0.55 + 0.25 * fbm(x * 9, floor(z * 3.1) * 3 + z * 0.5), sh = 0, g = -1;                         // deal boards, the grain along them
        for (const [gx, gz, rt, sd] of [[-0.5, 0.1, 0.4, 1], [0.3, -0.12, -0.5, -1]]) {
          const c = cos(rt), s = sin(rt), px = (x - gx) / 0.5, pz = -(z - gz) / 0.5, dx = (px * c + pz * s) * sd, dy = pz * c - px * s;
          const in_ = (a, b) => paw(a, b, 0, 0.13) || (abs(a) < 0.5 + 0.08 * (b - 0.7) && b > 0.68 && b < 1.4);
          if (in_(dx - 0.16 * sd, dy - 0.18)) sh = 1;
          if (in_(dx, dy)) g = !in_(dx + 0.07 * sd, dy + 0.07) ? 0.12 : !in_(dx - 0.05 * sd, dy - 0.05) ? 1                                                 // the under edge in shade, the upper edge lit
            : dy > 0.68 ? (dy < 0.8 || dy > 1.3 ? 0.3 : abs(fr(dx * 5 + 0.3 * sin(dy * 9)) - 0.5) < 0.12 ? 0.3 : 0.72)                                             // the gauntlet, in folds
            : dy < 0.05 ? (abs(fr(dy * 3.4 + 0.25 * sin(dx * 20)) - 0.5) < 0.09 ? 0.25 : paw(dx - 0.02 * sd, dy, 0, 0.06) ? 0.95 : 0.55)                         // fingers: creased at each joint, round, light along the top of each
            : abs(fr(dx * 4.2 + 0.5) - 0.5) < 0.04 && dy < 0.5 ? 0.25 : abs(fbm(dx * 5, dy * 11) - 0.5) < 0.035 ? 0.3 : hypot(dx + 0.1 * sd, dy - 0.3) < 0.26 ? 0.92 : 0.62;   // the back: three darts, wrinkles, the swell of it
        }
        const cd = hypot(x - 1.02, z - 0.22) * 0.85;
        L = (g >= 0 ? g : sh ? t * 0.1 : t * 0.75) * (g >= 0 ? 0.35 : 0.08) + (g >= 0 ? g : sh ? 0 : t * 0.75) * min(1, 2 * l) * (g >= 0 ? 0.65 : 0.92);
        if (g < 0 && hypot(x - 1.07, z - 0.17) < 0.17) L *= 0.15;
        if (cd < 0.17) { L = 0; A = cd > 0.14 || hypot(x - 1.02, z - 0.32) < 0.03 || (abs(z - 0.19) < 0.035 && abs(x - 1.02) < 0.09 && fr(x * 22) < 0.6) ? 0.3 : 1; }   // the check: a rim, a hole to hang it by, a number
      }
    }
    if (abs(u - bl.u) < 0.003 && v < bl.v) L = 0.4;
    if (br < 0.02) { L = 0; A = fl; } else A = max(A, 0.7 * fl * exp(-br * 26));
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };

  // keeper: a nail in the wall, the big ring on it, every key of the street. the rules pinned up beside. a lantern on the shelf, lit, the way it is left for whoever has the round
  S.keeper = (u, v, f, o) => {
    const C = [0.5, 0.5, 1.0], F = [0.3, 3.1, -0.45], E = 1.6, fl = [1, 0.9, 1, 0.95][f], lc = pj(C, F, 0.6, 0.36, -0.22), lr = hypot(u - lc.u, v - lc.v);
    let L = 0.02, A = 0, M = 0, k;
    if (rb(u, v, C, F, -9, 9, -5, E, 0, 1) === 3) {
      const x = H.x, y = H.y, lg = fl * lamp(0.6, 0.3, -0.22, 2), l = 0.35 + 0.65 * min(1, 2 * lg);
      const iron = (xx, yy) => {                                                                                                       // the ring and what hangs on it: bow, shank, bit, five times
        const e = hypot(xx + 0.45, yy + 0.85) / 0.3;
        if (e < 1.06 && e > 0.93) return 1;
        for (let i = 0; i < 5; i++) { const an = (i - 2) * 0.3, kx = xx + 0.45 - 0.3 * sin(an), ky = yy + 0.85 - 0.3 * cos(an) - 0.07, ln = [0.5, 0.72, 0.62, 0.8, 0.55][i], bw = hypot(kx, ky); if ((bw < 0.085 && bw > 0.045) || (abs(kx) < 0.02 && ky > 0.07 && ky < ln) || (kx > 0 && kx < 0.09 && ky > ln - 0.12 && ky < ln && fr(ky * 22 + i * 0.3) < 0.62)) return 2; }
        return 0;
      };
      const ir = iron(x, y), a = (x - 0.5) / 0.75, b = (y + 1.6) / 0.95;
      L = (0.02 + 0.3 * lg) * (0.7 + 0.5 * fbm(x * 3, y * 3)) * (fr(y * 1.4 + 0.2) < 0.02 ? 0.5 : 1);                                     // limewash
      if (iron(x + 0.07, y - 0.06)) L *= 0.12;
      if (a > 0 && a < 1 && b > 0 && b < 1) {                                                                                           // the rules
        const r = fr(b * 8), row = floor(b * 8);
        L = a < 0.04 || b > 0.97 ? 0.3 * l : l;
        if (row === 0 ? r > 0.3 && a > 0.25 && a < 0.75 : row < 7 && r > 0.35 && r < 0.7 && a > 0.1 && a < 0.9 && hash(floor(a * 26), row) > 0.25) { L = 0.04; if (row === 4) { L = 0; A = 1; } }   // one of them is underlined in red. you know which
        if (hypot(a - 0.5, (b - 0.04) * 1.3) < 0.035) L = 0.02;
      }
      if (ir) L = (ir === 1 ? (hypot(x + 0.45, y + 0.85) > 0.29 ? 0.5 : 1) : fr(x * 60) < 0.5 ? 1 : 0.7) * l;
      if (hypot(x + 0.45, y + 1.15) < 0.035) L = 1;
    }
    if ((k = rb(u, v, C, F, 0.05, 1.25, 0.62, 0.7, -0.45, 0))) L = k === 5 ? 0.85 : k === 3 ? 0.3 : 0.5;                                  // the shelf
    if ((k = rb(u, v, C, F, 0.44, 0.76, 0.54, 0.62, -0.38, -0.06))) L = k === 5 ? 0.7 : k === 3 ? 0.4 : 0.8;                              // the lantern: foot, four panes, a tin cap, a ring to carry it by
    if ((k = rb(u, v, C, F, 0.47, 0.73, 0.16, 0.54, -0.35, -0.09))) { const ed = H.s < 0.1 || H.s > 0.9 || H.t < 0.05 || H.t > 0.95; L = ed ? 0.75 : 0; A = ed ? 0 : fl * (hypot(H.s - 0.5, (H.t - 0.62) * 1.6) < 0.16 ? 1 : 0.62); }
    if ((k = rb(u, v, C, F, 0.42, 0.78, 0.08, 0.16, -0.4, -0.04))) { L = k === 5 ? 0.6 : k === 3 ? 0.15 : 0.45; A = 0; }
    const hn = pj(C, F, 0.6, 0.0, -0.22); if (abs(hypot(u - hn.u, (v - hn.v) * 1.1) - 0.045 * hn.k) < 0.007 * hn.k && v < hn.v + 0.02) L = 0.7;
    if (A < 0.5) A = max(A, 0.5 * fl * exp(-lr * 22));
    o[0] = min(L, 1); o[1] = A; o[2] = 0; o[3] = M;
  };
  // who>>

  // per scene: n frames (default 4), seq = playback order, one entry per tick, so a short loop can hold its odd frame back
  const META = {
    town: { seq: [0, 1, 0, 1, 2, 1, 0, 1, 0, 3] }, kitchen: { seq: [0, 0, 1, 1, 2, 3, 3, 3] }, woods: { seq: [0, 1, 2, 1, 0, 1, 2, 3] },
    lamp: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0] }, cellar: { seq: [0, 1, 0, 1, 2, 3, 2, 3] }, cat: { n: 6, seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 0, 3, 4, 4, 4, 5, 0] }, shore: { seq: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] },
    pumpkins: { seq: [0, 1, 2, 3, 0, 2] }, skitter: { n: 10 }, marsh: { n: 10 }, fen: { n: 10 }, reeds: { n: 10, seq: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3] }, road: { n: 10 }, barn: { n: 1 },
    window: { seq: [0, 1, 2, 1, 0, 2, 1, 0, 1, 3] }, tv: { seq: [0, 1, 2, 0, 1, 2, 1, 0, 2, 3] }, well: { seq: [0, 1, 3, 1, 0, 1, 3, 1, 0, 2] },
    field: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3] }, porch: { seq: [0, 1, 2, 1] }, yard: { seq: [0, 1, 2, 1] },
    birches: { seq: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 2, 1] }, swing: { seq: [0, 0, 1, 2, 2, 3] }, pier: { seq: [0, 1, 0, 1, 0, 1, 0, 1, 3, 3] }, hall: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3] }, mantel: { seq: [0, 0, 0, 0, 0, 0, 0, 3] }, rungs: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 3, 3] }, lighthouse: { seq: [0, 0, 1, 2, 2, 3] }, oak: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3] }, grove: { seq: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 3, 3] }, pond: { seq: [0, 0, 1, 1, 2, 2, 3, 3] }, drowned: { seq: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3] }, mound: { seq: [0, 0, 1, 1, 2, 2, 3, 3] },
    looms: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3] }, chain: { n: 2, seq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] }, paywin: { n: 7, seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 3, 4, 5, 6, 3] }, adit: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 3, 3] }, junction: { seq: [0, 1, 2, 1, 0, 1, 2, 3] }, tally: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3] }, spares: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3] },
    chute: { n: 6, seq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5, 5, 4] }, halt: { seq: [0, 0, 1, 2, 0, 0, 1, 0, 3, 3] }, signal: { seq: [0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 2] }, ring: { seq: [0, 0, 0, 0, 0, 0, 0, 3] }, cradle: { n: 10 }, keys: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 3, 0] }, knocker: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 3, 3, 0] }, stray: { seq: [0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 2, 0, 3] },
    wrack: { seq: [0, 0, 1, 1, 2, 2, 3, 3] }, mainst: { seq: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] }, storefront: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 3] },
  };
  const frames = (id) => META[id]?.n || 4;
  const seq = (id) => META[id]?.seq || Array.from({ length: frames(id) }, (_, i) => i);

  // --- quantize ---------------------------------------------------------------
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  const plate = (x, y) => (B8[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
  const scan = (x, y) => ([0, 2, 1, 3][y & 3] * 4 + [0, 2, 1, 3][x & 3] + 0.5) / 16;

  const cache = new Map();
  // win = [u0,v0,u1,v1] crop of the scene. still = only the first frame, for panels that do not move
  function field(id, w, h, win = [0, 0, 1, 1], still = false) {
    const key = [id, w, h, win, still].join();
    if (cache.has(key)) return cache.get(key);
    const o = [0, 0, 0, 0], out = { w, h, frames: [] };
    for (let f = 0, n = still ? 1 : frames(id); f < n; f++) {
      const d = new Float32Array(w * h * 4);
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
        S[id](win[0] + ((x + 0.5) / w) * (win[2] - win[0]), win[1] + ((y + 0.5) / h) * (win[3] - win[1]), f, o);
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = o[3] ? 1 : 0;
      }
      out.frames.push(d);
    }
    cache.set(key, out);
    return out;
  }
  // crop centred on (cx,cy) spanning z of the scene's width, matched to a w x h panel
  const win = (cx, cy, z, w, h) => [cx - z / 2, cy - (z * h) / w / 2, cx + z / 2, cy + (z * h) / w / 2];

  // -> Uint8Array of palette slots: 0 ground, 1 ink, 2 accent, 3 second accent (four colours: a 2-bit image)
  // style: mix (air in scanlines, objects in plate) | xim (the reverse) | scan | plate
  // edge:  none | line | fizz (border solid at the `fade` anchor, dissolving away from it, picture with it)
  //        | vig (no border, picture sinks into the dark; `fall` = how far in the fade starts, lower is softer) | bars (rules top and bottom, sides fade)
  function quantize(fld, f, { style = 'mix', edge = 'none', fade = [0, 0], fall = 0.5, seed = 1, swap = false } = {}) {
    const { w, h } = fld, d = fld.frames[f], out = new Uint8Array(w * h), sA = swap ? 3 : 2, sB = swap ? 2 : 3;
    for (let y = 0, i = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4, p++) {
      const P = plate(x, y);
      let m = 1, ma = 1;
      if (edge === 'vig') {
        const r = hypot(((x + 0.5) / w) * 2 - 1, ((y + 0.5) / h) * 2 - 1) * 0.92 + 0.4 * (fbm(x * 0.045 + seed * 7, y * 0.045) - 0.5);
        m = ss(1, fall, r); ma = ss(1.15, fall + 0.15, r);
      } else if (edge === 'bars') {
        m = ma = ss(1.05, 0.6, abs(((x + 0.5) / w) * 2 - 1) + 0.3 * (fbm(seed * 5, y * 0.08) - 0.5));
        if (y === 0 || y === h - 1) { out[p] = P < m * 1.5 ? 1 : 0; continue; }
      } else if (edge !== 'none') {
        const k = edge === 'line' ? 2 : 1.25 - 1.15 * hypot(x / w - fade[0], y / h - fade[1]);
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { out[p] = P < k ? 1 : 0; continue; }
        m = ma = ss(-0.25, 0.35, k);
      }
      const T = style === 'plate' ? P : style === 'scan' ? scan(x, y) : (d[i + 3] === 1) === (style === 'mix') ? scan(x, y) : P;
      out[p] = d[i + 2] * ma > T ? sB : d[i + 1] * ma > T ? sA : d[i] * m > T ? 1 : 0;
    }
    return out;
  }

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // pal = [ground, ink, accent, accent2] hex
  function toRGBA(idx, w, h, pal) {
    const c = pal.map(rgb), px = new Uint8ClampedArray(w * h * 4);
    for (let p = 0, q = 0; p < w * h; p++, q += 4) { const k = c[idx[p]]; px[q] = k[0]; px[q + 1] = k[1]; px[q + 2] = k[2]; px[q + 3] = 255; }
    return { data: px, width: w, height: h };
  }

  // --- drawing to a canvas (browser only) --------------------------------------
  // display faces by the code a page uses; d is the telling face. % = size in px
  const FACES = { g: '600 %px "Grenze Gotisch"', m: '%px "MedievalSharp"', p: '%px "Pirata One"', d: '%px "DotGothic16"' };
  const fontsReady = () => Promise.race([Promise.all(Object.values(FACES).map((f) => document.fonts.load(f.replace('%', 24)))).catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  // words are rasterised to 1-bit masks so they sit in the picture like everything else. t = { t, f, z, x?, y, k }
  function mask(t, face, W) {
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true }), font = FACES[t.f === 'd' ? 'd' : face].replace('%', t.z);
    g.font = font;
    c.width = Math.ceil(g.measureText(t.t).width) + 2; c.height = Math.ceil(t.z * 1.3);
    g.font = font; g.textBaseline = 'top'; g.fillStyle = '#fff'; g.fillText(t.t, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110;
    return { m, w: c.width, h: c.height, x: t.x ?? Math.round((W - c.width) / 2), y: t.y, k: t.k };
  }
  function stamp(idx, w, h, ox, oy, masks) {
    for (const t of masks) for (let y = max(t.y, oy); y < min(t.y + t.h, oy + h); y++) for (let x = max(t.x, ox); x < min(t.x + t.w, ox + w); x++)
      if (t.m[(y - t.y) * t.w + x - t.x]) idx[(y - oy) * w + x - ox] = t.k;
  }
  // draw a page onto a canvas and return a function that advances its moving panels by one tick.
  // page = { w, h, panels, text?, face? }; one scene on its own is a page with a single panel
  function mount(cv, { w, h, panels, text = [], face = 'g' }, pal) {
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = (idx, pw, ph, tint) => new ImageData(toRGBA(idx, pw, ph, tint ? [pal[0], pal[1], tint[0] || pal[2], tint[1] || pal[3]] : pal).data, pw, ph);
    const masks = text.map((t) => mask(t, face, w)), base = new Uint8Array(w * h);
    stamp(base, w, h, 0, 0, masks);
    g.putImageData(img(base, w, h), 0, 0);
    const live = panels.map((pn) => {
      const fld = field(pn.s, pn.w, pn.h, win(pn.c[0], pn.c[1], pn.z, pn.w, pn.h), !pn.live);
      const frames = fld.frames.map((_, f) => { const idx = quantize(fld, f, { style: pn.st, edge: pn.edge, fade: pn.fade, fall: pn.fall, seed: pn.x + pn.y + 1, swap: !!pn.swap }); stamp(idx, pn.w, pn.h, pn.x, pn.y, masks); return img(idx, pn.w, pn.h, pn.tint); });
      g.putImageData(frames[0], pn.x, pn.y);
      return { x: pn.x, y: pn.y, frames, seq: seq(pn.s) };
    }).filter((l) => l.frames.length > 1);
    return (tick) => { for (const l of live) g.putImageData(l.frames[l.seq[tick % l.seq.length]], l.x, l.y); };
  }

  const DF = { scenes: Object.keys(S), seq, field, win, quantize, toRGBA, fontsReady, mount };
  if (typeof module !== 'undefined') module.exports = DF; else globalThis.DF = DF;
})();
