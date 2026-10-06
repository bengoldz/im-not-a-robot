// ===== 00-core.js: constants, layout, utils, seeded RNG, input, audio core, shared game state =====
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = 960, H = 540;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = 'Fredoka, "Trebuchet MS", system-ui, sans-serif';
const PIX = 'VT323, "Courier New", monospace';
const C = { navy:'#0f1630', navy2:'#1b2547', panel:'#f7f9fc', line:'#d5dbe6', blue:'#2f6fe4', blueD:'#1f4fb0',
  green:'#22b573', red:'#e5484d', ink:'#1d2433', grey:'#7b8597', cat:'#f39a33', catD:'#c4661a', catL:'#ffd9a8',
  bot:'#9fb6cc', botD:'#5d7590', screen:'#14202f', cyan:'#5ff3ff', gold:'#ffc93c' };
// Non-seeded helpers: for animation / particles / quips only. Puzzle GENERATION must use the rng it is given.
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cap = s => s[0].toUpperCase() + s.slice(1);
const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inR = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
let best = 0; try { best = +localStorage.getItem('notarobot.best12') || 0; } catch (e) {}

// ===== Seeded RNG =====
// mulberry32: tiny, fast, good enough for puzzles. makeRng(seed) returns a function () -> [0,1) with helpers.
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// hash any mix of numbers/strings into a 32-bit seed (FNV-1a)
function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) { const s = String(p) + '|'; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } }
  return h >>> 0;
}
function makeRng(seed) {
  const f = mulberry32(seed >>> 0), r = () => f();
  r.seed = seed >>> 0;
  r.f = (a = 0, b = 1) => a + f() * (b - a);                       // float in [a,b)
  r.int = (a, b) => a + Math.floor(f() * (b - a + 1));              // int in [a,b] inclusive
  r.pick = arr => arr[Math.floor(f() * arr.length)];
  r.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  r.chance = p => f() < p;
  r.sample = (arr, k) => r.shuffle(arr).slice(0, k);               // k distinct items
  r.weighted = (items, w) => { const ws = items.map(w), tot = ws.reduce((s, x) => s + x, 0); let u = f() * tot; for (let i = 0; i < items.length; i++) { u -= ws[i]; if (u < 0) return items[i]; } return items[items.length - 1]; };
  r.fork = (...tag) => makeRng(hashSeed(r.seed, ...tag));          // independent child stream
  return r;
}

// ===== Layout (logical 960x540 units) =====
const PANEL = { x: 270, y: 12, w: 420, h: 516 };
const HEAD = { x: 270, y: 12, w: 420, h: 84 };
const GRID = { x: 298, y: 104, w: 364, h: 364 };   // the box every round's grid is fitted into
const VERIFY = { x: 566, y: 480, w: 112, h: 42 };
const FOOTPADS = { reload: { x: 300, y: 501 }, audio: { x: 338, y: 501 }, info: { x: 376, y: 501 } };
const TPADS = { start: { x: 300, y: 128, w: 360, h: 108 }, daily: { x: 300, y: 256, w: 174, h: 100 },
  howto: { x: 486, y: 256, w: 174, h: 100 }, retry: { x: 300, y: 344, w: 360, h: 90 } };

// ===== Input =====
const KEYMAP = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
  Space:'hop', ShiftLeft:'dash', ShiftRight:'dash', KeyC:'sit', KeyX:'sit' };
const key = {}, pressed = {};
let lastInputT = 0, anyPressed = false, firstKey = false;
function onFirstInput() { audio(); if (!firstKey) { firstKey = true; try { musicStart(); } catch (e) {} } }
addEventListener('keydown', e => {
  const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); onFirstInput();
  if (!e.repeat) { pressed[k] = true; anyPressed = true; } key[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { key[k] = false; e.preventDefault(); } });
addEventListener('blur', () => { for (const k in key) key[k] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); onFirstInput(); if (!key[k]) { pressed[k] = true; anyPressed = true; } key[k] = true; b.classList.add('on'); };
  const off = e => { e.preventDefault(); key[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});

// ===== Audio core (soft palette lives in 20-juice.js) =====
let AC = null, MASTER = null;
const MASTER_VOL = 0.55;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); MASTER = AC.createGain(); MASTER.gain.value = MASTER_VOL; MASTER.connect(AC.destination); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
// one enveloped oscillator note: f Hz, d seconds, type sine|triangle, v peak gain, slide Hz (exp ramp), delay seconds, attack seconds
function tone(f, d, type = 'sine', v = 0.06, slide = 0, delay = 0, attack = 0.006, dest) {
  if (!AC) return; const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(dest || MASTER); o.start(t); o.stop(t + d + 0.03);
}
// filtered noise burst (lp = lowpass cutoff Hz, hp = highpass cutoff Hz)
function noise(d, v = 0.05, delay = 0, lp = 2400, hp = 0, dest) {
  if (!AC) return; const t = AC.currentTime + delay, len = Math.max(1, Math.floor(AC.sampleRate * d));
  const b = AC.createBuffer(1, len, AC.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter(); s.buffer = b; g.gain.value = v;
  f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || lp;
  s.connect(f); f.connect(g); g.connect(dest || MASTER); s.start(t);
}

// ===== Shared game state (declared here so every file can use it) =====
let mode = 'title';          // title | play | verifying | result | denied | win
let R = null;                // the current round instance (see 30-director.js)
let RUN = null;              // the current run (seed, slots, stats)
let V = null, RES = null;    // verify-in-progress / result being shown
let roundIdx = 0, verified = 0, strikes = 0;
let toast = { text: '', t: 0 }, howto = false, time = 0, endT = 0;
const parts = [];
const bot = { x: 135, y: 470, mood: 'sad', say: '', sayT: 0, moodT: 0, bounce: 0, wig: 0 };
const cat = { x: 480, y: 440, vx: 0, vy: 0, z: 0, hopT: 0, dashT: 0, dashCd: 0, hopBuf: 0, sitBuf: 0, sitT: 0, face: 1, sx: 1, sy: 1, walkT: 0, fall: 0, holeT: 0,
  pad: null, dir: { x: 1, y: 0 }, auto: 0, autoD: { x: 0, y: 0 }, cell: -1, mv: null, excl: 0, pushT: 0, pushCell: -1 };
const HOPD = 0.5;
