// ===== 50-cat.js: cat movement. Free (analog, the classic feel) or step (cell by cell on the grid), entities, hooks =====
// Free mode (def.move 'free', default): the cat walks anywhere; walls / pushables are solid; leaning into a pushable for
//   0.12 s pushes it; onStep fires whenever the cell under its feet changes (grounded), onHop when a hop lands.
// Step mode (def.move 'step'): outside the grid the cat walks freely (to reach VERIFY); as soon as it walks into the grid it
//   snaps to a cell and then moves one cell per press (hold = keep walking). Space hops 2 cells (over one), Shift dashes until
//   blocked, walking off an edge leaves the grid (unless def.exitGrid === false). def.moveCat can replace any move's path.

function placeCat(x, y) {
  // (also drops buffered sit / hop presses: a key pressed to skip the result screen must not act in the next round)
  Object.assign(cat, { x, y, vx: 0, vy: 0, z: 0, hopT: 0, dashT: 0, fall: 0, holeT: 0, auto: 0, sitT: 0, sitBuf: 0, hopBuf: 0, mv: null, pushT: 0, pushCell: -1, stepBuf: null, excl: 0 });
  cat.cell = catCellAt(x, y, -1); cat.pad = padAt();
}
// ---------- which cell is the cat on? (free mode) ----------
// The cell under the cat's BODY centre (CAT_BODY px above its feet: the drawn cat's centroid; cellFoot() puts the body on the
// tile centre), with hysteresis: the cat stays on its current cell until the body is CAT_HYST px past the middle of the gap.
// The gap between two tiles is split in the middle. This one cell is what sitting selects, what onStep / holes / conveyors
// use, and what the hover highlight (drawCatHover) outlines.
const CAT_BODY = 17, CAT_HYST = 6;
function cellNear(x, y) {
  if (!G.cols) return -1;
  const g2 = G.gap / 2;
  if (x < G.x - g2 || x >= G.x + G.w + g2 || y < G.y - g2 || y >= G.y + G.h + g2) return -1;
  const r = clamp(Math.floor((y - G.y + g2) / G.pitch), 0, G.rows - 1), L = G.cols * G.pitch, o = G.rowOff[r] || 0;
  const c = Math.floor(((((x - G.x - o + g2) % L) + L) % L) / G.pitch);
  return r * G.cols + clamp(c, 0, G.cols - 1);
}
function catCellAt(x, y, prev = -1) {
  if (!G.cols) return -1;
  const by = y - CAT_BODY;
  if (prev >= 0 && prev < G.cols * G.rows) {
    const p = cellXY(prev), H = G.gap / 2 + CAT_HYST, L = G.cols * G.pitch;
    for (const ox of [0, -L, L]) if (x >= p.x + ox - H && x <= p.x + ox + G.ts + H && by >= p.y - H && by <= p.y + G.ts + H && x >= G.x - H && x <= G.x + G.w + H) return prev;
  }
  return cellNear(x, by);
}
// put the cat on cell i (step-mode rounds use spec.catStart for this)
function catToCell(i, instant = true) {
  const f = cellFoot(i);
  if (instant) { cat.x = f.x; cat.y = f.y; cat.cell = i; cat.mv = null; }
  else startMove(cat, [i], 'walk', [0, 0]);
}
const isStepMode = () => !!(R && R.def.move === 'step' && G.cols && (mode === 'play' || mode === 'verifying' || mode === 'result'));
// the cell the cat is standing on (-1 = not on the grid)
function catCell() { return isStepMode() ? cat.cell : catCellAt(cat.x, cat.y, cat.cell); }
function catFall() { if (cat.fall > 0) return; cat.fall = 0.001; SFX.fall(); }

// ---------- hook dispatch ----------
function fireStep(from, to, info) {
  if (!R || mode !== 'play') return;
  if (to >= 0) R.stats.steps++;
  if (to >= 0 && !R.entered) { R.entered = true; if (R.intro && R.slot > 0) catExclaim(); }
  if (R.def.onStep) R.def.onStep(R, from, to, info);
}
function fireHop(from, to, info) { if (!R || mode !== 'play') return; if (R.def.onHop) R.def.onHop(R, from, to, info); }

// ---------- shared cell-to-cell movement (cat + entities) ----------
// path: cell indices (or -1 with m.target for leaving the grid); how: walk | dash | slide | hop | exit | snap
function startMove(e, path, how, dir, target) {
  const dur = how === 'hop' ? 0.42 : how === 'dash' || how === 'slide' ? 0.075 : how === 'exit' ? 0.16 : how === 'snap' ? 0.1 : clamp(G.pitch / 480, 0.12, 0.2);
  e.mv = { path, k: 0, how, dir, t: 0, fx: e.x, fy: e.y, dur, target };
  if (dir && dir[1]) e.face = dir[1];
  if (how === 'hop') { SFX.hop(); e.sx = 0.8; e.sy = 1.25; } else if (how === 'dash' && e === cat) { SFX.dash(); dust(e.x, e.y, 3, 10); }
}
function advanceMove(e, dt) {
  const m = e.mv, seg = m.path[m.k], to = seg === -1 || seg == null ? m.target : cellFoot(seg);
  const ox = e.x, oy = e.y; m.t += dt;
  const p = Math.min(1, m.t / m.dur);
  e.x = lerp(m.fx, to.x, p); e.y = lerp(m.fy, to.y, p);
  if (m.how === 'hop') { e.z = Math.sin(Math.PI * p) * 26; e.hopT = Math.max(0.001, (1 - p) * HOPD); }
  if (dt > 0) { e.vx = (e.x - ox) / dt; e.vy = (e.y - oy) / dt; }
  if (m.how === 'dash' || m.how === 'slide') { if (Math.random() < 0.5) dust(e.x, e.y, 1, 6); if (m.how === 'dash') e.dashT = 0.05; }
  if (p < 1) return;
  const from = e.cell; e.cell = seg == null ? -1 : seg; m.k++; m.t = 0; m.fx = e.x; m.fy = e.y;
  if (m.how === 'hop') { e.z = 0; e.hopT = 0; e.sx = 1.3; e.sy = 0.75; SFX.land(); dust(e.x, e.y, 5, 16); }
  const done = m.k >= m.path.length;
  if (done) { e.mv = null; e.vx = e.vy = 0; e.dashT = 0; }
  if (e === cat) {
    if (m.how === 'hop') { R.stats.hops++; fireHop(from, e.cell, { dir: m.dir, over: m.over == null ? -1 : m.over }); }
    else fireStep(from, e.cell, { dir: m.dir, how: m.how });
  } else if (e.onArrive) e.onArrive(from, e.cell, m);
}
function bump(e, dir) { e.sx = dir && dir[1] ? 0.88 : 1.08; e.sy = dir && dir[1] ? 1.08 : 0.88; if (e === cat) tone(120, 0.06, 'sine', 0.05); }

// default path of one step-mode move (used when def.moveCat returns null/undefined)
function defaultPath(from, dir, how) {
  if (how === 'hop') {
    const j1 = stepCell(from, dir), j2 = stepCell(from, dir, 2);
    if (j2 >= 0 && canEnterCell(from, j2, { dir, push: false, hop: true })) return { path: [j2], how: 'hop', over: j1 };
    if (j1 >= 0 && canEnterCell(from, j1, { dir, push: false, hop: true })) return { path: [j1], how: 'hop', over: -1 };
    return { path: [from], how: 'hop', over: -1 };
  }
  if (how === 'dash') {
    const path = []; let k = from;
    for (;;) { const j = stepCell(k, dir); if (j < 0 || !canEnterCell(k, j, { dir, push: false })) break; path.push(j); k = j; }
    return { path, how: 'dash' };
  }
  const j = stepCell(from, dir);
  if (j < 0) return { path: [], how: 'exit' };
  return { path: canEnterCell(from, j, { dir }) ? [j] : [], how: 'walk' };
}
function catTryMove(dir, how) {
  const c = cat, from = c.cell;
  let res = R.def.moveCat ? R.def.moveCat(R, from, dir, how) : null, path, mhow = how, over = -1;
  if (res == null) res = defaultPath(from, dir, how);
  if (Array.isArray(res)) path = res; else { path = res.path || []; mhow = res.how || how; over = res.over == null ? -1 : res.over; }
  if (R.def.onMove) R.def.onMove(R, from, dir, mhow, path);
  if (mode !== 'play') return;
  if (dir[1]) c.face = dir[1];
  if (mhow === 'exit') {
    if (R.def.exitGrid === false) { bump(c, dir); return; }
    const f = cellFoot(from), tx = clamp(f.x + dir[1] * G.pitch * 0.8, PANEL.x + 14, PANEL.x + PANEL.w - 14), ty = clamp(f.y + dir[0] * G.pitch * 0.8, PANEL.y + 36, PANEL.y + PANEL.h - 4);
    if (cellAt(tx, ty) >= 0) { bump(c, dir); return; }
    startMove(c, [-1], 'exit', dir, { x: tx, y: ty }); return;
  }
  if (!path.length) { bump(c, dir); return; }
  if (mhow !== 'hop' && R.tiles[path[0]] && R.tiles[path[0]].push) { if (!pushTile(path[0], dir)) { bump(c, dir); return; } }
  if (mhow === 'dash') R.stats.dashes++;
  startMove(c, path, mhow, dir); c.mv.over = over;
}

// ---------- the cat ----------
function updateCat(dt) {
  const c = cat;
  c.dashCd -= dt; c.hopBuf -= dt; c.sitBuf -= dt; c.sitT -= dt; c.excl = Math.max(0, c.excl - dt);
  c.sx += (1 - c.sx) * Math.min(1, dt * 12); c.sy += (1 - c.sy) * Math.min(1, dt * 12);
  if (c.fall > 0) { c.fall += dt; if (c.fall > 0.9 && mode === 'play') finish({ pass: false, verdict: 'Cat fell through the internet. Very robot behavior.' }); return; }
  const frozen = mode === 'verifying' || mode === 'result';
  if (pressed.hop) c.hopBuf = 0.14; if (pressed.sit) c.sitBuf = 0.2;
  let ix = (key.right ? 1 : 0) - (key.left ? 1 : 0), iy = (key.down ? 1 : 0) - (key.up ? 1 : 0);
  if (ix || iy || pressed.hop || pressed.dash) lastInputT = time;
  if (c.auto > 0) { c.auto -= dt; ix = c.autoD.x; iy = c.autoD.y; }
  if (frozen) { ix = iy = 0; c.hopBuf = 0; }
  // sit FIRST, on the state the player is looking at (the last rendered frame: same cat position, same hover highlight).
  // Not mid-hop / dash / step-move, and not while a grid entity (mirror ghost) is still moving (the press stays buffered).
  // The cat stops dead, so it can't slide into the next cell after selecting this one.
  const entBusy = R && R.ents && R.ents.some(e => e.mv);
  if (c.sitBuf > 0 && c.hopT <= 0 && c.dashT <= 0 && !frozen && !c.mv && !entBusy) { c.sitBuf = 0; c.sitT = 0.3; c.sx = 1.15; c.sy = 0.85; c.vx = c.vy = 0; sitAction(); }
  if (isStepMode() && (c.cell >= 0 || c.mv)) updateCatStep(dt, ix, iy, frozen);
  else updateCatFree(dt, ix, iy, frozen);
  const grounded = c.hopT <= 0;
  const p = grounded ? padAt() : c.pad;
  if (p !== c.pad) { c.pad = p; enterPad(p); }
  // holes: standing on a 'gone' tile drops the cat
  if (mode === 'play' && grounded && !c.mv && G.cols && R) {
    const t = catCell();
    if (t >= 0 && R.tiles[t].state === 'gone') { c.holeT += dt; if (c.holeT > 0.09) catFall(); } else c.holeT = 0;
  }
}
function updateCatStep(dt, ix, iy, frozen) {
  const c = cat;
  const pdir = pressed.up ? DIRS.up : pressed.down ? DIRS.down : pressed.left ? DIRS.left : pressed.right ? DIRS.right : null;
  if (c.mv) { if (pdir || pressed.hop || pressed.dash) c.stepBuf = { dir: pdir, hop: pressed.hop, dash: pressed.dash, t: 0.18 }; advanceMove(c, dt); }
  if (c.stepBuf) { c.stepBuf.t -= dt; if (c.stepBuf.t <= 0) c.stepBuf = null; }
  if (c.mv || frozen || mode !== 'play') { if (!c.mv) c.vx = c.vy = 0; return; }
  const buf = c.stepBuf, held = iy < 0 ? DIRS.up : iy > 0 ? DIRS.down : ix < 0 ? DIRS.left : ix > 0 ? DIRS.right : null;
  let dir = pdir || (buf && buf.dir) || held, how = 'walk';
  if (c.hopBuf > 0 || (buf && buf.hop)) { how = 'hop'; c.hopBuf = 0; }
  else if ((pressed.dash || (buf && buf.dash)) && c.dashCd <= 0) { how = 'dash'; c.dashCd = 0.3; if (!dir) dir = [0, c.face]; }
  c.stepBuf = null;
  if (how === 'hop' && !dir) { startMove(c, [c.cell], 'hop', null); c.mv.over = -1; return; }
  if (dir) catTryMove(dir, how); else { c.vx = c.vy = 0; }
}
function updateCatFree(dt, ix, iy, frozen) {
  const c = cat, len = Math.hypot(ix, iy);
  if (len) { ix /= len; iy /= len; c.dir = { x: ix, y: iy }; if (Math.abs(ix) > 0.1) c.face = Math.sign(ix); }
  const grounded = c.hopT <= 0, play = mode === 'play' && R && G.cols;
  const sitting = grounded && c.dashT <= 0 && (key.sit || c.sitT > 0 || frozen);
  let landed = false;
  if (c.hopBuf > 0 && grounded && !frozen) { c.hopT = HOPD; c.hopBuf = 0; SFX.hop(); c.sx = 0.8; c.sy = 1.25; if (R) R.stats.hops++; }
  if (c.hopT > 0) { c.hopT -= dt; c.z = Math.sin(Math.PI * (1 - Math.max(0, c.hopT) / HOPD)) * 26; if (c.hopT <= 0) { c.z = 0; c.sx = 1.3; c.sy = 0.75; SFX.land(); dust(c.x, c.y, 5, 16); landed = true; } }
  if (pressed.dash && c.dashCd <= 0 && !frozen) { const d = len ? { x: ix, y: iy } : { x: c.face, y: 0 }; c.dashT = 0.16; c.dashCd = 0.42; c.vx = d.x * 640; c.vy = d.y * 640; SFX.dash(); c.sx = 1.4; c.sy = 0.7; dust(c.x, c.y, 3, 10); if (R) R.stats.dashes++; }
  if (c.dashT > 0) { c.dashT -= dt; if (Math.random() < 0.7) parts.push({ x: c.x - c.vx * 0.03, y: c.y - 8 - c.z, vx: 0, vy: 0, life: 0.25, max: 0.25, col: '#ffffffaa', sz: 6 }); if (Math.random() < 0.4) dust(c.x, c.y, 1, 8); }
  else { const sp = sitting ? 0 : 215; c.vx += (ix * sp - c.vx) * Math.min(1, dt * 16); c.vy += (iy * sp - c.vy) * Math.min(1, dt * 16); }
  let nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
  if (play && mode === 'play') {
    if (R.def.move === 'step' && grounded) {
      // walking into the grid of a step-mode round: snap onto the cell (or get blocked)
      const j = cellAt(nx, ny);
      if (j >= 0) {
        const dx = nx - c.x, dy = ny - c.y, dir = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
        if (canEnterCell(-1, j, { dir })) {
          if (R.tiles[j].push && !pushTile(j, dir)) { nx = c.x; ny = c.y; }
          else { c.x = nx; c.y = ny; c.vx = c.vy = 0; c.cell = -1; startMove(c, [j], 'snap', dir); return; }
        } else { nx = c.x; ny = c.y; c.vx = c.vy = 0; }
      }
    } else {
      // solid cells (walls, blocks, pushables) in free mode; lean into a pushable to push it
      // (tested at the body point, like catCellAt, so the cat can never stand "on" a solid cell)
      const cur = cellNear(c.x, c.y - CAT_BODY), solid = (x, y) => { const i = cellNear(x, y - CAT_BODY); if (i < 0 || i === cur) return -1; const t = R.tiles[i]; return t.wall || t.block || t.push ? i : -1; };
      let pushing = -1, pdir = null;
      const sx = solid(nx, c.y); if (sx >= 0) { if (R.tiles[sx].push) { pushing = sx; pdir = [0, Math.sign(c.vx)]; } nx = c.x; c.vx = 0; }
      const sy = solid(nx, ny); if (sy >= 0) { if (R.tiles[sy].push && pushing < 0) { pushing = sy; pdir = [Math.sign(c.vy), 0]; } ny = c.y; c.vy = 0; }
      if (pushing >= 0 && len) { if (c.pushCell === pushing) c.pushT += dt; else { c.pushCell = pushing; c.pushT = 0; } if (c.pushT > 0.12) { pushTile(pushing, pdir); c.pushT = 0; } }
      else { c.pushCell = -1; c.pushT = 0; }
    }
  }
  c.x = nx; c.y = ny;
  c.x = clamp(c.x, PANEL.x + 14, PANEL.x + PANEL.w - 14); c.y = clamp(c.y, PANEL.y + 36, PANEL.y + PANEL.h - 4);
  if (Math.hypot(c.vx, c.vy) > 20 && grounded) { c.walkT += dt * 12; if (Math.floor(c.walkT / Math.PI) !== Math.floor((c.walkT - dt * 12) / Math.PI)) SFX.step(); }
  // free-mode cell tracking -> onStep / onHop
  if (play && (grounded || landed) && R.def.move !== 'step') {   // (|| landed: `grounded` was sampled before this frame's landing, so onHop never fired)
    const cell = catCellAt(c.x, c.y, c.cell);
    if (landed) { const from = c.cell; c.cell = cell; fireHop(from, cell, { dir: [Math.sign(c.dir.y), Math.sign(c.dir.x)], over: -1 }); }
    else if (cell !== c.cell) { const from = c.cell; c.cell = cell; fireStep(from, cell, { dir: from >= 0 && cell >= 0 ? [Math.sign(rcOf(cell)[0] - rcOf(from)[0]), Math.sign(rcOf(cell)[1] - rcOf(from)[1])] : [0, 0], how: c.dashT > 0 ? 'dash' : 'walk' }); }
  } else if (R && R.def.move === 'step' && !c.mv) c.cell = -1;
}

// ---------- entities ----------
function moveEntity(e, dir, { push = false, how = 'walk' } = {}) {
  const from = e.cell, j = stepCell(from, dir);
  if (dir[1]) e.face = dir[1];
  if (j < 0 || !canEnterCell(from, j, { dir, ent: e, push })) { bump(e, dir); return false; }
  if (push && R.tiles[j].push && !pushTile(j, dir)) { bump(e, dir); return false; }
  startMove(e, [j], how, dir); return true;
}
function entitySit(e) { e.sitT = 0.35; e.sx = 1.15; e.sy = 0.85; }
function updateEntities(dt) {
  if (!R || !R.ents) return;
  for (const e of R.ents) {
    e.sitT -= dt; e.sx += (1 - e.sx) * Math.min(1, dt * 12); e.sy += (1 - e.sy) * Math.min(1, dt * 12);
    if (e.mv) advanceMove(e, dt); else { e.vx = e.vy = 0; }
    if (Math.hypot(e.vx, e.vy) > 20) e.walkT += dt * 12;
  }
}
function drawCats() {
  const list = [cat].concat(R && R.ents && (mode === 'play' || mode === 'verifying' || mode === 'result') ? R.ents : []).sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e === cat) { drawCat(); continue; }
    const gl = e.glitch && Math.random() < 0.05 ? rnd(-3, 3) : 0;
    e.x += gl; drawCat(e, e.rig, { alpha: e.alpha, filter: e.filter }); e.x -= gl;
  }
  if (cat.excl > 0) { const k = Math.min(1, cat.excl * 4), b = Math.abs(Math.sin(cat.excl * 9)) * 4; ctx.globalAlpha = k; txt('!', cat.x + 4, cat.y - cat.z - 66 - b, 30, C.gold, 'center', 700); ctx.globalAlpha = 1; }
}
