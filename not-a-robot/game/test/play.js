const { open } = require('./lib.js');
const fs = require('fs');
const only = process.argv[2] ? process.argv[2].split(',') : null;
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const ids = only || ['match', 'timed', 'traffic', 'absurd', 'checkbox', 'conveyor', 'falling', 'still', 'boss', 'lights'];
  const rows = [];
  for (const id of ids) for (const d of [0, 0.5, 1]) {
    await p.evaluate(([id, d]) => { DEV.play(id, d, 1000 + Math.round(d * 10)); BOT.frame(40); window.__snap = false; }, [id, d]);
    // mid-play screenshot: after half the work (selection juice visible)
    const res = await p.evaluate(() => {
      const r = BOT.solve(true); return { r, st: DEV.state().round && DEV.state().round.stats, log: BOT.log.splice(0) };
    });
    await p.evaluate(() => BOT.frame(40)); await shot(`p-${id}-${d}-result`);
    rows.push(`${id.padEnd(9)} d=${d}: ${res.r ? (res.r.pass ? 'PASS' : 'FAIL') + (res.r.perfect ? ' PERFECT' : '') + ' — ' + res.r.verdict : 'no result'} ${res.log.join(' ')}`);
  }
  console.log(rows.join('\n'));
  console.log('errors:', errs.join('\n'));
  await b.close();
})();
