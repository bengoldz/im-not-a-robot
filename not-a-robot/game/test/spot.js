// spot: d 0 / 0.5 / 1 x 3 seeds, sit on the odd tile (true index from DEV.state().round.solution), VERIFY -> PERFECT.
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open({ dsf: 1 });
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const rows = [];
  for (const d of [0, 0.5, 1]) for (const seed of [11, 22, 33]) {
    const first = seed === 11, tag = `spot-d${d}`;
    const info = await p.evaluate(([d, seed]) => { DEV.play('spot', d, seed); BOT.frame(40); const s = DEV.state().round; return { n: s.cols, icon: R.icon, tweak: R.tweak.k + (R.tweak.deg ? ' ' + R.tweak.deg : ''), what: R.tweak.what, par: s.par, odd: s.solution[0] }; }, [d, seed]);
    if (first) await shot(`${tag}-1-start`);
    await p.evaluate(odd => { BOT.goCell(odd); BOT.sit(); }, info.odd);
    await p.evaluate(() => BOT.toVerify());
    if (first) { await p.evaluate(() => { for (let f = 0; f < 120 && !(V && V.phase === 'sweep'); f++) BOT.frame(); BOT.frame(12); }); await shot(`${tag}-2-reveal`); }
    const r = await p.evaluate(() => BOT.awaitResult());
    if (first) { await p.evaluate(() => BOT.frame(30)); await shot(`${tag}-3-result`); }
    const st = await p.evaluate(() => DEV.state().round.stats);
    rows.push({ d, seed, grid: `${info.n}x${info.n}`, icon: info.icon, tweak: info.tweak, par: info.par.time, t: +st.t.toFixed(1), pass: r && r.pass, perfect: r && r.perfect, verdict: r && r.verdict.slice(0, 60) });
  }
  // deliberate fail: pick a normal tile
  await p.evaluate(() => { DEV.play('spot', 0.5, 5); BOT.frame(40); BOT.goCell(R.odd === 0 ? 1 : 0); BOT.sit(); BOT.toVerify(); BOT.frame(40); });
  await shot('spot-4-fail-reveal');
  const bad = await p.evaluate(() => BOT.awaitResult());
  console.table(rows);
  console.log('deliberate fail ->', JSON.stringify(bad));
  console.log('ALL PASS+PERFECT:', rows.every(r => r.pass && r.perfect), ' errors:', errs.join('\n') || 'none');
  await b.close();
})();
