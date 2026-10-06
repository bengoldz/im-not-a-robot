// rounds/parking.js — PARKING JAM 3D / RUSH HOUR / UNBLOCK ME, re-skinned as "Select the exit for the bus".
// A parking lot on the CAPTCHA grid: cars (2 cells) and trucks (3 cells), each horizontal or vertical, and the yellow
// school bus (2–3 cells, horizontal) that must leave through the gate in the right wall. The cat walks on free cells
// (step mode) and PUSHES a vehicle by walking into it along its axis (one cell, if the cell in front is free). Walking
// into a vehicle from the side only gets a honk. Cats can't pull: to push the other way the cat must walk round to the
// other end, so the state is vehicle positions + the cat's reachable region (walking off the grid edge and back in
// connects all free border cells).
// Generation: random placement, full forward exploration of the push graph (BFS, node cap), reverse BFS from the solved
// states gives every state's exact distance; the start is a state whose distance fits the d window. par = minimum pushes.
// Stuck? The RESET pad from sokoban.js (walk off the grid, sit on it).

const PK_PASS = ['The bus is free! It did not even say thank you. Very human of it.', 'Beep beep! You solved traffic. City planners want your paw print.', 'The bus escaped. I waved. It did not wave back. I am fine.'];
const PK_FAIL = ['The bus is still parked. It has accepted this lot as its home now.', 'Gridlock. Even the honking has given up.', 'No exit was selected. The bus is writing a sad song about it.'];
// body, shade, highlight
const PK_PAINT = [['#e84a5f', '#c9334a', '#ff8a99'], ['#2f6fe4', '#1f4fb0', '#7fa8f5'], ['#22b573', '#168a55', '#7fdcae'], ['#8e6bd8', '#6a4bb5', '#bba4ee'],
  ['#2bb3c0', '#1a8c97', '#86dde6'], ['#ff8fa3', '#e2687f', '#ffc2cd'], ['#dfe5ee', '#b4bfcf', '#ffffff']];
const PK_BUSPAINT = ['#ffc93c', '#f0a417', '#ffe48f'];
const PK_MARGIN = { r: 34, b: 38 };   // exit gate strip on the right, RESET strip under the grid
const PK_K = ['U', 'R', 'D', 'L'], PK_D = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// ---------- pure model ----------
// cars: [{ len, h, fix }] (h: horizontal; fix = its row if h, else its column); pos[k] = leftmost col / top row.
// car 0 is the bus. Solved when pos[0] === n - len[0] (its nose at the exit gate).
function pkCell(car, p, j, n) { return car.h ? car.fix * n + p + j : (p + j) * n + car.fix; }
function pkOcc(cars, pos, n) {
  const o = new Int8Array(n * n).fill(-1);
  for (let k = 0; k < cars.length; k++) for (let j = 0; j < cars[k].len; j++) o[pkCell(cars[k], pos[k], j, n)] = k;
  return o;
}
const pkBorder = (i, n) => { const r = (i / n) | 0, c = i % n; return r === 0 || c === 0 || r === n - 1 || c === n - 1; };
// cells the cat can reach from `start` (free cells; leaving the grid and walking round connects every free border cell)
function pkRegion(occ, n, start) {
  const N = n * n, seen = new Uint8Array(N), q = [start]; let out = false; seen[start] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], r = (i / n) | 0, c = i % n;
    if (!out && pkBorder(i, n)) { out = true; for (let j = 0; j < N; j++) if (!seen[j] && occ[j] < 0 && pkBorder(j, n)) { seen[j] = 1; q.push(j); } }
    if (r > 0 && !seen[i - n] && occ[i - n] < 0) { seen[i - n] = 1; q.push(i - n); }
    if (r < n - 1 && !seen[i + n] && occ[i + n] < 0) { seen[i + n] = 1; q.push(i + n); }
    if (c > 0 && !seen[i - 1] && occ[i - 1] < 0) { seen[i - 1] = 1; q.push(i - 1); }
    if (c < n - 1 && !seen[i + 1] && occ[i + 1] < 0) { seen[i + 1] = 1; q.push(i + 1); }
  }
  let rep = N; for (let j = 0; j < N; j++) if (seen[j]) { rep = j; break; }
  return { seen, rep, out };
}
// every legal push from (pos, cat region): { k, dir (0..3), from (cat cell, -1 = from outside the lot), into (the
// vehicle cell the cat walks into), np }. A vehicle touching the lot's edge can be pushed in from outside.
function pkPushes(cars, pos, occ, reg, n) {
  const out = [], seen = reg.seen;
  for (let k = 0; k < cars.length; k++) {
    const v = cars[k], p = pos[k], L = v.len;
    // forward along the axis (right / down): cat behind the tail, cell after the nose free
    if (p + L <= n - 1 && occ[pkCell(v, p + L, 0, n)] < 0) {
      const from = p >= 1 ? pkCell(v, p - 1, 0, n) : -1;
      if (from >= 0 ? seen[from] : reg.out) { const np = pos.slice(); np[k] = p + 1; out.push({ k, dir: v.h ? 1 : 2, from, into: pkCell(v, p, 0, n), np }); }
    }
    // backward (left / up): cat past the nose, cell before the tail free
    if (p >= 1 && occ[pkCell(v, p - 1, 0, n)] < 0) {
      const from = p + L <= n - 1 ? pkCell(v, p + L, 0, n) : -1;
      if (from >= 0 ? seen[from] : reg.out) { const np = pos.slice(); np[k] = p - 1; out.push({ k, dir: v.h ? 3 : 0, from, into: pkCell(v, p + L - 1, 0, n), np }); }
    }
  }
  return out;
}
const pkKey = (pos, rep) => { let k = rep; for (let i = 0; i < pos.length; i++) k = k * 7 + pos[i]; return k; };
// explore the whole push graph from one state (node cap); dist[] = exact min pushes to a solved state (Infinity = never)
function pkExplore(cars, pos0, cat0, n, cap = 30000, expandGoals = false) {
  const goal = n - cars[0].len, nodes = [], map = new Map(), rev = [];
  const add = (pos, cell) => {
    const occ = pkOcc(cars, pos, n), R0 = pkRegion(occ, n, cell), key = pkKey(pos, R0.rep);
    let id = map.get(key);
    if (id == null) { id = nodes.length; map.set(key, id); nodes.push({ pos, cell: R0.rep, goal: pos[0] === goal }); rev.push([]); }
    return id;
  };
  add(pos0, cat0);
  let capped = false;
  for (let h = 0; h < nodes.length; h++) {
    if (nodes.length > cap) { capped = true; break; }
    const s = nodes[h]; if (s.goal && !expandGoals) continue;
    const occ = pkOcc(cars, s.pos, n), reg = pkRegion(occ, n, s.cell);
    for (const m of pkPushes(cars, s.pos, occ, reg, n)) { const c = add(m.np, m.into); if (!s.goal) rev[c].push(h); }
  }
  const dist = new Array(nodes.length).fill(Infinity), q = [];
  nodes.forEach((s, i) => { if (s.goal) { dist[i] = 0; q.push(i); } });
  for (let h = 0; h < q.length; h++) for (const u of rev[q[h]]) if (dist[u] === Infinity) { dist[u] = dist[q[h]] + 1; q.push(u); }
  return { nodes, dist, capped };
}
// exact BFS (min pushes) from a concrete start; returns the push list or null
function pkSolve(cars, pos0, cat0, n, cap = 60000) {
  const goal = n - cars[0].len;
  if (pos0[0] === goal) return { len: 0, pushes: [], nodes: 1 };
  const occ0 = pkOcc(cars, pos0, n), r0 = pkRegion(occ0, n, cat0);
  const nodes = [{ pos: pos0, cell: cat0, par: -1, m: null, d: 0 }], seen = new Set([pkKey(pos0, r0.rep)]);
  for (let h = 0; h < nodes.length; h++) {
    if (nodes.length > cap) return null;
    const s = nodes[h], occ = pkOcc(cars, s.pos, n), reg = pkRegion(occ, n, s.cell);
    for (const m of pkPushes(cars, s.pos, occ, reg, n)) {
      const occ2 = pkOcc(cars, m.np, n), key = pkKey(m.np, pkRegion(occ2, n, m.into).rep);
      if (seen.has(key)) continue; seen.add(key);
      nodes.push({ pos: m.np, cell: m.into, par: h, m, d: s.d + 1 });
      if (m.np[0] === goal) {
        const pushes = []; for (let v = nodes.length - 1; nodes[v].par >= 0; v = nodes[v].par) pushes.push(nodes[v].m);
        return { len: s.d + 1, pushes: pushes.reverse(), nodes: nodes.length };
      }
    }
  }
  return null;
}
// the cat's walk from cell a to cell b, or to the outside (b = -1). Dijkstra: in-grid steps cost 1, a trip round the
// outside costs 6. Tokens: U R D L, or 'O<cell>:<K>' = leave the grid, walk round, step in onto <cell> moving K.
function pkEntryK(i, n) { const r = (i / n) | 0, c = i % n; return r === n - 1 ? 'U' : c === 0 ? 'R' : c === n - 1 ? 'L' : 'D'; }
function pkWalk(occ, n, a, b) {
  if (a === b) return [];
  const N = n * n, OUT = N, tgt = b < 0 ? OUT : b, dist = new Array(N + 1).fill(Infinity), prev = new Array(N + 1).fill(-1), done = new Array(N + 1).fill(false);
  dist[a] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i <= N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === tgt) break;
    done[u] = true;
    const nb = [];
    if (u === OUT) { for (let j = 0; j < N; j++) if (occ[j] < 0 && pkBorder(j, n)) nb.push([j, 3]); }
    else {
      const r = (u / n) | 0, c = u % n;
      for (const [dr, dc] of PK_D) { const r2 = r + dr, c2 = c + dc; if (r2 >= 0 && r2 < n && c2 >= 0 && c2 < n && occ[r2 * n + c2] < 0) nb.push([r2 * n + c2, 1]); }
      if (pkBorder(u, n)) nb.push([OUT, 3]);
    }
    for (const [v, w] of nb) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  if (dist[tgt] === Infinity) return null;
  const cells = []; for (let v = tgt; v >= 0; v = prev[v]) cells.unshift(v);
  const toks = [];
  for (let k = 1; k < cells.length; k++) {
    const u = cells[k - 1], v = cells[k];
    if (v === OUT) continue;
    if (u === OUT) { toks.push('O' + v + ':' + pkEntryK(v, n)); continue; }
    const dr = ((v / n) | 0) - ((u / n) | 0), dc = v % n - u % n;
    toks.push(PK_K[PK_D.findIndex(d => d[0] === dr && d[1] === dc)]);
  }
  return toks;
}
// random SOLVED lot: the bus at the exit, then cars / trucks until the occupancy target (no other horizontal vehicle on
// the exit row: it could never leave and would wall the bus in for good)
function pkPlace(rng, n, er, busLen, nCars, occT, truckP) {
  const cars = [{ len: busLen, h: true, fix: er, bus: true }], pos = [n - busLen];
  let occ = pkOcc(cars, pos, n), used = busLen;
  for (let tries = 0; tries < 300 && cars.length - 1 < nCars && used < occT; tries++) {
    const len = rng.chance(truckP) ? 3 : 2, h = rng.chance(0.45), fix = rng.int(0, n - 1), p = rng.int(0, n - len);
    if (h && fix === er) continue;
    const v = { len, h, fix }; let ok = true;
    for (let j = 0; j < len; j++) if (occ[pkCell(v, p, j, n)] >= 0) { ok = false; break; }
    if (!ok) continue;
    cars.push(v); pos.push(p); used += len; occ = pkOcc(cars, pos, n);
  }
  return { cars, pos, occ };
}
// Explore everything reachable from a solved lot (pushes are mostly reversible: the cat can walk round), take the state
// whose exact distance to a solved state is closest to a target drawn from the d window. Node budget keeps it fast.
function pkGenerate(d, rng) {
  const n = d < 0.5 ? 5 : 6, N = n * n;
  const busLen = n === 5 || rng.chance(0.6) ? 2 : 3;
  const er = n === 5 ? 2 : rng.pick([2, 2, 3]);
  const nCars = d === 0 ? rng.int(1, 2) : Math.round(n === 5 ? lerp(3, 6, d / 0.5) : lerp(6, 9, (d - 0.5) / 0.5)) + rng.int(0, 1);
  const occT = d === 0 ? 8 : Math.round((n === 5 ? lerp(0.44, 0.56, d / 0.5) : lerp(0.5, 0.6, (d - 0.5) / 0.5)) * N);
  const truckP = d === 0 ? 0 : lerp(0.15, 0.3, d);
  const lo = d === 0 ? 3 : Math.round(lerp(4, 13, d)), hi = d === 0 ? 5 : lo + Math.round(lerp(3, 7, d));
  const mid = (lo + hi) / 2;
  let best = null, budget = 36000;
  for (let a = 0; a < 80 && budget > 0; a++) {
    const L = pkPlace(rng, n, er, busLen, nCars, occT, truckP);
    const free = [...Array(N).keys()].filter(i => L.occ[i] < 0);
    const X = pkExplore(L.cars, L.pos, rng.pick(free), n, 8000, true);
    budget -= X.nodes.length;
    const target = rng.int(lo, hi);
    let pickI = -1, pickS = Infinity;
    X.nodes.forEach((s, i) => {
      const dd = X.dist[i]; if (dd === Infinity || dd < 1) return;
      const score = Math.abs(dd - target) + rng.f(0, 0.5);
      if (score < pickS) { pickS = score; pickI = i; }
    });
    if (pickI < 0) continue;
    // exact check from the concrete start (a capped exploration can over-estimate the distance)
    const s = X.nodes[pickI], occ = pkOcc(L.cars, s.pos, n), reg = pkRegion(occ, n, s.cell);
    const cells = [...Array(N).keys()].filter(i => reg.seen[i]);
    const near = cells.filter(i => [i - n, i + n, i % n ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1].some(j => j >= 0 && j < N && occ[j] >= 0));
    const cat0 = rng.pick(near.length ? near : cells), sol = pkSolve(L.cars, s.pos, cat0, n, 25000);
    if (!sol || sol.len < 1) continue;
    budget -= sol.nodes || 0;
    const dist = sol.len, inWin = dist >= lo && dist <= hi;
    if (!inWin && best && Math.abs(best.dist - mid) <= Math.abs(dist - mid)) continue;
    best = { cars: L.cars, pos: s.pos, cat: cat0, dist, n, er, sol };
    if (inWin) break;
  }
  if (!best) {   // hand-made fallback: the bus behind one vertical car
    const cars = [{ len: 2, h: true, fix: 2, bus: true }, { len: 2, h: false, fix: 3 }];
    best = { cars, pos: [0, 1], cat: 20, n: 5, er: 2 };
    best.sol = pkSolve(cars, best.pos, best.cat, 5); best.dist = best.sol.len;
  }
  return best;
}
// solution as key tokens (walk to each push, then walk into the vehicle)
function pkTokens(cars, pos0, cat0, n, pushes) {
  const toks = []; let pos = pos0.slice(), cat = cat0;
  for (const m of pushes) {
    const w = pkWalk(pkOcc(cars, pos, n), n, cat, m.from);
    if (!w) return null;
    toks.push(...w, m.from < 0 ? 'O' + m.into + ':' + PK_K[m.dir] : PK_K[m.dir]);
    pos = m.np; cat = m.into;
  }
  return toks;
}

registerRound({
  id: 'parking', name: 'Parking Jam',
  minD: 0.3, weight: 1,
  intro: 'Walk into a car to push it. Cats push, never pull. Get the yellow bus out of the exit on the right!',
  again: ['Traffic again! Push the cars until the bus can leave. Humans love traffic.', 'Another parking lot. Somebody parked like a robot. Push, never pull.'],
  move: 'step', verify: 'auto', exitGrid: true, autoDelay: 0.1, noCheck: true, selShrink: 1,

  generate(d, rng) {
    const L = pkGenerate(d, rng), n = L.n;
    const paints = rng.shuffle(PK_PAINT.map((p, i) => i));
    const vehicles = L.cars.map((v, k) => ({
      len: v.len, h: v.h, fix: v.fix, bus: !!v.bus, truck: !v.bus && v.len === 3,
      paint: v.bus ? -1 : paints[(k - 1) % paints.length],
      face: v.bus ? 'R' : v.h ? (rng.chance(0.5) ? 'R' : 'L') : (rng.chance(0.5) ? 'D' : 'U'),
    }));
    const tiles = [...Array(n * n)].map(() => ({ empty: true, noSelect: true }));
    const pushes = L.sol ? L.sol.pushes : [];
    return {
      grid: n, margin: PK_MARGIN, tiles, initTiles: tiles, catStart: L.cat,
      vehicles, carPos0: L.pos.slice(), exitRow: L.er,
      l1: 'Select the exit for', big: 'the bus', l3: 'Get the bus out. Humans love traffic.',
      par: { pushes: L.sol ? L.sol.len : 99 },
      solution: L.sol ? pkTokens(L.cars, L.pos, L.cat, n, pushes) : [],
    };
  },

  enter(R) {
    R.carPos = R.carPos0.slice(); R.won = false; R.exitT = -1; R.gate = 0; R.padOn = false; R.bubbles = []; R.stats.pushes = 0;
    R.vfx = R.vehicles.map(() => ({ ox: 0, oy: 0, sq: 1, wig: 0 }));
    pkRefresh(R);
  },
  update(R, dt) {
    sokoPadUpdate(R);
    for (const b of R.bubbles) b.t += dt;
    R.bubbles = R.bubbles.filter(b => b.t < b.life);
    if (R.exitT >= 0) {
      R.exitT += dt;
      const f = R.vfx[0], t = R.exitT - 0.18;
      f.ox = t < 0 ? -Math.sin(R.exitT / 0.18 * Math.PI) * 4 : 0.5 * 1700 * t * t + 60 * t;   // tiny rev back, then off it goes
      if (t > 0 && Math.random() < 0.6) { const p = pkVehRect(R, 0); dust(p.x + f.ox - 4, p.y + p.h * 0.75, 1, 8, '#b7bfcc'); }
    }
    // safety: a hop from outside that lands inside a vehicle cell would wedge the cat (free mode, not snapped): nudge it out
    if (mode === 'play' && cat.cell < 0 && !cat.mv && cat.hopT <= 0) {
      const j = cellAt(cat.x, cat.y);
      if (j >= 0 && R.occ[j] >= 0) {
        const dl = cat.x - G.x, dr = G.x + G.w - cat.x, du = cat.y - G.y, dd = G.y + G.h - cat.y, m = Math.min(dl, dr, du, dd);
        if (m === dd) cat.y = G.y + G.h + 8; else if (m === dl) cat.x = G.x - 8; else if (m === dr) cat.x = G.x + G.w + 8; else cat.y = G.y - 8;
      }
    }
  },

  // no hopping over cars (hop in place); walking into a vehicle along its axis pushes it (done in onMove)
  moveCat(R, from, dir, how) {
    if (how === 'hop') return { path: [from], how: 'hop' };
    if (how !== 'walk') return null;
    const j = stepCell(from, dir);
    if (j < 0 || R.occ[j] < 0) return null;
    return { path: pkCanPush(R, R.occ[j], dir) ? [j] : [], how: 'walk' };
  },
  // from === -1: the cat steps in from outside the lot (free walking snaps onto the grid). Walking into a vehicle's end
  // along its axis pushes it in (the cat then takes the freed cell); from the side, a honk (with a cooldown: this is
  // asked every frame while the cat leans on it).
  canEnter(R, from, to, info) {
    if (!R.occ || R.occ[to] < 0) return undefined;
    const k = R.occ[to], dir = info && info.dir;
    if (from !== -1 || !dir || info.hop || mode !== 'play') return false;
    if (stepCell(to, [-dir[0], -dir[1]]) < 0 && pkCanPush(R, k, dir)) { pkPush(R, k, dir); return true; }
    if ((R.honkT || 0) < time) { R.honkT = time + 0.8; pkBlocked(R, k, to, dir); }
    return false;
  },
  onMove(R, from, dir, how, path) {
    if (how !== 'walk' || from < 0) return;
    const j = stepCell(from, dir); if (j < 0) return;
    const k = R.occ[j]; if (k < 0) return;
    if (path.length) pkPush(R, k, dir);
    else pkBlocked(R, k, j, dir);
  },
  onSit(R, tile) {
    if (sokoPadSit(R, R2 => { if (R2.won) return; sokoRestore(R2); pkRestore(R2); })) return;
    addTxt(cat.x, cat.y - 50, pick(['sat.', 'beep beep?', 'parked.']), C.grey);
  },

  drawTile(R, g, t, x, y, s) {
    rr(g, x, y, s, s, s * 0.08, '#bcc2cd', 0);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 3, y + 3, s - 6, s * 0.4);
    // asphalt specks (fixed per cell)
    g.fillStyle = 'rgba(29,36,51,.10)';
    for (let k = 0; k < 4; k++) { const h = ((t.i + 1) * 2654435761 * (k + 3)) >>> 0; g.fillRect(x + (h % 97) / 97 * (s - 6) + 2, y + ((h >> 8) % 89) / 89 * (s - 6) + 2, 2.5, 2.5); }
    // painted bay corners
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; const m = s * 0.12, q = s * 0.2;
    g.beginPath(); g.moveTo(x + m, y + m + q); g.lineTo(x + m, y + m); g.lineTo(x + m + q, y + m);
    g.moveTo(x + s - m - q, y + s - m); g.lineTo(x + s - m, y + s - m); g.lineTo(x + s - m, y + s - m - q); g.stroke();
    if (t.r === R.exitRow) {   // chevrons on the exit lane
      g.save(); g.globalAlpha = 0.55; g.strokeStyle = '#ffd25a'; g.lineWidth = Math.max(3, s * 0.07); g.lineCap = 'round'; g.lineJoin = 'round';
      const cx = x + s / 2, cy = y + s / 2, w = s * 0.12;
      g.beginPath(); g.moveTo(cx - w, cy - w * 1.4); g.lineTo(cx + w * 0.6, cy); g.lineTo(cx - w, cy + w * 1.4); g.stroke(); g.restore();
    }
    return true;
  },
  drawUnder(R, g) {
    const p = 7;
    rr(g, G.x - p, G.y - p, G.w + p * 2, G.h + p * 2, 12, '#8e96a6', 0);           // the lot (shows in the tile gaps)
    // curb: thick ink-outlined kerb round the lot, with the gap on the right at the exit row
    const ey = cellXY(R.exitRow * G.cols).y, gy0 = ey - 2, gy1 = ey + G.ts + 2, xr = G.x + G.w + p;
    g.save(); g.lineWidth = 5; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(xr, gy0); g.lineTo(xr, G.y - p + 10); g.arcTo(xr, G.y - p, xr - 10, G.y - p, 10); g.lineTo(G.x - p + 10, G.y - p);
    g.arcTo(G.x - p, G.y - p, G.x - p, G.y - p + 10, 10); g.lineTo(G.x - p, G.y + G.h + p - 10); g.arcTo(G.x - p, G.y + G.h + p, G.x - p + 10, G.y + G.h + p, 10);
    g.lineTo(xr - 10, G.y + G.h + p); g.arcTo(xr, G.y + G.h + p, xr, G.y + G.h + p - 10, 10); g.lineTo(xr, gy1); g.stroke(); g.restore();
    // exit road through the gap, out to the panel edge
    const rx0 = xr - 2, rx1 = PANEL.x + PANEL.w;
    g.fillStyle = '#8e96a6'; g.fillRect(rx0, gy0 + 3, rx1 - rx0, gy1 - gy0 - 6);
    g.fillStyle = '#bcc2cd'; g.fillRect(rx0, gy0 + 7, rx1 - rx0, gy1 - gy0 - 14);
    g.save(); g.setLineDash([8, 7]); g.lineDashOffset = R.exitT >= 0 ? -time * 90 : 0; ln(g, [[rx0 + 4, (gy0 + gy1) / 2], [rx1, (gy0 + gy1) / 2]], 2.5, '#ffd25a'); g.restore();
  },
  drawOverlay(R, g) {
    sokoPadDraw(R, g);
    // vehicles (the bus clipped to the panel so it vanishes off the edge)
    g.save(); g.beginPath(); g.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h); g.clip();
    R.vehicles.forEach((v, k) => { if (k === 0 && R.exitT > 2) return; pkDrawVehicle(R, g, k); });
    g.restore();
    pkDrawGate(R, g);
  },
  drawTop(R, g) {
    for (const b of R.bubbles) {
      const k = Math.min(1, b.t * 8, (b.life - b.t) * 5), y = b.y - 8 * EASE.outCubic(Math.min(1, b.t * 4));
      g.save(); g.globalAlpha = Math.max(0, k);
      g.font = `700 13px ${FONT}`; const w = g.measureText(b.text).width + 16;
      rr(g, b.x - w / 2, y - 22, w, 20, 10, '#fff', 2.5);
      poly(g, [[b.x - 4, y - 3], [b.x + 4, y - 3], [b.x - 1, y + 4]], '#fff', 0); ln(g, [[b.x - 4, y - 2], [b.x - 1, y + 4], [b.x + 4, y - 2]], 2.5);
      txt(b.text, b.x, y - 11.5, 13, b.col || C.ink, 'center', 700);
      g.restore();
    }
  },

  progress: R => R.won ? `Bus out! · ${R.stats.pushes} / ${R.par.pushes}` : `Pushes ${R.stats.pushes} / par ${R.par.pushes}`,
  solved: R => R.won && R.exitT > 1.0,
  judge(R) {
    const row = [...Array(G.cols).keys()].map(c => R.exitRow * G.cols + c);
    return R.won ? { pass: true, verdict: pick(PK_PASS), checked: row } : { pass: false, verdict: pick(PK_FAIL), wrong: row, checked: row };
  },
});

// ---------- runtime helpers ----------
function pkRefresh(R) { R.occ = pkOcc(R.vehicles, R.carPos, G.cols); if (R.won) for (let i = 0; i < R.occ.length; i++) if (R.occ[i] === 0) R.occ[i] = -1; }
function pkCanPush(R, k, dir) {
  const v = R.vehicles[k], n = G.cols, p = R.carPos[k];
  if (R.won && k === 0) return false;
  if (v.h ? dir[0] !== 0 : dir[1] !== 0) return false;
  const fwd = v.h ? dir[1] > 0 : dir[0] > 0, np = p + (fwd ? 1 : -1);
  if (np < 0 || np + v.len > n) return false;
  const front = pkCell(v, fwd ? p + v.len : p - 1, 0, n);
  return R.occ[front] < 0 && cat.cell !== front;
}
function pkVehRect(R, k) {
  const v = R.vehicles[k], n = G.cols, a = cellXY(pkCell(v, R.carPos[k], 0, n)), span = v.len * G.pitch - G.gap;
  return v.h ? { x: a.x, y: a.y, w: span, h: G.ts } : { x: a.x, y: a.y, w: G.ts, h: span };
}
function pkPush(R, k, dir) {
  const v = R.vehicles[k], f = R.vfx[k];
  R.carPos[k] += v.h ? dir[1] : dir[0];
  pkRefresh(R);
  R.stats.pushes++;
  f.ox = -dir[1] * G.pitch; f.oy = -dir[0] * G.pitch;
  tween(f, { ox: 0, oy: 0 }, 0.2, { ease: 'outCubic' });
  tween(f, { sq: [0.94, 1.04, 1] }, 0.26, { ease: 'outQuad' });
  // engine growl + a little smoke puff from where the cat pushed
  tone(70, 0.22, 'triangle', 0.07, 45); tone(105, 0.16, 'triangle', 0.03, 30, 0.03); noise(0.18, 0.04, 0, 320);
  const r = pkVehRect(R, k), tx = dir[1] > 0 ? r.x : dir[1] < 0 ? r.x + r.w : r.x + r.w / 2, ty = dir[0] > 0 ? r.y : dir[0] < 0 ? r.y + r.h : r.y + r.h / 2;
  after(0.04, () => { dust(tx - dir[1] * 6, ty - dir[0] * 6 + 6, 6, 16, '#c3c9d4'); dust(tx - dir[1] * 10, ty - dir[0] * 10, 3, 10, '#e6e9ef'); });
  if (k === 0 && R.carPos[0] === G.cols - v.len) pkWin(R);
  else if (k === 0) addTxt(r.x + r.w / 2, r.y - 6, pick(['vroom', 'brrm!', 'chug']), '#c98a00');
}
function pkBlocked(R, k, j, dir) {
  const v = R.vehicles[k], c = cellCenter(j), side = v.h ? dir[0] !== 0 : dir[1] !== 0;
  tween(R.vfx[k], { wig: [0, 1] }, 0.25, { ease: 'linear', done: () => { R.vfx[k].wig = 0; } });
  if (side) {   // from the side: just a tiny honk
    R.bubbles.push({ x: c.x, y: c.y - G.ts * 0.3, text: pick(['honk!', 'beep!', 'honk honk']), t: 0, life: 0.9 });
    tone(392, 0.09, 'triangle', 0.05); tone(494, 0.12, 'triangle', 0.045, 0, 0.1);
  } else { R.bubbles.push({ x: c.x, y: c.y - G.ts * 0.3, text: 'stuck!', t: 0, life: 0.7, col: C.grey }); tone(80, 0.12, 'triangle', 0.05, -15); }
}
function pkWin(R) {
  R.won = true; pkRefresh(R); R.exitT = 0;
  tween(R, { gate: 1 }, 0.3, { ease: 'outBack' });
  // engine revs up and away
  tone(80, 0.9, 'triangle', 0.07, 260, 0.12); tone(160, 0.7, 'sine', 0.03, 380, 0.2); noise(0.6, 0.04, 0.12, 500);
  after(0.12, () => { tone(523, 0.1, 'triangle', 0.05); tone(659, 0.16, 'triangle', 0.05, 0, 0.11); });   // honk honk
  const r = pkVehRect(R, 0);
  R.bubbles.push({ x: r.x + r.w / 2, y: r.y - 4, text: 'HONK HONK!', t: 0, life: 1.1, col: '#c98a00' });
  after(0.25, () => { dust(r.x - 2, r.y + r.h * 0.7, 10, 22, '#b7bfcc'); burst(r.x + r.w, r.y + r.h / 2, C.gold, 8, 150, 3); });
  after(0.55, () => SFX.chord());
  say(pick(['Go, bus, go! Be free!', 'It is leaving! Goodbye, big yellow friend!', 'Look at it go. I am not crying, it is oil.']), 'ecstatic', 3);
}
function pkRestore(R) {
  R.carPos = R.carPos0.slice(); R.won = false; R.exitT = -1;
  R.vfx.forEach(f => { f.ox = f.oy = 0; f.sq = 1; tween(f, { sq: [0.9, 1.05, 1] }, 0.3, { ease: 'outQuad' }); });
  pkRefresh(R);
}

// ---------- drawing ----------
function pkDrawGate(R, g) {
  const ey = cellXY(R.exitRow * G.cols).y, xr = G.x + G.w + 7, y0 = ey - 2, y1 = ey + G.ts + 2;
  // posts
  rr(g, xr - 5, y0 - 8, 10, 12, 3, '#e5484d', 2.5); rr(g, xr - 5, y1 - 4, 10, 12, 3, '#e5484d', 2.5);
  // barrier arm (lifts when the bus leaves)
  const a = -R.gate * 1.35, L = y1 - y0 - 6;
  g.save(); g.translate(xr, y0 - 2); g.rotate(a);
  rr(g, -3.5, 0, 7, L, 3.5, '#fff', 2.5);
  for (let k = 0; k < 3; k++) { g.fillStyle = C.red; g.fillRect(-2, 4 + k * L / 3, 4, L / 6); }
  g.restore();
  circ(g, xr, y0 - 2, 4, C.ink, 0);
  // EXIT sign
  const sx = Math.min(xr + 20, PANEL.x + PANEL.w - 18), sy = y0 - 16;
  rr(g, sx - 15, sy - 9, 30, 16, 4, C.green, 2.5); txt('EXIT', sx, sy - 0.5, 9.5, '#fff', 'center', 700);
}
function pkDrawVehicle(R, g, k) {
  const v = R.vehicles[k], f = R.vfx[k], r = pkVehRect(R, k);
  const wig = f.wig > 0 ? Math.sin(f.wig * Math.PI * 4) * (1 - f.wig) * 2.5 : 0;
  const cx = r.x + r.w / 2 + f.ox + (v.h ? 0 : wig), cy = r.y + r.h / 2 + f.oy + (v.h ? wig : 0);
  const L = (v.h ? r.w : r.h) - G.ts * 0.08, Wd = G.ts * 0.8;
  g.save(); g.translate(cx, cy);
  // soft ground shadow
  g.fillStyle = 'rgba(29,36,51,.22)'; const sw = v.h ? L : Wd, shh = v.h ? Wd : L;
  g.beginPath(); g.roundRect(-sw / 2 + 3, -shh / 2 + 5, sw, shh, Wd * 0.3); g.fill();
  if (v.face === 'L') g.transform(-1, 0, 0, 1, 0, 0);
  else if (v.face === 'D') g.transform(0, 1, 1, 0, 0, 0);
  else if (v.face === 'U') g.transform(0, -1, 1, 0, 0, 0);
  g.scale(f.sq, 2 - f.sq);
  if (v.bus) pkDrawBus(g, L, Wd);
  else if (v.truck) pkDrawTruck(g, L, Wd, PK_PAINT[v.paint]);
  else pkDrawCar(g, L, Wd, PK_PAINT[v.paint]);
  g.restore();
}
// local frame: x along the vehicle (nose at +x), y across (+y = shaded side). All shapes ink-outlined, cel-shaded.
function pkWheels(g, xs, hw, wl, ww) { for (const x of xs) for (const s of [-1, 1]) rr(g, x - wl / 2, s > 0 ? hw - ww * 0.55 : -hw - ww * 0.45, wl, ww, 3, '#2a2f3a', 2.5); }
function pkBody(g, L, Wd, rad, P) {
  const hl = L / 2, hw = Wd / 2;
  g.beginPath(); g.roundRect(-hl, -hw, L, Wd, rad); g.fillStyle = P[0]; g.fill();
  g.save(); g.clip();
  g.fillStyle = P[1]; g.fillRect(-hl, hw * 0.42, L, hw); g.fillRect(-hl, -hw, L * 0.06, Wd);   // shade: lower side + tail
  g.fillStyle = P[2]; g.globalAlpha = 0.7; g.beginPath(); g.roundRect(-hl + L * 0.1, -hw + Wd * 0.1, L * 0.5, Wd * 0.1, 3); g.fill();
  g.restore();
  g.beginPath(); g.roundRect(-hl, -hw, L, Wd, rad); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
}
function pkGlass(g, pts) { poly(g, pts, '#bfe6ff', 2.2); g.save(); g.globalAlpha = 0.6; ln(g, [[lerp(pts[0][0], pts[1][0], 0.3), lerp(pts[0][1], pts[1][1], 0.3) + 2], [lerp(pts[3][0], pts[2][0], 0.3), lerp(pts[3][1], pts[2][1], 0.3) - 2]], 2, '#fff'); g.restore(); }
function pkLights(g, hl, hw, front = true, back = true) {
  if (front) for (const s of [-1, 1]) ell(g, hl - 3.5, s * hw * 0.62, 2.6, 3.6, '#ffe27a', 1.6);
  if (back) for (const s of [-1, 1]) rr(g, -hl + 0.5, s * hw * 0.62 - 3, 3.5, 6, 1.5, '#e5484d', 0);
}
function pkDrawCar(g, L, Wd, P) {
  const hl = L / 2, hw = Wd / 2, wl = Math.min(14, L * 0.17), ww = hw * 0.34;
  pkWheels(g, [hl * 0.56, -hl * 0.56], hw, wl, ww);
  for (const s of [-1, 1]) ell(g, hl * 0.2, s * (hw + 1.5), 3, 2.4, P[0], 1.8);   // wing mirrors
  pkBody(g, L, Wd, Wd * 0.34, P);
  // windscreen, roof, rear window
  pkGlass(g, [[hl * 0.08, -hw * 0.7], [hl * 0.5, -hw * 0.58], [hl * 0.5, hw * 0.58], [hl * 0.08, hw * 0.7]]);
  rr(g, -hl * 0.5, -hw * 0.66, hl * 0.58, hw * 1.32, 5, P[0], 2.2);
  g.fillStyle = P[2]; g.globalAlpha = 0.6; g.fillRect(-hl * 0.42, -hw * 0.5, hl * 0.4, hw * 0.22); g.globalAlpha = 1;
  pkGlass(g, [[-hl * 0.72, -hw * 0.58], [-hl * 0.52, -hw * 0.66], [-hl * 0.52, hw * 0.66], [-hl * 0.72, hw * 0.58]]);
  pkLights(g, hl, hw);
}
function pkDrawTruck(g, L, Wd, P) {
  const hl = L / 2, hw = Wd / 2, wl = Math.min(14, L * 0.11), ww = hw * 0.34, cab = L * 0.3;
  pkWheels(g, [hl * 0.7, -hl * 0.2, -hl * 0.68], hw, wl, ww);
  // cab (front)
  g.save(); g.translate(hl - cab / 2, 0); pkBody(g, cab, Wd * 0.92, Wd * 0.26, P);
  pkGlass(g, [[-cab * 0.1, -hw * 0.64], [cab * 0.22, -hw * 0.56], [cab * 0.22, hw * 0.56], [-cab * 0.1, hw * 0.64]]);
  for (const s of [-1, 1]) ell(g, cab * 0.4, s * hw * 0.6, 2.4, 3.4, '#ffe27a', 1.6);
  g.restore();
  // cargo box
  const bl = L - cab - 2, bx = -hl;
  rr(g, bx, -hw, bl, Wd, 5, '#eef1f6', 0);
  g.save(); g.beginPath(); g.roundRect(bx, -hw, bl, Wd, 5); g.clip(); g.fillStyle = '#cfd6e2'; g.fillRect(bx, hw * 0.4, bl, hw); g.restore();
  for (let k = 1; k < 4; k++) ln(g, [[bx + bl * k / 4, -hw + 4], [bx + bl * k / 4, hw - 4]], 1.6, 'rgba(29,36,51,.35)');
  g.fillStyle = P[0]; g.fillRect(bx + 3, -hw * 0.14, bl - 6, hw * 0.28);   // company stripe
  rr(g, bx, -hw, bl, Wd, 5, null, 3);
  pkLights(g, hl, hw, false, true);
}
function pkDrawBus(g, L, Wd) {
  const P = PK_BUSPAINT, hl = L / 2, hw = Wd / 2, wl = Math.min(15, L * 0.1), ww = hw * 0.36;
  pkWheels(g, [hl * 0.62, -hl * 0.55], hw, wl, ww);
  // stop-sign arm on the driver's side
  poly(g, [[hl * 0.42 - 5, -hw - 2], [hl * 0.42 + 5, -hw - 2], [hl * 0.42 + 6, -hw - 9], [hl * 0.42 - 6, -hw - 9]], '#e5484d', 2);
  pkBody(g, L, Wd, Wd * 0.22, P);
  // hood + windscreen at the nose
  const hood = Math.min(L * 0.13, 16);
  ln(g, [[hl - hood, -hw + 3], [hl - hood, hw - 3]], 2.2);
  pkGlass(g, [[hl - hood - L * 0.1, -hw * 0.72], [hl - hood - 2, -hw * 0.66], [hl - hood - 2, hw * 0.66], [hl - hood - L * 0.1, hw * 0.72]]);
  // roof: two black stripes, roof hatches, a lighter middle
  const rx0 = -hl + 6, rx1 = hl - hood - L * 0.12;
  g.fillStyle = P[2]; g.globalAlpha = 0.55; g.fillRect(rx0, -hw * 0.3, rx1 - rx0, hw * 0.4); g.globalAlpha = 1;
  ln(g, [[rx0, -hw * 0.52], [rx1, -hw * 0.52]], 2, C.ink); ln(g, [[rx0, hw * 0.52], [rx1, hw * 0.52]], 2, C.ink);
  const nh = L > 150 ? 3 : 2;
  for (let k = 0; k < nh; k++) { const x = lerp(rx0 + 8, rx1 - 16, nh === 1 ? 0.5 : k / (nh - 1)); rr(g, x, -hw * 0.28, 11, hw * 0.56, 2.5, '#fff6d6', 1.8); }
  // amber roof lights at the corners + head / tail lights
  for (const s of [-1, 1]) { circ(g, rx1 - 2, s * hw * 0.78, 2.2, '#ff9d2e', 1.2); circ(g, rx0 + 2, s * hw * 0.78, 2.2, '#ff9d2e', 1.2); }
  pkLights(g, hl, hw);
}
