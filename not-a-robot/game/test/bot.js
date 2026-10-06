// Injected into the page: an autoplayer that drives the game ONLY through key state (key[...] / pressed[...]) and update().
window.BOT = (() => {
  const B = {};
  B.log = [];
  B.frame = (n = 1) => { for (let i = 0; i < n; i++) { update(1 / 60); render(); } };
  B.release = () => { key.left = key.right = key.up = key.down = false; };
  B.walkTo = (tx, ty, { tol = 8, maxF = 900, stopIf } = {}) => {
    for (let f = 0; f < maxF; f++) {
      if (mode !== 'play' && mode !== 'title' && mode !== 'win' && mode !== 'denied') break;
      const x = typeof tx === 'function' ? tx() : tx, y = typeof ty === 'function' ? ty() : ty, dx = x - cat.x, dy = y - cat.y;
      if (Math.abs(dx) < tol && Math.abs(dy) < tol) { B.release(); B.frame(4); return true; }
      key.right = dx > tol / 2; key.left = dx < -tol / 2; key.down = dy > tol / 2; key.up = dy < -tol / 2;
      B.frame(); if (stopIf && stopIf()) break;
    }
    B.release(); return false;
  };
  B.tap = (k, frames = 3) => { pressed[k] = true; key[k] = true; anyPressed = true; B.frame(1); key[k] = false; B.frame(frames); };
  B.sit = () => B.tap('sit', 18);
  B.at = i => { const c = cellCenter(i), L = G.cols * G.pitch; let x = c.x; if (x > G.x + G.w - 16) x -= L; if (x < G.x + 16) x = Math.max(x, G.x + 16); return { x, y: c.y + Math.min(G.ts * 0.15, 12) }; };
  B.goCell = i => {
    for (let k = 0; k < 4; k++) {
      B.walkTo(() => B.at(i).x, () => B.at(i).y, { tol: Math.max(6, G.ts * 0.18) });
      if (cellAt(cat.x, cat.y) === i) return true;
    }
    return cellAt(cat.x, cat.y) === i;
  };
  B.order = list => { const out = [], rest = list.slice(); let p = { x: cat.x, y: cat.y }; while (rest.length) { rest.sort((a, b) => Math.hypot(B.at(a).x - p.x, B.at(a).y - p.y) - Math.hypot(B.at(b).x - p.x, B.at(b).y - p.y)); const n = rest.shift(); out.push(n); p = B.at(n); } return out; };
  B.selectAll = list => { for (let pass = 0; pass < 3; pass++) for (const i of B.order(list.filter(i => !R.tiles[i].sel))) { if (mode !== 'play') return; if (B.goCell(i) && !R.tiles[i].sel && catCell() === i) B.sit(); } };
  B.toVerify = () => B.walkTo(VERIFY.x + VERIFY.w / 2, VERIFY.y + VERIFY.h / 2, { tol: 10, stopIf: () => mode !== 'play' });
  // wait until a result is on screen, return it, then skip to the next round with a key press
  B.awaitResult = (maxF = 3000) => { for (let f = 0; f < maxF && mode !== 'result'; f++) { if (mode === 'win' || mode === 'denied') return null; B.frame(); } return mode === 'result' ? { pass: RES.pass, perfect: RES.perfect, verdict: RES.verdict } : null; };
  B.next = () => { B.frame(70); B.tap('hop', 2); for (let f = 0; f < 300 && mode === 'result'; f++) B.frame(); };

  // ---------- lights: GF(2) elimination, minimum-weight solution over the null space ----------
  B.lightsSolve = () => {
    const n = G.cols, N = n * n, rows = [];
    for (let i = 0; i < N; i++) { const r = new Array(N + 1).fill(0); for (const j of lightsArea(i, n)) r[j] = 1; r[N] = R.tiles[i].sel ? 0 : 1; rows.push(r); }
    const piv = []; let row = 0;
    for (let c = 0; c < N && row < N; c++) {
      let p = -1; for (let r = row; r < N; r++) if (rows[r][c]) { p = r; break; } if (p < 0) continue;
      [rows[row], rows[p]] = [rows[p], rows[row]];
      for (let r = 0; r < N; r++) if (r !== row && rows[r][c]) for (let k = c; k <= N; k++) rows[r][k] ^= rows[row][k];
      piv.push(c); row++;
    }
    for (let r = row; r < N; r++) if (rows[r][N]) return null; // unsolvable
    const free = [...Array(N).keys()].filter(c => !piv.includes(c));
    let best = null;
    for (let m = 0; m < (1 << free.length); m++) {
      const x = new Array(N).fill(0); free.forEach((c, k) => x[c] = (m >> k) & 1);
      piv.forEach((c, r) => { let v = rows[r][N]; for (const f of free) if (rows[r][f]) v ^= x[f]; x[c] = v; });
      const w = x.reduce((a, b) => a + b, 0); if (!best || w < best.w) best = { w, x };
    }
    return best.x.map((v, i) => v ? i : -1).filter(i => i >= 0);
  };

  // ---------- per-type solvers (play == true -> try to pass; false -> deliberately fail fast) ----------
  B.solve = (play = true) => {
    const id = R.id;
    if (!play) {
      if (R.def.verify === 'pad' || R.def.verify === 'both') { B.toVerify(); return B.awaitResult(); }
      if (id === 'lights') { B.goCell(0); B.sit(); B.goCell(0); B.sit(); }  // two presses cancel: not solved; wait it out? lights has no timer
      for (let f = 0; f < 60 * 40 && mode === 'play'; f++) { key.left = (f % 120) < 60; key.right = !key.left; B.frame(); }
      B.release(); return B.awaitResult();
    }
    if (['match', 'timed', 'conveyor'].includes(id)) { B.selectAll(R.hit); B.toVerify(); return B.awaitResult(); }
    if (id === 'traffic') { B.selectAll(R.headT); B.toVerify(); return B.awaitResult(); }
    if (id === 'absurd') { B.selectAll([R.acc[0]]); B.toVerify(); return B.awaitResult(); }
    if (id === 'lights') { const sol = B.lightsSolve(); B.log.push('lights solution ' + JSON.stringify(sol) + ' par ' + R.par.sits); for (const i of B.order(sol)) { B.goCell(i); B.sit(); B.frame(20); } return B.awaitResult(); }
    if (id === 'still') { key.sit = true; pressed.sit = true; B.frame(Math.ceil((R.need + 0.6) * 60)); key.sit = false; return B.awaitResult(); }
    if (id === 'checkbox') {
      for (let f = 0; f < 60 * 30 && mode === 'play'; f++) {
        const b = R.box, dx = b.x - cat.x, dy = b.y + 10 - cat.y, d = Math.hypot(dx, dy);
        key.right = dx > 6; key.left = dx < -6; key.down = dy > 6; key.up = dy < -6;
        if (d < 120 && cat.dashCd <= 0) { pressed.dash = true; }
        if (Math.abs(cat.x - b.x) < 40 && Math.abs(cat.y - 10 - b.y) < 40) { pressed.sit = true; }
        B.frame();
      }
      B.release(); return B.awaitResult();
    }
    if (id === 'boss') {
      for (let tries = 0; tries < 12 && mode === 'play'; tries++) {
        const want = R.hit.filter(j => j !== R.friend.tile), fix = R.tiles.map((t, i) => (t.sel !== want.includes(i)) ? i : -1).filter(i => i >= 0);
        if (!fix.length) {
          if (R.friend.moveT > 1.6) { B.toVerify(); return B.awaitResult(); }
          B.frame(10); continue;
        }
        for (const i of B.order(fix)) { const w2 = R.hit.filter(j => j !== R.friend.tile); if (R.tiles[i].sel !== w2.includes(i) && B.goCell(i)) B.sit(); }
      }
      B.toVerify(); return B.awaitResult();
    }
    if (id === 'falling') return B.solveFalling();
    B.log.push('no solver for ' + id); B.toVerify(); return B.awaitResult();
  };
  // falling: BFS over intact tiles (walk to neighbours, hop over one broken tile), re-planned after every leg
  B.solveFalling = () => {
    const ok = i => i >= 0 && R.tiles[i].state === 'ok';
    const plan = (from, to) => {
      const prev = new Map([[from, null]]), q = [from];
      while (q.length) { const u = q.shift(); if (u === to) break;
        for (const d of DIR4) { const a = stepCell(u, d), b = stepCell(u, d, 2);
          if (ok(a) && !prev.has(a)) { prev.set(a, { u, hop: false, d }); q.push(a); }
          else if (a >= 0 && !ok(a) && ok(b) && !prev.has(b)) { prev.set(b, { u, hop: true, d }); q.push(b); } } }
      if (!prev.has(to)) return null; const path = []; let v = to; while (prev.get(v)) { const e = prev.get(v); path.unshift({ to: v, ...e }); v = e.u; } return path;
    };
    // enter the grid from the bottom row
    let cur = cellAt(cat.x, cat.y);
    if (cur < 0) { const entry = (G.rows - 1) * G.cols + Math.min(G.cols - 1, Math.max(0, Math.round((cat.x - G.x) / G.pitch - 0.5))); B.goCell(entry); cur = entry; }
    const targets = R.hit.slice();
    while (targets.length && mode === 'play') {
      targets.sort((a, b) => (plan(cur, a) || [1, 1, 1, 1, 1, 1, 1, 1, 1]).length - (plan(cur, b) || [1, 1, 1, 1, 1, 1, 1, 1, 1]).length);
      const t = targets.shift(), path = t === cur ? [] : plan(cur, t);
      if (!path) { B.log.push('falling: no path to ' + t); continue; }
      for (const e of path) {
        if (mode !== 'play') break;
        if (e.hop) {
          const c = cellCenter(e.u), dx = e.d[1], dy = e.d[0];
          B.walkTo(c.x + dx * G.pitch * 0.42, c.y + 8 + dy * G.pitch * 0.42, { tol: 5 });
          const k = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up'; key[k] = true; pressed.hop = true; B.frame(34); key[k] = false; B.frame(2);
        } else B.goCell(e.to);
        cur = cellAt(cat.x, cat.y);
      }
      if (mode === 'play' && cellAt(cat.x, cat.y) === t && !R.tiles[t].sel) B.sit();
    }
    if (mode === 'play') {
      // leave downwards: hop off the bottom edge then walk to VERIFY
      const bottom = [...Array(G.cols).keys()].map(c => (G.rows - 1) * G.cols + c).map(i => ({ i, p: i === cur ? [] : plan(cur, i) })).filter(o => o.p).sort((a, b) => a.p.length - b.p.length)[0];
      if (bottom) for (const e of bottom.p) { if (e.hop) { const c = cellCenter(e.u), dx = e.d[1], dy = e.d[0]; B.walkTo(c.x + dx * G.pitch * 0.42, c.y + 8 + dy * G.pitch * 0.42, { tol: 5 }); const k = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up'; key[k] = true; pressed.hop = true; B.frame(34); key[k] = false; B.frame(2); } else B.goCell(e.to); }
      const c = cellCenter(cellAt(cat.x, cat.y) >= 0 ? cellAt(cat.x, cat.y) : 0); B.walkTo(c.x, c.y + G.pitch * 0.4, { tol: 5 });
      key.down = true; pressed.hop = true; B.frame(34); key.down = false;
      B.toVerify();
    }
    return B.awaitResult();
  };
  return B;
})();
