// the sound of the place, made in the browser as it plays: nothing is downloaded, and it comes round on itself without a seam.
// slow (54 to the minute, the pace of a tired clock), in D minor, fifty-six bars, a little over four minutes:
// a pad and a singing saw over a bass, a kick, a brush and the clock's tick, with a low guitar, all twang and tremolo, and a few notes of vibraphone, in a great deal of room. twice the beat drops away and leaves the night.
// round that, coming and going: a banjo, a real one, a recording, heard three times from a long way off; crickets, in their own time and not the beat's; a room full of people talking, another recording, twice and briefly; and twice a train going by a long way away.
// and twice the count itself bends, the way the rhythm cycles of Arabic and Turkish music are counted: out of four into ten and seven, later into nine and seven, and back. the saw sings straight through it.
// under all of it a drone that throbs, a rumble, now and then a note that should not be there; a heart when the beat has gone; a rush of air cut dead before each silence.
// from the story: the time clock ticks the beats, somebody knocks three times at the end of a phrase, a bell, and the mine drips.
import banjoUrl from './banjo.mp3';
import crowd1 from './crowd1.mp3';
import crowd2 from './crowd2.mp3';

const BPM = 54, S = 60 / BPM / 4, BARS = 56;                                               // S = a sixteenth, the smallest step
const TAU = Math.PI * 2, hz = (m) => 440 * 2 ** ((m - 69) / 12), rnd = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
// eight bars of harmony, seven times round: [bass, four notes of pad]. the two major chords have their sevenths in, which is where the ache is; the last is A with no third in it, which settles nothing
const Dm = [38, 50, 57, 62, 65], CHORDS = [Dm, Dm, [41, 53, 57, 60, 64], [36, 48, 55, 60, 64], Dm, Dm, [34, 46, 53, 57, 62], [33, 45, 52, 57, 64]];
const SAW = [81, 86, 84, 81, 77, 81, 82, 76];                                                                 // the saw's tune, a note a bar
// the count. a bar is so many sixteenths, with its heavy beats (dum), its light ones (tek), and where the clock ticks. four is the rule;
// samai is the ten of samai thaqil, and seven and nine are the limping ones, 3+2+2 and 2+2+2+3
const FOUR = { len: 16, dum: [0, 10], tek: [8], pulse: [0, 4, 8, 12] }, SAMAI = { len: 20, dum: [0, 10, 12], tek: [6, 14], pulse: [0, 6, 10, 14] }, SEVEN = { len: 14, dum: [0, 6], tek: [10], pulse: [0, 6, 10] }, NINE = { len: 18, dum: [0, 8], tek: [4, 12, 14], pulse: [0, 4, 8, 12] };
const BENT = { 12: SAMAI, 13: SAMAI, 14: SEVEN, 15: SEVEN, 46: NINE, 47: NINE, 48: SEVEN, 49: SEVEN };
const METER = Array.from({ length: BARS }, (_, b) => BENT[b] || FOUR), START = METER.reduce((a, m) => [...a, a.at(-1) + m.len], [0]), STEPS = START[BARS];   // START = the sixteenth each bar begins on
const WHERE = METER.flatMap((m, b) => Array.from({ length: m.len }, (_, s) => [b, s]));                       // which bar, and how far into it, each sixteenth of the loop is
const within = (b, spans) => spans.some(([a, z]) => b >= a && b < z);
const calm = (b) => within(b, [[20, 24], [36, 40]]), snaps = (b) => within(b, [[8, 20], [24, 36], [40, 52]]), saw = (b) => within(b, [[4, 20], [32, 56]]);

// everything that plays, built on an audio context and wired to out. -> step(n, t): sound whatever belongs to sixteenth n of the loop, at time t
export function band(ctx, out) {
  const sr = ctx.sampleRate, white = ctx.createBuffer(1, sr * 2, sr), room = ctx.createBuffer(2, sr * 3.5, sr), hall = ctx.createConvolver(), plucked = {};
  for (let i = 0, d = white.getChannelData(0); i < d.length; i++) d[i] = Math.random() * 2 - 1;
  for (let c = 0; c < 2; c++) for (let i = 0, d = room.getChannelData(c); i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;   // a big empty room: noise dying away
  hall.buffer = room; hall.connect(out);
  const bus = (level, wet) => { const g = ctx.createGain(), w = ctx.createGain(); g.gain.value = level; w.gain.value = wet; g.connect(out); g.connect(w).connect(hall); return g; };
  const beat = bus(0.9, 0.12), pad = bus(0.8, 0.5), night = bus(0, 0.08), under = bus(1, 0.25), far = bus(0.7, 0.9);
  // an oscillator, a burst of noise through a filter, a note's rise and fall, and somewhere to stand: what everything below is made of
  const osc = (type, f, t, dur, to) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(to); o.start(t); o.stop(t + dur); return o; };
  const hiss = (t, dur, to, type, f, q = 0.7) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = white; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; s.connect(fl).connect(to); s.start(t, Math.random()); s.stop(t + dur); return fl; };
  const env = (t, peak, rise, fall, to, hold = 0) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + rise); g.gain.setValueAtTime(peak, t + rise + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + rise + hold + fall); g.connect(to); return g; };
  const place = (from, to, t, dur, dest) => { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(from, t); p.pan.linearRampToValueAtTime(to, t + dur); p.connect(dest); return p; };

  const kick = (t, v) => osc('sine', 95, t, 0.6, env(t, v, 0.004, 0.5, beat)).frequency.exponentialRampToValueAtTime(38, t + 0.22);
  const brush = (t) => hiss(t, 0.5, env(t, 0.16, 0.03, 0.4, beat), 'bandpass', 1700);
  const tick = (t, v) => { hiss(t, 0.03, env(t, v, 0.001, 0.02, beat), 'highpass', 5200); osc('sine', 2300, t, 0.03, env(t, v * 0.5, 0.001, 0.015, beat)); };
  const knock = (t, v) => { osc('sine', 150, t, 0.2, env(t, v, 0.002, 0.13, beat)).frequency.exponentialRampToValueAtTime(85, t + 0.07); hiss(t, 0.08, env(t, v * 0.5, 0.001, 0.05, beat), 'lowpass', 900); };
  const bell = (t, m) => [1, 2.76, 5.4, 8.93].forEach((k, i) => osc('sine', hz(m) * k, t, 6, env(t, 0.07 / (i + 1), 0.005, 5 / (i + 1), far)));
  const drip = (t, k) => osc('sine', 900 + 900 * k, t, 0.2, env(t, 0.06, 0.002, 0.09, far)).frequency.exponentialRampToValueAtTime(500 + 500 * k, t + 0.08);
  // the pad: each note two saws a hair apart behind a filter that opens and shuts over the bar, and a thin high sine over the top of the chord
  const swell = (t, notes, len) => {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(1050, t + len * 0.6); f.frequency.linearRampToValueAtTime(420, t + len + 2.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 1.6); g.gain.setValueAtTime(0.045, t + len); g.gain.linearRampToValueAtTime(0, t + len + 2.6); f.connect(g).connect(pad);
    for (const m of notes) for (const c of [-7, 7]) osc('sawtooth', hz(m), t, len + 2.7, f).detune.value = c;
    osc('sine', hz(notes[3] + 12), t, len + 2.7, g).detune.value = 5;
  };
  const low = (t, m, len, v) => osc('sine', hz(m), t, len + 0.5, env(t, v, 0.03, len, pad));
  // the singing saw: one sine with a shake in it, sliding from each note to the next over four bars
  const sing = (t, b) => {
    const at = (i) => (START[b + i] - START[b]) * S, len = at(4), g = ctx.createGain(), o = osc('sine', hz(SAW[b % 8]), t, len + 3, g), shake = ctx.createGain();
    for (let i = 1; i < 4; i++) o.frequency.setTargetAtTime(hz(SAW[(b + i) % 8]), t + at(i), 0.5);
    shake.gain.value = 7; shake.connect(o.frequency); osc('sine', 5.2, t, len + 3, shake);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 3); g.gain.setValueAtTime(0.03, t + len - 1); g.gain.linearRampToValueAtTime(0, t + len + 2.5); g.connect(far);
  };
  // the low guitar: a plucked string worked out once for each note (noise going round a short loop, losing its top each time round) and kept, played through a slow tremolo into the far end of the room
  const trem = ctx.createGain(), wob = ctx.createGain(), dark = ctx.createBiquadFilter();
  trem.gain.value = 0.7; wob.gain.value = 0.3; wob.connect(trem.gain); osc('sine', 5.4, 0, 1e6, wob); dark.type = 'lowpass'; dark.frequency.value = 1700; trem.connect(dark).connect(far);
  const twang = (t, m, v) => {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = plucked[m] ||= (() => { const n = sr * 4, buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0), N = Math.round(sr / hz(m)); for (let i = 0; i < n; i++) d[i] = i < N ? Math.random() * 2 - 1 : (d[i - N] + d[i - N + 1]) * 0.4985; return buf; })();
    g.gain.value = v; s.connect(g).connect(trem); s.start(t);
  };
  // a vibraphone note: a sine with a little of its fourth partial, the motor turning
  const vibe = (t, m) => { const g = env(t, 0.035, 0.005, 3.2, far), w = ctx.createGain(); w.gain.value = 0.012; w.connect(g.gain); osc('sine', 4.3, t, 3.6, w); osc('sine', hz(m), t, 3.6, g); osc('sine', hz(m) * 4, t, 1, env(t, 0.006, 0.003, 0.6, far)); };
  // the two things here that are fetched are recordings: the opening of "Lonely Banjo", and a restaurant full of people. each is heard from the far end of the room with the top taken off it,
  // coming up slowly, staying a while and going as slowly, and never loud. the banjo is played two semitones down, which puts it in this key
  const load = (url) => { const c = {}; fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((b) => { c.buf = b; }, () => {}); return c; };
  const banjo = load(banjoUrl), crowd = [load(crowd1), load(crowd2)];
  const distant = (c, t, rate, cut, peak, rise, hold) => {
    if (!c.buf) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = c.buf; s.playbackRate.value = rate; f.type = 'lowpass'; f.frequency.value = cut;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + rise); g.gain.setValueAtTime(peak, t + rise + hold); g.gain.linearRampToValueAtTime(0, t + rise * 2 + hold);
    s.connect(f).connect(g).connect(far); s.start(t); s.stop(t + rise * 2 + hold + 0.1);
  };
  // what lies under it all and is not quite right. a drone on the low D, two notes a hair apart so that it throbs, with a rumble below that; d = how much of it
  const drone = (t, len, d, wrong) => {
    const f = ctx.createBiquadFilter(), g = env(t, d, 1.5, 2.5, under, len - 1.5);
    f.type = 'lowpass'; f.frequency.value = 220; f.connect(g);
    for (const h of [36.71, 37.15, 73.6]) osc('triangle', h, t, len + 3, f);
    if (wrong) osc('sine', 51.91, t, len + 3, env(t, d * 0.5, 2, 2.5, under, len - 2));                        // and now and then the note that should not be there, a tritone up
    hiss(t, len + 3, env(t, d * 1.5, 2, 2.5, under, len - 2), 'lowpass', 75, 2);
  };
  // a rush of air that builds through a bar and is cut off dead at the end of it
  const rush = (t, len) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + len); g.gain.setValueAtTime(0, t + len + 0.01); g.connect(far); hiss(t, len + 0.02, g, 'bandpass', 300, 1.2).frequency.exponentialRampToValueAtTime(2600, t + len); };
  // a heart, when the beat has gone
  const thump = (t, v) => osc('sine', 58, t, 0.4, env(t, v, 0.01, 0.3, under)).frequency.exponentialRampToValueAtTime(40, t + 0.15);
  const snap = (t) => hiss(t, 0.06, env(t, 0.05, 0.001, 0.035, far), 'bandpass', 2300, 2);
  // a cricket: three quick pulses of one high note. k = which cricket: each has its own pitch and its own side
  const chirp = (t, k) => {
    const g = ctx.createGain(), v = 0.016 + 0.01 * rnd(k + 2);
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(v, t + i * 0.019); g.gain.setValueAtTime(0, t + i * 0.019 + 0.011); }
    g.connect(place(k - 1, k - 1, t, 1, night)); osc('sine', 4300 + 260 * k, t, 0.07, g);
  };
  // a train going by in the night, a long way off: the rumble of it coming up and going, the wheels over the rail joints, and the whistle blown for a crossing: two long, a short, and a long
  const train = (t) => {
    const len = 28, side = place(-0.8, 0.8, t, len, far), g = ctx.createGain(), toot = (at, dur) => {
      const w = env(at, 0.035, 0.12, 0.5, side, dur), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1500; f.connect(w);
      for (const m of [62, 65, 69, 72]) { const o = osc('sawtooth', hz(m) * 1.01, at, dur + 0.8, f); o.frequency.setValueAtTime(hz(m) * 1.01, at + dur); o.frequency.linearRampToValueAtTime(hz(m) * 0.97, at + dur + 0.6); }
      hiss(at, dur + 0.8, env(at, 0.012, 0.1, 0.5, side, dur), 'bandpass', 1700, 1.5);
    };
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + len * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + len); g.connect(side);
    hiss(t, len, g, 'lowpass', 110);
    for (let at = t + 2; at < t + len - 2; at += 0.46) for (const d of [0, 0.1]) hiss(at + d, 0.07, env(at + d, 0.5, 0.004, 0.05, g), 'lowpass', 420);
    [[5, 1.7], [7.3, 1.7], [9.6, 0.45], [10.5, 2.6]].forEach(([at, dur]) => toot(t + at, dur));
  };

  return (n, t) => {
    const [b, s] = WHERE[n], m = METER[b], ch = CHORDS[b % 8], quiet = calm(b), human = (rnd(n) - 0.5) * 0.014;
    if (!s) {                                                                                                 // the top of a bar: the harmony, and who is in and who is out. the fades take a bar or two
      const set = (g, v, tc = 2.2) => g.gain.setTargetAtTime(v, t, tc);
      set(beat, quiet ? 0 : b < 4 || b >= 54 ? 0.55 : 0.9); set(pad, quiet ? 0.5 : 0.8);
      swell(t, ch.slice(1), m.len * S); low(t, ch[0], 2.6, 0.2);
      drone(t, m.len * S, quiet ? 0.085 : 0.05, b % 8 > 5 || quiet);
      if (calm(b + 1) && !quiet) rush(t, m.len * S);
      if (b % 8 === 7) osc('sine', hz(82), t, 5, env(t, 0.007, 2, 2, far, 1)).detune.linearRampToValueAtTime(-30, t + 5);   // over the last chord, a half step above its root, sagging
      if (b % 4 === 0 && saw(b)) sing(t, b);
      if ([0, 7, 22, 37, 39, 54].includes(b)) bell(t + 1.1, 81);
      if (b === 18 || b === 45) train(t);
      if ([8, 26, 40].includes(b)) distant(banjo, t, 2 ** (-2 / 12), 1500, 0.16, 5, 10);
      if (b === 33 || b === 53) distant(crowd[b === 33 ? 0 : 1], t, 1, 2600, 0.75, 2.5, 4);
      if (b % 2 === 0 && !quiet) { twang(t, ch[0] + 12, 0.16); twang(t + 6 * S, ch[0] + 19, 0.1); twang(t + 12 * S, ch[0] + 22, 0.12); }   // root, fifth, and up to the seventh, left hanging
      if (b % 4 === 2 || quiet) { vibe(t + 4 * S, ch[3] + 12); vibe(t + 11 * S, ch[4] + 12); }
    }
    if (s === m.dum[1]) low(t, ch[0], 0.9, 0.14);
    if (m.dum.includes(s)) kick(t + human, s ? 0.5 : 0.8);
    if (m.tek.includes(s)) brush(t + human);
    if (m === FOUR && (s === 4 || s === 12) && snaps(b) && !quiet) snap(t + 0.01);                            // fingers, on two and four
    if (quiet && [0, 3].includes(s % 8)) thump(t, s % 8 ? 0.2 : 0.3);
    if (m.pulse.includes(s)) tick(t, s ? 0.035 : 0.06);
    if (b % 8 === 7 && !quiet && [10, 12, 14].includes(s)) knock(t, 0.35);
    if (rnd(n * 3.1) < (quiet || b < 4 ? 0.07 : 0.012)) drip(t + rnd(n) * S, rnd(n * 7));
    // the crickets keep their own time and take no notice of the beat. each has its own pace and falls silent now and then, and the whole lot of them come up and die away on a long slow turn of their own
    const T = n * S, L = STEPS * S, w = (k) => Math.sin((TAU * k * T) / L + k);
    night.gain.setTargetAtTime(Math.max(0, Math.min(1, 0.6 * w(3) + 0.6 * w(5) - 0.1)), t, 1.5);
    for (let k = 0; k < 3; k++) for (let P = [0.61, 0.83, 0.47][k], c = Math.ceil(T / P); c * P < T + S; c++) if (rnd(k * 17 + ((c * P) / 7 | 0)) > 0.3) chirp(t + c * P - T + rnd(c + k) * 0.03, k);
  };
}

// --- the live player. a browser will not make a sound until the page has been clicked, so everything waits for the first click
const KEY = 'cryptomnesia-music';
let ctx, master, step, timer = 0, at = 0, n = 0;
export const wanted = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
const wake = () => {
  if (!ctx) {
    ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0;
    const squash = ctx.createDynamicsCompressor(); master.connect(squash).connect(ctx.destination);
    step = band(ctx, master);
  }
  if (ctx.state === 'suspended') ctx.resume();
};
const play = (on) => {
  master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, on ? 1.5 : 0.25);
  if (on && !timer) { at = Math.max(at, ctx.currentTime + 0.1); timer = setInterval(() => { for (; at < ctx.currentTime + 2.5; at += S, n = (n + 1) % STEPS) step(n, at); }, 100); }   // it picks up where it left off. it is written out two and a half seconds ahead, because a tab nobody is looking at is only let run once a second, and it plays on there
  if (!on) { clearInterval(timer); timer = 0; }
};
// turn the music on or off, and remember which. the click that asked for it is what lets it start
export function music(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private window */ } wake(); play(on); }
// every click on something that does something gets a clean small click of its own, music or no music
const click = () => {
  const t = ctx.currentTime, g = ctx.createGain(), o = ctx.createOscillator();
  o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.02);
  g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.04);
};
addEventListener('click', (e) => {
  wake();
  if (e.target.closest?.('button, a, [role="button"]')) click();
  if (wanted() && !timer) play(true);
}, true);
