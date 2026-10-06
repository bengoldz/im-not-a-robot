// ===== 40-grid.js: grid geometry, tiles, default tile faces, selection, pushing, entities (ghost cats), icon groups =====
// Cells are indexed i = r * G.cols + c (reading order). R.tiles[i] is the tile object currently IN cell i.
// Tiles can move between cells (pushTile / swapCells); t.i / t.r / t.c always hold its current cell, t.home its first one.
// Anything that belongs to a CELL rather than a tile (a sokoban slot outline, an ice rock) should live in your own
// cell-indexed array on R and be drawn in drawUnder / drawOverlay.

// ---------- geometry ----------
const G = { cols: 0, rows: 0, x: GRID.x, y: GRID.y, w: 0, h: 0, pitch: 0, ts: 0, gap: 6, rowOff: [], area: GRID };
// Pure layout for a cols x rows grid fitted (centred) into the GRID box minus optional margins {l,t,r,b} in px
// (margins leave room for decorations such as nonogram clues).
function gridMetrics(cols, rows = cols, margin) {
  const m = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, margin || {});
  const area = { x: GRID.x + m.l, y: GRID.y + m.t, w: GRID.w - m.l - m.r, h: GRID.h - m.t - m.b };
  if (!cols || !rows) return { cols: 0, rows: 0, x: area.x, y: area.y, w: 0, h: 0, pitch: 0, ts: 0, gap: 6, area };
  const mx = Math.max(cols, rows), gap = mx <= 3 ? 6 : mx <= 5 ? 5 : 4;
  const pitch = Math.min((area.w + gap) / cols, (area.h + gap) / rows), ts = pitch - gap, w = cols * pitch - gap, h = rows * pitch - gap;
  return { cols, rows, gap, pitch, ts, w, h, x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, area };
}
function setGrid(cols, rows = cols, margin) { Object.assign(G, gridMetrics(cols, rows, margin)); G.rowOff = new Array(G.rows).fill(0); }
const DIRS = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
const DIR4 = [DIRS.up, DIRS.right, DIRS.down, DIRS.left];
const inGrid = (r, c) => r >= 0 && r < G.rows && c >= 0 && c < G.cols;
const idx = (r, c) => inGrid(r, c) ? r * G.cols + c : -1;
const rcOf = i => [Math.floor(i / G.cols), i % G.cols];
function stepCell(i, dir, k = 1) { if (i < 0 || !G.cols) return -1; return idx(Math.floor(i / G.cols) + dir[0] * k, i % G.cols + dir[1] * k); }
function neighbors4(i) { return DIR4.map(d => stepCell(i, d)).filter(j => j >= 0); }
// top-left pixel of cell i (follows conveyor row offsets)
function cellXY(i) {
  const r = Math.floor(i / G.cols), c = i % G.cols, L = G.cols * G.pitch, o = G.rowOff[r] || 0;
  return { x: G.x + (o ? ((((c * G.pitch + o) % L) + L) % L) : c * G.pitch), y: G.y + r * G.pitch };
}
function cellCenter(i) { const p = cellXY(i); return { x: p.x + G.ts / 2, y: p.y + G.ts / 2 }; }
// where a cat's FEET go when it stands on cell i (a bit below the centre so the body looks centred on the tile)
function cellFoot(i) { const c = cellCenter(i); return { x: c.x, y: c.y + Math.min(G.ts * 0.2, 20) }; }
// cell under a point (the cat's feet), -1 outside
function cellAt(x, y) {
  if (!G.cols || x < G.x || x > G.x + G.w || y < G.y || y > G.y + G.h) return -1;
  const r = clamp(Math.floor((y - G.y) / G.pitch), 0, G.rows - 1), L = G.cols * G.pitch, o = G.rowOff[r] || 0;
  const c = Math.floor(((((x - G.x - o) % L) + L) % L) / G.pitch);
  return r * G.cols + clamp(c, 0, G.cols - 1);
}
const tileAt = cellAt;

// ---------- tiles ----------
// Tile fields understood by the default drawer / engine (all optional):
//   icon 'fish'        icon tile (art/icons or defineIcon)          sel        selected (blue check badge)
//   faceDown           card back (HUMANCHECK eye)                    word 'FISH' wooden word block
//   pipe 0..15         cable bitmask 1=up 2=right 4=down 8=left; rot = quarter turns clockwise; lit = cable glows
//   wall               solid block, the cat (and pushes) can't enter  push       pushable (walk into it)
//   empty              bare floor; a pushed tile may move into it    lit        warm glow   dim  darkened
//   hidden             not drawn                                     noSelect   default sit won't select it
//   state 'ok' | 'crumble' | 'gone'   (gone = hole: the cat falls if it stands on it)
//   anything else you like (data for your round). fx = juice state (see 20-juice.js), managed by the engine.
function makeTile(spec, i) {
  const t = typeof spec === 'string' ? { icon: spec } : Object.assign({}, spec || {});
  t.i = i; t.home = i; t.r = Math.floor(i / G.cols); t.c = i % G.cols;
  if (t.sel == null) t.sel = false;
  t.state = t.state || 'ok'; t.t = 0; t.sa = 1; t.fx = null; tileFx(t);
  return t;
}
function setTile(i, spec) { const t = makeTile(spec, i); R.tiles[i] = t; return t; }
function selected() { return R && R.tiles ? R.tiles.map((t, i) => t.sel ? i : -1).filter(i => i >= 0) : []; }
function tilesWhere(fn) { return R.tiles.map((t, i) => fn(t, i) ? i : -1).filter(i => i >= 0); }
// select / unselect with the standard juice: squash, check-mark stroke, ring burst, musical pop (pitch rises per selection)
function selectTile(t, on = !t.sel, opts = {}) {
  if (!t || t.sel === on) return;
  t.sel = on; const c = cellCenter(t.i), f = tileFx(t);
  if (on) {
    R.selN++; tileSquash(t); f.chk = 0; tween(f, { chk: 1 }, 0.18, { ease: 'outQuad' });
    burst(c.x, c.y, C.blue, 7); if (!opts.quiet) SFX.pop(R.selN - 1);
    if (opts.text !== false) addTxt(cat.x, cat.y - 54, pick(['it fits, I sits ✓', '✓', 'mine ✓', 'selected ✓']), C.blue);
  } else {
    tileSquash(t, 0.97, 1.02, 0.16); if (!opts.quiet) SFX.desel();
    if (opts.text !== false) addTxt(cat.x, cat.y - 54, 'nevermind', C.grey);
  }
}
// swap the tiles in cells a and b (animated slide)
function swapCells(a, b, { slide = true, dur = 0.14 } = {}) {
  const A = R.tiles[a], B = R.tiles[b], pa = cellXY(a), pb = cellXY(b);
  R.tiles[a] = B; R.tiles[b] = A;
  A.i = b; A.r = Math.floor(b / G.cols); A.c = b % G.cols; B.i = a; B.r = Math.floor(a / G.cols); B.c = a % G.cols;
  if (slide) { tileSlide(A, pa.x - pb.x, pa.y - pb.y, dur); tileSlide(B, pb.x - pa.x, pb.y - pa.y, dur); }
}

// ---------- entities (extra controllable / scripted cats on the grid, e.g. the mirror ghost) ----------
// addEntity({ cell, alpha, filter }) -> e. Drawn as a cat with the given alpha + canvas filter. Move with moveEntity(e, dir).
function addEntity(opts = {}) {
  const e = Object.assign({ kind: 'ghost', cell: -1, x: 0, y: 0, z: 0, vx: 0, vy: 0, face: 1, sx: 1, sy: 1, hopT: 0, dashT: 0, sitT: 0, sitHold: false,
    fall: 0, walkT: 0, mv: null, alpha: 0.62, filter: null, glitch: true }, opts);
  e.rig = newCatRig();
  if (e.cell >= 0) { const f = cellFoot(e.cell); e.x = f.x; e.y = f.y; }
  R.ents.push(e); return e;
}
function entityAt(i) { return R && R.ents ? R.ents.find(e => e.cell === i) || null : null; }

// ---------- pushing / entering ----------
// can the tile in cell i be pushed one cell in dir ([dr, dc])? Target must be in the grid, `empty`, and not occupied.
function canPush(i, dir) {
  const t = R.tiles[i]; if (!t || !t.push) return false;
  const j = stepCell(i, dir); if (j < 0) return false;
  const u = R.tiles[j];
  return !!u && !!u.empty && !u.wall && !u.push && !entityAt(j) && cat.cell !== j;
}
// push it (swap with the empty floor in front): slides with easeOutCubic, dust puff, wooden thock, onPush hook
function pushTile(i, dir) {
  if (!canPush(i, dir)) return false;
  const j = stepCell(i, dir); swapCells(i, j, { dur: 0.16 });
  const c = cellCenter(j); dust(c.x - dir[1] * G.ts * 0.45, c.y - dir[0] * G.ts * 0.45 + G.ts * 0.25, 6, 18); SFX.thock();
  R.stats.pushes++;
  if (R.def.onPush) R.def.onPush(R, R.tiles[j], i, j);
  return true;
}
// default movement rule: no walls / blocks; pushables only if they can be pushed in that direction.
// info = { dir, ent (the entity moving, if not the cat), push (false = pushing not allowed) }
function canEnterCell(from, to, info = {}) {
  if (to < 0 || !R) return false;
  if (R.def.canEnter) { const v = R.def.canEnter(R, from, to, info); if (v != null) return !!v; }
  const t = R.tiles[to]; if (!t || t.wall || t.block) return false;
  if (info.ent && cat.cell === to) return false;
  if (entityAt(to) && entityAt(to) !== info.ent) return false;
  if (t.push) return info.push !== false && !!info.dir && canPush(to, info.dir);
  return true;
}

// ---------- icon groups (for decoys that get more similar as d rises) ----------
const ICON_GROUPS = {
  vehicles: ['car', 'bus', 'bicycle', 'boat'],
  animals: ['fish', 'cat', 'dog', 'duck'],
  sky: ['sun', 'cloud', 'moon', 'balloon', 'umbrella'],
  street: ['hydrant', 'trafficlight', 'crosswalk', 'house', 'stairs'],
  things: ['sock', 'crown', 'pizza', 'toaster', 'ball', 'bone'],
  nature: ['tree', 'mountain', 'cactus', 'rock'],
};
const groupOf = icon => Object.keys(ICON_GROUPS).find(k => ICON_GROUPS[k].includes(icon)) || null;
// one decoy icon for `target`: with probability `similar` (0..1) from the target's own group, otherwise from anything else
function pickDecoy(target, similar, rng, exclude = []) {
  const grp = (ICON_GROUPS[groupOf(target)] || []).filter(k => k !== target && !exclude.includes(k));
  const others = ICONS.filter(k => k !== target && k !== 'crosswalk' && !exclude.includes(k));
  return grp.length && rng.chance(similar) ? rng.pick(grp) : rng.pick(others);
}

// ---------- drawing ----------
function drawGrid() {
  if (!R) return;
  if (R.def.drawUnder) R.def.drawUnder(R, ctx);
  if (!G.cols) return;
  if (R.def.drawTiles) { R.def.drawTiles(R, ctx); return; }
  const wrapRows = G.rowOff.some(o => o);
  ctx.save();
  if (wrapRows) { ctx.beginPath(); ctx.rect(G.x - 2, G.y - 2, G.w + 4, G.h + 4); ctx.clip(); }
  const L = G.cols * G.pitch;
  for (let i = 0; i < R.tiles.length; i++) {
    const t = R.tiles[i], p = cellXY(i);
    drawTileAt(t, p.x, p.y); if (wrapRows && p.x + G.ts > G.x + G.w) drawTileAt(t, p.x - L, p.y);
  }
  ctx.restore();
}
// hover highlight: outlines the cell the cat is on in free mode (catCell(): exactly the cell a SIT acts on right now).
// Hidden mid-hop / dash / fall and outside play. A round can opt out with def.hover = false.
function drawCatHover() {
  if (mode !== 'play' || !R || !G.cols || R.def.hover === false || isStepMode()) return;
  if (cat.hopT > 0 || cat.dashT > 0 || cat.fall > 0) return;
  const i = catCell(); if (i < 0 || !R.tiles[i] || R.tiles[i].hidden) return;
  const p = cellXY(i), L = G.cols * G.pitch, wrap = G.rowOff.some(o => o);
  ctx.save();
  if (wrap) { ctx.beginPath(); ctx.rect(G.x - 4, G.y - 4, G.w + 8, G.h + 8); ctx.clip(); }
  ctx.globalAlpha = 0.82 + 0.12 * Math.sin(time * 4);
  for (const x of wrap && p.x + G.ts > G.x + G.w ? [p.x, p.x - L] : [p.x]) {
    ctx.lineWidth = 4; ctx.strokeStyle = C.blue; ctx.beginPath(); ctx.roundRect(x - 1, p.y - 1, G.ts + 2, G.ts + 2, 8); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x + 2, p.y + 2, G.ts - 4, G.ts - 4, 6); ctx.stroke();
  }
  ctx.restore();
}
function drawTileAt(t, x, y) {
  if (t.hidden) return;
  const s = G.ts, f = t.fx;
  if (t.state === 'gone' && t.t > 0.6) { drawHole(x, y, s); return; }
  const wig = f.wig > 0 ? Math.sin(f.wig * Math.PI * 6) * (1 - f.wig) * 5 : 0;
  ctx.save(); ctx.translate(x + s / 2 + f.ox + wig, y + s / 2 + f.oy);
  if (t.state === 'gone') { ctx.fillStyle = '#0b1024'; ctx.fillRect(-s / 2, -s / 2, s, s); const k = 1 - t.t / 0.6; ctx.rotate((1 - k) * 0.8); ctx.scale(k, k); ctx.globalAlpha = k; }
  if (t.state === 'crumble') ctx.translate(rnd(-3, 3), rnd(-3, 3));
  const flipS = f.flip > 0 ? Math.abs(Math.cos(f.flip * Math.PI)) : 1, k = t.sa * f.sq;
  ctx.scale(k * Math.max(0.02, flipS), k);
  if (f.rot) ctx.rotate(f.rot);
  const face = f.before && f.flip > 0.5 ? Object.assign({}, t, f.before) : t;
  drawTileFace(face, -s / 2, -s / 2, s);
  if (t.state === 'crumble') ln(ctx, [[-s / 3, -s / 2], [-5, 0], [s / 4, s / 2]], 2);
  if (f.flash > 0) { ctx.globalAlpha = Math.min(1, f.flash) * 0.55; ctx.fillStyle = f.flashCol; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.globalAlpha = 1; }
  ctx.restore();
  if (face.sel && t.state !== 'gone' && !face.faceDown && !R.def.noCheck) drawCheckBadge(x + f.ox + wig, y + f.oy, s, f.chk);
}
// the blue check badge in the tile's top-left corner; p = stroke progress 0..1 (draws on)
function drawCheckBadge(x, y, s, p = 1) {
  const r = Math.min(12, s * 0.16), cx = x + r + 2, cy = y + r + 2;
  circ(ctx, cx, cy, r * (0.7 + 0.3 * Math.min(1, p * 2)), C.blue, 0);
  const pts = [[cx - r * 0.5, cy], [cx - r * 0.17, cy + r * 0.42], [cx + r * 0.5, cy - r * 0.42]];
  const L1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), L2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]), d = p * (L1 + L2);
  const path = [pts[0]];
  if (d <= L1) path.push([lerp(pts[0][0], pts[1][0], d / L1), lerp(pts[0][1], pts[1][1], d / L1)]);
  else { path.push(pts[1]); const u = (d - L1) / L2; path.push([lerp(pts[1][0], pts[2][0], u), lerp(pts[1][1], pts[2][1], u)]); }
  if (p > 0.02) ln(ctx, path, Math.max(2, r * 0.25), '#fff');
}
function drawHole(x, y, s) { ctx.fillStyle = '#0b1024'; ctx.fillRect(x, y, s, s); ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.strokeRect(x + 4, y + 4, s - 8, s - 8); ctx.setLineDash([]); }
// the default face of a tile, drawn in the box (x, y, s) — call it from your drawTile to get the standard look underneath
function drawTileFace(t, x, y, s) {
  const g = ctx;
  if (t.faceDown) { drawCardBack(g, x, y, s); return; }
  if (R.def.drawTile && R.def.drawTile(R, g, t, x, y, s)) return;
  drawTileBase(t, x, y, s);
}
function drawTileBase(t, x, y, s) {
  const g = ctx;
  if (R.scene) { const k = R.scene.k || 1, hr = Math.floor(t.home / G.cols), hc = t.home % G.cols; g.drawImage(R.scene, hc * G.pitch * k, hr * G.pitch * k, s * k, s * k, x, y, s, s); }
  else if (t.wall) drawWall(g, x, y, s);
  else if (t.empty) drawFloor(g, x, y, s);
  else if (t.word) drawWordTile(g, t.word, x, y, s, t.wordCol);
  else if (t.pipe != null) drawPipe(g, t, x, y, s);
  else if (t.icon) g.drawImage(iconTile(t.icon, Math.round(s)), x, y, s, s);
  else drawFloor(g, x, y, s);
  if (t.lit && t.pipe == null) { g.save(); g.fillStyle = 'rgba(255,214,90,.22)'; g.fillRect(x, y, s, s); g.lineWidth = 4; g.strokeStyle = '#ffd25a'; g.strokeRect(x + 2, y + 2, s - 4, s - 4); g.restore(); }
  if (t.dim) { g.fillStyle = 'rgba(15,22,48,.45)'; g.fillRect(x, y, s, s); }
}
function drawFloor(g, x, y, s) { g.fillStyle = '#e6ebf3'; g.fillRect(x, y, s, s); g.strokeStyle = '#d3dae6'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, s - 6, s - 6); }
function drawWall(g, x, y, s) {
  g.fillStyle = '#3b4660'; g.fillRect(x, y, s, s); g.fillStyle = '#4a5776'; g.fillRect(x, y, s, s * 0.12); g.fillStyle = '#2c3550'; g.fillRect(x, y + s * 0.88, s, s * 0.12);
  g.strokeStyle = '#2c3550'; g.lineWidth = 2; g.beginPath();
  for (let k = 1; k < 3; k++) { const yy = y + s * k / 3; g.moveTo(x, yy); g.lineTo(x + s, yy); const o = k % 2 ? 0.5 : 0.25; g.moveTo(x + s * o, yy - s / 3); g.lineTo(x + s * o, yy); }
  g.stroke();
}
function drawCardBack(g, x, y, s) {
  g.fillStyle = C.blue; g.fillRect(x, y, s, s); g.strokeStyle = '#ffffff55'; g.lineWidth = Math.max(2, s * 0.03); g.strokeRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84);
  g.fillStyle = '#ffffff22'; for (let k = 0; k < 4; k++) g.fillRect(x + s * 0.08, y + s * (0.2 + k * 0.2), s * 0.84, s * 0.02);
  g.save(); g.translate(x + s / 2, y + s / 2); g.beginPath(); g.ellipse(0, 0, s * 0.2, s * 0.13, 0, 0, 7); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.arc(0, 0, s * 0.075, 0, 7); g.fillStyle = C.ink; g.fill(); g.beginPath(); g.arc(-s * 0.025, -s * 0.03, s * 0.02, 0, 7); g.fillStyle = '#fff'; g.fill(); g.restore();
}
function drawWordTile(g, word, x, y, s, col) {
  g.fillStyle = '#b07a3a'; g.fillRect(x, y, s, s); g.fillStyle = col || '#ecc68b'; g.fillRect(x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.82);
  g.fillStyle = '#ffffff40'; g.fillRect(x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.08);
  let fs = s * 0.3; g.font = `700 ${fs}px ${FONT}`; while (fs > 8 && g.measureText(word).width > s * 0.8) { fs -= 1; g.font = `700 ${fs}px ${FONT}`; }
  g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, x + s / 2, y + s * 0.47);
}
// pipe bitmask after t.rot quarter turns clockwise
function pipeMask(t) { let m = t.pipe & 15; for (let k = 0; k < (((t.rot || 0) % 4) + 4) % 4; k++) m = ((m << 1) | (m >> 3)) & 15; return m; }
function drawPipe(g, t, x, y, s) {
  g.fillStyle = '#dfe6f1'; g.fillRect(x, y, s, s);
  const m = pipeMask(t), cx = x + s / 2, cy = y + s / 2, ends = [[cx, y], [x + s, cy], [cx, y + s], [x, cy]];
  for (const [w, col] of [[s * 0.2, C.ink], [s * 0.12, t.lit ? C.cyan : '#9aa6bb']]) for (let k = 0; k < 4; k++) if (m & (1 << k)) ln(g, [[cx, cy], ends[k]], w, col);
  circ(g, cx, cy, s * 0.11, t.lit ? C.cyan : '#9aa6bb', Math.max(2, s * 0.04));
}
