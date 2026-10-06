// Tests for the parking (Rush Hour / Parking Jam) round type.
//   node game/test/parking.js [--shots] [--gen]
// d in {0, 0.5, 1} x 3 seeds: replay the generator's BFS solution (min pushes) through real key presses: U/R/D/L taps,
// and 'O<cell>:<K>' = leave the grid, walk round the lot outside, step in onto <cell> moving K (this is also how the cat
// pushes a vehicle in from outside the lot). Expect VERIFIED + PERFECT. Then the RESET pad check, then screenshots.
const { open, D } = require('./lib.js');
const fs = require('fs');
const args = process.argv.slice(2), SHOTS = args.includes('--shots'), GEN = args.includes('--gen');
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.KEYS = { U: 'up', R: 'right', D: 'down', L: 'left' };
    window.idle = () => { for (let f = 0; f < 240; f++) { if (!cat.mv) break; BOT.frame(1); } BOT.frame(2); };
    // the ring the bot walks on outside the lot, and routing along it via its corners
    const ring = () => ({ xL: Math.max(PANEL.x + 16, G.x - 8), xR: G.x + G.w + 18, yT: G.y - 16, yB: G.y + G.h + 16 });
    const per = (q, g) => { const W = g.xR - g.xL, Hh = g.yB - g.yT; return q.s === 'T' ? q.x - g.xL : q.s === 'R' ? W + q.y - g.yT : q.s === 'B' ? W + Hh + g.xR - q.x : 2 * W + Hh + g.yB - q.y; };
    const onRing = (x, y) => {
      const g = ring(), ds = [['T', Math.abs(y - g.yT)], ['B', Math.abs(y - g.yB)], ['L', Math.abs(x - g.xL)], ['R', Math.abs(x - g.xR)]].sort((a, c) => a[1] - c[1]), s = ds[0][0];
      return s === 'T' || s === 'B' ? { s, x: clamp(x, g.xL, g.xR), y: s === 'T' ? g.yT : g.yB } : { s, x: s === 'L' ? g.xL : g.xR, y: clamp(y, g.yT, g.yB) };
    };
    window.ringWalk = (tx, ty) => {
      const g = ring(), a = onRing(cat.x, cat.y), z = onRing(tx, ty), P = 2 * (g.xR - g.xL + g.yB - g.yT);
      BOT.walkTo(a.x, a.y, { tol: 5 });
      const corners = [[0, g.xL, g.yT], [g.xR - g.xL, g.xR, g.yT], [g.xR - g.xL + g.yB - g.yT, g.xR, g.yB], [2 * (g.xR - g.xL) + g.yB - g.yT, g.xL, g.yB]];
      const pa = per(a, g), pz = per(z, g), cw = ((pz - pa) % P + P) % P, dirCw = cw <= P / 2;
      const seq = corners.map(([c, x, y]) => ({ x, y, k: dirCw ? ((c - pa) % P + P) % P : ((pa - c) % P + P) % P })).filter(c => c.k > 0.5 && c.k < (dirCw ? cw : P - cw)).sort((u, v) => u.k - v.k);
      for (const c of seq) BOT.walkTo(c.x, c.y, { tol: 5 });
      BOT.walkTo(z.x, z.y, { tol: 5 });
    };
    window.exitHere = () => {
      const n = G.cols, i = cat.cell, r = Math.floor(i / n), c = i % n;
      BOT.tap(r === n - 1 ? 'down' : c === 0 ? 'left' : c === n - 1 ? 'right' : 'up', 1); idle(); BOT.frame(3);
    };
    // leave (if inside), walk round, then step in onto `cell` moving K (pushes the vehicle there if it is one)
    window.goIn = (cell, K) => {
      if (cat.cell >= 0) exitHere();
      const g = ring(), c = cellCenter(cell), f = cellFoot(cell);
      const ap = K === 'R' ? [g.xL, f.y] : K === 'L' ? [g.xR, f.y] : K === 'D' ? [c.x, g.yT] : [c.x, g.yB];
      ringWalk(ap[0], ap[1]); BOT.walkTo(ap[0], ap[1], { tol: 3 });
      const k = KEYS[K];
      for (let fr = 0; fr < 60; fr++) { key[k] = true; BOT.frame(1); if (cat.mv || cat.cell >= 0) break; }
      key[k] = false; idle();
      return cat.cell === cell;
    };
    window.play1 = tok => {
      if (tok[0] === 'O') { const [c, K] = tok.slice(1).split(':'); return goIn(+c, K); }
      BOT.tap(KEYS[tok], 1); idle(); return true;
    };
  });
  const rows = [];
  if (GEN) {
    const out = await p.evaluate(() => {
      const res = [];
      for (const d of [0, 0.3, 0.5, 0.75, 1]) {
        let tmax = 0, tsum = 0; const lens = [];
        for (let s = 1; s <= 20; s++) { const t0 = performance.now(), spec = ROUNDS.parking.generate(d, makeRng(hashSeed(s, 'gen', 'parking')), {}); const dt = performance.now() - t0; tmax = Math.max(tmax, dt); tsum += dt; lens.push(spec.par.pushes); }
        lens.sort((a, c) => a - c);
        res.push(`parking d=${d}: par pushes min ${lens[0]} med ${lens[10]} max ${lens[19]} · gen ms avg ${(tsum / 20).toFixed(1)} max ${tmax.toFixed(0)}`);
      }
      return res;
    });
    console.log(out.join('\n'));
  }
  for (const d of [0, 0.5, 1]) for (const seed of [11, 222, 3333]) {
    const r = await p.evaluate(([d, seed]) => {
      DEV.play('parking', d, seed); BOT.frame(40);
      const sol = R.solution.slice(), par = R.par.pushes; let lost = 0;
      for (const t of sol) { if (mode !== 'play') break; if (!play1(t)) lost++; }
      const res = BOT.awaitResult(900);
      return { sol: sol.join(' '), par, pushes: R.stats.pushes, steps: R.stats.steps, res, n: G.cols, cars: R.vehicles.length, outs: sol.filter(t => t[0] === 'O').length, lost };
    }, [d, seed]);
    const ok = r.res && r.res.pass && r.res.perfect;
    rows.push({ d, seed, ok });
    console.log(`${ok ? 'OK  ' : 'FAIL'} parking d=${String(d).padEnd(3)} seed=${String(seed).padEnd(5)} ${r.n}x${r.n} vehicles ${String(r.cars).padStart(2)} par ${String(r.par).padStart(2)} pushes ${String(r.pushes).padStart(2)} steps ${String(r.steps).padStart(3)} outside-trips ${r.outs} ${r.res ? (r.res.pass ? 'VERIFIED' : 'FAILED') + (r.res.perfect ? '+PERFECT' : '') : 'no result'}${ok ? '' : '  lost ' + r.lost + ' ' + (r.res && r.res.verdict) + '  ' + r.sol}`);
  }
  // RESET pad: a few moves, walk off the grid, cross the pad (must NOT reset), sit on it (must reset)
  {
    const r = await p.evaluate(() => {
      DEV.play('parking', 0.5, 222); BOT.frame(40);
      const snap = () => R.carPos.join(',');
      const s0 = snap(), sol = R.solution;
      let k = 0; while (k < sol.length && snap() === s0) play1(sol[k++]);
      const moved = snap() !== s0;
      if (cat.cell >= 0) { for (const t of pkWalk(R.occ, G.cols, cat.cell, -1)) play1(t); exitHere(); }
      const pad = sokoPadRect();
      ringWalk(pad.x + pad.w / 2, G.y + G.h + 16); BOT.walkTo(pad.x + pad.w / 2, pad.y + pad.h / 2, { tol: 6 }); BOT.frame(10);
      const crossedOk = snap() !== s0, hover = R.padOn;
      BOT.sit(); BOT.frame(30);
      return { moved, crossedOk, hover, reset: snap() === s0, catBack: cat.cell === R.catStart, resets: R.resets || 0 };
    });
    const ok = r.moved && r.crossedOk && r.hover && r.reset && r.catBack;
    rows.push({ ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} parking RESET pad: ${JSON.stringify(r)}`);
  }
  if (SHOTS) {
    for (const d of [0, 1]) { await p.evaluate(d => { DEV.play('parking', d, 222); BOT.frame(50); }, d); await shot(`parking-d${d}`); }
    // mid-push, bus leaving, solved: d = 1
    await p.evaluate(() => { DEV.play('parking', 1, 3333); BOT.frame(40); });
    const sol = await p.evaluate(() => R.solution.slice());
    let gotPush = false;
    for (let k = 0; k < sol.length; k++) {
      const t = sol[k], last = k === sol.length - 1;
      if (!gotPush && 'URDL'.includes(t) && await p.evaluate(t => { const j = stepCell(cat.cell, DIRS[KEYS[t]]); return j >= 0 && R.occ[j] > 0; }, t)) {
        await p.evaluate(t => { BOT.tap(KEYS[t], 1); BOT.frame(4); }, t); await shot('parking-mid-push'); gotPush = true; await p.evaluate(() => idle()); continue;
      }
      if (last && t.length === 1) { await p.evaluate(t => { BOT.tap(KEYS[t], 1); BOT.frame(20); }, t); await shot('parking-bus-exiting'); await p.evaluate(() => idle()); continue; }
      await p.evaluate(t => play1(t), t);
    }
    for (let f = 0; f < 400; f++) { const m = await p.evaluate(() => { BOT.frame(1); return mode; }); if (m === 'result') { await p.evaluate(() => BOT.frame(14)); await shot('parking-solved'); break; } }
    // a honk (walking into a car from the side)
    await p.evaluate(() => { DEV.play('parking', 0.5, 11); BOT.frame(40); });
    const honk = await p.evaluate(() => {
      for (let i = 0; i < R.occ.length; i++) {
        if (R.occ[i] >= 0) continue;
        for (const [K, dir] of Object.entries({ U: DIRS.up, D: DIRS.down, L: DIRS.left, R: DIRS.right })) {
          const j = stepCell(i, dir); if (j < 0 || R.occ[j] < 0) continue;
          const v = R.vehicles[R.occ[j]]; if (v.h ? dir[0] === 0 : dir[1] === 0) continue;
          const w = pkWalk(R.occ, G.cols, cat.cell, i); if (!w) continue;
          for (const t of w) play1(t);
          BOT.tap(KEYS[K], 1); BOT.frame(8); return true;
        }
      }
      return false;
    });
    if (honk) await shot('parking-honk');
    await p.evaluate(() => { DEV.play('parking', 0.5, 222); BOT.frame(40); const pad = sokoPadRect(); if (cat.cell >= 0) { for (const t of pkWalk(R.occ, G.cols, cat.cell, -1)) play1(t); exitHere(); } ringWalk(pad.x + pad.w / 2, G.y + G.h + 16); BOT.walkTo(pad.x + pad.w / 2, pad.y + pad.h / 2, { tol: 6 }); BOT.frame(10); });
    await shot('parking-reset-hover');
  }
  const bad = rows.filter(r => !r.ok);
  console.log(`\n${rows.length - bad.length} / ${rows.length} OK`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
