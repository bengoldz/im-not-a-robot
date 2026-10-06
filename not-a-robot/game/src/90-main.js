// ===== 90-main.js: per-frame update, loop, dev hooks (window.DEV, #round=…&d=…&seed=…) =====
function update(dt) {
  if (hitstopT > 0) { hitstopT -= dt; return; }   // freeze frame; inputs stay buffered for the next frame
  time += dt;
  shakeT = Math.max(0, shakeT - dt);
  if (toast.t > 0) toast.t -= dt;
  if (bot.sayT > 0 && bot.sayT < 90) bot.sayT -= dt;
  if (bot.moodT > 0) { bot.moodT -= dt; if (bot.moodT <= 0 && mode !== 'title') bot.mood = 'neutral'; }
  bot.bounce = Math.max(0, bot.bounce - dt * 3);
  updateTweens(dt); updateTimers();
  updateCat(dt); updateEntities(dt);
  if (mode === 'play') updateRound(dt);
  if (R && inRound()) { const n0 = Math.floor(R.typeT * 70); R.typeT += dt; const n1 = Math.floor(R.typeT * 70), L = R.l1.length + R.big.length; if (!REDUCED && n1 !== n0 && n0 < L && n0 % 3 === 0) SFX.type(); }
  if (RUN && !RUN.over && mode !== 'title') RUN.elapsed += dt;
  if (mode === 'verifying') updateVerify(dt);
  if (mode === 'result') { RES.t += dt; if (RES.t > 3.4 || (RES.t > 1.1 && anyPressed)) endResult(); }
  if (mode === 'denied' || mode === 'win') endT += dt;
  if (R && R.tiles) {
    const shrink = R.def.selShrink != null ? R.def.selShrink : 0.82;
    for (const t of R.tiles) {
      t.sa += ((t.sel ? shrink : 1) - t.sa) * Math.min(1, dt * 14);
      if (t.state === 'crumble') { t.t -= dt; if (t.t <= 0) { t.state = 'gone'; t.t = 0; SFX.crumble(); } }
      else if (t.state === 'gone') t.t += dt;
    }
  }
  updateParts(dt); updateStamps(dt);
  try { musicTick(); } catch (e) {}
  for (const k in pressed) pressed[k] = false; anyPressed = false;
}

// ===== Loop =====
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); render(); requestAnimationFrame(frame);
}

// ===== Dev hooks =====
// DEV.play('lights', 0.6, 42)  jump straight into one round (a 1-round run; pass -> ACCESS GRANTED, fail -> DENIED)
// DEV.run(seed)                 start a full 12-round run with that seed;  DEV.makeRun(seed) -> slots without starting
// DEV.state()                   JSON snapshot (mode, round, tiles, cat, run, last result)
// DEV.warp(cell)                put the cat on a cell;  DEV.foot(cell) -> {x,y} where the cat stands on that cell
window.DEV = {
  play(id, d = 0.5, seed, intro = false) {
    if (!ROUNDS[id]) throw new Error('unknown round type: ' + id + ' (have: ' + Object.keys(ROUNDS).join(', ') + ')');
    if (seed == null) seed = (Math.random() * 1e9) >>> 0;
    d = clamp(+d, 0, 1);
    newRun({ seed, slots: [{ i: 0, id, d, genD: intro ? 0 : d, intro: !!intro, seed: hashSeed(seed, 'slot', 0, id), prep: null }], daily: false, day: 0, dev: true });
    return DEV.state();
  },
  run(seed, opts = {}) { startRun(Object.assign({ seed: seed == null ? undefined : seed }, opts)); return DEV.state(); },
  daily() { startRun({ daily: true }); return DEV.state(); },
  makeRun(seed) { return makeRun(seed).slots.map(s => ({ id: s.id, d: s.d, genD: s.genD, intro: s.intro })); },
  types() { return Object.values(ROUNDS).map(t => ({ id: t.id, name: t.name, minD: t.minD, weight: t.weight, maxPerRun: t.maxPerRun, boss: !!t.boss, hidden: !!t.hidden })); },
  title() { toTitle(); return DEV.state(); },
  warp(i) { catToCell(i, true); if (!isStepMode()) cat.cell = i; return DEV.state().cat; },
  foot(i) { return cellFoot(i); },
  state() {
    const T = R && R.tiles ? R.tiles.map(t => { const o = {}; for (const k of ['icon', 'sel', 'faceDown', 'word', 'pipe', 'rot', 'wall', 'push', 'empty', 'lit', 'state']) if (t[k] !== undefined && t[k] !== false) o[k] = t[k]; return o; }) : null;
    return {
      mode, roundIdx, verified, strikes, time,
      run: RUN && { seed: RUN.seed, daily: RUN.daily, day: RUN.day, dev: !!RUN.dev, perfects: RUN.perfects, streak: RUN.streak, elapsed: RUN.elapsed, results: RUN.results,
        slots: RUN.slots.map(s => ({ id: s.id, d: s.d, genD: s.genD, intro: s.intro })) },
      round: R && { id: R.id, d: R.d, intro: R.intro, slot: R.slot, cols: G.cols, rows: G.rows, l1: R.l1, big: R.big, l3: R.l3,
        progress: R.def.progress ? R.def.progress(R) : null, par: R.par, stats: R.stats, timeLeft: R.timeLeft, limit: R.limit, verify: R.def.verify, move: R.def.move,
        tiles: T, selected: selected(), solution: R.solution || null, ents: (R.ents || []).map(e => ({ cell: e.cell, x: e.x, y: e.y })) },
      grid: { x: G.x, y: G.y, w: G.w, h: G.h, pitch: G.pitch, ts: G.ts },
      cat: { x: cat.x, y: cat.y, cell: catCell(), moving: !!cat.mv, pad: cat.pad },
      verify: V && { phase: V.phase, async: V.async },
      res: RES && { pass: RES.pass, verdict: RES.verdict, perfect: RES.perfect, wrong: RES.wrong },
    };
  },
};
function parseHash() {
  const h = decodeURIComponent((location.hash || '').slice(1)); if (!h) return;
  try {
    if (h.includes('=')) {
      const q = new URLSearchParams(h), id = q.get('round');
      if (id) DEV.play(id, q.get('d') != null ? +q.get('d') : 0.5, q.get('seed') != null ? +q.get('seed') : undefined, q.get('intro') === '1');
      else if (q.get('run') != null) DEV.run(+q.get('run'));
    } else {
      const p = h.split(/[-_,]/);   // bare token form: #lights or #lights-0.6-42 (only bare #tokens reach the artifact viewer)
      if (p[0] === 'daily') DEV.daily();
      else if (p[0] === 'run' && p[1]) DEV.run(+p[1]);
      else if (ROUNDS[p[0]]) DEV.play(p[0], p[1] ? +p[1] : 0.5, p[2] ? +p[2] : undefined);
    }
  } catch (e) { console.warn('bad dev hash', h, e); }
}

// ===== Boot =====
say(pick(LINES.title), 'sad', 99);
toTitle();
parseHash();
addEventListener('hashchange', parseHash);
requestAnimationFrame(frame);
