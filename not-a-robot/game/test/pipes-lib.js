// Shared driver for the pipes / path / gravity / nonogram tests (test/pipes.js, path.js, gravity.js, nonogram.js).
// For each d in 0 / 0.5 / 1 and 3 seeds: DEV.play, solve through real key presses (bot.js walking + the per-type plans
// below), and require VERIFIED + PERFECT. Screenshots (seed #1 at d 0 and 1): start, mid-action, solved, result.
//   node game/test/pipes.js            (or path.js / gravity.js / nonogram.js; SHOTS=dir to redirect screenshots)
const { open } = require('./lib.js');
const fs = require('fs');

// page-side: build a list of actions for the current round; PB.step(k) performs action k through key presses
function pageSolvers() {
  window.PB = {
    plan() {
      const id = R.id;
      if (id === 'pipes') return R.solution.map(s => ({ cell: s.cell, sits: s.k }));
      if (id === 'nonogram') return BOT.order(R.solution).map(i => ({ cell: i, sits: 1 }));
      if (id === 'gravity') return R.solution.map(i => ({ cell: i, sits: 1, wait: 50 }));
      if (id === 'path') { const P = R.solution, out = []; for (let k = 1; k < P.length; k++) { const a = P[k - 1], b = P[k], dr = Math.floor(b / G.cols) - Math.floor(a / G.cols); out.push({ key: dr < 0 ? 'up' : dr > 0 ? 'down' : b > a ? 'right' : 'left', want: b }); } return out; }
      return [];
    },
    step(a) {
      if (a.key) {   // step mode: one key press = one cell
        BOT.tap(a.key, 16);
        for (let f = 0; f < 30 && cat.mv; f++) BOT.frame();
        return catCell() === a.want ? null : `expected cell ${a.want}, cat at ${catCell()}`;
      }
      if (!BOT.goCell(a.cell)) return `could not reach cell ${a.cell}`;
      for (let k = 0; k < a.sits; k++) { BOT.sit(); BOT.frame(4); }
      if (a.wait) BOT.frame(a.wait);
      return null;
    },
    finish() {
      if (R.id === 'path') { BOT.tap('down', 24); BOT.frame(10); BOT.toVerify(); }
      return mode;
    },
  };
}

async function runType(id, { ds = [0, 0.5, 1], seeds = [11, 202, 3003] } = {}) {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(pageSolvers);
  const rows = [], shots = [];
  for (const d of ds) for (const seed of seeds) {
    const snap = seed === seeds[0] && (d === 0 || d === 1);
    const info = await p.evaluate(([id, d, seed]) => { DEV.play(id, d, seed); BOT.frame(40); const s = DEV.state().round; return { size: s.cols + 'x' + s.rows, par: s.par, progress: s.progress }; }, [id, d, seed]);
    if (snap) shots.push(await shot(`${id}-d${d}-1-start`));
    const plan = await p.evaluate(() => PB.plan());
    let err = null;
    for (let k = 0; k < plan.length && !err; k++) {
      err = await p.evaluate(a => mode === 'play' ? PB.step(a) : null, plan[k]);
      if (snap && k === Math.floor(plan.length / 2)) { await p.evaluate(() => BOT.frame(2)); shots.push(await shot(`${id}-d${d}-2-mid`)); }
    }
    await p.evaluate(() => PB.finish());
    if (snap) { await p.evaluate(() => BOT.frame(30)); shots.push(await shot(`${id}-d${d}-3-solved`)); }
    const res = await p.evaluate(() => BOT.awaitResult());
    const st = await p.evaluate(() => ({ stats: R.stats, par: R.par }));
    if (snap) { await p.evaluate(() => BOT.frame(45)); shots.push(await shot(`${id}-d${d}-4-result`)); }
    const ok = res && res.pass && res.perfect;
    const pk = Object.keys(st.par)[0];
    rows.push({ id, d, seed, size: info.size, par: `${pk} ${st.stats[pk]}/${st.par[pk]}`, actions: plan.length, result: res ? (res.pass ? 'VERIFIED' : 'FAILED') + (res.perfect ? ' + PERFECT' : '') : 'no result', ok, err });
    await p.evaluate(() => { BOT.frame(240); });
  }
  console.log(`\n== ${id} ==`);
  for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'BAD '} d=${r.d} seed=${r.seed} ${r.size} ${r.par} -> ${r.result}${r.err ? '  ERR ' + r.err : ''}`);
  console.log('screenshots:\n  ' + shots.join('\n  '));
  console.log('page errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  const bad = rows.filter(r => !r.ok).length + errs.length;
  if (bad) process.exitCode = 1;
  return rows;
}
// full runs (DEV.run) that contain the new types: my rounds are solved with PB; every other round is skipped with finish().
// Checks intro appearances (generated at d 0), transitions between rounds, and page errors.
async function runFull({ mine = ['pipes', 'path', 'gravity', 'nonogram'], runs = 6 } = {}) {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(pageSolvers);
  const seeds = await p.evaluate(([mine, runs]) => {
    const out = [];
    for (let s = 1; out.length < runs && s < 5000; s++) { const sl = DEV.makeRun(s); const hit = mine.filter(id => sl.slice(0, 8).some(x => x.id === id)); if (hit.length >= 2) out.push(s); }
    return out;
  }, [mine, runs]);
  const lines = []; let bad = 0;
  for (const seed of seeds) {
    const log = await p.evaluate(([seed, mine]) => {
      DEV.run(seed); BOT.frame(40);
      const out = [`seed ${seed}: ` + RUN.slots.map(x => x.id + (x.intro ? '*' : '')).join(' ')];
      for (let k = 0; k < 12 && mode === 'play'; k++) {
        const id = R.id, intro = R.intro, d = R.d;
        let r;
        if (mine.includes(id)) { for (const a of PB.plan()) { if (mode !== 'play') break; PB.step(a); } PB.finish(); r = BOT.awaitResult(); }
        else { BOT.frame(30); finish({ pass: true, verdict: 'skipped by test' }); r = BOT.awaitResult(); r = r && Object.assign(r, { skipped: true }); }
        BOT.log.length = 0;
        out.push(`  ${k}: ${id}${intro ? '*' : ''} d=${d.toFixed(2)} -> ${r ? r.skipped ? '(skipped)' : (r.pass ? 'PASS' : 'FAIL') + (r.perfect ? '+PERFECT' : '') : 'no result'}${mine.includes(id) ? '   <- mine' : ''}`);
        BOT.next();
      }
      out.push('  end: ' + mode);
      return out;
    }, [seed, mine]);
    for (const l of log) { if (l.includes('<- mine') && !l.includes('PASS+PERFECT')) bad++; }
    lines.push(...log);
  }
  console.log(lines.join('\n'));
  console.log('page errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  if (bad || errs.length) process.exitCode = 1;
}
module.exports = { runType, runFull };
