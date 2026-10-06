// rounds/gravity.js — SAMEGAME / TETRIS / THREES popping, re-skinned as "Select all squares with fish. Some assembly required."
// The grid is stacked in columns. Sitting on a tile POPS it together with every touching tile of the same kind (pop + ring
// of particles + rising pop note); the tiles above fall down (easeInQuad + a small bounce, soft landing thump, no shake).
// Fish can't be popped, heavy anvils can't be popped (but they fall). Goal: every fish in the bottom row, within a limited
// number of pops. Auto-verifies when solved (VERIFY also works). Out of pops and unsolved -> the round ends.
// Generator: random fills, verified by BFS over pop sequences; par = the minimum number of pops (BFS depth),
// limit = par + slack (slack shrinks with d).

const GRAV_PASS = ['All fish on the floor. That is where fish belong, apparently. Verified.', 'Gravity: 1. Robots: 0. You: human. Probably.', 'Beautiful popping. Very bubble-wrap. Extremely human.'];
const GRAV_FAIL = ['Some fish are still floating. HUMANCHECK finds this fishy.', 'The fish did not reach the bottom. They are afraid of heights now.'];
const GRAV_POOL = ['ball', 'tree', 'cloud', 'pizza', 'sock', 'moon', 'cactus', 'crown'];
const GRAV_EASE = t => t < 0.72 ? (t / 0.72) * (t / 0.72) : 1 - 0.07 * Math.sin(Math.PI * (t - 0.72) / 0.28);   // easeInQuad fall + tiny bounce

// pure board helpers. A board is a string, reading order: '.' empty, 'a'..'d' kinds, 'F' fish, 'H' heavy.
function gravFall(b, cols, rows) {
  const out = new Array(cols * rows).fill('.');
  for (let c = 0; c < cols; c++) { let w = rows - 1; for (let r = rows - 1; r >= 0; r--) { const v = b[r * cols + c]; if (v !== '.') out[(w--) * cols + c] = v; } }
  return out.join('');
}
function gravGroup(b, cols, rows, i) {
  const k = b[i], seen = new Set([i]), q = [i];
  for (let h = 0; h < q.length; h++) {
    const u = q[h], r = Math.floor(u / cols), c = u % cols;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const j = nr * cols + nc; if (!seen.has(j) && b[j] === k) { seen.add(j); q.push(j); }
    }
  }
  return [...seen];
}
function gravDone(b, cols, rows) { for (let i = 0; i < cols * (rows - 1); i++) if (b[i] === 'F') return false; return true; }
// BFS over pop sequences: min pops to bring every fish to the bottom row. -> { depth, moves: [cell to sit on, ...] } | null
function gravSolve(b0, cols, rows, maxDepth = 6, maxStates = 6000) {
  if (gravDone(b0, cols, rows)) return { depth: 0, moves: [] };
  const prev = new Map([[b0, null]]); let layer = [b0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const b of layer) {
      const seen = new Set();
      for (let i = 0; i < b.length; i++) {
        const v = b[i]; if (v < 'a' || v > 'd' || seen.has(i)) continue;
        const grp = gravGroup(b, cols, rows, i); grp.forEach(j => seen.add(j));
        const arr = b.split(''); grp.forEach(j => { arr[j] = '.'; });
        const nb = gravFall(arr.join(''), cols, rows);
        if (prev.has(nb)) continue;
        prev.set(nb, { b, i });
        if (gravDone(nb, cols, rows)) { const moves = []; for (let s = nb; prev.get(s); s = prev.get(s).b) moves.unshift(prev.get(s).i); return { depth, moves }; }
        next.push(nb);
        if (prev.size > maxStates) return null;
      }
    }
    layer = next; if (!layer.length) return null;
  }
  return null;
}

registerRound({
  id: 'gravity', name: 'Gravity Pop',
  minD: 0.4, weight: 1,
  verify: 'both', autoDelay: 0.9, selShrink: 1, noCheck: true,
  intro: 'Sit on a square to POP it and its twins. Things fall. Get every fish to the bottom row.',
  again: ['Popping time! Fish go down. Like my hopes, but in a good way.', 'More gravity. Pop wisely, the pops are limited.'],

  generate(d, rng) {
    const cols = d < 0.25 ? 3 : d < 0.6 ? 4 : 5, rows = d < 0.25 ? 3 : d < 0.6 ? 4 : 5;
    const kinds = d < 0.25 ? 2 : 3, fishN = d < 0.25 ? 1 : d < 0.65 ? 2 : 3, heavyN = d < 0.45 ? 0 : d < 0.8 ? 1 : 2;
    const [lo, hi] = d < 0.25 ? [1, 1] : d < 0.6 ? [2, 3] : [3, 5];
    const N = cols * rows;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const b = new Array(N);
      for (let i = 0; i < N; i++) b[i] = 'abcd'[rng.int(0, kinds - 1)];
      const fcols = rng.sample([...Array(cols).keys()], fishN);
      for (const c of fcols) { const r = d < 0.25 ? 0 : rng.int(0, rows - 2); b[r * cols + c] = 'F'; }
      const free = [...Array(N).keys()].filter(i => b[i] !== 'F');
      for (const i of rng.sample(free, heavyN)) b[i] = 'H';
      const s = b.join('');
      if (gravDone(s, cols, rows)) continue;
      // cheap reject: an anvil under a fish in its column can never be removed
      if (fcols.some(c => { let f = false; for (let r = 0; r < rows; r++) { const v = s[r * cols + c]; if (v === 'F') f = true; else if (f && v === 'H') return true; } return false; })) continue;
      const sol = gravSolve(s, cols, rows, hi);
      if (!sol) continue;
      const cand = { s, sol };
      if (sol.depth >= lo && sol.depth <= hi) { best = cand; break; }
      if (!best || Math.abs(sol.depth - lo) < Math.abs(best.sol.depth - lo)) best = cand;
    }
    if (!best) throw new Error('gravity: generator failed');
    const icons = rng.sample(GRAV_POOL, kinds), par = best.sol.depth, slack = d < 0.25 ? 3 : d < 0.6 ? 2 : 1;
    return {
      cols, rows, margin: { l: 0, t: 0, r: 0, b: 10 },
      tiles: best.s.split('').map(v => v === 'F' ? { icon: 'fish', gfish: true, noSelect: true } : v === 'H' ? { heavy: true, noSelect: true } : { icon: icons['abcd'.indexOf(v)], gk: v }),
      l1: 'Select all squares with fish.', big: 'Some assembly required.',
      l3: 'Sit = pop it + its twins.',
      par: { pops: par }, popsMax: par + slack, solution: best.sol.moves, board0: best.s,
    };
  },

  enter(R) { R.stats.pops = 0; R.ghosts = []; R.outT = -1; R.fishDown = gravFishDown(R); },
  update(R, dt) {
    for (const gh of R.ghosts) gh.t += dt;
    R.ghosts = R.ghosts.filter(gh => gh.t < 0.4);
    if (R.outT >= 0) { R.outT += dt; if (R.outT > 1.4 && !gravSolved(R)) finish({ pass: false, verdict: 'Out of pops. The fish are stuck mid-air, like a screensaver.' }); }
  },

  onSit(R, tile) {
    if (!tile) { defaultSit(R, null); return; }
    const c = cellCenter(tile.i);
    if (tile.gEmpty) { addTxt(c.x, c.y - 30, 'just air', C.grey); return; }
    if (tile.gfish) { tileWiggle(tile); SFX.desel(); addTxt(c.x, c.y - 30, 'not the fish! we need those', C.red); return; }
    if (tile.heavy) { tileWiggle(tile); tone(110, 0.12, 'sine', 0.08, -30); addTxt(c.x, c.y - 30, 'too heavy to pop', C.grey); return; }
    if (R.stats.pops >= R.popsMax) { tileWiggle(tile); SFX.desel(); addTxt(c.x, c.y - 30, 'out of pops', C.red); return; }
    // still falling: the square under the cat doesn't show its final tile yet, so popping now would pop something you can't see
    if (R.tiles.some(t => t.fx && Math.abs(t.fx.oy || 0) > 0.5)) { addTxt(c.x, c.y - 30, 'let it land…', C.grey); return; }
    gravPop(R, tile.i);
  },

  solved: R => gravSolved(R),
  progress: R => `Fish ${gravFishDown(R)}/${R.tiles.filter(t => t.gfish).length} down · pops ${R.stats.pops}/${R.popsMax}`,
  judge(R) {
    const fish = tilesWhere(t => t.gfish), up = fish.filter(i => Math.floor(i / G.cols) < G.rows - 1);
    if (!up.length) return { pass: true, verdict: pick(GRAV_PASS), checked: fish };
    return { pass: false, verdict: pick(GRAV_FAIL), wrong: up, checked: fish };
  },

  drawUnder(R, g) {
    // the goal: the bottom row sits in a green "landing strip"
    const y = G.y + (G.rows - 1) * G.pitch;
    rr(g, G.x - 6, y - 5, G.w + 12, G.ts + 10, 10, '#c9efd9', 0);
  },
  drawTile(R, g, t, x, y, s) {
    if (t.gEmpty) {
      rr(g, x, y, s, s, s * 0.1, 'rgba(230,236,245,.55)', 0);
      g.save(); g.setLineDash([4, 5]); g.lineWidth = 1.5; g.strokeStyle = '#c3cbd9'; g.beginPath(); g.roundRect(x + 4, y + 4, s - 8, s - 8, s * 0.08); g.stroke(); g.restore();
      return true;
    }
    if (t.heavy) { gravDrawAnvil(g, x, y, s); return true; }
    drawTileBase(t, x, y, s);
    if (t.gfish && t.r === G.rows - 1 && Math.abs(t.fx.oy || 0) < 2) { g.save(); g.lineWidth = Math.max(3, s * 0.06); g.strokeStyle = C.green; g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth); g.restore(); }
    return true;
  },
  drawOverlay(R, g) {
    // the goal strip outline (above the tiles) + a tab saying what it is
    const y = G.y + (G.rows - 1) * G.pitch;
    g.save(); g.setLineDash([7, 6]); g.lineDashOffset = -time * 12; g.lineWidth = 2.5; g.strokeStyle = C.green; g.beginPath(); g.roundRect(G.x - 6, y - 5, G.w + 12, G.ts + 10, 10); g.stroke(); g.restore();
    rr(g, G.x + G.w - 92, y - 15, 86, 18, 9, C.green, 0); txt('fish go here', G.x + G.w - 49, y - 5.5, 11, '#fff', 'center', 700);
    // preview: the group the cat would pop
    const ci = mode === 'play' ? catCell() : -1, ct = ci >= 0 ? R.tiles[ci] : null;
    if (ct && ct.gk && R.stats.pops < R.popsMax) {
      const grp = gravGroup(R.tiles.map(t => t.gk || '.').join(''), G.cols, G.rows, ci);
      g.save(); g.globalAlpha = 0.55 + 0.2 * Math.sin(time * 6); g.lineWidth = 3; g.strokeStyle = '#ffffff';
      for (const j of grp) { const p = cellXY(j), f = R.tiles[j].fx; g.beginPath(); g.roundRect(p.x + 2, p.y + 2 + (f ? f.oy : 0), G.ts - 4, G.ts - 4, 8); g.stroke(); }
      g.restore();
    }
    for (const gh of R.ghosts) {
      const k = clamp((gh.t - gh.delay) / 0.26, 0, 1); if (gh.t < gh.delay) { g.drawImage(iconTile(gh.icon, Math.round(G.ts)), gh.x - G.ts / 2, gh.y - G.ts / 2, G.ts, G.ts); continue; }
      const sc = 1 + 0.35 * EASE.outCubic(k); g.save(); g.globalAlpha = 1 - k; g.translate(gh.x, gh.y); g.scale(sc, sc);
      g.drawImage(iconTile(gh.icon, Math.round(G.ts)), -G.ts / 2, -G.ts / 2, G.ts, G.ts); g.restore();
    }
  },
});

function gravSolved(R) { return R.tiles.every((t, i) => !t.gfish || Math.floor(i / G.cols) === G.rows - 1); }
function gravFishDown(R) { return R.tiles.filter((t, i) => t.gfish && Math.floor(i / G.cols) === G.rows - 1).length; }
const GRAV_COL = { ball: '#ff6b6b', tree: '#4caf50', cloud: '#ffffff', pizza: '#ffd166', sock: '#f28fb0', moon: '#ffe9a6', cactus: '#3fa34d', crown: '#ffcc33' };

// pop the group at cell i, then let the columns fall
function gravPop(R, i) {
  const cols = G.cols, rows = G.rows, kind = R.tiles[i].gk, sr = Math.floor(i / cols), sc = i % cols;
  const grp = [], seen = new Set([i]), q = [i];
  for (let h = 0; h < q.length; h++) { const u = q[h]; grp.push(u); for (const v of neighbors4(u)) if (!seen.has(v) && R.tiles[v].gk === kind && !R.tiles[v].gEmpty) { seen.add(v); q.push(v); } }
  R.stats.pops++;
  SFX.pop(R.stats.pops + 1); noise(0.05, 0.04, 0, 0, 2500);
  for (const j of grp) {
    const t = R.tiles[j], c = cellCenter(j), dist = Math.abs(Math.floor(j / cols) - sr) + Math.abs(j % cols - sc), delay = dist * 0.035;
    R.ghosts.push({ icon: t.icon, x: c.x, y: c.y, t: 0, delay });
    after(delay, () => { burst(c.x, c.y, GRAV_COL[t.icon] || C.blue, 7, 170, 4); addP(c.x, c.y, 3, GRAV_COL[t.icon] || C.blue, 140, 0.5, 4); if (dist) SFX.toggle(dist + 3); });
    R.tiles[j] = makeTile({ gEmpty: true, noSelect: true }, j);
  }
  const popDur = grp.reduce((m, j) => Math.max(m, (Math.abs(Math.floor(j / cols) - sr) + Math.abs(j % cols - sc)) * 0.035), 0) + 0.12;
  // gravity, column by column; fallen tiles keep their objects (and slide down from where they were)
  let maxFall = 0;
  for (let c = 0; c < cols; c++) {
    const stack = [];
    for (let r = rows - 1; r >= 0; r--) { const t = R.tiles[r * cols + c]; if (!t.gEmpty) stack.push({ t, r }); }
    for (let r = rows - 1, k = 0; r >= 0; r--, k++) {
      const idx = r * cols + c;
      if (k < stack.length) {
        const { t, r: r0 } = stack[k], fall = r - r0;
        R.tiles[idx] = t; t.i = idx; t.r = r; t.c = c;
        if (fall > 0) {
          const f = tileFx(t), dur = 0.2 + 0.06 * fall; f.oy = (f.oy || 0) - fall * G.pitch;
          tween(f, { oy: 0 }, dur, { ease: GRAV_EASE, delay: popDur });
          maxFall = Math.max(maxFall, popDur + dur * 0.72);
          after(popDur + dur * 0.72, () => { const p = cellCenter(t.i); dust(p.x, p.y + G.ts * 0.42, 3, G.ts * 0.5); });
        }
      } else if (!R.tiles[idx].gEmpty) R.tiles[idx] = makeTile({ gEmpty: true, noSelect: true }, idx);
    }
  }
  const downBefore = R.fishDown;
  if (maxFall > 0) after(maxFall, () => {
    tone(105, 0.1, 'sine', 0.08, -25); noise(0.06, 0.03, 0, 500);   // soft landing thump
    const now = gravFishDown(R);
    if (now > downBefore) {
      R.tiles.forEach((t, j) => { if (t.gfish && Math.floor(j / cols) === rows - 1) { const p = cellCenter(j); burst(p.x, p.y, C.green, 8, 150, 4); tileSquash(t, 0.9, 1.06, 0.24); } });
      SFX.chime(now + 1); const p = cellCenter((rows - 1) * cols); addTxt(G.x + G.w / 2, p.y - G.ts * 0.6, now === R.tiles.filter(t => t.gfish).length ? 'all fish down ✓' : 'fish down ✓', '#178a56');
    }
  });
  R.fishDown = gravFishDown(R);
  if (R.stats.pops >= R.popsMax && !gravSolved(R)) R.outT = 0;
}
// a heavy anvil (can't be popped): dark steel on a hazard-striped plate
function gravDrawAnvil(g, x, y, s) {
  rr(g, x, y, s, s, s * 0.1, '#c5ccd8', 0);
  g.save(); g.beginPath(); g.roundRect(x, y, s, s, s * 0.1); g.clip();
  g.fillStyle = '#f2c94c'; g.fillRect(x, y + s * 0.8, s, s * 0.2); g.fillStyle = C.ink;
  for (let k = -1; k < 6; k++) { g.beginPath(); g.moveTo(x + k * s * 0.2, y + s); g.lineTo(x + k * s * 0.2 + s * 0.1, y + s); g.lineTo(x + k * s * 0.2 + s * 0.3, y + s * 0.8); g.lineTo(x + k * s * 0.2 + s * 0.2, y + s * 0.8); g.closePath(); g.fill(); }
  g.restore();
  g.save(); g.translate(x + s / 2, y + s * 0.47); g.scale(s / 100, s / 100);
  g.beginPath(); g.moveTo(-40, -22); g.lineTo(30, -22); g.quadraticCurveTo(44, -20, 44, -10); g.lineTo(18, -6); g.lineTo(14, 8); g.lineTo(26, 22); g.lineTo(-26, 22); g.lineTo(-14, 8); g.lineTo(-18, -6); g.quadraticCurveTo(-36, -8, -40, -22); g.closePath();
  sh(g, '#5d6a80', 5);
  g.beginPath(); g.moveTo(-34, -18); g.lineTo(26, -18); g.lineTo(26, -13); g.lineTo(-30, -13); g.closePath(); g.fillStyle = '#8d9ab0'; g.fill();
  g.beginPath(); g.moveTo(-22, 18); g.lineTo(22, 18); g.lineTo(18, 13); g.lineTo(-18, 13); g.closePath(); g.fillStyle = '#46526a'; g.fill();
  g.restore();
}
