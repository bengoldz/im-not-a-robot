const { open } = require('./lib.js');
(async () => {
  for (const h of ['#round=lights&d=0.6&seed=42', '#lights-0.6-42', '#falling-0-3']) {
    const { b, p, errs } = await open({ hash: h, live: true, wait: 1500 });
    console.log(h, JSON.stringify(await p.evaluate(() => { const s = DEV.state(); return { mode: s.mode, id: s.round && s.round.id, d: s.round && s.round.d, seed: s.run && s.run.seed, prog: s.round && s.round.progress }; })), errs);
    if (h === '#falling-0-3') {
      const ms = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 300; i++) { update(1 / 60); render(); } return ((performance.now() - t0) / 300).toFixed(2); });
      console.log('ms per update+render:', ms);
    }
    await b.close();
  }
})();
