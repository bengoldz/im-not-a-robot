// Tests for the `triple` round type (Tile Explorer / Triple Match re-skin).
//   node game/test/triple.js [--shots]
// d in {0, 0.5, 1} x 3 seeds: walk (real key taps, step mode) to each cell of the generator's DFS solution and SIT;
// expect VERIFIED + PERFECT (sits == par == card count). Then a deliberate fail: always take a card that does NOT pair up
// until the 7-slot tray overflows.
// --shots: boards at d=0 / d=1, a card mid-arc to the tray, a merge, the solved state, the tray-overflow fail.
const { open } = require('./lib.js');
const fs = require('fs');
const SHOTS = process.argv.includes('--shots'), ID = 'triple';
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.idle = () => { for (let f = 0; f < 240 && cat.mv; f++) BOT.frame(1); BOT.frame(2); };
    window.goCell = to => {
      const from = cat.cell; if (from === to) return true;
      const prev = new Map([[from, null]]), q = [from], K = ['up', 'right', 'down', 'left'];
      while (q.length) { const u = q.shift(); if (u === to) break; DIR4.forEach((d, k) => { const v = stepCell(u, d); if (v >= 0 && !prev.has(v) && !R.tiles[v].block && !R.tiles[v].wall) { prev.set(v, { u, k }); q.push(v); } }); }
      if (!prev.has(to)) return false;
      const keys = []; for (let v = to; prev.get(v); v = prev.get(v).u) keys.unshift(K[prev.get(v).k]);
      for (const k of keys) { BOT.tap(k, 1); idle(); }
      return cat.cell === to;
    };
    // pick the cell whose top card pairs up the least (never completes a set if avoidable) -> overflow
    window.worstCell = () => {
      const cnt = {}; R.tray.filter(c => !c.gid).forEach(c => { cnt[c.icon] = (cnt[c.icon] || 0) + 1; });
      const cells = R.stk.map((s, i) => s.length ? i : -1).filter(i => i >= 0);
      return cells.sort((a, b) => (cnt[R.stk[a][R.stk[a].length - 1]] || 0) - (cnt[R.stk[b][R.stk[b].length - 1]] || 0))[0];
    };
  });
  const rows = [];
  for (const d of [0, 0.5, 1]) for (const seed of [11, 222, 3333]) {
    const r = await p.evaluate(([id, d, seed]) => {
      DEV.play(id, d, seed); BOT.frame(40);
      const sol = R.solution.slice(), n = G.cols, kinds = R.kinds.length, maxTray = { v: 0 };
      for (const i of sol) { if (mode !== 'play') break; goCell(i); BOT.tap('sit', 30); maxTray.v = Math.max(maxTray.v, R.tray.filter(c => !c.gid).length); }
      const res = BOT.awaitResult(900);
      return { n, kinds, layers: R.layers, par: R.par.sits, sits: R.stats.sits, sets: R.sets, maxTray: maxTray.v, res };
    }, [ID, d, seed]);
    const ok = !!(r.res && r.res.pass && r.res.perfect);
    rows.push(ok);
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${ID} d=${String(d).padEnd(3)} seed=${String(seed).padEnd(5)} ${r.n}x${r.n} layers<=${r.layers} kinds ${r.kinds} par ${String(r.par).padStart(2)} sits ${String(r.sits).padStart(2)} sets ${String(r.sets).padStart(2)} tray max ${r.maxTray} ${r.res ? (r.res.pass ? 'VERIFIED' : 'FAILED') + (r.res.perfect ? '+PERFECT' : '') : 'no result'}${ok ? '' : '  ' + (r.res && r.res.verdict)}`);
  }
  // deliberate fail: tray overflow
  const f = await p.evaluate(id => {
    DEV.play(id, 0.5, 222); BOT.frame(40);
    let k = 0;
    for (; k < 40 && mode === 'play' && !R.over; k++) { goCell(worstCell()); BOT.tap('sit', 30); }
    const tray = R.tray.filter(c => !c.gid).length, res = BOT.awaitResult(600);
    return { picks: k, tray, res };
  }, ID);
  const fok = !!(f.res && !f.res.pass && f.tray === 7);
  rows.push(fok);
  console.log(`${fok ? 'OK  ' : 'FAIL'} ${ID} deliberate fail: ${f.picks} picks, tray ${f.tray}/7 -> ${f.res ? (f.res.pass ? 'VERIFIED?!' : 'FAILED') : 'no result'} "${f.res && f.res.verdict}"`);

  if (SHOTS) {
    for (const d of [0, 1]) { await p.evaluate(([id, d]) => { DEV.play(id, d, 222); BOT.frame(50); }, [ID, d]); await shot(`${ID}-d${d}`); }
    // mid-action at d = 1: play the solution, grab a card mid-arc and the first merge
    await p.evaluate(id => { DEV.play(id, 1, 222); BOT.frame(40); }, ID);
    const sol = await p.evaluate(() => R.solution.slice());
    let gotArc = false, gotMerge = false;
    for (let k = 0; k < sol.length; k++) {
      const willMerge = await p.evaluate(i => { goCell(i); const ic = R.stk[i][R.stk[i].length - 1]; return R.tray.filter(c => !c.gid && c.icon === ic).length === 2; }, sol[k]);
      if (k === 3 && !gotArc) { await p.evaluate(() => BOT.tap('sit', 11)); await shot(`${ID}-mid-arc`); gotArc = true; await p.evaluate(() => BOT.frame(20)); continue; }
      if (willMerge && !gotMerge && k > 3) { await p.evaluate(() => BOT.tap('sit', 31)); await shot(`${ID}-mid-merge`); gotMerge = true; await p.evaluate(() => BOT.frame(10)); continue; }
      await p.evaluate(() => BOT.tap('sit', 30));
      if (k === 20) await shot(`${ID}-d1-midgame`);
    }
    for (let k = 0; k < 400; k++) { const m = await p.evaluate(() => { BOT.frame(1); return mode; }); if (m === 'result') { await p.evaluate(() => BOT.frame(14)); await shot(`${ID}-solved`); break; } }
    await p.evaluate(id => { DEV.play(id, 1, 3333); BOT.frame(40); for (let k = 0; k < 40 && mode === 'play' && !R.over; k++) { goCell(worstCell()); BOT.tap('sit', 30); } BOT.frame(14); }, ID);
    await shot(`${ID}-overflow`);
  }
  const bad = rows.filter(x => !x).length;
  console.log(`\n${rows.length - bad} / ${rows.length} OK`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
