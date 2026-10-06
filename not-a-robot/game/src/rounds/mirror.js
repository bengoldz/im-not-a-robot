// rounds/mirror.js — MIRROR GHOST (The Witness symmetry / Herding), re-skinned as "Two cats. One verification."
// A pale, glitchy ghost cat copies every move mirrored left<->right (at d > 0.6 also up<->down). Walls block each cat
// independently, which is how you get them out of sync. Both must be on their paw prints (solid paw = you, dashed
// ghost paw = the ghost) when you SIT. Generation: random walls + starts, a BFS over (cat, ghost) states picks a goal
// pair at a d-dependent distance (par = that distance); layouts where some reachable state can no longer reach the goal
// are rejected, so there are no dead ends (and no reset).
// Movement model (shared by the BFS and the live game): the cat is blocked by walls, the edge and the ghost's CURRENT
// cell; the ghost is blocked by walls, the edge, the cat's current cell and the cell the cat is moving into.

const MIR_PASS = ['Two cats, one verification. HUMANCHECK counted two humans. That is double access.', 'Perfect sync. You and your reflection should start a band.', 'Mirror verified. Seven years of good luck. For me, hopefully.'];
const MIR_FAIL = ['One of you was not on the paw print. The ghost blames you. You blame the ghost.', 'Out of sync. Like my dial-up modem.'];
const MIR_K = ['U', 'R', 'D', 'L'];
// the ghost's direction index for a cat direction k (0 up 1 right 2 down 3 left)
function mirGhostK(k, axis) { if (axis === 'hv') return (k + 2) % 4; return k === 1 ? 3 : k === 3 ? 1 : k; }
function mirStep(a, b, k, n, wall, axis) {
  const ca = sokoNb(a, k, n), catOk = ca >= 0 && !wall[ca] && ca !== b;
  const gb = sokoNb(b, mirGhostK(k, axis), n), ghostOk = gb >= 0 && !wall[gb] && gb !== a && !(catOk && gb === ca);
  return { a: catOk ? ca : a, b: ghostOk ? gb : b, catOk, ghostOk };
}
// all states reachable from (a0, b0): dist + parent; plus the forward edges for the dead-end check
function mirExplore(n, wall, axis, a0, b0) {
  const N = n * n, key = (a, b) => a * N + b, dist = new Map([[key(a0, b0), 0]]), par = new Map(), q = [key(a0, b0)], edges = new Map();
  for (let h = 0; h < q.length; h++) {
    const s = q[h], a = Math.floor(s / N), b = s % N, out = [];
    for (let k = 0; k < 4; k++) {
      const m = mirStep(a, b, k, n, wall, axis); if (!m.catOk && !m.ghostOk) continue;
      const t = key(m.a, m.b); out.push(t);
      if (!dist.has(t)) { dist.set(t, dist.get(s) + 1); par.set(t, [s, k]); q.push(t); }
    }
    edges.set(s, out);
  }
  return { N, dist, par, edges, list: q };
}
function mirMirror(i, n, axis) { const r = Math.floor(i / n), c = i % n; return axis === 'hv' ? (n - 1 - r) * n + (n - 1 - c) : r * n + (n - 1 - c); }
function mirTry(d, rng, attempt) {
  const n = d < 0.25 ? 4 : d < 0.7 ? 5 : 6, N = n * n, axis = d > 0.6 ? 'hv' : 'h';
  const wall = new Array(N).fill(false);
  const nW = d === 0 ? 0 : Math.round(lerp(2, 8, d)) + rng.int(0, 1);
  for (const i of rng.sample([...Array(N).keys()], nW)) wall[i] = true;
  const free = [...Array(N).keys()].filter(i => !wall[i]);
  // start mirrored (so the copying is obvious), the cat in the lower half, not on the mirror line
  const ac = free.filter(i => !wall[mirMirror(i, n, axis)] && mirMirror(i, n, axis) !== i && Math.floor(i / n) >= Math.floor(n / 2));
  if (!ac.length) return null;
  const a0 = rng.pick(ac), b0 = mirMirror(a0, n, axis);
  const E = mirExplore(n, wall, axis, a0, b0);
  const want = d === 0 ? 3 : Math.round(lerp(4, 13, d)) - Math.floor(attempt / 25);
  // goal candidates: both on different cells; with d > 0.15 the goal must break the mirror symmetry (needs a wall trick)
  let cands = E.list.filter(s => { const a = Math.floor(s / N), b = s % N; return a !== b && E.dist.get(s) > 0 && (d <= 0.15 ? b === mirMirror(a, n, axis) : b !== mirMirror(a, n, axis)); });
  if (d === 0) cands = cands.filter(s => E.dist.get(s) === 3 || E.dist.get(s) === 2);
  if (!cands.length) return null;
  const near = cands.filter(s => E.dist.get(s) >= want && E.dist.get(s) <= want + 1);
  const top = Math.max(...cands.map(s => E.dist.get(s)));
  if (!near.length && top < (d === 0 ? 2 : Math.max(2, want - 2))) return null;
  const goal = rng.pick(near.length ? near : cands.filter(s => E.dist.get(s) === top));
  // no dead ends: every reachable state must still reach the goal (reverse BFS over the explored graph)
  const rev = new Map(); for (const [s, out] of E.edges) for (const t of out) { if (!rev.has(t)) rev.set(t, []); rev.get(t).push(s); }
  const ok = new Set([goal]), q = [goal];
  for (let h = 0; h < q.length; h++) for (const s of rev.get(q[h]) || []) if (!ok.has(s)) { ok.add(s); q.push(s); }
  if (ok.size !== E.list.length) return null;
  const toks = []; for (let s = goal; E.par.has(s); s = E.par.get(s)[0]) toks.push(MIR_K[E.par.get(s)[1]]);
  toks.reverse(); toks.push('S');
  return { n, axis, wall, a0, b0, ta: Math.floor(goal / N), tb: goal % N, len: E.dist.get(goal), toks };
}
function mirFallback() {
  const n = 4, wall = new Array(16).fill(false);
  return { n, axis: 'h', wall, a0: 13, b0: 14, ta: 4, tb: 7, len: 3, toks: ['U', 'U', 'L', 'S'] };
}

// paw print: solid (the real cat) or dashed + glitchy (the ghost)
function mirPaw(g, cx, cy, s, ghost, pulse) {
  const k = s / 100, toes = [[-26, -20], [-9, -32], [9, -32], [26, -20]];
  g.save(); g.translate(cx, cy); g.scale(k * (1 + pulse * 0.08), k * (1 + pulse * 0.08));
  if (!ghost) {
    g.fillStyle = 'rgba(243,154,51,.28)'; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill();
    g.fillStyle = '#d9822b'; g.beginPath(); g.ellipse(0, 10, 20, 16, 0, 0, 7); g.fill();
    for (const [x, y] of toes) { g.beginPath(); g.ellipse(x, y, 8, 10, 0, 0, 7); g.fill(); }
  } else {
    g.fillStyle = 'rgba(95,243,255,.14)'; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill();
    g.setLineDash([5, 4]); g.lineDashOffset = time * 10; g.lineWidth = 4; g.strokeStyle = '#27b7c9';
    g.beginPath(); g.ellipse(0, 10, 20, 16, 0, 0, 7); g.stroke();
    for (const [x, y] of toes) { g.beginPath(); g.ellipse(x, y, 8, 10, 0, 0, 7); g.stroke(); }
  }
  g.restore();
}
function mirBonk(x, y) {
  addTxt(x, y - 50, 'bonk', '#7a6cc9'); burst(x, y - 26, C.gold, 5, 90, 2.5);
  tone(160, 0.08, 'sine', 0.04, -50);
}

registerRound({
  id: 'mirror', name: 'Two cats',
  minD: 0.5, weight: 1,
  intro: 'That ghost copies you, mirrored. Walls stop each of you separately. Both on your paws, then SIT.',
  again: ['The mirror ghost is back. It still copies everything. Even your mistakes.', 'Two cats again. Use the walls to get out of sync.'],
  move: 'step', verify: 'auto', exitGrid: false, autoDelay: 0.45,

  generate(d, rng) {
    let L = null;
    for (let a = 0; a < 100 && !L; a++) L = mirTry(d, rng, a);
    if (!L) L = mirFallback();
    const { n, axis, wall } = L;
    return {
      grid: n, tiles: [...Array(n * n)].map((_, i) => wall[i] ? { wall: true } : { empty: true }), catStart: L.a0, ghostStart: L.b0,
      axis, tgtCat: L.ta, tgtGhost: L.tb,
      l1: 'Two cats.', big: 'One verification.', l3: axis === 'hv' ? 'The ghost mirrors you: left↔right AND up↕down.' : 'The ghost mirrors you left↔right. Both on paws, then sit.',
      par: { moves: L.len }, solution: L.toks,
    };
  },

  enter(R) {
    R.stats.moves = 0; R.won = false; R.hint = 0;
    // no canvas filter: ctx.filter on every rig part is extremely slow (seconds per frame in headless Chromium). The pale
    // cyan look comes from alpha + an aura underneath (drawOverlay) + cyan scanlines on top (drawTop).
    R.ghost = addEntity({ cell: R.ghostStart, alpha: 0.5, filter: null });
    R.ghost.face = -1;
  },
  moveCat(R, from, dir, how) {
    if (how === 'hop') return { path: [from], how: 'hop' };
    const k = DIR4.indexOf(DIR4.find(v => v[0] === dir[0] && v[1] === dir[1]));
    const m = mirStep(from, R.ghost.cell, k, G.cols, R.tiles.map(t => !!t.wall), R.axis);
    R.pend = { k, m };
    return { path: m.catOk ? [m.a] : [], how: 'walk' };
  },
  onMove(R, from, dir, how, path) {
    const e = R.ghost;
    if (how === 'hop') { startMove(e, [e.cell], 'hop', null); e.mv.over = -1; return; }
    const { k, m } = R.pend || {}; R.pend = null; if (k == null) return;
    R.won = false;
    const gk = mirGhostK(k, R.axis), gd = DIR4[gk];
    if (m.ghostOk) moveEntity(e, gd); else { bump(e, gd); e.face = gd[1] || e.face; }
    if (m.catOk || m.ghostOk) R.stats.moves++;
    if (m.catOk !== m.ghostOk) { if (!m.catOk) mirBonk(cat.x, cat.y); else mirBonk(e.x, e.y); }
  },
  onSit(R, tile) {
    entitySit(R.ghost);
    const okC = catCell() === R.tgtCat, okG = R.ghost.cell === R.tgtGhost;
    if (okC && okG) {
      R.won = true; SFX.chord();
      for (const i of [R.tgtCat, R.tgtGhost]) { const c = cellCenter(i); burst(c.x, c.y, i === R.tgtCat ? C.cat : C.cyan, 8, 150, 3); tileSquash(R.tiles[i]); }
      addTxt((cat.x + R.ghost.x) / 2, Math.min(cat.y, R.ghost.y) - 60, 'in sync ✓', C.green);
    } else {
      R.hint = 1; tween(R, { hint: 0 }, 0.6, { ease: 'outQuad' }); SFX.desel();
      addTxt(cat.x, cat.y - 50, okC ? 'ghost is off its paw' : okG ? 'you are off your paw' : 'both off the paws', C.grey);
    }
  },

  drawOverlay(R, g) {
    // mirror axis (faint, glitchy)
    g.save(); g.strokeStyle = 'rgba(39,183,201,.35)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.lineDashOffset = time * 12;
    const mx = G.x + G.w / 2, my = G.y + G.h / 2;
    g.beginPath(); g.moveTo(mx, G.y - 4); g.lineTo(mx, G.y + G.h + 4); if (R.axis === 'hv') { g.moveTo(G.x - 4, my); g.lineTo(G.x + G.w + 4, my); } g.stroke(); g.restore();
    const e = R.ghost;
    if (e) {   // hologram aura under the ghost
      const gr = g.createRadialGradient(e.x, e.y - e.z - 24, 4, e.x, e.y - e.z - 24, 40);
      gr.addColorStop(0, 'rgba(95,243,255,.42)'); gr.addColorStop(1, 'rgba(95,243,255,0)');
      g.fillStyle = gr; g.fillRect(e.x - 44, e.y - e.z - 68, 88, 88);
    }
    const pc = cellCenter(R.tgtCat), pg = cellCenter(R.tgtGhost), s = G.ts * 0.62;
    mirPaw(g, pc.x, pc.y + 2, s, false, R.hint * (catCell() === R.tgtCat ? 0 : 1));
    mirPaw(g, pg.x + (Math.random() < 0.04 ? rnd(-2, 2) : 0), pg.y + 2, s, true, R.hint * (R.ghost && R.ghost.cell === R.tgtGhost ? 0 : 1));
  },
  drawTop(R, g) {
    // scanline flicker over the ghost
    const e = R.ghost; if (!e) return;
    const fl = 0.42 + 0.14 * Math.sin(time * 23) + (Math.random() < 0.06 ? 0.2 : 0);
    g.save(); g.beginPath(); g.ellipse(e.x, e.y - e.z - 26, 30, 32, 0, 0, 7); g.clip();
    g.fillStyle = `rgba(95,243,255,${fl.toFixed(3)})`;
    const off = (time * 30) % 4;
    for (let y = e.y - 62 + off; y < e.y + 6; y += 3) g.fillRect(e.x - 32, y, 64, 1.5);
    if (Math.random() < 0.05) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(e.x - 32, e.y - rnd(10, 55), 64, 3); }
    g.restore();
  },

  progress: R => `You ${catCell() === R.tgtCat ? '✓' : '✗'} · Ghost ${R.ghost && R.ghost.cell === R.tgtGhost ? '✓' : '✗'} · moves ${R.stats.moves || 0} / par ${R.par.moves}`,
  solved: R => !!R.won && catCell() === R.tgtCat && R.ghost.cell === R.tgtGhost,
  judge(R) {
    const okC = catCell() === R.tgtCat, okG = R.ghost.cell === R.tgtGhost, wrong = [];
    if (!okC) wrong.push(R.tgtCat); if (!okG) wrong.push(R.tgtGhost);
    return { pass: !wrong.length, verdict: pick(wrong.length ? MIR_FAIL : MIR_PASS), wrong, checked: [R.tgtCat, R.tgtGhost] };
  },
});
