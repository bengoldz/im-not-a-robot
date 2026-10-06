// ===== 20-juice.js: easing, tweens, timers, particles, hitstop, shake budget, tile juice, stamps, sfx palette, music =====
// Everything here runs on GAME time (paused during hitstop). Rounds should use these helpers instead of rolling their own.

// ---------- easing ----------
const EASE = {
  linear: t => t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  spring: t => t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * Math.PI * 2.5),   // overshoots ~8%, settles at 1
};

// ---------- tweens ----------
// tween(obj, { prop: to, prop2: [k0, k1, k2] }, dur, { ease, delay, done, from })
//   - a number animates from the current value to `to`; an array is a keyframe list (piecewise-linear over the eased progress)
//   - starting a tween on obj+prop replaces any running tween of that prop
//   - returns a handle { stop() }
const tweens = [];
function tween(obj, to, dur, opts = {}) {
  const props = Object.keys(to);
  for (const tw of tweens) if (tw.obj === obj && !tw.dead) { for (const p of props) delete tw.to[p]; if (!Object.keys(tw.to).length) tw.dead = true; }
  const tw = { obj, to: Object.assign({}, to), from: {}, dur: Math.max(1e-4, dur), t: -(opts.delay || 0), started: false,
    ease: typeof opts.ease === 'function' ? opts.ease : EASE[opts.ease || 'outCubic'], done: opts.done, fromOpt: opts.from };
  tw.stop = () => { tw.dead = true; };
  tweens.push(tw); return tw;
}
function killTweens(obj) { for (const tw of tweens) if (tw.obj === obj) tw.dead = true; }
function updateTweens(dt) {
  for (let i = 0; i < tweens.length; i++) {
    const tw = tweens[i]; if (tw.dead) continue;
    tw.t += dt; if (tw.t < 0) continue;
    if (!tw.started) { tw.started = true; for (const p in tw.to) tw.from[p] = tw.fromOpt && p in tw.fromOpt ? tw.fromOpt[p] : (Array.isArray(tw.to[p]) ? tw.to[p][0] : tw.obj[p]); }
    const k = Math.min(1, tw.t / tw.dur), e = tw.ease(k);
    for (const p in tw.to) {
      const v = tw.to[p];
      if (Array.isArray(v)) { const s = e * (v.length - 1), j = clamp(Math.floor(s), 0, v.length - 2); tw.obj[p] = lerp(v[j], v[j + 1], s - j); }
      else tw.obj[p] = lerp(tw.from[p], v, e);
    }
    if (k >= 1) { tw.dead = true; for (const p in tw.to) { const v = tw.to[p]; tw.obj[p] = Array.isArray(v) ? v[v.length - 1] : v; } if (tw.done) tw.done(); }
  }
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].dead) tweens.splice(i, 1);
}

// ---------- timers (game time) ----------
// after(seconds, fn) -> handle { cancel() }. Timers belonging to a round are cancelled when the next round begins (R.timers).
const timers = [];
function after(sec, fn) { const t = { at: time + sec, fn, round: R }; t.cancel = () => { t.dead = true; }; timers.push(t); return t; }
function updateTimers() {
  for (let i = 0; i < timers.length; i++) { const t = timers[i]; if (!t.dead && time >= t.at) { t.dead = true; try { t.fn(); } catch (e) { console.error(e); } } }
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].dead) timers.splice(i, 1);
}
function clearRoundTimers() { for (const t of timers) if (t.round) t.dead = true; }

// ---------- hitstop ----------
let hitstopT = 0;
function hitstop(ms = 60) { hitstopT = Math.max(hitstopT, ms / 1000); }

// ---------- screen shake (BUDGET ENFORCED) ----------
// Allowed reasons: 'fail' (failed verify) and 'denied' (ACCESS DENIED). Max 6 px, 0.25 s, never under reduced motion.
// Do not add other callers: selection / pushes / pops / success use squash, flashes and particles instead.
let shakeT = 0, shakeA = 0;
const SHAKE_REASONS = ['fail', 'denied'], SHAKE_MAX = 6, SHAKE_DUR = 0.25;
function shake(amount, reason) {
  if (REDUCED || !SHAKE_REASONS.includes(reason)) return false;
  shakeA = Math.min(SHAKE_MAX, amount); shakeT = SHAKE_DUR; return true;
}
function shakeOffset() { if (shakeT <= 0) return [0, 0]; const k = shakeT / SHAKE_DUR; return [rnd(-1, 1) * shakeA * k, rnd(-1, 1) * shakeA * k * 0.5]; }

// ---------- particles ----------
// kinds: (default) square with gravity, 'dot' ring-burst dot, 'puff' dust, 'check' / 'paw' confetti, text
function addP(x, y, n, col, sp = 120, life = 0.6, sz = 4) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(sp * 0.3, sp); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life, max: life, col, sz }); } }
function addTxt(x, y, text, col = C.blue) { parts.push({ x, y, vx: 0, vy: -40, life: 1.1, max: 1.1, text, col }); }
// ring burst: n dots flying out evenly (no gravity, drag), UI blue by default
function burst(x, y, col = C.blue, n = 7, speed = 150, size = 4) {
  const a0 = rnd(0, 6.28);
  for (let i = 0; i < n; i++) { const a = a0 + i * Math.PI * 2 / n; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.38, max: 0.38, col, sz: size, drag: 7 }); }
}
// soft dust puffs (walking fast, landing, pushed tiles)
function dust(x, y, n = 4, spread = 14, col = '#d6dcea') {
  for (let i = 0; i < n; i++) parts.push({ kind: 'puff', x: x + rnd(-spread, spread) * 0.5, y: y + rnd(-3, 3), vx: rnd(-spread, spread) * 2.2, vy: rnd(-20, -4), life: rnd(0.3, 0.45), max: 0.45, col, sz: rnd(4, 7), drag: 4 });
}
// confetti of little checkmarks and paw prints falling from the header
function confetti(n = 34) {
  const cols = [C.green, C.blue, C.gold, C.cat, '#ff7ab0'];
  for (let i = 0; i < n; i++) parts.push({ kind: i % 3 ? 'check' : 'paw', x: rnd(HEAD.x + 20, HEAD.x + HEAD.w - 20), y: HEAD.y + HEAD.h - rnd(0, 30), vx: rnd(-40, 40), vy: rnd(20, 120),
    life: rnd(1.3, 2), max: 2, col: pick(cols), sz: rnd(7, 11), rot: rnd(-1, 1), vr: rnd(-4, 4), sway: rnd(0, 6.28), g: 120 });
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'check' || p.kind === 'paw') { p.vy += p.g * dt; p.vy = Math.min(p.vy, 150); p.rot += p.vr * dt; p.x += Math.sin(time * 3 + p.sway) * 20 * dt; }
    else if (!p.text && !p.kind) p.vy += 300 * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
function drawParts() {
  for (const p of parts) {
    const a = Math.max(0, Math.min(1, p.life / p.max)); ctx.globalAlpha = a;
    if (p.text) { ctx.font = `700 16px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.textAlign = 'center'; ctx.strokeText(p.text, p.x, p.y); txt(p.text, p.x, p.y, 16, p.col, 'center', 700); }
    else if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (0.4 + 0.6 * a), 0, 7); ctx.fillStyle = p.col; ctx.fill(); }
    else if (p.kind === 'puff') { ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (1.6 - a * 0.6), 0, 7); ctx.fillStyle = p.col; ctx.fill(); }
    else if (p.kind === 'check') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ln(ctx, [[-p.sz * 0.5, 0], [-p.sz * 0.15, p.sz * 0.4], [p.sz * 0.55, -p.sz * 0.45]], 3, p.col); ctx.restore(); }
    else if (p.kind === 'paw') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; const s = p.sz / 10;
      ctx.beginPath(); ctx.ellipse(0, 2 * s, 4 * s, 3.4 * s, 0, 0, 7); ctx.fill(); for (const [x, y] of [[-4.4, -2.6], [-1.5, -5], [1.5, -5], [4.4, -2.6]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 1.6 * s, 0, 7); ctx.fill(); } ctx.restore(); }
    else { ctx.fillStyle = p.col; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
  }
  ctx.globalAlpha = 1;
}

// ---------- per-tile juice ----------
// Every tile has t.fx = { sq, sx, ox, oy, rot, flash, flashCol, wig, chk, flip, before, glow } (see 40-grid.js for how it is drawn).
function tileFx(t) { return t.fx || (t.fx = { sq: 1, ox: 0, oy: 0, rot: 0, flash: 0, flashCol: C.green, wig: 0, chk: 1, flip: 0, before: null, pop: 0 }); }
function tileSquash(t, lo = 0.92, hi = 1.04, dur = 0.2) { tween(tileFx(t), { sq: [lo, hi, 1] }, dur, { ease: 'outBack' }); }
function tileFlash(t, col = C.green, dur = 0.35) { const f = tileFx(t); f.flashCol = col; f.flash = 1; tween(f, { flash: 0 }, dur, { ease: 'outQuad' }); }
function tileWiggle(t, dur = 0.35) { const f = tileFx(t); f.wig = 0; tween(f, { wig: 1 }, dur, { ease: 'linear', done: () => { f.wig = 0; } }); }
// flip the tile over (scaleX 1 -> 0 -> 1). Until the midpoint the tile is drawn with the fields in `before` overriding its own
// (e.g. { faceDown: true } for the round-start wave, or { sel: wasSel } so a toggle visibly flips from the old state).
function tileFlip(t, { delay = 0, dur = 0.28, before = null } = {}) { const f = tileFx(t); f.before = before; f.flip = 1; tween(f, { flip: 0 }, dur, { delay, ease: 'inOutSine', done: () => { f.before = null; } }); }
// slide in from a pixel offset (used by pushTile / swapCells)
function tileSlide(t, ox, oy, dur = 0.14) { const f = tileFx(t); f.ox = ox; f.oy = oy; tween(f, { ox: 0, oy: 0 }, dur, { ease: 'outCubic' }); }
// rotate with a spring overshoot from `fromRad` (relative) to 0 — e.g. pipes: t.rot++ then tileSpin(t, -Math.PI / 2)
function tileSpin(t, fromRad, dur = 0.32) { const f = tileFx(t); f.rot = fromRad; tween(f, { rot: 0 }, dur, { ease: 'spring' }); }
function tilePop(t) { tween(tileFx(t), { sq: [1, 1.12, 1] }, 0.22, { ease: 'outQuad' }); }

// ---------- stamps (big VERIFIED / PERFECT labels that slam in) ----------
const stamps = [];
function stamp(text, col, { x = 480, y = 222, size = 34, rot = -0.08, life = 3, sub = '' } = {}) {
  const s = { text, col, x, y, size, rot, t: 0, life, sub, k: 2.2, sx: 1, sy: 1 };
  tween(s, { k: 1 }, 0.22, { ease: 'inCubic', done: () => { s.sx = 1.18; s.sy = 0.82; tween(s, { sx: 1, sy: 1 }, 0.3, { ease: 'outBack' }); SFX.stamp(); } });
  stamps.push(s); return s;
}
function updateStamps(dt) { for (let i = stamps.length - 1; i >= 0; i--) { stamps[i].t += dt; if (stamps[i].t > stamps[i].life) stamps.splice(i, 1); } }
function clearStamps() { stamps.length = 0; }
function drawStamps() {
  for (const s of stamps) {
    const a = Math.min(1, (s.life - s.t) * 4, s.t * 12); if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.k * s.sx, s.k * s.sy);
    ctx.font = `700 ${s.size}px ${FONT}`; const w = ctx.measureText(s.text).width + 34, h = s.size + 18;
    ctx.fillStyle = '#ffffffd8'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = s.col; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 7); ctx.stroke();
    txt(s.text, 0, 1, s.size, s.col, 'center', 700);
    if (s.sub) txt(s.sub, 0, h / 2 + 14, 14, s.col, 'center', 600);
    ctx.restore();
  }
}

// ---------- cat + robot feedback ----------
function catExclaim(dur = 0.8) { cat.excl = dur; SFX.tick(); }   // "!" over the cat (new mechanic / surprise)
function botWiggle() { bot.wig = 1; tween(bot, { wig: 0 }, 0.9, { ease: 'linear' }); }

// ---------- sfx palette: soft sine/triangle, short envelopes, low master volume ----------
const SCALE = [0, 2, 4, 5, 7, 9, 11];                 // major scale steps (do re mi fa so la ti)
const noteHz = (step, base = 523.25) => base * Math.pow(2, (SCALE[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)) / 12);
const SFX = {
  hop: () => tone(420, 0.12, 'triangle', 0.05, 260),
  land: () => { tone(150, 0.07, 'sine', 0.07); noise(0.05, 0.025, 0, 700); },
  dash: () => { noise(0.16, 0.05, 0, 1800); tone(520, 0.12, 'sine', 0.03, -260); },
  step: () => tone(220 + Math.random() * 40, 0.03, 'triangle', 0.015),
  pop: (k = 0) => { const f = noteHz(k); tone(f, 0.11, 'sine', 0.07); tone(f * 2, 0.07, 'triangle', 0.018, 0, 0.005); },   // selection: do-re-mi per selection
  sel: () => SFX.pop(0),
  desel: () => tone(520, 0.1, 'sine', 0.05, -180),
  pad: () => tone(660, 0.08, 'triangle', 0.06, 200),
  tick: () => tone(1400, 0.025, 'sine', 0.02),
  type: () => tone(1800 + Math.random() * 300, 0.012, 'sine', 0.008),
  chime: (k = 0) => { const f = noteHz(k + 2, 659.25); tone(f, 0.22, 'sine', 0.05); tone(f * 3, 0.12, 'sine', 0.008); },   // verify sweep: rising
  bonk: () => { tone(150, 0.2, 'sine', 0.09, -60); tone(225, 0.12, 'triangle', 0.03, -80); },
  pass: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(f, 0.24, 'sine', 0.05, 0, i * 0.07); tone(f / 2, 0.2, 'triangle', 0.02, 0, i * 0.07); }),
  perfect: () => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, 0.3, 'sine', 0.03, 0, i * 0.05)),
  fail: () => { tone(260, 0.3, 'triangle', 0.06, -60); tone(196, 0.4, 'triangle', 0.05, -40, 0.14); },
  stamp: () => { tone(90, 0.14, 'sine', 0.12, -30); noise(0.06, 0.04, 0, 900); },
  thock: () => { tone(190, 0.07, 'triangle', 0.08, -40); noise(0.04, 0.05, 0, 1200); },   // wooden push
  toggle: (k = 0) => tone(noteHz(k, 392), 0.09, 'triangle', 0.05),
  chord: () => [261.63, 329.63, 392, 493.88].forEach((f, i) => tone(f, 0.9, 'sine', 0.03, 0, i * 0.03, 0.03)),
  crumble: () => noise(0.25, 0.05, 0, 900),
  fall: () => tone(700, 0.6, 'sine', 0.06, -600),
  meow: () => { tone(500, 0.12, 'triangle', 0.05, 300); tone(800, 0.3, 'triangle', 0.05, -450, 0.11); },
  beep: () => { tone(990, 0.06, 'sine', 0.05); tone(660, 0.08, 'sine', 0.05, 0, 0.08); },
  whoosh: () => noise(0.25, 0.03, 0, 0, 1200),
};

// ---------- music: soft 2-chord loop, one more layer every 3 rounds; starts after the first keypress ----------
let musicOn = true, musicNext = 0, musicBeat = 0, MUSIC = null;
const MUSIC_BPM = 84, MUSIC_CHORDS = [[48, 55, 64, 71], [53, 57, 60, 64]];   // Cmaj7, Fmaj7 (midi)
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
function musicStart() { if (!AC || MUSIC) return; MUSIC = AC.createGain(); MUSIC.gain.value = 0.5; MUSIC.connect(MASTER); musicNext = AC.currentTime + 0.1; musicBeat = 0; }
function musicLayers() { return mode === 'play' || mode === 'verifying' || mode === 'result' ? 1 + Math.floor(roundIdx / 3) : 1; }
function musicTick() {
  if (!AC || !MUSIC || AC.state !== 'running') return;
  MUSIC.gain.value = musicOn ? 0.5 : 0;
  const spb = 60 / MUSIC_BPM / 2;   // eighth notes
  while (musicNext < AC.currentTime + 0.25) {
    const b = musicBeat, chord = MUSIC_CHORDS[Math.floor(b / 16) % 2], t = musicNext - AC.currentTime, L = musicLayers();
    if (musicOn) {
      if (b % 16 === 0) chord.forEach(m => tone(midiHz(m), spb * 16, 'sine', 0.012, 0, t, 0.5, MUSIC));                 // pad
      if (L >= 2 && b % 4 === 0) tone(midiHz(chord[0] - 12), spb * 3, 'triangle', 0.03, 0, t, 0.02, MUSIC);            // bass
      if (L >= 3 && b % 2 === 0) tone(midiHz(chord[(b / 2) % 4] + 12), spb * 1.6, 'sine', 0.012, 0, t, 0.01, MUSIC);     // arp
      if (L >= 4 && b % 4 === 2) noise(0.04, 0.012, t, 0, 6000, MUSIC);                                                 // soft hat
    }
    musicBeat++; musicNext += spb;
  }
}
