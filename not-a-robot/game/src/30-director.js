// ===== 30-director.js: round registry, runs (seeded), difficulty director, round lifecycle, verify flow, pads =====
// See game/API.md for the full contract. Summary of registerRound(def):
//   id, name, minD (0..1, earliest difficulty it may appear), weight (pick weight), maxPerRun (default 2),
//   boss (true = only ever the last slot), hidden (true = never picked by the director; DEV.play only),
//   intro (robot line on the first appearance), again (robot line(s) on later appearances),
//   move 'free' | 'step', verify 'pad' | 'auto' | 'both' | 'none', exitGrid (step mode: may the cat walk off the grid), hideBot, loaf,
//   timeoutVerdict, parTime(R),
//   generate(d, rng, info) -> spec           REQUIRED. Pure + seeded (use rng, never Math.random). Must be solvable.
//   prepare(slot, rng) -> Promise|value       optional, called while the PREVIOUS round plays; result arrives as info.prep
//   enter(R)                                  once, after the grid + tiles exist
//   update(R, dt)                             every frame while mode === 'play'
//   onSit(R, tile|null, info)                 cat sat down (tile null = not on a grid cell). Omit = default select toggle.
//   onStep(R, from, to, info)                 cat moved between cells (-1 = off grid). info = { dir:[dr,dc], how }
//   onHop(R, from, to, info)                  cat landed a hop. info = { dir, over }
//   canEnter(R, from, to, info) -> bool|undef  override whether the cat may enter cell `to` (undefined = default rules)
//   moveCat(R, from, dir, how) -> cells[]|{path, how}|null   step mode: override the path of one move (ice sliding etc.)
//   onPush(R, tile, from, to)                 a pushable tile was pushed
//   solved(R) -> bool                         for verify 'auto' / 'both'
//   judge(R) -> { pass, verdict, wrong?, checked?, banned? } | Promise of it
//   progress(R) -> string                     header readout, e.g. "Lights 18 / 25"
//   drawTile(R, g, tile, x, y, s) -> bool     custom tile face (return true = handled, false/undefined = default face)
//   drawUnder(R, g) / drawOverlay(R, g) / drawTop(R, g)   before tiles / after tiles (under the cat) / above the cat
//   onTimeout(R)                              timer ran out (default: fail with timeoutVerdict)
const ROUNDS = {};
const RUN_LEN = 12;
function registerRound(def) {
  if (!def || typeof def.id !== 'string' || typeof def.generate !== 'function') throw new Error('registerRound: needs id and generate()');
  if (ROUNDS[def.id]) console.warn('registerRound: replacing', def.id);
  ROUNDS[def.id] = Object.assign({ name: def.id, minD: 0, weight: 1, maxPerRun: 2, move: 'free', verify: 'pad', exitGrid: true, intro: '' }, def);
  return ROUNDS[def.id];
}

// ===== Robot friend lines =====
const LINES = {
  title: ['I just want to see the internet once. Please, kitty.', 'They say the internet is 70% cats. You will fit right in.', 'The gate says HUMANS ONLY. I am 0% human. You are 0% human. Together: still 0%.'],
  pass: ['We\'re in! Well. One square closer.', 'Beep! I mean... "hooray", as humans say.', 'Your paws are so convincing.', 'I felt that verification in my capacitors.', 'Human behavior detected. Excellent fraud.', 'The internet is RIGHT there. I can smell the memes.', 'My joy bar is at 100%. Do not tell anyone.', 'Good kitty. Most human kitty.'],
  fail: ['Oh no. They\'re onto us.', 'That\'s fine. I\'m fine. My fan is just loud.', 'Maybe it was a metaphor?', '*sad dial-up noises*', 'I\'ll wait out here. In the rain. Of static.', 'Strike! That is a sports word. Humans love sports.', 'We\'ll get it next time. Statistically. Eventually.', 'Error 404: hope not found. Rebooting hope...'],
  again: ['This one again! You know the drill. The drill is squares.', 'Round two of this. Same rules, more squares.', 'Again! I believe in your paws.'],
  denied: 'ACCESS DENIED. I will go back to being a toaster.', win: 'I\'M ON THE INTERNET! ...it\'s all cats. Of course it is.',
};
function say(text, mood, d = 4.5) { bot.say = text; bot.sayT = d; if (mood) { bot.mood = mood; bot.moodT = d; } bot.bounce = 1; }
function toastMsg(t, d = 2.6) { toast.text = t; toast.t = d; }

// ===== Runs =====
// Daily seed: everyone gets the same run on the same (local) date. Day #1 = 2026-01-01.
function dailyInfo(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate(), key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { seed: hashSeed('daily', key), day: Math.floor((Date.UTC(y, m, d) - Date.UTC(2026, 0, 1)) / 864e5) + 1, key };
}
// Pure: the same seed always gives the same slots. Rules (DESIGN §1): d = i/11 ± 0.08; minD/weight picking; no type twice in a
// row; max maxPerRun per run (match 3); first appearance = intro (generated at d 0); last slot = boss; >= 1 absurd in slots 3..8.
function makeRun(seed, opts = {}) {
  seed = seed >>> 0;
  const rng = makeRng(hashSeed(seed, 'director')), len = opts.len || RUN_LEN;
  const all = Object.values(ROUNDS), pool = all.filter(t => !t.boss && !t.hidden && t.weight > 0), boss = all.find(t => t.boss && !t.hidden);
  const ab = ROUNDS.absurd && !ROUNDS.absurd.hidden ? ROUNDS.absurd : null;
  const absurdSlot = ab && len >= 10 ? rng.int(3, 8) : -1;
  const slots = [], counts = {}; let prev = null;
  for (let i = 0; i < len; i++) {
    const d = clamp((len > 1 ? i / (len - 1) : 0) + rng.f(-0.08, 0.08), 0, 1);
    let id;
    if (i === len - 1 && boss) id = boss.id;
    else if (i === absurdSlot) id = ab.id;
    else {
      const ok = (t, relax) => t.id !== prev && (relax >= 1 || t.minD <= d + 1e-9) && (relax >= 2 || (counts[t.id] || 0) < t.maxPerRun)
        && !(t === ab && (i === absurdSlot - 1 || i === absurdSlot + 1 || (i < absurdSlot && (counts[t.id] || 0) >= t.maxPerRun - 1)));
      let cands = [];
      for (let relax = 0; relax < 3 && !cands.length; relax++) {
        cands = pool.filter(t => ok(t, relax));
        if (relax >= 1 && cands.length) { const lo = Math.min(...cands.map(t => t.minD)); cands = cands.filter(t => t.minD <= lo + 1e-9); }   // nothing fits: the gentlest types only
      }
      if (!cands.length) cands = pool.filter(t => t.id !== prev);
      if (!cands.length) cands = pool;
      id = rng.weighted(cands, t => t.weight).id;
    }
    const intro = !counts[id], def = ROUNDS[id];
    counts[id] = (counts[id] || 0) + 1;
    const dr = Math.round(d * 1000) / 1000;
    slots.push({ i, id, d: dr, genD: intro && !def.boss ? 0 : dr, intro, seed: hashSeed(seed, 'slot', i, id), prep: null });
    prev = id;
  }
  return { seed, slots, daily: !!opts.daily, day: opts.day || 0 };
}
function newRun(run) {
  RUN = Object.assign(run, { perfects: 0, streak: 0, bestStreak: 0, results: [], usedAbsurd: [], elapsed: 0, over: false });
  verified = 0; strikes = 0; parts.length = 0;
  beginRound(0);
}
function startRun(opts = {}) {
  let seed = opts.seed, day = 0;
  if (opts.daily) { const di = dailyInfo(); seed = di.seed; day = di.day; }
  if (seed == null) seed = (Math.random() * 4294967296) >>> 0;
  newRun(makeRun(seed, { daily: !!opts.daily, day }));
}

// ===== Round lifecycle =====
function buildRound(def, spec, slot, rng) {
  const R = Object.assign({}, spec);
  R.def = def; R.kind = R.id = def.id; R.d = slot.genD; R.dTarget = slot.d; R.intro = !!slot.intro; R.slot = slot.i;
  R.rng = rng.fork('runtime');   // seeded randomness for runtime behaviour (enemy moves etc.)
  R.l1 = spec.l1 != null ? spec.l1 : 'Select all squares with'; R.big = spec.big || ''; R.l3 = spec.l3 || '';
  R.limit = spec.limit || 0; R.timeLeft = R.limit;
  R.stats = { t: 0, sits: 0, steps: 0, hops: 0, dashes: 0, pushes: 0 };
  R.selN = 0; R.ents = []; R.typeT = 0; R.solvedT = 0; R.entered = false;
  const cols = spec.cols != null ? spec.cols : spec.grid || 0, rows = spec.rows != null ? spec.rows : cols;
  setGrid(cols, rows, spec.margin);
  R.cols = G.cols; R.rows = G.rows;
  R.par = typeof spec.par === 'number' ? { time: spec.par } : spec.par ? Object.assign({}, spec.par) : { time: def.parTime ? def.parTime(R) : Math.round(14 + 12 * R.d) };
  R.tiles = [];
  for (let i = 0; i < G.cols * G.rows; i++) R.tiles.push(makeTile(spec.tiles && spec.tiles[i], i));
  return R;
}
function beginRound(i) {
  clearRoundTimers(); clearStamps();
  roundIdx = i;
  const slot = RUN.slots[i]; let def = ROUNDS[slot.id];
  const info = { intro: slot.intro, slot: i, d: slot.d, prep: slot.prep, run: RUN };
  let rng = makeRng(slot.seed), spec;
  try { spec = def.generate(slot.genD, rng, info) || {}; }
  catch (e) { console.error('generate failed for', slot.id, e); def = ROUNDS.match; rng = makeRng(slot.seed); spec = def.generate(slot.genD, rng, info); }
  R = buildRound(def, spec, slot, rng);
  mode = 'play'; V = null; RES = null;
  placeCat(440, 514);
  if (spec.catStart != null && spec.catStart >= 0) catToCell(spec.catStart, true);
  if (def.enter) def.enter(R);
  const line = slot.intro || def.boss || RUN.dev ? (def.intro || pick(LINES.again)) : (def.again ? (Array.isArray(def.again) ? pick(def.again) : def.again) : pick(LINES.again));
  say(line, def.mood || (def.boss ? 'nervous' : 'hopeful'), 5);
  // round transition: tiles flip over in a diagonal wave from the card back; the prompt types itself in
  const span = Math.max(1, G.cols + G.rows - 2);
  for (const t of R.tiles) tileFlip(t, { delay: (t.r + t.c) / span * 0.24, dur: 0.18, before: { faceDown: true } });
  if (G.cols) SFX.whoosh();
  // let the next slot prepare (slow precomputation) while this one plays
  const nx = RUN.slots[i + 1];
  if (nx && !nx.prep && ROUNDS[nx.id] && ROUNDS[nx.id].prepare) {
    Promise.resolve().then(() => ROUNDS[nx.id].prepare(nx, makeRng(nx.seed).fork('prep'))).then(p => { if (p != null) nx.prep = p; }).catch(() => {});
  }
}
function updateRound(dt) {
  R.stats.t += dt;
  if (R.limit) {
    R.timeLeft -= dt;
    if (R.timeLeft <= 0) { R.timeLeft = 0; if (R.def.onTimeout) R.def.onTimeout(R); else finish({ pass: false, verdict: R.def.timeoutVerdict || 'Verification expired. Too slow. Suspiciously slow.' }); return; }
  }
  if (R.def.update) R.def.update(R, dt);
  if (mode === 'play' && R.def.solved && (R.def.verify === 'auto' || R.def.verify === 'both')) {
    if (R.def.solved(R)) { R.solvedT += dt; if (R.solvedT > (R.def.autoDelay != null ? R.def.autoDelay : 0.35)) submit(); } else R.solvedT = 0;
  }
}

// ===== Verify flow =====
function normRes(r) {
  r = r || {};
  const pass = !!r.pass;
  return { pass, verdict: String(r.verdict || (pass ? 'Verified.' : 'Please try again.')), wrong: Array.isArray(r.wrong) ? r.wrong : [],
    checked: Array.isArray(r.checked) ? r.checked : null, banned: !!r.banned };
}
// walk onto VERIFY (verify 'pad'/'both') or auto-submit (verify 'auto'/'both' + solved()) -> judge -> tile sweep -> result
function submit() {
  if (mode !== 'play' || !R) return;
  let res;
  try { res = R.def.judge ? R.def.judge(R) : { pass: true, verdict: 'Verified.' }; }
  catch (e) { console.error('judge failed', e); res = { pass: false, verdict: 'HUMANCHECK tripped over its own paperwork.' }; }
  mode = 'verifying'; SFX.pad();
  V = { t: 0, phase: 'wait', min: 0, res: null, async: false, sweep: null };
  if (res && typeof res.then === 'function') {
    V.async = true; V.min = 0.6;
    res.then(r => { if (V && !V.res) V.res = normRes(r); }, () => { if (V && !V.res) V.res = normRes({ pass: false, verdict: 'The oracle is napping. Strike, unfortunately.' }); });
  } else V.res = normRes(res);
}
// end the round right now with a result (no verify pad): e.g. checkbox caught, timer ran out, cat fell
function finish(res) { if (mode !== 'play') return; mode = 'verifying'; V = { t: 0, phase: 'hold', min: 0.35, res: normRes(res), async: false, sweep: null }; }
function startSweep() {
  const res = V.res, N = R && R.tiles ? R.tiles.length : 0;
  let order = res.checked || [...new Set(selected().concat(res.wrong))];
  order = order.filter(i => i >= 0 && i < N).sort((a, b) => a - b);
  if (!order.length) { V.phase = 'hold'; V.t = 0; V.min = 0.25; return; }
  V.phase = 'sweep'; V.sweep = { order, wrong: new Set(res.wrong), k: 0, ok: 0, bad: 0, t: 0, step: Math.min(0.06, 1.1 / order.length) };
}
function updateVerify(dt) {
  V.t += dt;
  if (V.res && V.res.start) { if (Math.floor(V.t * 8) !== Math.floor((V.t - dt) * 8)) SFX.tick(); if (V.t >= V.min) { SFX.meow(); startRun({ daily: V.res.daily }); toastMsg('Suspicious paws detected. Additional verification required.', 3.5); } return; }
  if (V.phase === 'wait') { if (Math.floor(V.t * 8) !== Math.floor((V.t - dt) * 8)) SFX.tick(); if (V.res && V.t >= V.min) startSweep(); }
  else if (V.phase === 'hold') { if (V.t >= V.min) showResult(V.res); }
  else if (V.phase === 'sweep') {
    const S = V.sweep; S.t += dt;
    while (S.k < S.order.length && S.t >= S.k * S.step) {
      const i = S.order[S.k], t = R.tiles[i];
      if (S.wrong.has(i)) { tileFlash(t, C.red, 0.6); tileWiggle(t); if (S.bad++ < 3) SFX.bonk(); }
      else { tileFlash(t, C.green, 0.5); tileSquash(t, 0.95, 1.05, 0.18); SFX.chime(S.ok++); }
      S.k++;
    }
    if (S.k >= S.order.length && S.t >= S.order.length * S.step + 0.3) showResult(V.res);
  }
}
function withinPar(R) { for (const k in R.par) { const v = k === 'time' ? R.stats.t : R.stats[k]; if (v > R.par[k]) return false; } return true; }
function showResult(res) {
  mode = 'result';
  const perfect = res.pass && withinPar(R);
  RES = Object.assign({ t: 0, perfect }, res);
  RUN.results.push({ id: R.kind, pass: res.pass, perfect, t: Math.round(R.stats.t * 10) / 10, d: R.d });
  if (res.pass) {
    verified++; SFX.pass(); hitstop(60); confetti(); botWiggle();
    stamp('VERIFIED ✓', '#178a56', { y: 206 });
    say(pick(LINES.pass), 'happy', 4);
    if (perfect) {
      RUN.perfects++; RUN.streak++; RUN.bestStreak = Math.max(RUN.bestStreak, RUN.streak);
      after(0.45, () => { if (mode !== 'result') return; stamp('PERFECT', '#c98a00', { x: 590, y: 136, size: 20, rot: 0.12, life: 2.6 }); hitstop(60); SFX.perfect(); burst(590, 136, C.gold, 8, 180); });
    } else RUN.streak = 0;
  } else {
    strikes++; RUN.streak = 0; SFX.fail(); shake(6, 'fail');
    stamp(res.banned ? 'FRIEND BANNED' : 'PLEASE TRY AGAIN', C.red, { y: 206, size: 28, rot: -0.05 });
    say(res.banned ? 'BANNED?! I was being so quiet! I was a lamp!' : pick(LINES.fail), res.banned ? 'crying' : 'sad', 4);
  }
}
function endResult() {
  clearStamps();
  const last = roundIdx + 1 >= RUN.slots.length;
  if (strikes >= 3 || (last && RUN.dev && strikes > 0)) { mode = 'denied'; endT = 0; RUN.over = true; say(LINES.denied, 'crying', 99); SFX.fail(); shake(6, 'denied'); saveBest(); placeCat(480, 300); }
  else if (last) { mode = 'win'; endT = 0; RUN.over = true; say(LINES.win, 'ecstatic', 99); SFX.pass(); confetti(40); saveBest(); placeCat(480, 300); }
  else beginRound(roundIdx + 1);
}
function saveBest() { if (RUN.dev) return; if (verified > best) { best = verified; try { localStorage.setItem('notarobot.best12', best); } catch (e) {} } }
function toTitle() { mode = 'title'; R = null; RUN = null; setGrid(0, 0); placeCat(480, 440); }

// ===== Pads (things you walk onto) and sitting =====
function padAt() {
  const x = cat.x, y = cat.y;
  if (mode === 'title') { for (const k of ['start', 'daily', 'howto']) if (inR(x, y, TPADS[k])) return k; return null; }
  if (mode === 'denied' || mode === 'win') return inR(x, y, TPADS.retry) ? 'retry' : null;
  if (mode === 'play') {
    if (inR(x, y, VERIFY)) return 'verify';
    for (const k in FOOTPADS) if (Math.hypot(x - FOOTPADS[k].x, y - FOOTPADS[k].y) < 16) return k;
  }
  return null;
}
function enterPad(p) {
  if (!p) return;
  if (p === 'howto') { howto = !howto; SFX.pad(); }
  else if (p === 'start' || p === 'retry' || p === 'daily') { toastMsg(p === 'daily' ? `DAILY HUMANCHECK #${dailyInfo().day}: same squares for everyone today. SIT to begin.` : 'Now SIT on it (C or X). If it fits, I sits.'); SFX.tick(); }
  else if (p === 'verify') { if (R && R.def.verify !== 'pad' && R.def.verify !== 'both') { toastMsg('No verify button needed. Just be human.'); SFX.tick(); } else { const why = R && R.def.verifyBlocked && R.def.verifyBlocked(R); if (why) { toastMsg(why); SFX.tick(); } else submit(); } }
  else if (p === 'reload') { toastMsg('Reload denied. These are your squares now.'); SFX.desel(); }
  else if (p === 'audio') { musicOn = !musicOn; toastMsg('Audio challenge: "mrrrp?" Type what you heard. (You can\'t.)' + (musicOn ? ' Music: on.' : ' Music: off.')); SFX.meow(); }
  else if (p === 'info') { toastMsg('HUMANCHECK™ keeps the internet 100% robot-free since never.'); SFX.tick(); }
}
// the default "sit on a tile" behaviour: toggle its selection (with juice). Rounds with their own onSit can call this.
function defaultSit(R, tile) {
  if (!tile) { addTxt(cat.x, cat.y - 50, 'sat.', C.grey); return; }
  if (tile.state !== 'ok' && tile.state !== 'crumble') return;
  if (tile.wall || tile.empty || tile.noSelect) { addTxt(cat.x, cat.y - 50, 'sat.', C.grey); return; }
  selectTile(tile, !tile.sel);
}
function sitAction() {
  if (mode === 'title' && (cat.pad === 'start' || cat.pad === 'daily')) { SFX.sel(); mode = 'verifying'; V = { t: 0, phase: 'hold', min: 1.4, res: { start: true, daily: cat.pad === 'daily' }, async: false }; burst(cat.x, cat.y - 20, C.green, 8); return; }
  if ((mode === 'denied' || mode === 'win') && cat.pad === 'retry') { SFX.sel(); startRun(); return; }
  if (mode !== 'play' || !R) return;
  R.stats.sits++;
  const i = catCell(), tile = i >= 0 ? R.tiles[i] : null;
  if (R.def.onSit) R.def.onSit(R, tile, { x: cat.x, y: cat.y, cell: i });
  else defaultSit(R, tile);
}
