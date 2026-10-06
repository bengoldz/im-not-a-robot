const { open } = require('./lib.js');
(async () => {
  const { b, p, errs, shot } = await open();
  await shot('00-title');
  console.log(JSON.stringify(await p.evaluate(() => DEV.types())));
  for (const id of ['match','timed','traffic','absurd','checkbox','conveyor','falling','still','boss','lights']) {
    for (const d of [0, 0.5, 1]) {
      const st = await p.evaluate(([id, d]) => { DEV.play(id, d, 7); step(900); return DEV.state(); }, [id, d]);
      await shot(`r-${id}-${d}`);
      console.log(id, d, st.round.cols + 'x' + st.round.rows, st.round.big, '|', st.round.progress, JSON.stringify(st.round.par), 'limit', st.round.limit);
    }
  }
  console.log('errors:', errs.join('\n'));
  await b.close();
})();
