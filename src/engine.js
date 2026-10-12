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
    const ear = (ex, top) => v > top && v < 0.4 && abs(u - hx - ex) < (v - top) * 0.3;
    if ((hypot((u - cx - 0.12 * (v - 0.6)) / 0.075, (v - 0.6) / 0.17) < 1 + rag && v < wall + 0.006) || (hypot((u - cx - 0.045) / 0.07, (v - 0.69) / 0.075) < 1 + rag && v < wall + 0.006)
      || hypot(u - hx, v - 0.435) < 0.056 * (1 + rag * 0.7) || ear(-0.034, 0.315) || ear(0.034, 0.35)
      || dSeg(u, v, cx + 0.08, wall - 0.02, cx + 0.15, wall + 0.1) < 0.006 + 0.008 * hash(floor(v * 70), 1) || dSeg(u, v, cx + 0.15, wall + 0.1, cx + 0.13 + tail, wall + 0.24) < 0.004 + 0.008 * hash(floor(v * 70), 2)) { L = 0; M = 0; }
    for (const sx of [-1, 1]) {
      const ex = u - hx - sx * 0.023, ey = v - 0.428 + sx * ex * 0.3;
      if (lid && hypot(ex / 0.015, ey / (0.0085 * lid)) < 1) A = abs(ex) < 0.0028 ? 0 : 1;
    }
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
    const fl = [1, 0.8, 1, 0.9][f], gy = 0.66 + 0.1 * u;
    let L = 0.1 + 0.26 * ss(0, 0.6, v) + 0.16 * ss(0.5, 0.8, fbm(u * 3, v * 10)), A = 0, M = 1;
    if (v > 0.5 - 0.07 * fbm(u * 5, 2) - 0.08 * u) { L = fbm(u * 40, v * 40) > 0.62 ? 0.12 : 0.02; M = 0; }
    if (v > gy) { M = 0; L = abs(v - gy - 0.1 - 0.06 * u) < 0.006 ? 0.5 : 0.06 + 0.1 * hash(floor(u * 90), floor(v * 90)); }
    if (quad(u, v, 0.3, 0.3, 0.8, 0.25, 0.76, 0.17, 0.24, 0.25)) { M = 0; L = 0.05; }
    if (dSeg(u, v, 0.24, 0.25, 0.76, 0.17) < 0.008) { M = 0; L = 0.7; }
    if (wall(u, v, 0.3, 0.8, 0.3, 0.25, 0.7, 0.76)) {
      const s = W.s, t = W.t;
      M = 0; L = fr(s * 6) < 0.04 ? 0.04 : 0.16 + 0.1 * fbm(s * 9, t * 9);
      if (s > 0.6 && s < 0.86 && t > 0.16 && t < 0.6) { L = 0; A = abs(t - 0.36) < 0.02 && s > 0.65 && s < 0.8 ? 0 : 0.8 * fl; }
      if (t > 0.72 && t < 0.78 && s > 0.05 && s < 0.52) L = 0.7;
      if (t >= 0.78 && (abs(s - 0.09) < 0.012 || abs(s - 0.48) < 0.012)) L = 0.45;
    }
    for (const px of [0.24, 0.76]) if (abs(u - px) < 0.008 && v > (px < 0.5 ? 0.25 : 0.17) && v < (px < 0.5 ? 0.76 : 0.86)) { M = 0; L = 0.6; A = 0; }
    FOX.forEach(([x, top, lean], i) => {
      const sx = x + lean * (0.98 - v), d = u - sx, k = floor((v - top) / 0.032), by = top + (k + 0.5) * 0.032, bw = 0.009 + 0.0013 * k, side = k & 1 ? 1 : -1;
      if (v <= top) return;
      if (abs(d) < 0.004) { M = 0; L = 0.3; A = 0; }
      if (k < 9 && ell(u, v, sx + side * (bw + 0.004), by, bw, 0.015) < 1) { M = 0; A = 0; L = v > by + 0.005 ? 0.3 : 0.92; }
      if (v > top + 0.3 && abs(d) < (v - top - 0.3) * 0.3 * (0.5 + 0.5 * abs(sin(v * 60 + i)))) { M = 0; A = 0; L = fr(d * 70 + v * 20) < 0.3 ? 0.04 : 0.24; }
    });
    o[0] = L; o[1] = A; o[2] = 0; o[3] = M;
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
  const T4 = [0, 0, 0, 0];
  S.cinema = (u, v, f, o) => {
    let L = 0.03 + 0.05 * fbm(u * 4, v * 4), A = 0, B = 0, M = 1;
    const bx = u - 0.48, by = v - 0.3, q = abs(by + (1 - u) * 0.5 - 0.02) / (0.02 + (1 - u) * 0.16);
    if (u > 0.3 && q < 1) L += 0.3 * (1 - q) * (0.6 + 0.4 * fbm(u * 20 + f, v * 20));
    if (wall(u, v, 0.12, 0.84, 0.1, 0.14, 0.52, 0.5)) {
      const s = W.s, t = W.t;
      S.stairs(0.06 + s * 0.88, t, f, T4);                                                                                          // the film is the staircase on the landing page
      M = 0; L = 0.22 + 0.78 * T4[0]; A = T4[1];
      if (s < 0.015 || s > 0.985 || t < 0.02 || t > 0.98) { L = 0.3; A = 0; }
    }
    if (inBox(u, v, 0.885, 0.3, 0.965, 0.345)) { M = 0; L = 0; B = fr((u - 0.885) * 50) < 0.65 && abs(v - 0.3225) < 0.013 ? 1 : 0.35; }   // exit
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

  // per scene: n frames (default 4), seq = playback order, one entry per tick, so a short loop can hold its odd frame back
  const META = {
    town: { seq: [0, 1, 0, 1, 2, 1, 0, 1, 0, 3] }, kitchen: { seq: [0, 0, 1, 1, 2, 3, 3, 3] }, woods: { seq: [0, 1, 2, 1, 0, 1, 2, 3] },
    lamp: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0] }, cellar: { seq: [0, 1, 0, 1, 2, 3, 2, 3] }, cat: { n: 6, seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 0, 3, 4, 4, 4, 5, 0] }, shore: { seq: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] },
    pumpkins: { seq: [0, 1, 2, 3, 0, 2] }, skitter: { n: 10 }, marsh: { n: 10 }, fen: { n: 10 }, reeds: { n: 10, seq: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3] }, road: { n: 10 }, barn: { n: 1 },
    window: { seq: [0, 1, 2, 1, 0, 2, 1, 0, 1, 3] }, tv: { seq: [0, 1, 2, 0, 1, 2, 1, 0, 2, 3] }, well: { seq: [0, 1, 3, 1, 0, 1, 3, 1, 0, 2] },
    field: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3] }, porch: { seq: [0, 1, 2, 1] }, yard: { seq: [0, 1, 2, 1] },
    birches: { seq: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 2, 1] }, swing: { seq: [0, 0, 1, 2, 2, 3] }, pier: { seq: [0, 1, 0, 1, 0, 1, 0, 1, 3, 3] }, hall: { seq: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3] }, mantel: { seq: [0, 0, 0, 0, 0, 0, 0, 3] }, rungs: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 3, 3] }, lighthouse: { seq: [0, 0, 1, 2, 2, 3] }, oak: { seq: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3] }, grove: { seq: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 3, 3] }, pond: { seq: [0, 0, 1, 1, 2, 2, 3, 3] }, drowned: { seq: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3] }, mound: { seq: [0, 0, 1, 1, 2, 2, 3, 3] },
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
