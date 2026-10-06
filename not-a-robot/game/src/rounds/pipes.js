// rounds/pipes.js — PIPE MANIA / INFINITY LOOP, re-skinned as "Connect the internet to your robot friend".
// Every tile is a cable piece (end, straight, corner, tee, cross). Sitting on a tile turns it 90° clockwise (spring + click).
// The router sits outside the grid on the left, the robot friend's port on the right. Connected cable glows cyan with a
// pulse travelling out from the router; once the port is reached, light races along the path, the little robot boots up
// ("Connected" + loading bar + chord) and the round auto-verifies.
// Generator: random self-avoiding path left -> right (longer and twistier with d), decoy pieces elsewhere, scrambled
// rotations. par = the true minimum number of rotations (Dijkstra relaxation, exact B&B search when it is not a simple path).

const PIPES_PASS = ['I can hear the modem singing. It is singing about me.', 'Connected! I just downloaded a picture of a cloud. It was a cloud.', 'Wi-Fi achieved. The cable did the hard work. Also you. Mostly you.'];
const PIPES_FAIL = ['Still offline. I am a very expensive paperweight.', 'The internet is on the other side of that cable. So close. So unplugged.', 'No signal. I tried licking the port. Do not tell HUMANCHECK.'];
const PIPES_YAY = ['CONNECTED! Loading internet… 3%…', 'I feel the bandwidth! It tickles!', 'Packets! Real packets! In my ports!'];
const PIPES_BIT = [[1, -1, 0], [2, 0, 1], [4, 1, 0], [8, 0, -1]];        // bit, dr, dc  (1 up, 2 right, 4 down, 8 left)
const PIPES_OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };

// mask rotated k quarter turns clockwise (same rule as pipeMask in 40-grid.js)
function pipesRot(m, k) { k = ((k % 4) + 4) % 4; for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15; return m; }
// fewest clockwise turns so that the piece (base mask p, current rot r) opens to every side in `need`
function pipesCost(p, r, need) { for (let k = 0; k < 4; k++) if ((pipesRot(p, r + k) & need) === need) return k; return Infinity; }
// flood the signal from the router: depth[i] = cable distance from the router (-1 = dark); parent for the race path
function pipesFlow(masks, cols, rows, rS, rE) {
  const N = cols * rows, depth = new Array(N).fill(-1), parent = new Array(N).fill(-1), start = rS * cols, end = rE * cols + cols - 1;
  if (masks[start] & 8) {
    depth[start] = 0; const q = [start];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], r = Math.floor(i / cols), c = i % cols;
      for (const [bit, dr, dc] of PIPES_BIT) {
        if (!(masks[i] & bit)) continue;
        const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const j = nr * cols + nc; if (depth[j] >= 0 || !(masks[j] & PIPES_OPP[bit])) continue;
        depth[j] = depth[i] + 1; parent[j] = i; q.push(j);
      }
    }
  }
  const connected = depth[end] >= 0 && !!(masks[end] & 2);
  const path = []; if (connected) for (let k = end; k >= 0; k = parent[k]) path.unshift(k);
  return { depth, connected, path };
}
// minimum rotations to connect router (left of row rS) to port (right of row rE).
// returns { cost, steps: [{cell, k}] }. Any solution contains a simple lit path whose cells each need at least
// pipesCost(entry|exit) turns, so the cheapest simple path is optimal (a cross is the only piece a path could reuse,
// and a cross never needs turning). Dijkstra over (cell, entry side) is a relaxation; if its path is simple it is exact,
// otherwise a branch-and-bound DFS over simple paths decides.
function pipesMinRot(base, rot, cols, rows, rS, rE, budget = 250000) {
  const N = cols * rows, start = rS * cols, end = rE * cols + cols - 1, S = N * 4, sideIx = { 1: 0, 2: 1, 4: 2, 8: 3 };
  const dist = new Array(S).fill(Infinity), prev = new Array(S).fill(-1), done = new Array(S).fill(false);
  const st = (i, e) => i * 4 + sideIx[e];
  dist[st(start, 8)] = 0;
  let best = Infinity, bestEnd = -1;
  for (;;) {
    let u = -1, du = Infinity; for (let s = 0; s < S; s++) if (!done[s] && dist[s] < du) { du = dist[s]; u = s; }
    if (u < 0 || du >= best) break;
    done[u] = true;
    const i = u >> 2, e = [1, 2, 4, 8][u & 3], r = Math.floor(i / cols), c = i % cols;
    if (i === end) { const k = pipesCost(base[i], rot[i], e | 2); if (du + k < best) { best = du + k; bestEnd = u; } }
    for (const [bit, dr, dc] of PIPES_BIT) {
      if (bit === e) continue;
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const k = pipesCost(base[i], rot[i], e | bit); if (k === Infinity) continue;
      const v = st(nr * cols + nc, PIPES_OPP[bit]);
      if (du + k < dist[v]) { dist[v] = du + k; prev[v] = u; }
    }
  }
  if (bestEnd < 0) return null;
  // reconstruct: list of (cell, entry); exit side = direction towards the next cell (port side for the last)
  const chain = []; for (let s = bestEnd; s >= 0; s = prev[s]) chain.unshift(s);
  const cells = chain.map(s => s >> 2);
  const steps = cells.map((i, k) => {
    const e = [1, 2, 4, 8][chain[k] & 3];
    let x = 2; if (k + 1 < cells.length) { const j = cells[k + 1], dr = Math.floor(j / cols) - Math.floor(i / cols), dc = j % cols - i % cols; x = dr < 0 ? 1 : dc > 0 ? 2 : dr > 0 ? 4 : 8; }
    return { cell: i, k: pipesCost(base[i], rot[i], e | x) };
  });
  if (new Set(cells).size === cells.length) return { cost: best, steps: steps.filter(s => s.k > 0), path: cells };
  // not simple: exact DFS over simple paths, bounded by the best known
  let bestCost = Infinity, bestSteps = null, bestPath = null, nodes = 0;
  const vis = new Array(N).fill(false), trail = [];
  const dfs = (i, e, cost) => {
    if (++nodes > budget) return;
    const r = Math.floor(i / cols), c = i % cols;
    vis[i] = true;
    if (i === end) { const k = pipesCost(base[i], rot[i], e | 2); if (cost + k < bestCost) { bestCost = cost + k; bestSteps = trail.concat([{ cell: i, k }]); bestPath = bestSteps.map(s => s.cell); } }
    for (const [bit, dr, dc] of PIPES_BIT) {
      if (bit === e) continue;
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const j = nr * cols + nc; if (vis[j]) continue;
      const k = pipesCost(base[i], rot[i], e | bit); if (k === Infinity || cost + k >= bestCost) continue;
      trail.push({ cell: i, k }); dfs(j, PIPES_OPP[bit], cost + k); trail.pop();
    }
    vis[i] = false;
  };
  dfs(start, 8, 0);
  if (!bestSteps) return null;
  return { cost: bestCost, steps: bestSteps.filter(s => s.k > 0), path: bestPath };
}
// random self-avoiding path (cell list) from (rS, 0) to (rE, cols-1) with a cell count in [lo, hi]
function pipesWalk(rng, cols, rows, rS, rE, lo, hi) {
  const start = rS * cols, end = rE * cols + cols - 1, vis = new Array(cols * rows).fill(false), path = [start];
  let nodes = 0, found = null;
  vis[start] = true;
  const dfs = i => {
    if (found || ++nodes > 6000) return;
    if (i === end) { if (path.length >= lo && path.length <= hi) found = path.slice(); return; }
    if (path.length >= hi) return;
    const r = Math.floor(i / cols), c = i % cols, er = Math.floor(end / cols), ec = end % cols;
    if (path.length + Math.abs(er - r) + Math.abs(ec - c) > hi) return;
    for (const [, dr, dc] of rng.shuffle(PIPES_BIT)) {
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const j = nr * cols + nc; if (vis[j]) continue;
      vis[j] = true; path.push(j); dfs(j); path.pop(); vis[j] = false;
    }
  };
  dfs(start);
  return found;
}
const PIPES_DECOYS = [[1, 0.14], [5, 0.3], [3, 0.3], [7, 0.21], [15, 0.05]];   // end, straight, corner, tee, cross

registerRound({
  id: 'pipes', name: 'Cable Connect',
  minD: 0.3, weight: 1,
  intro: 'Sit on a cable to turn it. Connect the router to me. I am the robot on the right. Hi.',
  again: ['More cables! Plug me in, kitty. Gently. I am ticklish at 5 GHz.', 'Cables again. Turn them until I can smell the internet.'],
  verify: 'auto', autoDelay: 1.5, noCheck: true, selShrink: 1,

  generate(d, rng) {
    const n = d < 0.2 ? 3 : d < 0.5 ? 4 : 5, cols = n, rows = n, N = cols * rows;
    let fallback = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      let rS, rE, path;
      if (d < 0.2) { rS = rE = 1; path = [3, 4, 5]; }
      else {
        rS = rng.int(0, rows - 1); rE = rng.int(0, rows - 1);
        const minLen = cols + Math.abs(rS - rE), extra = Math.round(lerp(0, N * 0.42, (d - 0.2) / 0.8)) + rng.int(0, 2);
        path = pipesWalk(rng, cols, rows, rS, rE, minLen + extra, minLen + extra + 3) || pipesWalk(rng, cols, rows, rS, rE, minLen, minLen + extra + 3);
        if (!path) continue;
      }
      // the correct masks along the path (+ decoy branches at higher d)
      const base = new Array(N).fill(0), rot = new Array(N).fill(0), onPath = new Set(path);
      path.forEach((i, k) => {
        const side = (a, b) => { const dr = Math.floor(b / cols) - Math.floor(a / cols), dc = b % cols - a % cols; return dr < 0 ? 1 : dc > 0 ? 2 : dr > 0 ? 4 : 8; };
        let m = (k === 0 ? 8 : side(i, path[k - 1])) | (k === path.length - 1 ? 2 : side(i, path[k + 1]));
        if (d >= 0.2 && rng.chance(d * 0.3)) { const extra = rng.pick([1, 2, 4, 8].filter(b => !(m & b))); m |= extra; }
        base[i] = m;
      });
      for (let i = 0; i < N; i++) if (!onPath.has(i)) { base[i] = rng.weighted(PIPES_DECOYS, x => x[1])[0]; rot[i] = rng.int(0, 3); }
      // scramble path tiles: each chosen one gets a rotation that actually breaks it
      const nScr = d < 0.2 ? 1 : clamp(Math.round(lerp(2, path.length * 0.7, d)), 2, path.length);
      const scr = d < 0.2 ? [4] : rng.sample(path, nScr);
      for (const i of scr) { const bad = [1, 2, 3].filter(k => pipesRot(base[i], k) !== base[i]); if (bad.length) rot[i] = rng.pick(bad); }
      const sol = pipesMinRot(base, rot, cols, rows, rS, rE);
      if (!sol || sol.cost < 1) continue;
      if (d >= 0.2 && sol.cost < 2) continue;
      if (d < 0.2 && sol.cost !== 1) continue;
      if (sol.cost > Math.round(lerp(4, 14, d))) continue;   // keep the turning count humane
      const spec = {
        cols, rows, margin: { l: 42, r: 50, t: 0, b: 0 },
        tiles: base.map((p, i) => ({ pipe: p, rot: rot[i], noSelect: true })),
        l1: 'Connect the internet to', big: 'your robot friend', l3: 'Sit = turn a cable 90°.',
        par: { sits: sol.cost }, rS, rE, solution: sol.steps, solPath: sol.path, genPath: path,
      };
      if (sol.cost >= Math.max(1, Math.round(path.length * 0.4 * d))) return spec;
      if (!fallback) fallback = spec;
    }
    return fallback || (() => { throw new Error('pipes: generator failed'); })();
  },

  enter(R) { R.connected = false; R.raceT = -1; R.loadT = -1; R.flow = null; pipesUpdate(R, -1, true); },
  update(R, dt) { if (R.raceT >= 0) R.raceT += dt; if (R.loadT >= 0) R.loadT += dt; },

  onSit(R, tile) {
    if (!tile) { defaultSit(R, null); return; }
    tile.rot = (tile.rot || 0) + 1;
    tileSpin(tile, -Math.PI / 2, 0.34);
    tileSquash(tile, 0.94, 1.03, 0.2);
    const c = cellCenter(tile.i);
    tone(1500, 0.025, 'triangle', 0.05); tone(820, 0.04, 'sine', 0.05, -200, 0.02); noise(0.025, 0.03, 0, 0, 3000);   // click
    dust(c.x, c.y + G.ts * 0.3, 2, 10);
    pipesUpdate(R, tile.i, false);
  },

  solved: R => R.connected,
  progress(R) {
    const L = R.solPath.length, k = R.connected ? L : R.solPath.filter(i => R.tiles[i].lit).length;
    return `Connected ${k}/${L} · turns ${R.stats.sits}/${R.par.sits}`;
  },
  judge(R) {
    const path = R.flow && R.flow.connected ? R.flow.path : [];
    if (R.connected) return { pass: true, verdict: pick(PIPES_PASS), checked: path };
    const wrong = R.solPath.filter(i => !R.tiles[i].lit);
    return { pass: false, verdict: pick(PIPES_FAIL), wrong, checked: R.solPath };
  },

  drawTile(R, g, t, x, y, s) {
    const race = R.raceIx && R.raceIx[t.i] != null ? R.raceIx[t.i] : -1;
    const hot = race >= 0 && R.raceT >= 0 ? clamp((R.raceT - race * 0.05) / 0.12, 0, 1) : 0;
    const ph = t.lit && t.depth >= 0 ? ((time * 5 - t.depth) % 7 + 7) % 7 : 9, pulse = ph < 1.6 ? Math.sin(ph / 1.6 * Math.PI) : 0;
    pipesDrawTile(g, pipeMask(t), x, y, s, !!t.lit, pulse, hot);
    return true;
  },
  drawUnder(R, g) {
    // backing plate so the cable gaps read as one board
    rr(g, G.x - 5, G.y - 5, G.w + 10, G.h + 10, 10, '#cfd8e6', 0);
    pipesDrawRouter(R, g);
  },
  drawOverlay(R, g) { pipesDrawBuddy(R, g); },
});

// recompute connectivity after a rotation; juice for newly lit cable, the race when the port connects
function pipesUpdate(R, changed, quiet) {
  const masks = R.tiles.map(t => pipeMask(t)), F = pipesFlow(masks, G.cols, G.rows, R.rS, R.rE), was = R.tiles.map(t => !!t.lit);
  R.flow = F;
  let newly = 0;
  R.tiles.forEach((t, i) => {
    t.depth = F.depth[i]; t.lit = F.depth[i] >= 0;
    if (t.lit && !was[i] && !quiet) { const c = cellCenter(i); after(t.depth * 0.03, () => burst(c.x, c.y, C.cyan, 5, 90, 3)); newly++; }
  });
  if (newly && !quiet) SFX.toggle(Math.min(12, F.depth.filter(v => v >= 0).length));
  if (F.connected && !R.connected) {
    R.connected = true; R.raceT = 0; R.loadT = -1; R.raceIx = {};
    F.path.forEach((i, k) => {
      R.raceIx[i] = k;
      after(k * 0.05, () => { if (!R.connected) return; const c = cellCenter(i); burst(c.x, c.y, '#e9feff', 6, 140, 3); tilePop(R.tiles[i]); SFX.chime(k); });
    });
    after(F.path.length * 0.05 + 0.08, () => {
      if (!R.connected) return;
      R.loadT = 0; SFX.chord(); botWiggle(); say(pick(PIPES_YAY), 'ecstatic', 3);
      const p = pipesBuddyXY(R); burst(p.x, p.y - 30, C.cyan, 10, 170, 4);
    });
  } else if (!F.connected && R.connected) { R.connected = false; R.raceT = -1; R.loadT = -1; R.raceIx = null; }
}

// ---------- drawing ----------
// chunky rounded cable: ink outline, grey (or glowing cyan) cable, copper ferrules at the tile edges, a hub in the middle
function pipesDrawTile(g, m, x, y, s, lit, pulse, hot) {
  rr(g, x, y, s, s, s * 0.12, lit ? '#e2f8fb' : '#e6ebf3', 0);
  g.lineWidth = 2; g.strokeStyle = lit ? '#bfeaf0' : '#d3dae6'; g.beginPath(); g.roundRect(x + 3, y + 3, s - 6, s - 6, s * 0.09); g.stroke();
  const cx = x + s / 2, cy = y + s / 2, w = s * 0.25, o = Math.max(2.5, s * 0.05), arms = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const arm = (k, width, col, inset = 0, off = 0) => {
    const [ax, ay] = arms[k], px = -ay * off, py = ax * off;
    g.beginPath(); g.moveTo(cx + px, cy + py); g.lineTo(cx + ax * (s / 2 - inset) + px, cy + ay * (s / 2 - inset) + py);
    g.lineWidth = width; g.strokeStyle = col; g.lineCap = 'butt'; g.stroke();
  };
  const ks = [0, 1, 2, 3].filter(k => m & (1 << k));
  if (lit) { g.save(); g.globalAlpha = 0.22 + 0.25 * Math.max(pulse, hot); for (const k of ks) arm(k, w * 2.2, C.cyan); circ(g, cx, cy, w * 1.1, C.cyan, 0); g.restore(); }
  for (const k of ks) arm(k, w + 2 * o, C.ink);
  circ(g, cx, cy, w / 2 + o, C.ink, 0);
  const body = hot > 0 ? '#e9feff' : lit ? '#62e8f7' : '#a3adbf', shade = lit ? '#2fbfd3' : '#8590a5';
  for (const k of ks) { arm(k, w, body); arm(k, w * 0.3, shade, 0, w * 0.3); arm(k, w * 0.22, 'rgba(255,255,255,.5)', 0, -w * 0.24); }
  circ(g, cx, cy, w / 2, body, 0);
  if (lit && (pulse > 0 || hot > 0)) { g.save(); g.globalAlpha = Math.max(pulse * 0.9, hot); for (const k of ks) arm(k, w * 0.36, '#ffffff'); circ(g, cx, cy, w * 0.2, '#ffffff', 0); g.restore(); }
  // copper ferrules where the cable meets the tile edge
  const fl = s * 0.13, fw = w + 2 * o + s * 0.05;
  for (const k of ks) {
    const [ax, ay] = arms[k], ex = cx + ax * (s / 2 - fl / 2), ey = cy + ay * (s / 2 - fl / 2), ww = ax ? fl : fw, hh = ax ? fw : fl;
    rr(g, ex - ww / 2, ey - hh / 2, ww, hh, 2, '#d9893b', Math.max(2, o * 0.8));
    g.fillStyle = '#f4b877'; if (ax) g.fillRect(ex - ww / 2 + 2, ey - hh / 2 + 2, ww - 4, hh * 0.22); else g.fillRect(ex - ww / 2 + 2, ey - hh / 2 + 2, ww * 0.22, hh - 4);
  }
  // hub / end cap
  if (ks.length === 1) { circ(g, cx, cy, w * 0.78, '#d9893b', Math.max(2, o * 0.8)); circ(g, cx - w * 0.2, cy - w * 0.2, w * 0.2, '#f4b877', 0); circ(g, cx, cy, w * 0.22, C.ink, 0); }
  else { circ(g, cx, cy, w * 0.5, lit ? '#c9fbff' : '#c9d0dc', Math.max(1.5, o * 0.7)); circ(g, cx, cy, w * 0.14, lit ? '#1f9fb3' : '#7b8597', 0); }
}
function pipesStub(g, x1, x2, y, s, lit) {
  const w = s * 0.25, o = Math.max(2.5, s * 0.05);
  if (lit) { g.save(); g.globalAlpha = 0.3; ln(g, [[x1, y], [x2, y]], w * 2.2, C.cyan); g.restore(); }
  ln(g, [[x1, y], [x2, y]], w + 2 * o, C.ink); ln(g, [[x1, y], [x2, y]], w, lit ? '#62e8f7' : '#a3adbf');
  ln(g, [[x1, y - w * 0.24], [x2, y - w * 0.24]], w * 0.22, 'rgba(255,255,255,.5)');
}
function pipesDrawRouter(R, g) {
  const cy = cellCenter(R.rS * G.cols).y, s = G.ts, bx = Math.max(PANEL.x + 22, G.x - 30);
  pipesStub(g, bx + 8, G.x - 1, cy, s, true);
  // the router: a little box with two antennas and blinking LEDs
  ln(g, [[bx - 8, cy - 10], [bx - 12, cy - 30]], 3); ln(g, [[bx + 8, cy - 10], [bx + 12, cy - 30]], 3);
  circ(g, bx - 12, cy - 31, 3.2, C.red, 2); circ(g, bx + 12, cy - 31, 3.2, C.red, 2);
  rr(g, bx - 16, cy - 12, 32, 24, 6, '#e9eef6', 3);
  g.fillStyle = '#c9d2e0'; g.fillRect(bx - 13, cy + 4, 26, 5);
  for (let k = 0; k < 3; k++) circ(g, bx - 8 + k * 8, cy - 2, 2.6, (Math.floor(time * 6 + k * 1.7) % 3) ? '#38e08a' : '#1f6b47', 0);
  // signal arcs
  g.save(); g.strokeStyle = C.cyan; g.lineWidth = 2; g.lineCap = 'round';
  for (let k = 1; k <= 2; k++) { g.globalAlpha = 0.35 + 0.35 * Math.sin(time * 4 - k); g.beginPath(); g.arc(bx, cy - 22, 6 + k * 6, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke(); }
  g.restore();
}
function pipesBuddyXY(R) { const cy = cellCenter(R.rE * G.cols + G.cols - 1).y; return { x: Math.min(PANEL.x + PANEL.w - 24, G.x + G.w + 32), y: cy + 30 }; }
function pipesDrawBuddy(R, g) {
  const cy = cellCenter(R.rE * G.cols + G.cols - 1).y, p = pipesBuddyXY(R), s = G.ts;
  pipesStub(g, G.x + G.w + 1, p.x - 6, cy, s, R.connected && R.raceT > (R.flow.path.length * 0.05));
  const mood = R.loadT >= 0 ? 'ecstatic' : R.connected ? 'happy' : 'nervous';
  drawBot(p.x, p.y, 0.31, mood, 'pipes');
  if (R.loadT >= 0) {
    // the robot's screen shows a loading bar, then "Connected"
    const k = clamp(R.loadT / 0.8, 0, 1), bx = p.x - 34, by = p.y - 94;
    rr(g, bx, by, 68, 24, 7, C.screen, 2);
    if (k < 1) { rr(g, bx + 6, by + 9, 56, 6, 3, '#24344a', 0); rr(g, bx + 6, by + 9, 56 * EASE.outCubic(k), 6, 3, C.cyan, 0); }
    else txt('Connected', p.x, by + 12.5, 11, C.cyan, 'center', 700);
  }
}
