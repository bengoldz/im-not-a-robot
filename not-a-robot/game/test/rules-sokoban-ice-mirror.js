// Tests for the rules / sokoban / ice / mirror round types.
//   node game/test/rules-sokoban-ice-mirror.js [type ...] [--shots] [--gen]
// For each type, d in {0, 0.5, 1} x 3 seeds: generate, replay the generator's BFS solution through real key presses
// (taps of up/down/left/right/sit; rules also exits the grid and walks onto VERIFY), and expect VERIFIED + PERFECT.
// --shots also saves d=0 / d=1 boards, mid-action frames (push, slide, mirror bonk) and the solved state.
// --gen runs a generator sweep (many seeds per d) checking solvability / timing straight from generate().
const { open, D } = require('./lib.js');
const fs = require('fs');
const args = process.argv.slice(2), TYPES = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : ['rules', 'sokoban', 'ice', 'mirror'];
const SHOTS = args.includes('--shots'), GEN = args.includes('--gen');
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.KEYS = { U: 'up', R: 'right', D: 'down', L: 'left' };
    window.idle = () => { for (let f = 0; f < 240; f++) { if (!cat.mv && !(R && R.ents && R.ents.some(e => e.mv))) break; BOT.frame(1); } BOT.frame(2); };
    // play one token of a solution: U/R/D/L walk, S sit, X step off the bottom edge and walk onto VERIFY
    // walk (BFS around walls / pushables) to the nearest bottom-row cell and step off the grid
    window.exitBottom = () => {
      const n = G.cols, D = rulesDist(n, cat.cell, i => !R.tiles[i].wall && !R.tiles[i].push && !R.tiles[i].block);
      let best = -1; for (let c = 0; c < n; c++) { const v = (n - 1) * n + c; if (D.d[v] >= 0 && (best < 0 || D.d[v] < D.d[best])) best = v; }
      for (const t of rulesPathTo(D, best)) play1(t);
      BOT.tap('down', 2); idle(); BOT.frame(4);
    };
    window.play1 = tok => {
      if (tok === 'S') { BOT.tap('sit', 20); return; }
      if (tok === 'X') { BOT.tap('down', 2); idle(); BOT.frame(4); BOT.toVerify(); return; }
      BOT.tap(KEYS[tok], 1); idle();
    };
  });
  const rows = [];
  if (GEN) {
    for (const id of TYPES) {
      const out = await p.evaluate(id => {
        const res = [];
        for (const d of [0, 0.25, 0.5, 0.75, 1]) {
          let tmax = 0, tsum = 0, lens = [], fb = 0;
          for (let s = 1; s <= 30; s++) {
            const t0 = performance.now(), spec = ROUNDS[id].generate(d, makeRng(hashSeed(s, 'gen', id)), {});
            const dt = performance.now() - t0; tmax = Math.max(tmax, dt); tsum += dt; lens.push(spec.par.moves);
          }
          lens.sort((a, b) => a - b);
          res.push(`${id} d=${d}: par min ${lens[0]} med ${lens[15]} max ${lens[29]} · gen ms avg ${(tsum / 30).toFixed(1)} max ${tmax.toFixed(0)}`);
        }
        return res;
      }, id);
      console.log(out.join('\n'));
    }
  }
  for (const id of TYPES) for (const d of [0, 0.5, 1]) for (const seed of [11, 222, 3333]) {
    const r = await p.evaluate(([id, d, seed]) => {
      DEV.play(id, d, seed); BOT.frame(40);
      const sol = R.solution.slice(), par = R.par.moves;
      for (const t of sol) { if (mode !== 'play') break; play1(t); }
      const res = BOT.awaitResult(900);
      return { sol: sol.join(''), par, moves: R.stats.moves, res, n: G.cols };
    }, [id, d, seed]);
    const ok = r.res && r.res.pass && r.res.perfect;
    rows.push({ id, d, seed, n: r.n, par: r.par, moves: r.moves, pass: !!(r.res && r.res.pass), perfect: !!(r.res && r.res.perfect), ok });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${id.padEnd(8)} d=${String(d).padEnd(3)} seed=${String(seed).padEnd(5)} ${r.n}x${r.n} par ${String(r.par).padStart(2)} moves ${String(r.moves).padStart(2)} ${r.res ? (r.res.pass ? 'VERIFIED' : 'FAILED') + (r.res.perfect ? '+PERFECT' : '') : 'no result'}  ${r.sol}${ok ? '' : '  ' + (r.res && r.res.verdict)}`);
  }
  if (SHOTS) for (const id of TYPES) {
    for (const d of [0, 1]) { await p.evaluate(([id, d]) => { DEV.play(id, d, 222); BOT.frame(50); }, [id, d]); await shot(`${id}-d${d}`); }
    // mid-action + solved: d = 0.5, play the solution and grab the interesting frames
    await p.evaluate(id => { DEV.play(id, 0.5, 222); BOT.frame(40); }, id);
    const sol = await p.evaluate(() => R.solution.slice());
    let gotMid = false;
    for (let k = 0; k < sol.length; k++) {
      const t = sol[k];
      if (!gotMid && 'URDL'.includes(t)) {
        const want = await p.evaluate(([id, t]) => {
          const dir = DIRS[KEYS[t]], j = stepCell(cat.cell, dir);
          if (id === 'rules' || id === 'sokoban') return j >= 0 && R.tiles[j].push;
          if (id === 'ice') return R.def.moveCat(R, cat.cell, dir, 'walk').path.length >= 2;
          if (id === 'mirror') { const k = DIR4.indexOf(dir), m = mirStep(cat.cell, R.ghost.cell, k, G.cols, R.tiles.map(x => !!x.wall), R.axis); return m.catOk !== m.ghostOk; }
        }, [id, t]).catch(() => false);
        if (want) {
          await p.evaluate(t => { BOT.tap(KEYS[t], 1); BOT.frame(5); }, t);
          await shot(`${id}-mid-action`); gotMid = true; await p.evaluate(() => idle()); continue;
        }
      }
      await p.evaluate(t => play1(t), t);
    }
    // solved state (sokoban: also during the assemble shine; then the VERIFIED result for every type)
    if (id === 'sokoban') for (let f = 0; f < 120; f++) { if (await p.evaluate(() => { BOT.frame(1); return R.shine > 0.45; })) { await shot('sokoban-assembled'); break; } }
    for (let f = 0; f < 400; f++) {
      const m = await p.evaluate(() => { BOT.frame(1); return mode + ':' + (V && V.phase); });
      if (m.startsWith('result')) { await p.evaluate(() => BOT.frame(14)); await shot(`${id}-solved`); break; }
    }
  }
  // RESET pad (sokoban + rules): play a few moves, walk off the grid, cross the pad (must NOT reset), sit on it (must reset)
  for (const id of TYPES.filter(t => t === 'sokoban' || t === 'rules')) {
    const r = await p.evaluate(id => {
      DEV.play(id, 0.5, 222); BOT.frame(40);
      const snap = () => R.tiles.map(t => (t.word || '') + (t.piece != null ? 'p' + t.piece : '') + (t.wall ? '#' : '')).join(',');
      const s0 = snap(), big0 = R.big;
      for (const t of R.solution.filter(t => 'URDL'.includes(t)).slice(0, 6)) play1(t);
      const moved = snap() !== s0;
      exitBottom();
      const pad = sokoPadRect(); BOT.walkTo(pad.x + pad.w / 2, cat.y, { tol: 6 }); BOT.walkTo(pad.x + pad.w / 2, pad.y + pad.h / 2, { tol: 6 }); BOT.frame(10);
      const crossedOk = snap() !== s0 || !moved, hover = R.padOn;
      BOT.sit(); BOT.frame(30);
      return { moved, crossedOk, hover, reset: snap() === s0, catBack: cat.cell === R.catStart, prompt: R.big === big0 };
    }, id);
    if (SHOTS) { await p.evaluate(() => { const pad = sokoPadRect(); exitBottom(); BOT.walkTo(pad.x + pad.w / 2, cat.y, { tol: 6 }); BOT.walkTo(pad.x + pad.w / 2, pad.y + pad.h / 2, { tol: 6 }); BOT.frame(10); }); await shot(`${id}-reset-hover`); }
    const ok = r.moved && r.crossedOk && r.hover && r.reset && r.catBack && r.prompt;
    rows.push({ ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} RESET pad: ${JSON.stringify(r)}`);
  }
  const bad = rows.filter(r => !r.ok);
  console.log(`\n${rows.length - bad.length} / ${rows.length} VERIFIED+PERFECT`);
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
