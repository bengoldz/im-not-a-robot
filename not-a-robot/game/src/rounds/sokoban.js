// rounds/sokoban.js — SOKOBAN, re-skinned as "Assemble the image".
// A picture (bus, traffic light, robot...) is cut into 2–4 pieces that lie scattered on the grid. The cat pushes them
// (never pulls) into the outlined slots; every piece has ONE right slot (the part of the picture it shows).
// Generation: reverse play ("pulls") from the solved board, then a forward BFS (node cap) proves it solvable and gives
// par = minimum moves. Dead ends are possible in sokoban, so there is a red RESET pad in the footer (walk off the grid
// onto it). The RESET helpers (sokoPad*, sokoRestore) are shared with rules.js.

const SOKO_PICS = {
  h: ['bus', 'car', 'fish', 'bone', 'boat'],               // wide pictures for 1x2 / 1x3 slots
  v: ['trafficlight', 'hydrant', 'cactus', 'tree'],         // tall pictures for 2x1 / 3x1 slots
  s: ['robot', 'house', 'sun', 'pizza', 'crown', 'duck', 'ghost'],   // 2x2
};
const SOKO_PASS = ['The picture is whole again. Like my heart, after you.', 'Jigsaw complete. Humans love jigsaws. Especially on rainy Sundays.', 'Perfectly assembled. Flat-pack furniture fears you.'];
const SOKO_FAIL = ['The picture is still in pieces. So am I.', 'Those pieces do not go there. They told me. Quietly.'];

// ---------- pure helpers (no live grid) ----------
// neighbour of cell i in direction k (0 up, 1 right, 2 down, 3 left) on a cols x rows board, -1 outside
function sokoNb(i, k, cols, rows = cols) {
  const r = Math.floor(i / cols), c = i % cols;
  if (k === 0) return r > 0 ? i - cols : -1;
  if (k === 1) return c < cols - 1 ? i + 1 : -1;
  if (k === 2) return r < rows - 1 ? i + cols : -1;
  return c > 0 ? i - 1 : -1;
}
const SOKO_K = ['U', 'R', 'D', 'L'];
// BFS over (cat, piece cells). Labeled pieces: piece p must end on slots[p]. Returns { len, toks } or null.
function sokoSolve(n, wall, slots, pieces, cat, cap = 160000) {
  const N = n * n, P = pieces.length;
  const enc = (c, ps) => { let k = c; for (let i = 0; i < P; i++) k = k * N + ps[i]; return k; };
  const nodes = [{ c: cat, ps: pieces.slice(), d: 0, par: -1, tok: '' }], seen = new Set([enc(cat, pieces)]);
  for (let h = 0; h < nodes.length; h++) {
    const s = nodes[h];
    if (s.ps.every((p, i) => p === slots[i])) {
      const toks = []; for (let v = h; nodes[v].par >= 0; v = nodes[v].par) toks.push(nodes[v].tok);
      return { len: s.d, toks: toks.reverse(), nodes: nodes.length };
    }
    if (nodes.length > cap) return null;
    for (let k = 0; k < 4; k++) {
      const j = sokoNb(s.c, k, n); if (j < 0 || wall[j]) continue;
      let ps = s.ps; const pi = ps.indexOf(j);
      if (pi >= 0) { const j2 = sokoNb(j, k, n); if (j2 < 0 || wall[j2] || ps.includes(j2)) continue; ps = ps.slice(); ps[pi] = j2; }
      const key = enc(j, ps); if (seen.has(key)) continue; seen.add(key);
      nodes.push({ c: j, ps, d: s.d + 1, par: h, tok: SOKO_K[k] });
    }
  }
  return null;
}
function sokoShapeOf(k, rng) { return k === 2 ? (rng.chance(0.5) ? [1, 2] : [2, 1]) : k === 3 ? (rng.chance(0.5) ? [1, 3] : [3, 1]) : [2, 2]; }

// ---------- shared RESET pad (sokoban + rules) ----------
// the pad sits in a strip under the grid (rounds using it reserve it with SOKO_MARGIN), bottom-left of the GRID box
const SOKO_MARGIN = { b: 38 };
function sokoPadRect() { return { x: GRID.x + 2, y: GRID.y + GRID.h - 32, w: 64, h: 32 }; }
// RESET is a SIT pad (walking across it on the way to VERIFY must not wipe the puzzle). Call sokoPadUpdate from
// update(R) (hover state + hint) and sokoPadSit from onSit (returns true when it handled the sit).
function sokoPadUpdate(R) {
  const on = mode === 'play' && cat.cell < 0 && !cat.mv && inR(cat.x, cat.y, sokoPadRect());
  if (on && !R.padOn) { SFX.tick(); R.padHint = 1.6; }
  R.padOn = on; if (R.padHint > 0) R.padHint -= 1 / 60;
}
function sokoPadSit(R, doReset) {
  if (catCell() >= 0 || !inR(cat.x, cat.y, sokoPadRect())) return false;
  doReset(R); return true;
}
function sokoPadDraw(R, g) {
  const p = sokoPadRect(), on = R.padOn, dy = on ? 3 : 0;
  if (!on) rr(g, p.x + 3, p.y + 6, p.w - 6, p.h - 4, 7, '#a8262b', 0);
  rr(g, p.x, p.y + dy, p.w, p.h - 4, 7, on ? '#c9353a' : C.red, 2.5);
  g.save(); g.translate(p.x + 13, p.y + dy + (p.h - 4) / 2);   // tiny circular arrow
  g.beginPath(); g.arc(0, 0, 6, -0.4, 4.4); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.stroke();
  poly(g, [[6.5, -6], [7.5, 1], [1, -2]], '#fff', 0); g.restore();
  txt('RESET', p.x + p.w / 2 + 8, p.y + dy + (p.h - 4) / 2 + 1, 11, '#fff', 'center', 700);
  if (on) { const w = 92; rr(g, p.x + p.w + 6, p.y + 4, w, 20, 10, C.ink, 0); txt('sit to reset', p.x + p.w + 6 + w / 2, p.y + 14, 12, '#fff', 'center', 600); }
}
// put every tile back to its generated state (diagonal flip wave), cat back on its start cell
function sokoRestore(R) {
  const span = Math.max(1, G.cols + G.rows - 2);
  for (let i = 0; i < R.tiles.length; i++) {
    const t = setTile(i, R.initTiles[i]);
    tileFlip(t, { delay: (t.r + t.c) / span * 0.2, dur: 0.18, before: { faceDown: true } });
  }
  const f0 = { x: cat.x, y: cat.y };
  catToCell(R.catStart, true); cat.sx = 1.3; cat.sy = 0.75;
  dust(f0.x, f0.y, 6, 16); burst(cat.x, cat.y - 16, C.red, 8, 140, 3);
  SFX.whoosh(); SFX.desel();
  say(pick(['Factory reset! The squares forget everything. Lucky squares.', 'Back to the start. Humans call this "a fresh perspective".', 'Reset! Nobody saw that. I deleted the footage.']), 'nervous', 3);
  R.resets = (R.resets || 0) + 1;
}

// ---------- generation ----------
function sokoTry(d, rng, attempt) {
  const n = d < 0.35 ? 4 : 5, N = n * n;
  const k = d < 0.3 ? 2 : d < 0.7 ? 3 : 4;
  const [sh, sw] = sokoShapeOf(k, rng);
  const r0 = rng.int(0, n - sh), c0 = rng.int(0, n - sw), slots = [];
  for (let dr = 0; dr < sh; dr++) for (let dc = 0; dc < sw; dc++) slots.push((r0 + dr) * n + c0 + dc);
  const wall = new Array(N).fill(false);
  const nW = d < 0.3 ? 0 : Math.round(lerp(1, 4, d)) + rng.int(0, 1);
  const free = () => [...Array(N).keys()].filter(i => !wall[i] && !slots.includes(i));
  for (const i of rng.sample(free(), nW)) wall[i] = true;
  const pieces = slots.slice();
  const open = i => i >= 0 && !wall[i] && !pieces.includes(i);
  const cands = [...Array(N).keys()].filter(i => open(i) && [0, 1, 2, 3].some(k => pieces.includes(sokoNb(i, k, n))));
  if (!cands.length) return null;
  let cat = rng.pick(cands);
  // reverse play: the inverse of a push is a PULL (the cat steps away from a piece and drags it along). Mostly pull,
  // sometimes just wander; every intermediate state is reachable backwards, so the start is solvable by construction.
  const steps = Math.round(lerp(40, 70, d)), minSteps = Math.round(lerp(2, 40, d));
  for (let s = 0; s < steps; s++) {
    if (s >= minSteps && pieces.every((p, i) => p !== slots[i])) break;
    const pulls = [], walks = [];
    for (let k = 0; k < 4; k++) {
      const j = sokoNb(cat, k, n); if (!open(j)) continue;
      const back = sokoNb(cat, (k + 2) % 4, n), pi = back >= 0 ? pieces.indexOf(back) : -1;
      (pi >= 0 ? pulls : walks).push([j, pi]);
    }
    if (!pulls.length && !walks.length) break;
    const homeP = pulls.filter(([, pi]) => pieces[pi] === slots[pi]);   // prefer dragging pieces that are still home
    const [j, pi] = pulls.length && (rng.chance(0.65) || !walks.length) ? rng.pick(homeP.length && rng.chance(0.8) ? homeP : pulls) : rng.pick(walks);
    if (pi >= 0) pieces[pi] = cat;
    cat = j;
  }
  const home = pieces.filter((p, i) => p === slots[i]).length;
  if (home > (k === 4 ? 1 : 0)) return null;
  const res = sokoSolve(n, wall, slots, pieces, cat);
  if (!res) return null;
  const relax = Math.floor(attempt / 25) * 2;
  const minL = d === 0 ? 2 : Math.max(3, Math.round(lerp(5, 20, d)) - relax), maxL = d === 0 ? 6 : Math.round(lerp(14, 60, d)) + relax;
  if (res.len < minL || res.len > maxL) return null;
  return { n, wall, slots, pieces, cat, res, shape: [sh, sw] };
}
// hand-made fallback (4x4, 2 pieces, one push each)
function sokoFallback() {
  const n = 4, wall = new Array(16).fill(false), slots = [5, 6], pieces = [9, 10], cat = 13;
  return { n, wall, slots, pieces, cat, res: sokoSolve(n, wall, slots, pieces, cat), shape: [1, 2] };
}

registerRound({
  id: 'sokoban', name: 'Assemble the image',
  minD: 0.3, weight: 1,
  intro: 'Push the picture pieces into the dotted slots. Push only, no pulling. Stuck? Walk off the grid and sit on RESET.',
  again: ['Jigsaw time again. Push, never pull. Like a polite shopping cart.', 'More broken pictures. Fix them with your face. I mean your paws.'],
  move: 'step', verify: 'auto', exitGrid: true, autoDelay: 0.9, noCheck: true,

  generate(d, rng) {
    let L = null;
    for (let a = 0; a < 90 && !L; a++) L = sokoTry(d, rng, a);
    if (!L) L = sokoFallback();
    const { n, wall, slots, pieces, cat, res, shape } = L;
    const kind = shape[0] === shape[1] ? 's' : shape[0] === 1 ? 'h' : 'v';
    const pic = rng.pick(SOKO_PICS[kind]);
    const tiles = [...Array(n * n)].map((_, i) => wall[i] ? { wall: true } : pieces.includes(i) ? { push: true, piece: pieces.indexOf(i), noSelect: true } : { empty: true });
    return {
      grid: n, margin: SOKO_MARGIN, tiles, initTiles: tiles, catStart: cat, slots, shape, pic,
      l1: 'Assemble the image of', big: 'a ' + (pic === 'trafficlight' ? 'traffic light' : pic), l3: 'Walk into a piece to push it. Stuck? Sit on RESET.',
      par: { moves: res.len }, solution: res.toks,
    };
  },

  enter(R) {
    R.stats.moves = 0; R.done = false; R.asm = 0; R.shine = -1; R.padOn = false;
    R.slotOf = new Array(R.tiles.length).fill(-1); R.slots.forEach((s, p) => R.slotOf[s] = p);
    // the full picture, drawn large across the slot block (pieces show their part of it)
    const [sh, sw] = R.shape, bw = sw * G.pitch - G.gap, bh = sh * G.pitch - G.gap, K = 2;
    const c = document.createElement('canvas'); c.width = Math.ceil(bw * K); c.height = Math.ceil(bh * K);
    const g = c.getContext('2d'); g.scale(K, K);
    const bg = (ICON[R.pic] || ['indoor'])[0];
    if (!artDraw(g, 'tiles/' + bg, 0, 0, bw, bh)) { g.fillStyle = BG[bg] || '#dbe5f0'; g.fillRect(0, 0, bw, bh); }
    // square block: the icon as is; strips: the icon stretched along the long side (a long bus, a tall traffic light)
    const m = Math.min(bw, bh), st = Math.min(2.4, Math.max(bw, bh) / m) * 0.97;
    g.save(); g.translate(bw / 2, bh / 2); g.scale(bw >= bh ? st : 1, bh > bw ? st : 1); drawIcon(g, R.pic, 0, 0, m * (sh === sw ? 0.96 : 1.02)); g.restore();
    R.picC = c; R.picK = K; R.picW = bw; R.picH = bh;
  },
  update(R) { sokoPadUpdate(R); },
  moveCat(R, from, dir, how) { return how === 'hop' ? { path: [from], how: 'hop' } : null; },   // no hopping over walls / pieces
  onMove(R, from, dir, how, path) { if (how !== 'hop' && path.length) R.stats.moves += path.length; },
  onPush(R, tile, from, to) {
    const c = cellCenter(to);
    if (R.slotOf[to] === tile.piece) {                        // snapped into its own slot
      tilePop(tile); after(0.05, () => { dust(c.x, c.y + G.ts * 0.3, 10, G.ts * 0.9, '#e6dcc6'); burst(c.x, c.y, C.green, 6, 120, 3); });
      tone(330, 0.09, 'triangle', 0.08, -60, 0.04); tone(660, 0.12, 'sine', 0.04, 0, 0.07);
      addTxt(c.x, c.y - G.ts * 0.45, pick(['click.', 'thock.', 'fits!']), C.green);
      if (R.tiles.every(t => t.piece == null || R.slotOf[t.i] === t.piece) && !R.done) {
        R.done = true; tween(R, { asm: 1 }, 0.3, { ease: 'outCubic', delay: 0.12 });
        R.shine = 0; tween(R, { shine: 1 }, 0.7, { ease: 'inOutSine', delay: 0.25 });
        after(0.25, () => SFX.chord());
      }
    }
  },
  onSit(R, tile) {
    if (sokoPadSit(R, R2 => { sokoRestore(R2); R2.done = false; })) return;
    addTxt(cat.x, cat.y - 50, pick(['sat.', 'thinking...', 'a piece of my mind']), C.grey);
  },

  drawTile(R, g, t, x, y, s) {
    const slot = R.slotOf ? R.slotOf[t.i] : -1;
    if (t.piece != null) {
      const p = R.slots[t.piece], pr = Math.floor(p / G.cols) - Math.floor(R.slots[0] / G.cols), pc = p % G.cols - R.slots[0] % G.cols, K = R.picK;
      g.save(); g.beginPath(); g.roundRect(x, y, s, s, 6); g.clip();
      g.drawImage(R.picC, pc * G.pitch * K, pr * G.pitch * K, s * K, s * K, x, y, s, s);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, s, 3); g.fillRect(x, y, 3, s);       // bevel
      g.fillStyle = 'rgba(29,36,51,.25)'; g.fillRect(x, y + s - 4, s, 4); g.fillRect(x + s - 4, y, 4, s);
      g.restore();
      const ok = slot === t.piece;
      g.lineWidth = 3; g.strokeStyle = ok ? C.green : C.ink; g.beginPath(); g.roundRect(x + 1.5, y + 1.5, s - 3, s - 3, 6); g.stroke();
      return true;
    }
    if (slot >= 0 && t.empty) {
      drawFloor(g, x, y, s);
      const p = R.slots[slot], pr = Math.floor(p / G.cols) - Math.floor(R.slots[0] / G.cols), pc = p % G.cols - R.slots[0] % G.cols, K = R.picK;
      g.save(); g.globalAlpha = 0.2; g.drawImage(R.picC, pc * G.pitch * K, pr * G.pitch * K, s * K, s * K, x, y, s, s); g.restore();
      g.save(); g.setLineDash([7, 5]); g.lineDashOffset = -time * 14; g.lineWidth = 2.5; g.strokeStyle = C.blue; g.strokeRect(x + 4, y + 4, s - 8, s - 8); g.restore();
      return true;
    }
    return false;
  },
  drawOverlay(R, g) {
    sokoPadDraw(R, g);
    if (!R.picC) return;
    if (!R.done) {   // the target block outline, on top (pieces resting on a wrong slot hide that slot's own outline)
      const p0 = cellXY(R.slots[0]);
      g.save(); g.setLineDash([9, 6]); g.lineDashOffset = -time * 14; g.lineWidth = 2.5; g.strokeStyle = 'rgba(47,111,228,.75)';
      g.beginPath(); g.roundRect(p0.x - 3, p0.y - 3, R.picW + 6, R.picH + 6, 9); g.stroke(); g.restore();
      return;
    }
    // assembled: the seamless picture fades in over the slot block, then a shine sweeps across it
    const p0 = cellXY(R.slots[0]), bw = R.picW, bh = R.picH;
    g.save(); g.globalAlpha = R.asm; g.beginPath(); g.roundRect(p0.x, p0.y, bw, bh, 8); g.clip();
    g.drawImage(R.picC, p0.x, p0.y, bw, bh);
    if (R.shine > 0 && R.shine < 1) {
      const sx = p0.x + lerp(-bw * 0.6, bw * 1.6, R.shine), gr = g.createLinearGradient(sx - 40, p0.y, sx + 40, p0.y + bh);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(p0.x, p0.y, bw, bh);
    }
    g.restore();
    g.globalAlpha = R.asm; g.lineWidth = 4; g.strokeStyle = C.gold; g.beginPath(); g.roundRect(p0.x - 1, p0.y - 1, bw + 2, bh + 2, 8); g.stroke(); g.globalAlpha = 1;
  },

  progress: R => `Pieces ${R.tiles.filter(t => t.piece != null && R.slotOf && R.slotOf[t.i] === t.piece).length} / ${R.slots.length} · moves ${R.stats.moves || 0} / par ${R.par.moves}`,
  solved: R => !!R.done,
  judge(R) {
    const wrong = R.slots.filter((s, p) => !(R.tiles[s].piece === p));
    return wrong.length ? { pass: false, verdict: pick(SOKO_FAIL), wrong, checked: R.slots } : { pass: true, verdict: pick(SOKO_PASS), checked: R.slots };
  },
});
