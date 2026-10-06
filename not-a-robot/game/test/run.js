// (d) full scripted runs from the title screen: start -> win, and start -> denied
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  for (const want of ['win', 'denied']) {
    const seed = want === 'win' ? 20261005 : 777;
    // walk to START, sit; the run seed is forced through startRun wrapper so the result is reproducible
    const log = await p.evaluate(([seed, want]) => {
      DEV.title(); BOT.frame(10);
      const orig = window.startRun; window.startRun = (o = {}) => orig(Object.assign({ seed }, o)); // fix the seed, keep the real flow
      const s = TPADS.start; BOT.walkTo(s.x + 180, s.y + 60, { tol: 10 }); BOT.sit();
      for (let f = 0; f < 200 && mode !== 'play'; f++) BOT.frame();
      window.startRun = orig;
      const out = ['start -> ' + mode + ' slots: ' + RUN.slots.map(x => x.id + (x.intro ? '*' : '')).join(' ')];
      let fails = 0;
      for (let k = 0; k < 14 && mode !== 'win' && mode !== 'denied'; k++) {
        const id = R.id, t0 = time, wantPass = want === 'win' || fails >= 3;
        const r = BOT.solve(want === 'win');
        out.push(`${k}: ${id} d=${R.d.toFixed(2)} -> ${r ? (r.pass ? 'PASS' : 'FAIL') + (r.perfect ? '+PERFECT' : '') : '?'} (${(time - t0).toFixed(1)}s) ${BOT.log.splice(0).join(' ')}`);
        if (r && !r.pass) fails++;
        BOT.next();
      }
      for (let f = 0; f < 120; f++) BOT.frame();
      out.push('end mode: ' + mode + ' verified ' + verified + ' strikes ' + strikes + ' perfects ' + RUN.perfects + ' elapsed ' + RUN.elapsed.toFixed(1));
      return out;
    }, [seed, want]);
    console.log(log.join('\n'));
    await shot('end-' + want);
  }
  console.log('errors:', errs.join('\n'));
  await b.close();
})();
