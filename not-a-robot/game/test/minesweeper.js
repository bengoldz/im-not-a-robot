// minesweeper: d 0 / 0.5 / 1 x 3 seeds.
//  1. the no-guess check: for every possible first tile, the precomputed board is solvable by mineSolvable (deduction only)
//  2. the bot plays through key presses using ONLY what is visible (revealed numbers, woken vacuums) + mineDeduce:
//     first sit in the middle, then repeatedly deduce -> walk to the nearest safe tile -> sit. It plants one paw flag
//     (hop in place) on the first deduced vacuum to exercise flagging. Never guesses: if stuck it reports STUCK.
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open({ dsf: 1 });
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.MSBOT = () => {
      const n = G.cols, known = () => R.tiles.map(t => t.back ? null : t.mine ? 'M' : t.num);
      const start = Math.floor(n / 2) * n + Math.floor(n / 2);
      BOT.goCell(start); BOT.sit(); BOT.frame(30);
      let flagged = 0, stuck = false, sits = 1, mineCells = new Set();
      for (let it = 0; it < 200 && mode === 'play'; it++) {
        let ded;
        for (let g = 0; g < 10; g++) {   // deduce, mark deduced vacuums as known, repeat until nothing new
          const k = known(); mineCells.forEach(j => { if (k[j] == null) k[j] = 'M'; });
          ded = mineDeduce(n, G.rows, k); const before = mineCells.size; ded.mines.forEach(j => mineCells.add(j));
          if (ded.safe.some(j => R.tiles[j].back) || mineCells.size === before) break;
        }
        if (!flagged && mineCells.size) { const j = [...mineCells][0]; if (BOT.goCell(j)) { BOT.frame(10); const c0 = catCell(); BOT.tap('hop', 45); flagged = R.tiles[j].flag ? 1 : -1; if (flagged < 0) BOT.log.push('flag miss: at ' + c0 + ' want ' + j + ' now ' + catCell()); } }
        const safe = ded.safe.filter(j => R.tiles[j].back);
        if (!safe.length) { if (mode === 'play' && !ROUNDS.minesweeper.solved(R)) stuck = true; break; }
        const j = BOT.order(safe)[0];
        if (BOT.goCell(j)) { BOT.sit(); sits++; BOT.frame(6); }
      }
      return { stuck, flagged, sits, woken: R.woken, log: BOT.log.splice(0) };
    };
  });
  const rows = [];
  for (const d of [0, 0.5, 1]) for (const seed of [11, 22, 33]) {
    const first = seed === 11, tag = `minesweeper-d${d}`;
    const info = await p.evaluate(([d, seed]) => {
      DEV.play('minesweeper', d, seed); BOT.frame(40);
      const n = G.cols, solv = R.boards.map((m, s) => mineSolvable(n, n, m, s)), fullMines = R.boards.filter(m => m.length === R.mines).length;
      return { n, mines: R.mines, par: R.par, solvableStarts: solv.filter(x => x >= 0).length + '/' + solv.length, fullMines: fullMines + '/' + R.boards.length, maxRounds: Math.max(...solv) };
    }, [d, seed]);
    if (first) await shot(`${tag}-1-start`);
    if (first) {   // capture the cascade mid-ripple from the first sit
      await p.evaluate(() => { const n = G.cols; BOT.goCell(Math.floor(n / 2) * n + Math.floor(n / 2)); pressed.sit = true; key.sit = true; BOT.frame(1); key.sit = false; BOT.frame(9); });
      await shot(`${tag}-2-cascade`);
      await p.evaluate(() => BOT.frame(30));
    }
    const res = await p.evaluate(() => MSBOT());
    if (first) await shot(`${tag}-3-cleared`);
    const r = await p.evaluate(() => BOT.awaitResult());
    if (first) { await p.evaluate(() => BOT.frame(40)); await shot(`${tag}-4-result`); }
    const st = await p.evaluate(() => DEV.state().round.stats);
    rows.push({ d, seed, grid: `${info.n}x${info.n}`, mines: info.mines, noGuess: info.solvableStarts, fullCount: info.fullMines, par: info.par.time, t: +st.t.toFixed(1), sits: res.sits, stuck: res.stuck, flag: res.flagged, log: res.log.join(';'), pass: r && r.pass, perfect: r && r.perfect });
  }
  // a vacuum: wake one on purpose (strike, round continues), then finish -> pass but not PERFECT
  const v = await p.evaluate(() => {
    DEV.play('minesweeper', 0.5, 7); BOT.frame(40); const n = G.cols; BOT.goCell(0); BOT.sit(); BOT.frame(30);
    const m = R.tiles.findIndex(t => t.mine); BOT.goCell(m); BOT.sit(); BOT.frame(20);
    return { strikes, mode, woken: R.woken, prog: DEV.state().round.progress };
  });
  await shot('minesweeper-5-vacuum');
  const v2 = await p.evaluate(() => { const r = MSBOT(); const res = BOT.awaitResult(); return { r, res }; });
  console.table(rows);
  console.log('vacuum test:', JSON.stringify(v), '->', JSON.stringify(v2.res));
  console.log('ALL PASS+PERFECT, none stuck:', rows.every(r => r.pass && r.perfect && !r.stuck), ' errors:', errs.join('\n') || 'none');
  await b.close();
})();
