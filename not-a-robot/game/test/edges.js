// Human-play edge cases: "what you see is what is judged". Everything goes through key state (key[] / pressed[]) and update().
//   node game/test/edges.js            (GAME_URL=file://... to test another build)
// 1. Random human-ish play on every free-mode grid type: walk (diagonals too) to random points biased to tile borders and gaps,
//    sometimes hop / dash on the way, sometimes sit while still holding a direction. For every sit:
//      - the cell acted on == the cell the hover highlight outlined in the last rendered frame (and the outline is on screen)
//      - the cat's drawn body centre (feet - CAT_BODY) is in that cell (tile + half the gap + hysteresis)
//      - the cat stops dead: 30 frames later its body is still in that cell
//      - default-select types: exactly that tile toggled
// 2. Scenarios: dash + sit; sit pressed to skip the result screen (no stray sit next round); mirror sit buffered during the last
//    move; boss friend caught mid-hop by VERIFY; memory verified during the flip / shuffle; gravity sit while tiles fall;
//    timer hitting 0 on the VERIFY frame; jittering on a tile border in the falling round; traffic slivers (see traffic.js).
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  await p.evaluate(() => {
    window.Q = {};
    window.__sits = []; window.__hov = undefined;
    const hasHover = typeof drawCatHover === 'function';
    Q.hasHover = hasHover;
    if (hasHover) { const dh = drawCatHover; window.drawCatHover = function () { window.__hov = mode === 'play' && !isStepMode() && cat.hopT <= 0 && cat.dashT <= 0 && cat.fall <= 0 && R && G.cols ? catCell() : -1; return dh(); }; }
    const sa = sitAction; window.sitAction = function () { if (mode === 'play' && R) window.__sits.push({ cell: catCell(), hov: window.__hov, x: cat.x, y: cat.y, sel: R.tiles.map(t => !!t.sel) }); return sa(); };
    Q.BODY = typeof CAT_BODY === 'number' ? CAT_BODY : 17;
    Q.inCell = (i, x, y, slack = 0) => { if (i < 0) return false; const q = cellXY(i), H = G.gap / 2 + (typeof CAT_HYST === 'number' ? CAT_HYST : 6) + slack, L = G.cols * G.pitch, by = y - Q.BODY;
      return [0, -L, L].some(o => x >= q.x + o - H && x <= q.x + o + G.ts + H && by >= q.y - H && by <= q.y + G.ts + H); };
    // is the blue outline drawn around cell i? (sample the outline ring on all four sides, need 2 hits: the cat may cover some)
    Q.outlineAt = i => {
      const q = cellXY(i), k = cv.width / W, L = G.cols * G.pitch, pts = [];
      for (const ox of [0, -L]) { const x0 = q.x + ox; pts.push([x0 - 1, q.y + G.ts * 0.3], [x0 + G.ts + 1, q.y + G.ts * 0.3], [x0 + G.ts * 0.3, q.y - 1], [x0 + G.ts * 0.7, q.y + G.ts + 1], [x0 - 1, q.y + G.ts * 0.7], [x0 + G.ts + 1, q.y + G.ts * 0.7], [x0 + G.ts * 0.15, q.y - 1], [x0 + G.ts * 0.85, q.y + G.ts + 1]); }
      let hit = 0; for (const [x, y] of pts) { if (x < G.x - 3 || x > G.x + G.w + 3) continue; const d = ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data; if (d[2] > 150 && d[0] < 120 && d[1] > 70 && d[1] < 160) hit++; }
      return hit >= 2;
    };
    Q.keysOff = () => { key.left = key.right = key.up = key.down = false; };
  });

  // ---------- 1. random human play ----------
  const TYPES = [['match', 0.5], ['match', 1], ['timed', 0.8], ['traffic', 1], ['absurd', 0.6], ['conveyor', 0.5], ['conveyor', 1], ['falling', 0.7], ['boss', 0.5],
    ['lights', 0.6], ['memory', 0.5], ['minesweeper', 0.5], ['nonogram', 0.6], ['pipes', 0.6], ['spot', 0.6], ['gravity', 0.7]];
  const DEFAULT_SEL = ['match', 'timed', 'traffic', 'absurd', 'conveyor', 'falling', 'boss', 'memory'];
  const table = [];
  for (const [id, d] of TYPES) {
    const r = await p.evaluate(([id, d, defSel]) => {
      let seed = 100, fails = [], sits = 0, outl = 0, maxSlide = 0, rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
      const start = () => { DEV.play(id, d, seed++); BOT.frame(40); if (id === 'memory') { for (let f = 0; f < 900 && R.phase !== 'pick'; f++) BOT.frame(); } };
      start();
      for (let ep = 0; ep < 45; ep++) {
        if (mode !== 'play') { BOT.next(); start(); }
        strikes = 0; if (R.limit) R.timeLeft = R.limit;
        // a target near a random cell, biased to its borders / the gaps
        const c = cellCenter(Math.floor(rnd() * R.tiles.length)), off = () => (rnd() * 2 - 1) * G.pitch * (rnd() < 0.6 ? 0.55 : 0.3);
        const tx = c.x + off(), ty = c.y + off() + Q.BODY, hopAt = rnd() < 0.25 ? Math.floor(rnd() * 30) : -1, dashAt = rnd() < 0.15 ? Math.floor(rnd() * 20) : -1, sitHeld = rnd() < 0.35;
        for (let f = 0; f < 240 && mode === 'play'; f++) {
          const dx = tx - cat.x, dy = ty - cat.y; if (Math.abs(dx) < 2.5 && Math.abs(dy) < 2.5 && cat.hopT <= 0) break;
          key.right = dx > 2; key.left = dx < -2; key.down = dy > 2; key.up = dy < -2;
          if (f === hopAt) pressed.hop = true; if (f === dashAt) pressed.dash = true;
          BOT.frame();
        }
        if (!sitHeld) Q.keysOff();
        if (mode !== 'play') continue;
        // wait for the landing / dash end so the sit is not just buffered
        for (let f = 0; f < 40 && (cat.hopT > 0 || cat.dashT > 0); f++) BOT.frame();
        if (mode !== 'play') continue;
        const hovOk = !Q.hasHover || window.__hov < 0 || Q.outlineAt(window.__hov);
        const n0 = __sits.length; pressed.sit = true; key.sit = true; anyPressed = true; BOT.frame(1); key.sit = false; Q.keysOff();
        if (__sits.length === n0) { BOT.frame(12); }
        if (__sits.length === n0) continue;
        const s = __sits[__sits.length - 1]; sits++;
        if (!hovOk) fails.push(`ep ${ep}: no outline drawn around the highlighted cell ${window.__hov}`); else if (Q.hasHover && s.hov >= 0) outl++;
        if (Q.hasHover && s.hov !== s.cell) fails.push(`ep ${ep}: highlighted ${s.hov} but sat on ${s.cell}`);
        if (s.cell >= 0 && !Q.inCell(s.cell, s.x, s.y)) fails.push(`ep ${ep}: sat on ${s.cell} but the body is at (${s.x.toFixed(0)},${(s.y - Q.BODY).toFixed(0)}), cell ${s.cell} at ${JSON.stringify(cellXY(s.cell))}`);
        if (s.cell < 0 && G.cols && typeof cellNear === 'function' && cellNear(s.x, s.y - Q.BODY) >= 0 && !(R.def.hover === false)) fails.push(`ep ${ep}: sat "off grid" with the body over cell ${cellNear(s.x, s.y - Q.BODY)}`);
        if (defSel.includes(id) && s.cell >= 0 && mode === 'play' && ['ok', 'crumble'].includes(R.tiles[s.cell].state)) {
          const ch = R.tiles.map((t, i) => !!t.sel !== s.sel[i] ? i : -1).filter(i => i >= 0);
          if (ch.length !== 1 || ch[0] !== s.cell) fails.push(`ep ${ep}: sat on ${s.cell} but toggled [${ch}]`);
        }
        const x0 = cat.x, y0 = cat.y; BOT.frame(30);
        if (mode === 'play' && s.cell >= 0 && id !== 'conveyor') { maxSlide = Math.max(maxSlide, Math.hypot(cat.x - x0, cat.y - y0)); if (!Q.inCell(s.cell, cat.x, cat.y)) fails.push(`ep ${ep}: slid out of cell ${s.cell} after sitting`); }
      }
      return { sits, outl, maxSlide: +maxSlide.toFixed(1), fails };
    }, [id, d, DEFAULT_SEL]);
    table.push({ type: `${id}@${d}`, sits: r.sits, outlined: r.outl, maxSlide: r.maxSlide, fails: r.fails.length, first: r.fails[0] || '' });
  }
  console.table(table);

  // ---------- 2. scenarios ----------
  const sc = await p.evaluate(() => {
    const out = {};
    // dash + sit: the cat must sit (and stay) in the cell it was in when the sit happened
    { DEV.play('match', 0.5, 5); BOT.frame(30); DEV.warp(5); BOT.frame(5); key.right = true; pressed.dash = true; BOT.frame(1); pressed.sit = true; BOT.frame(1); key.right = false;
      for (let f = 0; f < 40; f++) BOT.frame(); const s = __sits[__sits.length - 1]; out.dashSit = { sat: s.cell, now: catCell(), bodyIn: Q.inCell(s.cell, cat.x, cat.y), ok: s.cell === catCell() && Q.inCell(s.cell, cat.x, cat.y) }; }
    // sit pressed to skip the result screen must not sit in the next round
    { newRun({ seed: 1, slots: [{ i: 0, id: 'match', d: 0, genD: 0, intro: false, seed: 11, prep: null }, { i: 1, id: 'lights', d: 0.5, genD: 0.5, intro: false, seed: 12, prep: null }], daily: false, day: 0, dev: true });
      BOT.frame(30); BOT.toVerify(); BOT.awaitResult(); BOT.frame(75); const n0 = __sits.length; pressed.sit = true; key.sit = true; anyPressed = true; BOT.frame(1); key.sit = false;
      for (let f = 0; f < 30 && mode !== 'play'; f++) BOT.frame(); BOT.frame(20);
      out.skipSit = { round: R.id, sits: R.stats.sits, strays: __sits.length - n0, ok: R.id === 'lights' && R.stats.sits === 0 && __sits.length === n0 }; }
    // mirror: sit pressed during the last move (buffered) -> both arrive, then the sit counts as in sync
    { const res = [];
      for (const seed of [11, 222, 3333]) {
        DEV.play('mirror', 0.5, seed); BOT.frame(30);
        const toks = Array.isArray(R.solution) ? R.solution : R.solution.split(''), KEYS = { U: 'up', R: 'right', D: 'down', L: 'left' };
        const idle = () => { for (let f = 0; f < 240 && (cat.mv || R.ents.some(e => e.mv)); f++) BOT.frame(); BOT.frame(2); };
        const last = toks.lastIndexOf(toks.filter(t => t !== 'S').pop());
        toks.forEach((t, k) => { if (t === 'S') return; BOT.tap(KEYS[t], 1); if (k === last) { BOT.frame(4); pressed.sit = true; BOT.frame(1); } idle(); });
        for (let f = 0; f < 200 && mode === 'play'; f++) BOT.frame();
        const r = BOT.awaitResult(); res.push(!!(r && r.pass));
      }
      out.mirrorBufferedSit = { pass: res, ok: res.every(Boolean) }; }
    // boss: the friend starts a hop 3 frames before the cat steps onto VERIFY -> judged where he visibly is
    { const res = [];
      for (let seed = 1; seed <= 12; seed++) {
        DEV.play('boss', 0.5, seed); BOT.frame(60);
        R.tiles.forEach((t, i) => t.sel = R.hit.includes(i) && i !== R.friend.tile);
        cat.x = VERIFY.x - 3 * 215 / 60 - 1; cat.y = VERIFY.y + 20; cat.vx = 215; cat.cell = -1; key.right = true; R.friend.moveT = 0.0001;
        for (let f = 0; f < 20 && mode === 'play'; f++) BOT.frame(); key.right = false;
        const f = R.friend, near = R.tiles.map((t, i) => { const q = cellXY(i); return Math.hypot(q.x + G.ts / 2 - f.x, q.y + G.ts * 0.8 - f.y); }), vis = near.indexOf(Math.min(...near));
        const r = BOT.awaitResult();
        res.push({ judged: f.tile, visible: vis, banned: !!(RES && RES.banned), selVisible: R.tiles[vis].sel, ok: f.tile === vis && !!(RES && RES.banned) === R.tiles[vis].sel });
      }
      out.bossMidHop = { bad: res.filter(r => !r.ok), ok: res.every(r => r.ok) }; }
    // memory: VERIFY while the cards are still flipping is refused (verifyBlocked): no judging, no strike, round continues
    { DEV.play('memory', 0.9, 4); BOT.frame(30); for (let f = 0; f < 900 && R.phase === 'show'; f++) BOT.frame();
      const swapBefore = R.swap, tilesBefore = R.tiles.map(t => t.icon).join(); cat.x = VERIFY.x + 20; cat.y = VERIFY.y - 10; cat.cell = -1; BOT.frame(2); key.down = true; BOT.frame(6); key.down = false;
      for (let f = 0; f < 150; f++) BOT.frame();
      out.memoryFlipVerify = { swap: !!swapBefore, phase: R.phase, mode, unchanged: R.tiles.map(t => t.icon).join() === tilesBefore, strikes, ok: mode === 'play' && R.phase !== 'reveal' && strikes === 0 }; }
    // gravity: a second sit while the column is still falling must not pop anything
    { DEV.play('gravity', 0.7, 202); BOT.frame(40); const sol = R.solution, c0 = sol[0];
      DEV.warp(c0); BOT.frame(2); pressed.sit = true; BOT.frame(3);
      const pops1 = R.stats.pops, falling = R.tiles.some(t => t.fx && Math.abs(t.fx.oy || 0) > 0.5);
      const j = R.tiles.findIndex(t => t.gk && t.fx && Math.abs(t.fx.oy || 0) > 0.5) >= 0 ? R.tiles.findIndex(t => t.gk && t.fx && Math.abs(t.fx.oy || 0) > 0.5) : R.tiles.findIndex(t => t.gk);
      DEV.warp(j); pressed.sit = true; BOT.frame(2);
      out.gravityMidFall = { falling, pops: [pops1, R.stats.pops], ok: !falling || R.stats.pops === pops1 }; }
    // timer hits 0 on the frame the cat steps onto VERIFY: the verify wins (judge, not timeout)
    { DEV.play('timed', 0.5, 9); BOT.frame(30); R.tiles.forEach((t, i) => t.sel = R.hit.includes(i));
      cat.x = VERIFY.x - 2; cat.y = VERIFY.y + 20; cat.vx = 215; cat.cell = -1; key.right = true; R.timeLeft = 0.5 / 60; BOT.frame(1); key.right = false;
      const r = BOT.awaitResult(); out.timerVsVerify = { res: r, ok: !!(r && r.pass) }; }
    // falling: jitter left / right on the border between two tiles: at most the tile the cat came from may crumble
    { DEV.play('falling', 0.5, 21); BOT.frame(30); DEV.warp(5); BOT.frame(4); const q = cellXY(5), bx = q.x + G.ts + G.gap / 2;
      BOT.walkTo(bx, cat.y, { tol: 1.5 }); BOT.frame(4);
      for (let k = 0; k < 40; k++) { key[k % 2 ? 'left' : 'right'] = true; BOT.frame(2); key.left = key.right = false; BOT.frame(1); }
      const crumbled = R.tiles.map((t, i) => t.state !== 'ok' ? i : -1).filter(i => i >= 0);
      out.fallingJitter = { crumbled, mode, ok: crumbled.length <= 1 && mode === 'play' }; }
    return out;
  });
  for (const k in sc) console.log((sc[k].ok ? 'OK  ' : 'FAIL') + ' ' + k.padEnd(18) + JSON.stringify(sc[k]));
  await p.evaluate(() => { DEV.play('conveyor', 1, 3); BOT.frame(30); DEV.warp(6); BOT.frame(50); });
  await shot('edges-conveyor-hover');
  const bad = table.filter(r => r.fails).length + Object.values(sc).filter(s => !s.ok).length;
  console.log(bad ? `FAIL: ${bad} problem group(s)` : 'PASS: all edge cases');
  console.log('errors:', errs.join('\n'));
  await b.close();
  process.exitCode = bad || errs.length ? 1 : 0;
})();
