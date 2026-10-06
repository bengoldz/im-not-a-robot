// (c) solve lights through real key presses (GF(2) min-weight solution), capture the juice frames
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open({ dsf: 2 });
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const info = await p.evaluate(() => { DEV.play('lights', 0.6, 4242); BOT.frame(10); return DEV.state().round; });
  console.log('board', info.cols + 'x' + info.rows, 'progress', info.progress, 'par', JSON.stringify(info.par), 'generator solution', JSON.stringify(info.solution));
  await shot('L0-transition-wave');   // mid diagonal flip wave + typing prompt
  await p.evaluate(() => BOT.frame(40));
  const sol = await p.evaluate(() => BOT.lightsSolve());
  console.log('GF(2) min-weight solution', JSON.stringify(sol));
  const order = await p.evaluate(s => BOT.order(s), sol);
  for (let k = 0; k < order.length; k++) {
    const last = k === order.length - 1;
    await p.evaluate(i => { BOT.goCell(i); pressed.sit = true; key.sit = true; BOT.frame(1); key.sit = false; }, order[k]);
    if (k === 0) { await p.evaluate(() => BOT.frame(5)); await shot('L1-ripple-mid'); }
    await p.evaluate(() => BOT.frame(last ? 1 : 24));
    console.log('after sit', order[k], await p.evaluate(() => DEV.state().round && DEV.state().round.progress), 'mode', await p.evaluate(() => mode));
  }
  // auto-verify: 0.35 s after solved -> sweep -> result
  const tl = [];
  for (let f = 0; f < 200; f++) {
    const m = await p.evaluate(() => { BOT.frame(1); return mode + (V && V.phase ? ':' + V.phase : '') + (V && V.sweep ? ':' + V.sweep.k : ''); });
    if (!tl.length || tl[tl.length - 1].m !== m.split(':').slice(0, 2).join(':')) tl.push({ f, m: m.split(':').slice(0, 2).join(':') });
    if (m.startsWith('verifying:sweep:12') && !tl.shot1) { tl.shot1 = 1; await shot('L2-verify-sweep'); }
    if (m.startsWith('result')) { if (!tl.r) tl.r = f; if (f - tl.r === 8) await shot('L3-verified-stamp'); if (f - tl.r === 40) await shot('L4-perfect-stamp'); if (f - tl.r === 75) { await shot('L5-result-settled'); break; } }
  }
  console.log('timeline', JSON.stringify(tl.slice(0, 8)));
  const st = await p.evaluate(() => DEV.state());
  console.log('result', JSON.stringify(st.res), 'stats', JSON.stringify(st.round.stats), 'run', JSON.stringify(st.run.results));
  console.log('errors:', errs.join('\n'));
  await b.close();
})();
