// Tests for the `colorsort` round type (Ball Sort / Water Sort re-skin).
//   node game/test/colorsort.js [--shots]
// d in {0, 0.5, 1} x 3 seeds: replay the A* solution through real key taps (walk the shelf, SIT to pick up, walk, SIT to
// drop); expect VERIFIED + PERFECT (moves == par). Deliberate fail: an illegal drop is refused ("nope"; nothing changes,
// no move counted), hop-in-place puts the item back, and the RESET pad restores the deal.
// --shots: boards at d=0 / d=1, the cat carrying an item, a "nope", the celebration sweep, the solved state, RESET hover.
const { open } = require('./lib.js');
const fs = require('fs');
const SHOTS = process.argv.includes('--shots'), ID = 'colorsort';
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.idle = () => { for (let f = 0; f < 240 && cat.mv; f++) BOT.frame(1); BOT.frame(2); };
    window.goCell = to => {
      const from = cat.cell; if (from === to) return true;
      const prev = new Map([[from, null]]), q = [from], K = ['up', 'right', 'down', 'left'];
      while (q.length) { const u = q.shift(); if (u === to) break; DIR4.forEach((d, k) => { const v = stepCell(u, d); if (v >= 0 && !prev.has(v) && !R.tiles[v].block && !R.tiles[v].wall) { prev.set(v, { u, k }); q.push(v); } }); }
      if (!prev.has(to)) return false;
      const keys = []; for (let v = to; prev.get(v); v = prev.get(v).u) keys.unshift(K[prev.get(v).k]);
      for (const k of keys) { BOT.tap(k, 1); idle(); }
      return cat.cell === to;
    };
    window.snap = () => JSON.stringify(R.tubes);
    window.move = ([a, b]) => { goCell(a); BOT.tap('sit', 20); goCell(b); BOT.tap('sit', 22); };
  });
  const rows = [];
  for (const d of [0, 0.5, 1]) for (const seed of [11, 222, 3333]) {
    const r = await p.evaluate(([id, d, seed]) => {
      DEV.play(id, d, seed); BOT.frame(40);
      const sol = R.solution.map(m => m.slice()), n = G.cols;
      for (const m of sol) { if (mode !== 'play') break; move(m); }
      const res = BOT.awaitResult(900);
      return { n, colors: R.colors, item: R.item, par: R.par.moves, moves: R.stats.moves, res };
    }, [ID, d, seed]);
    const ok = !!(r.res && r.res.pass && r.res.perfect);
    rows.push(ok);
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${ID} d=${String(d).padEnd(3)} seed=${String(seed).padEnd(5)} ${r.n} tubes ${r.colors} colours (${r.item}) par ${String(r.par).padStart(2)} moves ${String(r.moves).padStart(2)} ${r.res ? (r.res.pass ? 'VERIFIED' : 'FAILED') + (r.res.perfect ? '+PERFECT' : '') : 'no result'}${ok ? '' : '  ' + (r.res && r.res.verdict)}`);
  }
  // deliberate fail: illegal drop doesn't count; hop puts it back; RESET restores the deal
  const f = await p.evaluate(id => {
    DEV.play(id, 0.5, 222); BOT.frame(40);
    const T = R.tubes, n = T.length;
    let pair = null;
    for (let a = 0; a < n && !pair; a++) for (let b = 0; b < n && !pair; b++) if (a !== b && T[a].length && T[b].length && T[b][T[b].length - 1] !== T[a][T[a].length - 1]) pair = [a, b];
    const s0 = snap();
    goCell(pair[0]); BOT.tap('sit', 20);
    const held = !!R.held, afterPick = snap();
    goCell(pair[1]); BOT.tap('sit', 22);
    const refused = !!R.held && snap() === afterPick && R.stats.moves === 0;
    BOT.tap('hop', 2); idle(); BOT.frame(30);
    const putBack = !R.held && snap() === s0 && R.stats.moves === 0;
    // one legal move, then RESET (walk off the shelf, onto the pad, sit)
    move(R.solution[0]);
    const moved = snap() !== s0 && R.stats.moves === 1;
    goCell(0); BOT.tap('left', 2); idle(); BOT.frame(4);
    const pad = sokoPadRect(); BOT.walkTo(cat.x, pad.y + pad.h / 2, { tol: 6 }); BOT.walkTo(pad.x + pad.w / 2, pad.y + pad.h / 2, { tol: 6 }); BOT.frame(10);
    const hover = R.padOn;
    BOT.sit(); BOT.frame(30);
    const reset = snap() === s0 && cat.cell === R.catStart && !R.held;
    return { held, refused, putBack, moved, hover, reset, mode };
  }, ID);
  const fok = f.held && f.refused && f.putBack && f.moved && f.hover && f.reset && f.mode === 'play';
  rows.push(fok);
  console.log(`${fok ? 'OK  ' : 'FAIL'} ${ID} illegal drop refused / hop puts back / RESET: ${JSON.stringify(f)}`);

  if (SHOTS) {
    for (const d of [0, 1]) { await p.evaluate(([id, d]) => { DEV.play(id, d, 222); BOT.frame(50); }, [ID, d]); await shot(`${ID}-d${d}`); }
    // carrying: pick up the first item of the plan and walk towards its target
    await p.evaluate(id => { DEV.play(id, 1, 3333); BOT.frame(40); const [a, b] = R.solution[0]; goCell(a); BOT.tap('sit', 26); goCell(b); BOT.frame(20); }, ID);
    await shot(`${ID}-carrying`);
    // nope: try to drop it somewhere illegal
    const nope = await p.evaluate(() => {
      const T = R.tubes, ci = R.held.ci, bad = T.findIndex((t, c) => c !== R.held.from && t.length && (t.length >= 4 || t[t.length - 1] !== ci));
      if (bad < 0) return false; goCell(bad); BOT.tap('sit', 8); return true;
    });
    if (nope) await shot(`${ID}-nope`);
    // solved: the celebration sweep and the result (d = 0.5)
    await p.evaluate(id => { DEV.play(id, 0.5, 11); BOT.frame(40); for (const m of R.solution) move(m); }, ID);
    for (let k = 0; k < 300; k++) { const pt = await p.evaluate(() => { BOT.frame(1); return R.party && R.flashT.flat().filter(t => time - t < 0.2).length > 3; }); if (pt) { await shot(`${ID}-party`); break; } }
    for (let k = 0; k < 400; k++) { const m = await p.evaluate(() => { BOT.frame(1); return mode; }); if (m === 'result') { await p.evaluate(() => BOT.frame(14)); await shot(`${ID}-solved`); break; } }
    await p.evaluate(id => { DEV.play(id, 0.5, 222); BOT.frame(40); goCell(0); BOT.tap('left', 2); idle(); const pad = sokoPadRect(); BOT.walkTo(cat.x, pad.y + pad.h / 2, { tol: 6 }); BOT.walkTo(pad.x + pad.w / 2, pad.y + pad.h / 2, { tol: 6 }); BOT.frame(10); }, ID);
    await shot(`${ID}-reset-hover`);
  }
  const bad = rows.filter(x => !x).length;
  console.log(`\n${rows.length - bad} / ${rows.length} OK`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
