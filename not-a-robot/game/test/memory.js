// memory: generate at d 0 / 0.5 / 1 x 3 seeds, solve through key presses (bot reads the true targets from DEV.state()),
// expect VERIFIED + PERFECT. Screenshots: memorize phase (ring timer), flip wave, shuffle twist, reveal, result.
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open({ dsf: 1 });
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const rows = [];
  for (const d of [0, 0.5, 1]) for (const seed of [11, 22, 33]) {
    const first = seed === 11, tag = `memory-d${d}`;
    const info = await p.evaluate(([d, seed]) => { DEV.play('memory', d, seed); BOT.frame(30); const s = DEV.state().round; return { n: s.cols, k: R.k, show: R.show, swap: R.swap, par: s.par, sol: s.solution }; }, [d, seed]);
    if (first) await shot(`${tag}-1-memorize`);
    // wait for the face-down wave
    await p.evaluate(() => { for (let f = 0; f < 900 && R.phase === 'show'; f++) BOT.frame(); });
    if (first) { await p.evaluate(() => BOT.frame(12)); await shot(`${tag}-2-flipwave`); }
    if (info.swap && first) { await p.evaluate(() => { for (let f = 0; f < 200 && !(R.tiles.some(t => t.fx.ox)); f++) BOT.frame(); BOT.frame(12); }); await shot(`${tag}-3-shuffle`); }
    await p.evaluate(() => { for (let f = 0; f < 600 && R.phase !== 'pick'; f++) BOT.frame(); });
    const sol = await p.evaluate(() => DEV.state().round.solution);
    await p.evaluate(sol => { BOT.selectAll(sol); }, sol);
    if (first) await shot(`${tag}-4-selected`);
    await p.evaluate(() => BOT.toVerify());
    if (first) { await p.evaluate(() => BOT.frame(14)); await shot(`${tag}-5-reveal`); }
    const r = await p.evaluate(() => BOT.awaitResult());
    if (first) { await p.evaluate(() => BOT.frame(30)); await shot(`${tag}-6-result`); }
    const st = await p.evaluate(() => DEV.state().round.stats);
    rows.push({ d, seed, grid: `${info.n}x${info.n}`, targets: info.k, show: info.show, swap: !!info.swap, par: info.par.time, t: +st.t.toFixed(1), pass: r && r.pass, perfect: r && r.perfect});
  }
  // a deliberate fail: select nothing, verify
  await p.evaluate(() => { DEV.play('memory', 0.5, 5); BOT.frame(30); for (let f = 0; f < 900 && R.phase !== 'pick'; f++) BOT.frame(); BOT.toVerify(); });
  const bad = await p.evaluate(() => BOT.awaitResult());
  console.table(rows);
  console.log('deliberate fail ->', JSON.stringify(bad));
  console.log('ALL PASS+PERFECT:', rows.every(r => r.pass && r.perfect), ' errors:', errs.join('\n') || 'none');
  await b.close();
})();
