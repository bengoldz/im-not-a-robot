// Tests for the `arrows` round type (Tap Away re-skin).
//   node game/test/arrows.js [--shots]
// d in {0, 0.5, 1} x 3 seeds: walk (real key taps, step mode) to each card of the generator's removal order and SIT on it;
// expect VERIFIED + PERFECT (sits == par). Then a deliberate fail: sit on a blocked card until the hearts run out.
// --shots: boards at d=0 / d=1, a card mid-flight, a bonk, the solved board (VERIFIED), the out-of-hearts fail.
const { open } = require('./lib.js');
const fs = require('fs');
const SHOTS = process.argv.includes('--shots'), ID = 'arrows';
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.idle = () => { for (let f = 0; f < 240 && cat.mv; f++) BOT.frame(1); BOT.frame(2); };
    // BFS over enterable cells from the cat's cell, then one key tap per step
    window.goCell = to => {
      const from = cat.cell; if (from === to) return true;
      const prev = new Map([[from, null]]), q = [from], K = ['up', 'right', 'down', 'left'];
      while (q.length) { const u = q.shift(); if (u === to) break; DIR4.forEach((d, k) => { const v = stepCell(u, d); if (v >= 0 && !prev.has(v) && !R.tiles[v].block && !R.tiles[v].wall) { prev.set(v, { u, k }); q.push(v); } }); }
      if (!prev.has(to)) return false;
      const keys = []; for (let v = to; prev.get(v); v = prev.get(v).u) keys.unshift(K[prev.get(v).k]);
      for (const k of keys) { BOT.tap(k, 1); idle(); }
      return cat.cell === to;
    };
  });
  const rows = [];
  for (const d of [0, 0.5, 1]) for (const seed of [11, 222, 3333]) {
    const r = await p.evaluate(([id, d, seed]) => {
      DEV.play(id, d, seed); BOT.frame(40);
      const sol = R.solution.slice(), n = G.cols, rot = R.tiles.filter(t => t.arot).length;
      for (const i of sol) { if (mode !== 'play') break; goCell(i); BOT.tap('sit', 24); }
      const res = BOT.awaitResult(900);
      return { n, rot, par: R.par.sits, sits: R.stats.sits, hearts: R.hearts + '/' + R.heartsMax, res };
    }, [ID, d, seed]);
    const ok = !!(r.res && r.res.pass && r.res.perfect);
    rows.push(ok);
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${ID} d=${String(d).padEnd(3)} seed=${String(seed).padEnd(5)} ${r.n}x${r.n} rot ${r.rot} par ${String(r.par).padStart(2)} sits ${String(r.sits).padStart(2)} hearts ${r.hearts} ${r.res ? (r.res.pass ? 'VERIFIED' : 'FAILED') + (r.res.perfect ? '+PERFECT' : '') : 'no result'}${ok ? '' : '  ' + (r.res && r.res.verdict)}`);
  }
  // deliberate fail: keep launching a blocked card -> bonk, bonk (, bonk) -> out of hearts -> round fails
  const f = await p.evaluate(id => {
    DEV.play(id, 0.5, 222); BOT.frame(40);
    const blocked = R.tiles.find(t => t.adir != null && arrBlocker(t.i, t.adir, G.cols, G.rows, j => R.tiles[j].adir != null) >= 0);
    goCell(blocked.i);
    const log = [];
    for (let k = 0; k < 6 && mode === 'play' && !R.over; k++) { BOT.tap('sit', 50); log.push(R.hearts); }
    const cleared = R.cleared, res = BOT.awaitResult(600);
    return { log, cleared, res };
  }, ID);
  const fok = !!(f.res && !f.res.pass && f.cleared === 0 && f.log.join(',') === '2,1,0');
  rows.push(fok);
  console.log(`${fok ? 'OK  ' : 'FAIL'} ${ID} deliberate fail: hearts after each bonk ${f.log.join(',')} -> ${f.res ? (f.res.pass ? 'VERIFIED?!' : 'FAILED') : 'no result'} "${f.res && f.res.verdict}"`);

  if (SHOTS) {
    for (const d of [0, 1]) { await p.evaluate(([id, d]) => { DEV.play(id, d, 222); BOT.frame(50); }, [ID, d]); await shot(`${ID}-d${d}`); }
    // mid-action: a card in flight (d = 1, first card of the plan) and a bonk
    await p.evaluate(id => { DEV.play(id, 1, 222); BOT.frame(40); goCell(R.solution[0]); }, ID);
    await shot(`${ID}-d1-preview-road`);
    await p.evaluate(() => { BOT.tap('sit', 7); });
    await shot(`${ID}-mid-flight`);
    await p.evaluate(() => {
      BOT.frame(30);
      // the blocked card with the longest slide (so the frame shows it travelling towards its blocker)
      const occ = j => R.tiles[j].adir != null, dist = t => { const j = arrBlocker(t.i, t.adir, G.cols, G.rows, occ); return j < 0 ? -1 : Math.abs(rcOf(j)[0] - t.r) + Math.abs(rcOf(j)[1] - t.c); };
      const blocked = R.tiles.filter(t => t.adir != null && dist(t) > 0).sort((a, b) => dist(b) - dist(a))[0];
      goCell(blocked.i); BOT.tap('sit', 1);
      for (let f = 0; f < 30 && !(tileFx(R.tiles[blocked.i]).ox || tileFx(R.tiles[blocked.i]).oy) ; f++) BOT.frame(1);
      BOT.frame(4);
    });
    await shot(`${ID}-mid-bonk`);
    // solved: d = 0.5 played through; grab the verify sweep and the stamp
    await p.evaluate(id => { DEV.play(id, 0.5, 11); BOT.frame(40); for (const i of R.solution) { goCell(i); BOT.tap('sit', 24); } }, ID);
    for (let k = 0; k < 400; k++) { const m = await p.evaluate(() => { BOT.frame(1); return mode; }); if (m === 'result') { await p.evaluate(() => BOT.frame(14)); await shot(`${ID}-solved`); break; } }
    await p.evaluate(id => { DEV.play(id, 1, 3333); BOT.frame(40); const bl = R.tiles.find(t => t.adir != null && arrBlocker(t.i, t.adir, G.cols, G.rows, j => R.tiles[j].adir != null) >= 0); goCell(bl.i); for (let k = 0; k < 3 && !R.over; k++) BOT.tap('sit', 50); BOT.awaitResult(600); BOT.frame(14); }, ID);
    await shot(`${ID}-fail`);
  }
  const bad = rows.filter(x => !x).length;
  console.log(`\n${rows.length - bad} / ${rows.length} OK`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
