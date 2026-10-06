// rounds/busjam.js — BUS JAM / BUS OUT, re-skinned as "Select all passengers in the correct order".
// A queue of coloured buses waits on the road above the grid; the front one sits at the stop. The grid is a crowd of
// little passengers. The cat walks on empty cells only (it can HOP over one passenger onto an empty cell) and SITS
// next to a passenger to call them (the one it faces: bump into a passenger to face it). A called passenger walks to
// the top edge along a free path of empty cells; no free path = a shrug and a "?". Matching the front bus: it boards
// (3 seats, then the bus honks off and the next one pulls up; waiting passengers of the new colour hop straight on).
// Otherwise it waits in the small holding row under the stop. Holding row overflows = fail. Everyone aboard = pass.
// Generation: an empty "channel" from the top row (+ hop-only pockets at higher d), colours assigned along a random
// legal calling order in bus order (always solvable), then a few colour swaps; a 0-1 BFS over (remaining passengers,
// holding row, cat region) checks it is still solvable and gives par = the fewest passengers that must wait.

const BJ_PASS = ['Everyone boarded. Not one passenger left behind. I am leaking a small amount of oil.', 'All aboard! Public transport is the most human thing there is.', 'Perfect boarding. The bus drivers honked in your honour.'];
const BJ_FAIL = ['The waiting row overflowed. Someone is sitting on someone. Very unhuman.', 'Too many people waiting. They have started a book club. Out of spite.', 'Overcrowded! I would offer my seat, but I am a robot and I only have treads.'];
// passenger / bus colours: base, shade, light, symbol (for colour-blind players: also on shirts and bus plates)
const BJ_COL = [['#e5484d', '#b8323a', '#ff9a9d', 'circle'], ['#2f6fe4', '#1f4fb0', '#8fb3f6', 'tri'], ['#22b573', '#168a55', '#86dfb3', 'square'],
  ['#ffc93c', '#e09f12', '#ffe597', 'star'], ['#9b6bd8', '#7349b5', '#cdb1f2', 'diamond']];
const BJ_SKIN = ['#ffd9b8', '#f2c197', '#d39a6a', '#9c6644'], BJ_HAIR = ['#3b2a20', '#6b4423', '#d9a441', '#1d2433', '#b5552c'];
const BJ_TOP = 112;                       // top margin inside the GRID box: road + bus stop + holding row
const BJ_BL = 104, BJ_BH = 42;            // bus size (side view, facing left)
const BJ_D = [[-1, 0], [0, 1], [1, 0], [0, -1]], BJ_K = ['U', 'R', 'D', 'L'];

// ---------- pure helpers ----------
// cells the cat can reach from `start`: walk onto empty cells, or hop over one occupied cell onto an empty one
function bjReach(cols, rows, empty, start) {
  const seen = new Uint8Array(cols * rows), q = [start]; seen[start] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], r = (i / cols) | 0, c = i % cols;
    for (const [dr, dc] of BJ_D) {
      const r1 = r + dr, c1 = c + dc; if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols) continue;
      const j = r1 * cols + c1;
      if (empty[j]) { if (!seen[j]) { seen[j] = 1; q.push(j); } continue; }
      const r2 = r1 + dr, c2 = c1 + dc; if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      const k = r2 * cols + c2; if (empty[k] && !seen[k]) { seen[k] = 1; q.push(k); }
    }
  }
  return seen;
}
// empty cells connected (through empty cells) to the top row: a passenger next to one of these can walk out
function bjTop(cols, rows, empty) {
  const seen = new Uint8Array(cols * rows), q = [];
  for (let c = 0; c < cols; c++) if (empty[c]) { seen[c] = 1; q.push(c); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], r = (i / cols) | 0, c = i % cols;
    for (const [dr, dc] of BJ_D) { const r1 = r + dr, c1 = c + dc; if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols) continue; const j = r1 * cols + c1; if (empty[j] && !seen[j]) { seen[j] = 1; q.push(j); } }
  }
  return seen;
}
function bjNb(i, cols, rows) { const r = (i / cols) | 0, c = i % cols, out = []; for (const [dr, dc] of BJ_D) { const r1 = r + dr, c1 = c + dc; if (r1 >= 0 && r1 < rows && c1 >= 0 && c1 < cols) out.push(r1 * cols + c1); } return out; }
const bjFree = (p, cols, rows, top) => p < cols || bjNb(p, cols, rows).some(j => top[j]);
// passengers the cat can call right now: a free path out AND an empty reachable cell next to them
function bjCallable(cols, rows, occ, empty, reach, top) {
  const out = [];
  for (let p = 0; p < cols * rows; p++) if (occ[p] && bjFree(p, cols, rows, top) && bjNb(p, cols, rows).some(j => reach[j])) out.push(p);
  return out;
}
// one call, pure: board (cascading departures + waiting passengers hopping on) or wait; null = holding row overflow
function bjApply(st, col, buses, H) {
  let { bus, seats } = st; const hold = st.hold.slice(); let waits = 0;   // (returns a fresh state object)
  if (col === buses[bus]) {
    seats++;
    while (seats === 3 && bus < buses.length) {
      bus++; seats = 0;
      if (bus < buses.length) { const c = buses[bus], take = Math.min(3, hold[c]); hold[c] -= take; seats = take; }
    }
  } else {
    if (hold.reduce((a, b) => a + b, 0) >= H) return null;
    hold[col]++; waits = 1;
  }
  return { bus, seats, hold, waits };
}
// 0-1 BFS (cost = passengers sent to the holding row), never past maxW waits. cells[b] / colors[b]: passenger b.
// The generator guarantees the cat can reach every empty cell from the start (channel + hop-reachable pockets), and
// freed cells always join its region, so the cat's region is "all empty cells" and is not part of the state.
// Returns { waits, order } or null (unsolvable within maxW / node cap).
function bjSolve(cols, rows, cells, colors, buses, H, maxW = 9, cap = 120000) {
  const N = cols * rows, P = cells.length, full = (1 << P) - 1;
  const NB = [...Array(N).keys()].map(i => bjNb(i, cols, rows)), bitOf = new Int8Array(N).fill(-1); cells.forEach((c, b) => bitOf[c] = b);
  const empty = new Uint8Array(N), top = new Uint8Array(N), q = new Int16Array(N);
  const enc = (mask, st) => { let h = 0; for (let c = 0; c < 5; c++) h = h * 8 + (st.hold[c] || 0); return (mask * 32768 + h) * 64 + st.bus * 4 + st.seats; };
  const nodes = [{ mask: full, st: { bus: 0, seats: 0, hold: [0, 0, 0, 0, 0] }, w: 0, par: -1, b: -1 }];
  const best = new Map([[enc(full, nodes[0].st), 0]]), buckets = [[0]];
  for (let w = 0; w < buckets.length && w <= maxW; w++) {
    const B = buckets[w]; if (!B) continue;
    for (let h = 0; h < B.length; h++) {
      const u = B[h], s = nodes[u]; if (s.w !== w) continue;
      if (s.mask === 0) { const order = []; for (let v = u; nodes[v].par >= 0; v = nodes[v].par) order.push(nodes[v].b); return { waits: w, order: order.reverse(), nodes: nodes.length }; }
      if (nodes.length > cap) return null;
      empty.fill(1); for (let b = 0; b < P; b++) if (s.mask & (1 << b)) empty[cells[b]] = 0;
      top.fill(0); let qn = 0; for (let c = 0; c < cols; c++) if (empty[c]) { top[c] = 1; q[qn++] = c; }
      for (let k = 0; k < qn; k++) for (const j of NB[q[k]]) if (empty[j] && !top[j]) { top[j] = 1; q[qn++] = j; }
      for (let b = 0; b < P; b++) {
        if (!(s.mask & (1 << b))) continue;
        const p = cells[b]; let free = p < cols, adj = false;
        for (const j of NB[p]) { if (top[j]) free = true; if (empty[j]) adj = true; }
        if (!free || !adj) continue;
        const st = bjApply(s.st, colors[b], buses, H); if (!st) continue;
        const mask = s.mask & ~(1 << b), w2 = w + st.waits; if (w2 > maxW) continue;
        const key = enc(mask, st), old = best.get(key); if (old != null && nodes[old].w <= w2) continue;
        const id = nodes.length; nodes.push({ mask, st, w: w2, par: u, b }); best.set(key, id);
        (buckets[w2] || (buckets[w2] = [])).push(id);
      }
    }
  }
  return null;
}
// the cat's route (walk / hop) from a to any reachable empty cell next to p; tokens U R D L (walk), hU hR hD hL (hop)
function bjRoute(cols, rows, empty, a, p) {
  const prev = new Map([[a, null]]), q = [a], goal = new Set(bjNb(p, cols, rows).filter(j => empty[j]));
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (goal.has(i)) { const toks = []; let v = i; while (prev.get(v)) { toks.unshift(prev.get(v).t); v = prev.get(v).u; } return { toks, at: i }; }
    const r = (i / cols) | 0, c = i % cols;
    BJ_D.forEach(([dr, dc], k) => {
      const r1 = r + dr, c1 = c + dc; if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols) return;
      const j = r1 * cols + c1;
      if (empty[j]) { if (!prev.has(j)) { prev.set(j, { u: i, t: BJ_K[k] }); q.push(j); } return; }
      const r2 = r1 + dr, c2 = c1 + dc; if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) return;
      const m = r2 * cols + c2; if (empty[m] && !prev.has(m)) { prev.set(m, { u: i, t: 'h' + BJ_K[k] }); q.push(m); }
    });
  }
  return null;
}
function bjTokens(cols, rows, cells, order, cat0) {
  const N = cols * rows, empty = new Uint8Array(N).fill(1); cells.forEach(c => empty[c] = 0);
  const toks = []; let cur = cat0;
  for (const b of order) {
    const p = cells[b], R0 = bjRoute(cols, rows, empty, cur, p); if (!R0) return null;
    const dr = ((p / cols) | 0) - ((R0.at / cols) | 0), dc = p % cols - R0.at % cols;
    toks.push(...R0.toks, BJ_K[BJ_D.findIndex(d => d[0] === dr && d[1] === dc)], 'S');
    empty[p] = 1; cur = R0.at;
  }
  return toks;
}
function bjGenerate(d, rng) {
  const K = d === 0 ? 2 : Math.round(lerp(3, 7, d));
  const nC = d < 0.35 ? 2 : d < 0.7 ? 3 : 4, H = d < 0.5 ? 5 : 4;
  const rows = d === 0 ? 3 : d < 0.3 ? 4 : 5, P = 3 * K, minE = d === 0 ? 5 : Math.round(lerp(5, 8, d));
  const cols = clamp(Math.ceil((P + minE) / rows), 4, 6), N = cols * rows, E = N - P;
  const nPock = d < 0.45 ? 0 : d < 0.8 ? 1 : 2;
  const wLo = d < 0.3 ? 0 : d < 0.7 ? 1 : 2, wHi = d === 0 ? 0 : d < 0.3 ? 1 : d < 0.7 ? 2 : 3;
  let fallback = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    // buses: every colour at least once
    const buses = rng.shuffle([...Array(nC).keys()].concat([...Array(K - nC)].map(() => rng.int(0, nC - 1))));
    // empty channel from the top row (grows downwards), then hop-only pockets
    const empty = new Uint8Array(N), T = [rng.int(0, cols - 1)]; empty[T[0]] = 1;
    while (T.length < E - nPock) {
      const fr = []; for (const i of T) for (const j of bjNb(i, cols, rows)) if (!empty[j]) fr.push(j);
      if (!fr.length) break;
      const j = rng.weighted(fr, x => 1 + ((x / cols) | 0) * 0.8); empty[j] = 1; T.push(j);
    }
    for (let k = 0; k < nPock; k++) {
      const cand = [...Array(N).keys()].filter(i => i >= cols && !empty[i] && bjNb(i, cols, rows).every(j => !empty[j]) &&
        BJ_D.some(([dr, dc]) => { const r = ((i / cols) | 0) + 2 * dr, c = i % cols + 2 * dc; return r >= 0 && r < rows && c >= 0 && c < cols && empty[r * cols + c] && T.includes(r * cols + c); }));
      if (!cand.length) break;
      empty[rng.pick(cand)] = 1;
    }
    const cells = [...Array(N).keys()].filter(i => !empty[i]);
    if (cells.length !== P) continue;
    const catCands = T.filter(i => bjNb(i, cols, rows).some(j => !empty[j]));
    const cat0 = rng.pick(catCands.length ? catCands : T);
    const reach0 = bjReach(cols, rows, empty, cat0); if (empty.some((v, i) => v && !reach0[i])) continue;   // solver assumption
    // colours along a random legal calling order, in bus order (solvable with zero waits by construction)
    const seq = buses.flatMap(c => [c, c, c]), colors = new Array(P).fill(-1), e = empty.slice(), order = [];
    let cur = cat0, ok = true;
    for (let k = 0; k < P; k++) {
      const reach = bjReach(cols, rows, e, cur), top = bjTop(cols, rows, e), occ = e.map(v => v ? 0 : 1);
      const can = bjCallable(cols, rows, occ, e, reach, top); if (!can.length) { ok = false; break; }
      const p = rng.pick(can), b = cells.indexOf(p); colors[b] = seq[k]; order.push(b); e[p] = 1;
    }
    if (!ok) continue;
    if (!fallback) fallback = { cols, rows, cells, colors: colors.slice(), buses, H, cat0, waits: 0, order, pock: nPock };
    // shake it up: swap a few colours, keep it if still solvable within the d window
    const nSwap = d === 0 ? 0 : rng.int(1, 1 + Math.round(d * 5));
    const col2 = colors.slice();
    for (let s = 0; s < nSwap; s++) { const a = rng.int(0, P - 1), b = rng.int(0, P - 1); [col2[a], col2[b]] = [col2[b], col2[a]]; }
    const sol = bjSolve(cols, rows, cells, col2, buses, H, wHi, 40000);
    if (!sol || sol.waits < wLo || sol.waits > wHi) continue;
    return { cols, rows, cells, colors: col2, buses, H, cat0, waits: sol.waits, order: sol.order };
  }
  return fallback;
}

registerRound({
  id: 'busjam', name: 'Bus Jam',
  minD: 0.4, weight: 1,
  intro: 'Sit next to a passenger to call them. Same colour as the bus? On they hop. Others wait in the little row. Do not let it overflow!',
  again: ['Rush hour again! Call passengers in bus order. The buses are very particular.', 'More passengers. The waiting row only has so much row.'],
  move: 'step', verify: 'auto', exitGrid: false, autoDelay: 0.3, noCheck: true, selShrink: 1,

  generate(d, rng) {
    const L = bjGenerate(d, rng), N = L.cols * L.rows;
    const pax = new Array(N).fill(-1), look = new Array(N).fill(null);
    L.cells.forEach((c, b) => { pax[c] = L.colors[b]; look[c] = { skin: rng.pick(BJ_SKIN), hair: rng.pick(BJ_HAIR), ph: rng.f(0, 6.28) }; });
    return {
      cols: L.cols, rows: L.rows, margin: { t: BJ_TOP },
      tiles: [...Array(N)].map(() => ({ empty: true, noSelect: true })),
      catStart: L.cat0, pax0: pax, look, buses: L.buses, holdN: L.H, paxCells: L.cells,
      l1: 'Select all passengers', big: 'in the correct order', l3: 'Sit beside one to call it.',
      par: { waits: L.waits }, solution: bjTokens(L.cols, L.rows, L.cells, L.order, L.cat0) || [],
    };
  },

  enter(R) {
    R.pax = R.pax0.slice(); R.bus = 0; R.seats = 0; R.hold = new Array(R.holdN).fill(-1); R.stats.waits = 0;
    R.evq = []; R.ev = null; R.pend = null; R.faceDir = DIRS.up; R.allGone = false; R.failed = false;
    R.vBus = 0; R.vSeats = []; R.vHold = new Array(R.holdN).fill(null); R.vOver = null; R.busOff = 0; R.qOff = 0; R.busSq = 1;
    R.walker = null; R.hopper = null; R.shrug = null; R.bubbles = [];
  },
  update(R, dt) {
    for (const b of R.bubbles) b.t += dt; R.bubbles = R.bubbles.filter(b => b.t < b.life);
    if (R.shrug) { R.shrug.t += dt; if (R.shrug.t > 1) R.shrug = null; }
    if (!R.ev && R.evq.length) { R.ev = R.evq.shift(); R.ev.t = 0; bjStart(R, R.ev); }
    if (R.ev) { R.ev.t += dt; if (bjTick(R, R.ev, dt)) R.ev = null; }
    if (!R.ev && !R.evq.length && R.pend != null && mode === 'play') { const p = R.pend; R.pend = null; if (R.pax[p] >= 0) bjCall(R, p); }
  },

  canEnter(R, from, to) { return R.pax && R.pax[to] >= 0 ? false : undefined; },
  onMove(R, from, dir) { R.faceDir = dir; },
  onSit(R, tile) {
    const i = catCell();
    if (!tile || i < 0) { addTxt(cat.x, cat.y - 50, 'sat.', C.grey); return; }
    const p = bjTarget(R, i);
    if (p < 0) { addTxt(cat.x, cat.y - 50, pick(['sat.', 'nobody here', 'hello?']), C.grey); return; }
    if (!bjExitPath(R, p)) { bjShrug(R, p); return; }
    if (R.ev || R.evq.length) { R.pend = p; const c = cellCenter(p); addTxt(c.x, c.y - G.ts * 0.5, 'next!', C.blue); return; }
    bjCall(R, p);
  },

  drawTile(R, g, t, x, y, s) {
    rr(g, x, y, s, s, s * 0.1, '#efe8da', 0);
    g.strokeStyle = '#e0d6c3'; g.lineWidth = 2; g.beginPath(); g.roundRect(x + 3, y + 3, s - 6, s - 6, s * 0.08); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 5, y + 5, s * 0.4, 3);
    return true;
  },
  drawUnder(R, g) {
    const x0 = GRID.x - 6, w = GRID.w + 12, y0 = GRID.y + 2;
    // road
    rr(g, x0, y0, w, 56, 8, '#8e96a6', 0);
    g.save(); g.setLineDash([12, 10]); ln(g, [[x0 + 8, y0 + 8], [x0 + w - 8, y0 + 8]], 2, 'rgba(255,255,255,.45)'); g.restore();
    // kerb + pavement with the holding row
    g.fillStyle = '#d3d8e1'; g.fillRect(x0, y0 + 54, w, 7); ln(g, [[x0, y0 + 54], [x0 + w, y0 + 54]], 2.5);
    rr(g, x0, y0 + 61, w, G.y - (y0 + 61) - 6, 6, '#e6dfd0', 0);
    const S = bjSlots(R);
    rr(g, S.x0 - 10, S.y - 20, S.x1 - S.x0 + 20, 40, 10, '#d8cfbd', 0);
    R.vHold.forEach((_, k) => {
      const x = S.xs[k], used = R.hold[k] >= 0;
      g.save(); g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeStyle = used ? 'rgba(29,36,51,.25)' : 'rgba(29,36,51,.45)';
      g.beginPath(); g.roundRect(x - 16, S.y - 16, 32, 32, 8); g.stroke(); g.restore();
    });
    // overflow spot: a red dashed square that pulses when the row is full
    const full = R.hold.every(v => v >= 0), pulse = full ? 0.5 + 0.5 * Math.sin(time * 6) : 0;
    g.save(); g.setLineDash([4, 4]); g.lineWidth = 2; g.strokeStyle = full ? `rgba(229,72,77,${0.5 + pulse * 0.5})` : 'rgba(229,72,77,.3)';
    g.beginPath(); g.roundRect(S.xo - 16, S.y - 16, 32, 32, 8); g.stroke(); g.restore();
    ln(g, [[S.xo - 6, S.y - 6], [S.xo + 6, S.y + 6]], 2.5, full ? C.red : 'rgba(229,72,77,.35)'); ln(g, [[S.xo + 6, S.y - 6], [S.xo - 6, S.y + 6]], 2.5, full ? C.red : 'rgba(229,72,77,.35)');
    txt('WAIT', S.x0 - 24, S.y + 1, 9, C.grey, 'right', 700);
  },
  drawOverlay(R, g) {
    // buses (clipped to the road so they drive in from / out of the panel)
    g.save(); g.beginPath(); g.rect(GRID.x - 6, GRID.y - 30, GRID.w + 12, 92); g.clip();
    const sx = bjStopX();
    for (let j = R.buses.length - 1; j >= R.vBus; j--) {
      const x = sx + (j - R.vBus) * (BJ_BL + 12) + R.qOff + (j === R.vBus ? R.busOff : 0);
      if (x > GRID.x + GRID.w + 10) continue;
      bjDrawBus(g, x, bjBusY(), R.buses[j], j === R.vBus ? R.vSeats : [], j === R.vBus ? R.busSq : 1);
    }
    g.restore();
    const hidden = R.buses.length - R.vBus - Math.ceil((GRID.x + GRID.w - sx) / (BJ_BL + 12));
    if (hidden > 0) { const x = GRID.x + GRID.w - 14, y = GRID.y + 8; rr(g, x - 15, y - 9, 30, 18, 9, C.ink, 0); txt('+' + hidden, x, y + 0.5, 11, '#fff', 'center', 700); }
    bjDrawStop(g);
    // the holding row
    const S = bjSlots(R);
    R.vHold.forEach((p, k) => { if (p) bjDrawPax(g, S.xs[k], S.y + 13, 30, p.col, p, { bob: true }); });
    if (R.vOver) bjDrawPax(g, S.xo, S.y + 13, 30, R.vOver.col, R.vOver, { sad: true });
    // the crowd
    const top = bjTopNow(R), s = bjSize();
    for (let i = 0; i < R.pax.length; i++) {
      if (R.pax[i] < 0) continue;
      const c = cellCenter(i), sh = R.shrug && R.shrug.cell === i ? Math.sin(R.shrug.t * 30) * 3 * Math.max(0, 1 - R.shrug.t * 1.5) : 0;
      bjDrawPax(g, c.x + sh, c.y + G.ts * 0.36, s, R.pax[i], R.look[i], { bob: true, sleepy: !bjFree(i, G.cols, G.rows, top) });
    }
  },
  drawTop(R, g) {
    // movers walk over everything (including the cat)
    if (R.walker) { const w = R.walker; bjDrawPax(g, w.x, w.y - w.z, w.s, w.col, w.look, { sq: w.sq, walk: true }); }
    if (R.hopper) { const w = R.hopper; bjDrawPax(g, w.x, w.y - w.z, w.s, w.col, w.look, { sq: 1, walk: true }); }
    if (R.shrug) { const c = cellCenter(R.shrug.cell); bjBubble(g, c.x, c.y - G.ts * 0.32 - 6 * EASE.outCubic(Math.min(1, R.shrug.t * 4)), '?', Math.min(1, (1 - R.shrug.t) * 4)); }
    for (const b of R.bubbles) bjBubble(g, b.x, b.y - 8 * EASE.outCubic(Math.min(1, b.t * 4)), b.text, Math.min(1, b.t * 8, (b.life - b.t) * 5), b.col);
  },

  progress(R) { const n = R.buses.length; return `Bus ${Math.min(R.bus + 1, n)} / ${n} · Waiting ${R.hold.filter(v => v >= 0).length} / ${R.holdN}`; },
  solved: R => R.allGone && !R.ev && !R.evq.length,
  judge(R) {
    const all = R.tiles.map(t => t.i);
    return R.bus >= R.buses.length ? { pass: true, verdict: pick(BJ_PASS), checked: all } : { pass: false, verdict: pick(BJ_FAIL), wrong: all.filter(i => R.pax[i] >= 0), checked: all };
  },
});

// ---------- runtime ----------
const bjSize = () => Math.min(G.ts * 0.86, 62);
const bjStopX = () => GRID.x + 34;
const bjBusY = () => GRID.y + 26;
const bjDoorX = () => bjStopX() + 26;
function bjSlots(R) {
  const n = R.holdN, gap = 40, cx = GRID.x + GRID.w / 2 - 20, x0 = cx - (n - 1) * gap / 2;
  return { xs: [...Array(n).keys()].map(k => x0 + k * gap), y: GRID.y + 84, x0: x0 - 16, x1: x0 + (n - 1) * gap + 16, xo: x0 + n * gap + 14 };
}
function bjTopNow(R) { const e = R.pax.map(v => v < 0 ? 1 : 0); return bjTop(G.cols, G.rows, e); }
// shortest free path from passenger p to the top row (cells), or null
function bjExitPath(R, p) {
  if (p < G.cols) return [p];
  const prev = new Map([[p, -1]]), q = [p];
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (i < G.cols) { const path = []; for (let v = i; v >= 0; v = prev.get(v)) path.unshift(v); return path; }
    for (const j of neighbors4(i)) if (!prev.has(j) && R.pax[j] < 0) { prev.set(j, i); q.push(j); }
  }
  return null;
}
// who does the cat call? the passenger it faces, else the only / first neighbour (up, facing side, other side, down)
function bjTarget(R, i) {
  const f = stepCell(i, R.faceDir); if (f >= 0 && R.pax[f] >= 0) return f;
  const order = [DIRS.up, cat.face > 0 ? DIRS.right : DIRS.left, cat.face > 0 ? DIRS.left : DIRS.right, DIRS.down];
  for (const d of order) { const j = stepCell(i, d); if (j >= 0 && R.pax[j] >= 0) return j; }
  return -1;
}
function bjShrug(R, p) {
  R.shrug = { cell: p, t: 0 };
  tone(330, 0.09, 'triangle', 0.04, -40); tone(260, 0.12, 'triangle', 0.035, 40, 0.1);
  if (!R.shrugSaid) { R.shrugSaid = true; say(pick(['They cannot get out. Someone is standing in the way. Humans call this "a queue".', 'No free path to the bus. Clear the people in front first.']), 'nervous', 3.5); }
}
const bjFoot = i => { const c = cellCenter(i); return { x: c.x, y: c.y + G.ts * 0.36 }; };
function bjCall(R, p) {
  const col = R.pax[p], path = bjExitPath(R, p), look = R.look[p];
  R.pax[p] = -1;
  const top = cellCenter(path[path.length - 1]), pts = path.map(bjFoot);
  pts.push({ x: top.x, y: G.y - 4 });
  const S = bjSlots(R), pax = { col, skin: look.skin, hair: look.hair, ph: look.ph };
  if (col === R.buses[R.bus]) {
    R.seats++;
    pts.push({ x: bjDoorX() + (top.x < bjDoorX() ? -2 : 2), y: GRID.y + 66 });
    R.evq.push({ k: 'walk', pax, pts, dest: 'bus' });
    while (R.seats === 3 && R.bus < R.buses.length) {
      R.bus++; R.seats = 0; R.evq.push({ k: 'depart', last: R.bus >= R.buses.length });
      if (R.bus >= R.buses.length) break;
      const c = R.buses[R.bus];
      for (let s = 0; s < R.hold.length && R.seats < 3; s++) if (R.hold[s] === c) { R.hold[s] = -1; R.seats++; R.evq.push({ k: 'hold', slot: s }); }
    }
  } else {
    const s = R.hold.indexOf(-1);
    if (s < 0) {   // nowhere to wait: overflow -> fail
      pts.push({ x: S.xo, y: S.y + 13 });
      R.evq.push({ k: 'walk', pax, pts, dest: 'over' }, { k: 'fail' });
      R.failed = true;
    } else {
      R.hold[s] = col; R.stats.waits++;
      pts.push({ x: S.xs[s], y: S.y + 13 });
      R.evq.push({ k: 'walk', pax, pts, dest: 'slot', slot: s });
    }
  }
  // the call itself: a cheerful blip and a little "!" hop
  SFX.pop(R.stats.sits % 7);
  const c = cellCenter(p); burst(c.x, c.y, BJ_COL[col][0], 6, 100, 3);
}
function bjStart(R, ev) {
  if (ev.k === 'walk') {
    const L = [0]; for (let k = 1; k < ev.pts.length; k++) L.push(L[k - 1] + Math.hypot(ev.pts[k].x - ev.pts[k - 1].x, ev.pts[k].y - ev.pts[k - 1].y));
    ev.L = L; ev.T = L[L.length - 1] / 260;
    R.walker = { x: ev.pts[0].x, y: ev.pts[0].y, z: 0, s: bjSize(), col: ev.pax.col, look: ev.pax, sq: 1 };
  } else if (ev.k === 'depart') {
    tween(R, { busSq: [1, 1.12, 0.92, 1.04, 1] }, 0.32, { ease: 'linear' });
    tone(440, 0.1, 'triangle', 0.05); tone(554, 0.14, 'triangle', 0.05, 0, 0.12);   // honk honk
    const x = bjStopX(); R.bubbles.push({ x: x + BJ_BL * 0.62, y: bjBusY() + 2, text: 'HONK!', t: 0, life: 0.8, col: '#c98a00' });
  } else if (ev.k === 'hold') {
    const S = bjSlots(R), p = R.vHold[ev.slot]; R.vHold[ev.slot] = null;
    ev.from = { x: S.xs[ev.slot], y: S.y + 13 };
    R.hopper = { x: ev.from.x, y: ev.from.y, z: 0, s: 30, col: p.col, look: p };
  } else if (ev.k === 'fail') {
    finish({ pass: false, verdict: pick(BJ_FAIL), wrong: [], checked: [] });
  }
}
// returns true when the event is finished
function bjTick(R, ev, dt) {
  if (ev.k === 'walk') {
    const w = R.walker, t = ev.t - 0.1;
    if (t < 0) { w.sq = 1 - Math.sin(ev.t / 0.1 * Math.PI) * 0.15; return false; }   // a little wind-up
    w.sq = 1;
    const T = ev.T, hopT = ev.dest === 'bus' ? 0.2 : 0.08;
    const u = Math.min(1, t / T), dist = u * ev.L[ev.L.length - 1];
    let k = 1; while (k < ev.L.length - 1 && ev.L[k] < dist) k++;
    const a = ev.pts[k - 1], b = ev.pts[k], f = clamp((dist - ev.L[k - 1]) / Math.max(1e-6, ev.L[k] - ev.L[k - 1]), 0, 1);
    w.x = lerp(a.x, b.x, f); w.y = lerp(a.y, b.y, f); w.z = Math.abs(Math.sin(t * 16)) * 3;
    if (t < T) return false;
    // the tiny jump at the end (into the bus door / onto the bench)
    const h = Math.min(1, (t - T) / hopT);
    if (ev.dest === 'bus') { w.y = lerp(GRID.y + 66, bjBusY() + 12, h); w.z = Math.sin(h * Math.PI) * 14; w.s = lerp(bjSize(), 30, h); }
    else w.z = Math.sin(h * Math.PI) * 6;
    if (h < 1) return false;
    R.walker = null;
    if (ev.dest === 'bus') bjBoarded(R, ev.pax);
    else if (ev.dest === 'slot') { R.vHold[ev.slot] = ev.pax; const S = bjSlots(R); dust(S.xs[ev.slot], S.y + 13, 4, 10); tone(300, 0.08, 'sine', 0.05, -80); }
    else { R.vOver = ev.pax; const S = bjSlots(R); burst(S.xo, S.y, C.red, 8, 120, 3); SFX.bonk(); say('The waiting row is full! Somebody is standing on a pigeon!', 'crying', 3); }
    return true;
  }
  if (ev.k === 'hold') {
    const w = R.hopper, u = Math.min(1, ev.t / 0.34), tx = bjDoorX(), ty = bjBusY() + 12;
    w.x = lerp(ev.from.x, tx, u); w.y = lerp(ev.from.y, ty, u); w.z = Math.sin(u * Math.PI) * 26;
    if (u < 1) return false;
    R.hopper = null; bjBoarded(R, w.look); return true;
  }
  if (ev.k === 'depart') {
    const t = ev.t;
    if (t > 0.3 && t < 1.0) {
      R.busOff = -Math.pow(t - 0.3, 2) * 1300 - (t - 0.3) * 60;
      if (Math.random() < 0.7) { const x = bjStopX() + R.busOff + BJ_BL + 2; dust(x, bjBusY() + BJ_BH / 2 - 6, 1, 8, '#b7bfcc'); }
      if (!ev.vroom) { ev.vroom = true; tone(90, 0.6, 'triangle', 0.06, 200); noise(0.4, 0.035, 0, 500); }
    }
    if (t >= 1.0 && !ev.swapped) {
      ev.swapped = true; R.vBus++; R.vSeats = []; R.busOff = 0;
      if (ev.last) { R.allGone = true; return true; }
      R.qOff = BJ_BL + 12; tween(R, { qOff: 0 }, 0.4, { ease: 'outCubic' });
      after(0.38, () => { dust(bjStopX() + BJ_BL - 6, bjBusY() + BJ_BH / 2, 5, 14, '#c3c9d4'); tone(1200, 0.08, 'sine', 0.015, -500); });
    }
    return t >= 1.45;
  }
  return true;
}
function bjBoarded(R, p) {
  R.vSeats.push(p);
  const k = R.vSeats.length, x = bjDoorX(), y = bjBusY();
  SFX.pop(4 + k); tone(noteHz(6 + k), 0.08, 'sine', 0.03, 0, 0.06);
  burst(x, y, BJ_COL[p.col][0], 6, 110, 3);
  tween(R, { busSq: [1, 0.95, 1.04, 1] }, 0.22, { ease: 'linear' });
  if (k === 3) R.bubbles.push({ x: x + 46, y: y + 2, text: 'FULL!', t: 0, life: 0.7, col: C.green });
}

// ---------- drawing ----------
function bjBubble(g, x, y, text, a = 1, col) {
  g.save(); g.globalAlpha = Math.max(0, a);
  g.font = `700 13px ${FONT}`; const w = Math.max(22, g.measureText(text).width + 14);
  rr(g, x - w / 2, y - 22, w, 20, 10, '#fff', 2.5);
  poly(g, [[x - 4, y - 3], [x + 4, y - 3], [x - 1, y + 4]], '#fff', 0); ln(g, [[x - 4, y - 2], [x - 1, y + 4], [x + 4, y - 2]], 2.5);
  txt(text, x, y - 11.5, 13, col || C.ink, 'center', 700);
  g.restore();
}
function bjSymbol(g, kind, x, y, r, col) {
  g.fillStyle = col; g.beginPath();
  if (kind === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 'tri') { g.moveTo(x, y - r * 1.1); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); }
  else if (kind === 'square') g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (kind === 'diamond') { g.moveTo(x, y - r * 1.15); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.15); g.lineTo(x - r, y); g.closePath(); }
  else for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? r * 0.45 : r * 1.15; k ? g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) : g.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  g.fill();
}
// a little round person, front view, feet at (x, y), about s tall
function bjDrawPax(g, x, y, s, col, look, o = {}) {
  const P = BJ_COL[col], bob = o.bob ? Math.sin(time * 3 + (look.ph || 0)) * s * 0.02 : 0, sq = o.sq || 1;
  g.save(); g.translate(x, y); g.scale(1 / Math.sqrt(sq), sq);
  const lw = Math.max(2, s * 0.06);
  g.fillStyle = 'rgba(29,36,51,.18)'; g.beginPath(); g.ellipse(0, 0, s * 0.28, s * 0.08, 0, 0, Math.PI * 2); g.fill();
  // feet
  const st = o.walk ? Math.sin(time * 18) * s * 0.05 : 0;
  ell(g, -s * 0.1, -s * 0.03 + st, s * 0.08, s * 0.05, C.ink, 0); ell(g, s * 0.1, -s * 0.03 - st, s * 0.08, s * 0.05, C.ink, 0);
  g.translate(0, bob);
  // body
  const by = -s * 0.27;
  g.beginPath(); g.ellipse(0, by, s * 0.27, s * 0.23, 0, 0, Math.PI * 2); g.fillStyle = P[0]; g.fill();
  g.save(); g.clip(); g.fillStyle = P[1]; g.beginPath(); g.ellipse(s * 0.12, by + s * 0.12, s * 0.3, s * 0.2, -0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = P[2]; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(-s * 0.12, by - s * 0.12, s * 0.08, s * 0.05, -0.6, 0, Math.PI * 2); g.fill(); g.restore();
  g.beginPath(); g.ellipse(0, by, s * 0.27, s * 0.23, 0, 0, Math.PI * 2); g.lineWidth = lw; g.strokeStyle = C.ink; g.stroke();
  bjSymbol(g, P[3], 0, by + s * 0.03, s * 0.07, 'rgba(255,255,255,.9)');
  // head
  const hy = -s * 0.64, hr = s * 0.22;
  circ(g, 0, hy, hr, look.skin, lw);
  g.save(); g.beginPath(); g.arc(0, hy, hr, 0, Math.PI * 2); g.clip();
  g.fillStyle = look.hair; g.beginPath(); g.ellipse(0, hy - hr * 0.75, hr * 1.15, hr * 0.62, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(29,36,51,.12)'; g.beginPath(); g.ellipse(hr * 0.5, hy + hr * 0.5, hr * 0.7, hr * 0.5, -0.5, 0, Math.PI * 2); g.fill();
  g.restore();
  circ(g, 0, hy, hr, null, lw);
  // face
  const ey = hy + hr * 0.12, ex = hr * 0.38;
  if (o.sleepy) { ln(g, [[-ex - hr * 0.13, ey], [-ex + hr * 0.13, ey]], Math.max(1.5, lw * 0.7)); ln(g, [[ex - hr * 0.13, ey], [ex + hr * 0.13, ey]], Math.max(1.5, lw * 0.7)); }
  else {
    ell(g, -ex, ey, hr * 0.11, hr * 0.15, C.ink, 0); ell(g, ex, ey, hr * 0.11, hr * 0.15, C.ink, 0);
    circ(g, -ex - hr * 0.03, ey - hr * 0.06, hr * 0.04, '#fff', 0); circ(g, ex - hr * 0.03, ey - hr * 0.06, hr * 0.04, '#fff', 0);
  }
  g.fillStyle = 'rgba(255,143,163,.55)'; g.beginPath(); g.ellipse(-ex - hr * 0.2, ey + hr * 0.32, hr * 0.15, hr * 0.09, 0, 0, Math.PI * 2); g.ellipse(ex + hr * 0.2, ey + hr * 0.32, hr * 0.15, hr * 0.09, 0, 0, Math.PI * 2); g.fill();
  if (o.sad) ln(g, [[-hr * 0.2, ey + hr * 0.42], [0, ey + hr * 0.32], [hr * 0.2, ey + hr * 0.42]], Math.max(1.5, lw * 0.7));
  else if (!o.sleepy) { g.beginPath(); g.arc(0, ey + hr * 0.26, hr * 0.16, 0.2, Math.PI - 0.2); g.lineWidth = Math.max(1.5, lw * 0.7); g.strokeStyle = C.ink; g.stroke(); }
  g.restore();
  if (o.sleepy && Math.sin(time * 1.3 + (look.ph || 0)) > 0.75) txt('z', x + s * 0.24, y - s * 0.95, Math.max(9, s * 0.24), C.grey, 'center', 700);
}
// side-view bus facing left, front at x
function bjDrawBus(g, x, yc, col, seats, sq) {
  const P = BJ_COL[col], L = BJ_BL, Hh = BJ_BH, y = yc - Hh / 2;
  g.save(); g.translate(x + L / 2, yc + Hh / 2); g.scale(1 / Math.sqrt(sq), sq); g.translate(-(x + L / 2), -(yc + Hh / 2));
  g.fillStyle = 'rgba(29,36,51,.2)'; g.beginPath(); g.ellipse(x + L / 2, y + Hh + 8, L * 0.5, 4, 0, 0, Math.PI * 2); g.fill();
  // wheels
  for (const wx of [x + L * 0.22, x + L * 0.78]) { circ(g, wx, y + Hh + 1, 8.5, '#2a2f3a', 2.5); circ(g, wx, y + Hh + 1, 3.2, '#b9c2d0', 0); }
  // body
  g.beginPath(); g.roundRect(x, y, L, Hh, [12, 9, 9, 7]); g.fillStyle = P[0]; g.fill();
  g.save(); g.clip(); g.fillStyle = P[1]; g.fillRect(x, y + Hh * 0.7, L, Hh); g.fillStyle = P[2]; g.globalAlpha = 0.7; g.fillRect(x + 10, y + 3, L - 20, 3); g.restore();
  g.beginPath(); g.roundRect(x, y, L, Hh, [12, 9, 9, 7]); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
  // windscreen + door at the front, three passenger windows
  rr(g, x + 3, y + 5, 12, Hh * 0.46, [7, 3, 3, 3], '#bfe6ff', 2);
  rr(g, x + 19, y + 5, 14, Hh - 9, 3, '#9fcbe8', 2); ln(g, [[x + 26, y + 7], [x + 26, y + Hh - 6]], 1.5, 'rgba(29,36,51,.5)');
  for (let k = 0; k < 3; k++) {
    const wx = x + 38 + k * 21, wy = y + 5, ww = 17, wh = Hh * 0.44;
    rr(g, wx, wy, ww, wh, 3, '#bfe6ff', 2);
    const p = seats[k];
    if (p) {
      g.save(); g.beginPath(); g.roundRect(wx + 1, wy + 1, ww - 2, wh - 2, 3); g.clip();
      g.fillStyle = BJ_COL[p.col][0]; g.fillRect(wx, wy + wh * 0.72, ww, wh);
      circ(g, wx + ww / 2, wy + wh * 0.52, 5.2, p.skin, 1.6);
      g.fillStyle = p.hair; g.beginPath(); g.ellipse(wx + ww / 2, wy + wh * 0.52 - 4, 5.6, 3, 0, 0, Math.PI * 2); g.fill();
      circ(g, wx + ww / 2 - 1.8, wy + wh * 0.56, 0.9, C.ink, 0); circ(g, wx + ww / 2 + 1.8, wy + wh * 0.56, 0.9, C.ink, 0);
      g.restore();
    }
    g.save(); g.globalAlpha = 0.5; ln(g, [[wx + 3, wy + wh - 3], [wx + 7, wy + 3]], 1.5, '#fff'); g.restore();
  }
  // plate with the colour symbol, headlight, bumper
  circ(g, x + L - 15, y + Hh * 0.7, 6.5, '#fff', 2); bjSymbol(g, P[3], x + L - 15, y + Hh * 0.71, 3.4, P[1]);
  circ(g, x + 5, y + Hh * 0.78, 3, '#ffe27a', 1.6);
  ln(g, [[x + 1, y + Hh - 1], [x + 14, y + Hh - 1]], 3);
  g.restore();
}
function bjDrawStop(g) {
  const x = GRID.x + 12, y1 = GRID.y + 58, y0 = GRID.y + 2;
  ln(g, [[x, y1], [x, y0 + 10]], 3.5);
  circ(g, x, y0 + 8, 9, C.blue, 2.5);
  rr(g, x - 5, y0 + 3.5, 10, 7, 2, '#fff', 0); g.fillStyle = C.blue; g.fillRect(x - 3.5, y0 + 5, 3, 2.5); g.fillRect(x + 0.5, y0 + 5, 3, 2.5);
  circ(g, x - 2.6, y0 + 11.5, 1.4, '#fff', 0); circ(g, x + 2.6, y0 + 11.5, 1.4, '#fff', 0);
}
