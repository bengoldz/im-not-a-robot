// Tests for the busjam (Bus Jam / Bus Out) round type.
//   node game/test/busjam.js [--shots] [--gen]
// d in {0, 0.5, 1} x 3 seeds: replay the generator's 0-1 BFS solution (fewest passengers sent to the holding row)
// through real key presses: U/R/D/L walk taps, hU/hR/hD/hL hops (Space + direction), the bump that faces the passenger,
// then S = sit (call) and wait for the walk / boarding / bus animations. Expect VERIFIED + PERFECT.
// Then a deliberate fail: keep calling passengers that do NOT match the front bus until the holding row overflows.
const { open, D } = require('./lib.js');
const fs = require('fs');
const args = process.argv.slice(2), SHOTS = args.includes('--shots'), GEN = args.includes('--gen');
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.KEYS = { U: 'up', R: 'right', D: 'down', L: 'left' };
    window.busy = () => !!(R.ev || R.evq.length || R.pend != null);
    window.idle = () => { for (let f = 0; f < 240; f++) { if (!cat.mv) break; BOT.frame(1); } BOT.frame(2); };
    window.settle = () => { for (let f = 0; f < 900 && mode === 'play' && busy(); f++) BOT.frame(1); BOT.frame(2); };
    window.play1 = tok => {
      if (tok === 'S') { BOT.tap('sit', 2); settle(); return; }
      if (tok[0] === 'h') { const k = KEYS[tok[1]]; key[k] = true; pressed[k] = true; pressed.hop = true; BOT.frame(1); key[k] = false; idle(); return; }
      BOT.tap(KEYS[tok], 1); idle();
    };
    // walk to a passenger, face it, call it (any passenger, using the round's own helpers)
    window.callPax = q => {
      const empty = R.pax.map(v => v < 0 ? 1 : 0), r0 = bjRoute(G.cols, G.rows, empty, cat.cell, q); if (!r0) return false;
      for (const t of r0.toks) play1(t);
      const dr = Math.floor(q / G.cols) - Math.floor(cat.cell / G.cols), dc = q % G.cols - cat.cell % G.cols;
      play1(dr < 0 ? 'U' : dr > 0 ? 'D' : dc < 0 ? 'L' : 'R'); play1('S'); return true;
    };
    window.callable = () => { const e = R.pax.map(v => v < 0 ? 1 : 0); return bjCallable(G.cols, G.rows, R.pax.map(v => v >= 0 ? 1 : 0), e, e, bjTopNow(R)); };
  });
  const rows = [];
  if (GEN) {
    const out = await p.evaluate(() => {
      const res = [];
      for (const d of [0, 0.3, 0.5, 0.75, 1]) {
        let tmax = 0, tsum = 0; const ws = [], dims = new Set();
        for (let s = 1; s <= 20; s++) { const t0 = performance.now(), spec = ROUNDS.busjam.generate(d, makeRng(hashSeed(s, 'gen', 'busjam')), {}); const dt = performance.now() - t0; tmax = Math.max(tmax, dt); tsum += dt; ws.push(spec.par.waits); dims.add(`${spec.cols}x${spec.rows} ${spec.buses.length} buses ${new Set(spec.buses).size} colours hold ${spec.holdN}`); }
        ws.sort((a, c) => a - c);
        res.push(`busjam d=${d}: par waits min ${ws[0]} med ${ws[10]} max ${ws[19]} · gen ms avg ${(tsum / 20).toFixed(1)} max ${tmax.toFixed(0)} · ${[...dims].join(' | ')}`);
      }
      return res;
    });
    console.log(out.join('\n'));
  }
  for (const d of [0, 0.5, 1]) for (const seed of [11, 222, 3333]) {
    const r = await p.evaluate(([d, seed]) => {
      DEV.play('busjam', d, seed); BOT.frame(40);
      const sol = R.solution.slice(), par = R.par.waits;
      for (const t of sol) { if (mode !== 'play') break; play1(t); }
      const res = BOT.awaitResult(900);
      return { par, waits: R.stats.waits, sits: R.stats.sits, res, dims: `${G.cols}x${G.rows}`, buses: R.buses.length, hold: R.holdN, hops: sol.filter(t => t[0] === 'h').length };
    }, [d, seed]);
    const ok = r.res && r.res.pass && r.res.perfect;
    rows.push({ ok });
    console.log(`${ok ? 'OK  ' : 'FAIL'} busjam d=${String(d).padEnd(3)} seed=${String(seed).padEnd(5)} ${r.dims} buses ${r.buses} hold ${r.hold} par waits ${r.par} waits ${r.waits} sits ${String(r.sits).padStart(2)} hops ${r.hops} ${r.res ? (r.res.pass ? 'VERIFIED' : 'FAILED') + (r.res.perfect ? '+PERFECT' : '') : 'no result'}${ok ? '' : '  ' + (r.res && r.res.verdict)}`);
  }
  // deliberate fail: overflow the holding row
  {
    const r = await p.evaluate(() => {
      DEV.play('busjam', 1, 222); BOT.frame(40);
      let calls = 0;
      while (mode === 'play' && calls < 40) {
        const can = callable(), front = R.buses[R.bus], wrong = can.filter(q => R.pax[q] !== front);
        const q = (wrong.length ? wrong : can)[0]; if (q == null) break;
        if (!callPax(q)) break; calls++;
      }
      const holdFull = R.hold.every(v => v >= 0), failed = R.failed;
      const res = BOT.awaitResult(600);
      return { calls, holdFull, failed, res };
    });
    const ok = r.res && !r.res.pass && r.holdFull && r.failed;
    rows.push({ ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} busjam overflow fail: ${JSON.stringify(r)}`);
  }
  if (SHOTS) {
    for (const d of [0, 1]) { await p.evaluate(d => { DEV.play('busjam', d, 222); BOT.frame(50); }, d); await shot(`busjam-d${d}`); }
    // d = 1: passenger walking, bus departing, holding row, solved
    await p.evaluate(() => { DEV.play('busjam', 1, 3333); BOT.frame(40); });
    const sol = await p.evaluate(() => R.solution.slice());
    const got = {};
    for (const t of sol) {
      if (t !== 'S') { await p.evaluate(t => play1(t), t); continue; }
      await p.evaluate(() => BOT.tap('sit', 2));
      for (let f = 0; f < 600; f++) {
        const s = await p.evaluate(() => { BOT.frame(1); return { walk: !!(R.ev && R.ev.k === 'walk' && R.ev.t > 0.35), dep: !!(R.ev && R.ev.k === 'depart' && R.ev.t > 0.45 && R.ev.t < 0.7), busy: busy(), mode, held: R.vHold.filter(Boolean).length }; });
        if (s.walk && !got.walk) { got.walk = 1; await shot('busjam-passenger-walking'); }
        if (s.dep && !got.dep) { got.dep = 1; await shot('busjam-bus-departing'); }
        if (s.held >= 2 && !s.busy && !got.held) { got.held = 1; await shot('busjam-holding-row'); }
        if (!s.busy || s.mode !== 'play') break;
      }
    }
    for (let f = 0; f < 400; f++) { const m = await p.evaluate(() => { BOT.frame(1); return mode; }); if (m === 'result') { await p.evaluate(() => BOT.frame(14)); await shot('busjam-solved'); break; } }
    // a shrug: hop into a pocket next to a buried passenger and call it (if this layout has one)
    const sh = await p.evaluate(() => {
      for (const seed of [11, 222, 3333, 44, 55, 66]) {
        DEV.play('busjam', 1, seed); BOT.frame(40);
        const e = R.pax.map(v => v < 0 ? 1 : 0), top = bjTopNow(R);
        const q = R.pax.findIndex((v, i) => v >= 0 && !bjFree(i, G.cols, G.rows, top) && neighbors4(i).some(j => e[j]));
        if (q < 0) continue;
        const r0 = bjRoute(G.cols, G.rows, e, cat.cell, q); if (!r0) continue;
        for (const t of r0.toks) play1(t);
        const dr = Math.floor(q / G.cols) - Math.floor(cat.cell / G.cols), dc = q % G.cols - cat.cell % G.cols;
        play1(dr < 0 ? 'U' : dr > 0 ? 'D' : dc < 0 ? 'L' : 'R'); BOT.tap('sit', 10);
        return { seed, shrug: !!R.shrug };
      }
      return null;
    });
    if (sh && sh.shrug) await shot('busjam-shrug');
    console.log('shrug', JSON.stringify(sh));
    // overflow fail
    await p.evaluate(() => {
      DEV.play('busjam', 1, 222); BOT.frame(40);
      while (mode === 'play') { const can = callable(), front = R.buses[R.bus], wrong = can.filter(q => R.pax[q] !== front), q = (wrong.length ? wrong : can)[0]; if (q == null || !callPax(q)) break; }
    });
    for (let f = 0; f < 400; f++) { const m = await p.evaluate(() => { BOT.frame(1); return mode; }); if (m === 'result') { await p.evaluate(() => BOT.frame(14)); await shot('busjam-overflow-fail'); break; } }
  }
  const bad = rows.filter(r => !r.ok);
  console.log(`\n${rows.length - bad.length} / ${rows.length} OK`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
