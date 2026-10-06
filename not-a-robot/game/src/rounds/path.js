// rounds/path.js — THE WITNESS, re-skinned as "Draw a line through all fish. Do not cross yourself."
// Step mode. The cat starts on the start circle; every cell it enters lights up and joins a glowing cream/gold line drawn
// through the cell centres on a dark tinted grid. A lit cell can't be entered again (bonk), hopping is not allowed (the line
// must be continuous), sitting retracts the last step (rewind), and the line may only leave the grid through the exit nub
// on the bottom edge, after which the cat walks onto VERIFY. Valid = starts on the circle (always), visits every fish,
// never crosses itself (enforced), steps on no dog, numbered fish in order 1 → n, leaves through the exit.
// Generator: random self-avoiding walk start -> exit; fish on the walk, dogs / blocks off it. par = the shortest valid line
// found by a bounded branch-and-bound search (never longer than the generating walk).

const PATH_PASS = ['A single, elegant line. Very human. Robots draw in triangles.', 'Every fish visited, no knots. HUMANCHECK is moved to tears. Of oil.', 'That line had intent. Purpose. Whiskers. Verified.'];
const PATH_FAIL = ['The line forgot some fish. The fish noticed.', 'HUMANCHECK says the line is "suspiciously wobbly". I say it is art.', 'You stepped on a dog. The dog is fine. The verification is not.'];

// shortest valid line on an n x n board (pure). cells: 'W' wall, 'D' dog, 'F' fish, '.' plain. ord[i] = order (1..k) or 0.
function pathBest(n, cells, ord, start, exit, ordered, seed, budget = 300000) {
  const N = n * n, fish = []; for (let i = 0; i < N; i++) if (cells[i] === 'F') fish.push(i);
  const md = (a, b) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
  const fishOrd = ordered ? fish.slice().sort((a, b) => ord[a] - ord[b]) : fish;
  let best = seed ? seed.length - 1 : Infinity, bestPath = seed ? seed.slice() : null, nodes = 0;
  const vis = new Array(N).fill(false), trail = [start];
  const lb = (cur, got) => {
    const rest = fishOrd.filter(f => !vis[f]);
    if (!rest.length) return md(cur, exit);
    if (ordered) { let s = md(cur, rest[0]); for (let k = 1; k < rest.length; k++) s += md(rest[k - 1], rest[k]); return s + md(rest[rest.length - 1], exit); }
    let m = 0; for (const f of rest) m = Math.max(m, md(cur, f) + md(f, exit)); return m;
  };
  const dfs = (cur, got) => {
    if (++nodes > budget) return;
    const len = trail.length - 1;
    if (cur === exit && got === fish.length) { if (len < best) { best = len; bestPath = trail.slice(); } return; }
    if (len + lb(cur, got) >= best) return;
    const r = Math.floor(cur / n), c = cur % n;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const j = nr * n + nc; if (vis[j] || cells[j] === 'W' || cells[j] === 'D') continue;
      if (cells[j] === 'F' && ordered && ord[j] !== got + 1) continue;
      vis[j] = true; trail.push(j); dfs(j, got + (cells[j] === 'F' ? 1 : 0)); trail.pop(); vis[j] = false;
    }
  };
  vis[start] = true; dfs(start, cells[start] === 'F' ? 1 : 0);
  return bestPath ? { len: best, path: bestPath } : null;
}
// random self-avoiding walk from start to exit with lo..hi cells (pure, seeded)
function pathWalk(rng, n, start, exit, lo, hi) {
  const N = n * n, vis = new Array(N).fill(false), path = [start]; let nodes = 0, found = null;
  const md = (a, b) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
  vis[start] = true;
  const dfs = i => {
    if (found || ++nodes > 8000) return;
    if (i === exit) { if (path.length >= lo) found = path.slice(); return; }
    if (path.length + md(i, exit) > hi) return;
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of rng.shuffle([[-1, 0], [0, 1], [1, 0], [0, -1]])) {
      const nr = r + dr, nc = c + dc; if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const j = nr * n + nc; if (vis[j]) continue;
      vis[j] = true; path.push(j); dfs(j); path.pop(); vis[j] = false;
    }
  };
  dfs(start);
  return found;
}

registerRound({
  id: 'path', name: 'The Line',
  minD: 0.45, weight: 1,
  move: 'step', verify: 'pad', noCheck: true, selShrink: 1,
  intro: 'Draw ONE line through every fish. You cannot cross it. Sit to undo. Leave by the little exit nub.',
  again: ['Line puzzle! Plan first, walk second. Like a human with a calendar.', 'Another line. Do not cross the streams. Or yourself.'],

  generate(d, rng) {
    const n = d < 0.15 ? 3 : d < 0.4 ? 4 : d < 0.85 ? 5 : 6, N = n * n;
    const dogsOn = d >= 0.35, blocksOn = d >= 0.5, ordered = d >= 0.6 && (d >= 0.85 || rng.chance(0.55));
    for (let attempt = 0; attempt < 200; attempt++) {
      const start = d < 0.15 ? 0 : rng.int(0, Math.floor(n / 2) - (n > 4 ? 0 : 1)) * n + rng.int(0, n - 1);
      const exit = d < 0.15 ? N - 1 : (n - 1) * n + rng.int(Math.floor(n / 2), n - 1);   // right half: near VERIFY, clear of the footer pads
      if (start === exit) continue;
      const tgt = d < 0.15 ? 5 : Math.round(lerp(N * 0.42, N * 0.72, d));
      const walk = pathWalk(rng, n, start, exit, tgt, tgt + 3) || pathWalk(rng, n, start, exit, Math.round(tgt * 0.7), tgt + 3);
      if (!walk) continue;
      const cells = new Array(N).fill('.'), ord = new Array(N).fill(0), onWalk = new Set(walk);
      const fishN = ordered ? 3 : d < 0.15 ? 2 : clamp(Math.round(lerp(2, 5, d)), 2, walk.length - 1);
      // fish spread along the walk (never on the start circle)
      const slots = walk.slice(1), picks = [];
      for (let k = 0; k < fishN; k++) { const a = Math.floor(k * slots.length / fishN), b = Math.floor((k + 1) * slots.length / fishN) - 1; picks.push(slots[rng.int(a, Math.max(a, b))]); }
      [...new Set(picks)].forEach((i, k) => { cells[i] = 'F'; ord[i] = k + 1; });
      const off = rng.shuffle([...Array(N).keys()].filter(i => !onWalk.has(i)));
      const near = off.filter(i => walk.some(w => Math.abs(Math.floor(w / n) - Math.floor(i / n)) + Math.abs(w % n - i % n) === 1));
      const dogN = dogsOn ? Math.min(near.length, clamp(Math.round(lerp(1, 3, (d - 0.35) / 0.65)), 1, 3)) : 0;
      const dogs = near.slice(0, dogN); dogs.forEach(i => { cells[i] = 'D'; });
      const rest = off.filter(i => cells[i] === '.');
      const blockN = blocksOn ? Math.min(rest.length, rng.int(1, n >= 6 ? 3 : 2)) : 0;
      rest.slice(0, blockN).forEach(i => { cells[i] = 'W'; });
      const best = pathBest(n, cells, ord, start, exit, ordered, walk);
      if (!best || best.len < n) continue;
      const nf = cells.filter(c => c === 'F').length;
      return {
        grid: n, catStart: start, start, exit, ordered, fishN: nf,
        tiles: cells.map((c, i) => c === 'W' ? { wall: true, noSelect: true } : { noSelect: true, pfish: c === 'F', dog: c === 'D', ord: ordered && c === 'F' ? ord[i] : 0 }),
        l1: ordered ? 'Draw a line through fish 1 → ' + nf + ', in order.' : 'Draw a line through all fish.',
        big: 'Do not cross yourself.',
        l3: (dogsOn && dogs.length ? 'No dogs! ' : '') + 'Sit = undo. Exit via the nub ↓',
        par: { steps: best.len }, solution: best.path, genWalk: walk,
      };
    }
    throw new Error('path: generator failed');
  },

  enter(R) {
    R.path = [R.start]; R.lit = new Array(R.tiles.length).fill(false); R.lit[R.start] = true;
    R.sealed = false; R.rewinding = -1; R.hintT = 0; R.bonkT = 0; R.undos = 0; R.flash = 0;
    R.tiles[R.start].lit = true;
  },
  update(R, dt) { R.hintT -= dt; R.bonkT -= dt; R.flash = Math.max(0, R.flash - dt * 2); },

  canEnter(R, from, to, info) {
    if (info && info.ent) return undefined;
    if (from === -1) return R.sealed && to === R.path[R.path.length - 1];
    if (R.lit[to]) return false;
    return undefined;
  },
  moveCat(R, from, dir, how) {
    if (how === 'hop') { pathHint(R, 'No hopping: the line has to stay in one piece.'); return []; }
    const j = stepCell(from, dir);
    if (j < 0) {
      if (from === R.exit && dir[0] === 1 && R.path[R.path.length - 1] === R.exit) { pathSeal(R); return { path: [], how: 'exit' }; }
      pathHint(R, 'The line can only leave through the exit nub.'); return [];
    }
    if (R.lit[j]) {
      if (R.bonkT <= 0) { tileWiggle(R.tiles[j]); SFX.bonk(); const c = cellCenter(j); addTxt(c.x, c.y - 10, 'no crossing!', C.red); R.bonkT = 0.45; }
      return [];
    }
    return { path: canEnterCell(from, j, { dir }) ? [j] : [], how: 'walk' };
  },
  onStep(R, from, to) {
    if (to === -1) return;   // left through the exit nub (sealed when the move started: it may cross VERIFY on the way)
    if (R.rewinding === to) { R.rewinding = -1; return; }
    if (from === -1) { R.sealed = false; return; }   // walked back in through the nub
    R.path.push(to); R.lit[to] = true; R.tiles[to].lit = true;
    const t = R.tiles[to], c = cellCenter(to);
    tileSquash(t, 0.94, 1.03, 0.18);
    SFX.toggle(Math.min(14, R.path.length));
    if (t.pfish) {
      const got = R.path.filter(i => R.tiles[i].pfish).length;
      const okOrder = !R.ordered || t.ord === got;
      if (okOrder) { SFX.pop(got + 2); burst(c.x, c.y, C.gold, 8, 150, 4); addTxt(c.x, c.y - 18, R.ordered ? `fish ${t.ord} ✓` : 'fish ✓', '#c98a00'); }
      else { tileFlash(t, C.red, 0.5); tileWiggle(t); SFX.desel(); addTxt(c.x, c.y - 18, 'wrong order!', C.red); }
    }
    if (t.dog) { tileFlash(t, C.red, 0.6); tileWiggle(t); tone(180, 0.09, 'triangle', 0.07, 60); tone(200, 0.09, 'triangle', 0.07, 60, 0.12); addTxt(c.x, c.y - 18, 'woof!! (sit to undo)', C.red); }
  },
  onSit(R, tile) {
    if (!tile || cat.cell < 0) { defaultSit(R, null); return; }
    if (R.path.length <= 1) { addTxt(cat.x, cat.y - 54, 'nothing to undo', C.grey); return; }
    const last = R.path.pop(), prev = R.path[R.path.length - 1];
    R.lit[last] = false; R.tiles[last].lit = false; R.undos++;
    const c = cellCenter(last); dust(c.x, c.y + G.ts * 0.2, 3, 12, '#ffe9a6');
    tone(760, 0.16, 'triangle', 0.045, -420); tone(520, 0.12, 'sine', 0.03, -260, 0.07);   // rewind
    R.rewinding = prev; catToCell(prev, false);
  },

  progress(R) {
    const got = R.path.filter(i => R.tiles[i].pfish).length;
    return `Fish ${got}/${R.fishN} · line ${R.path.length - 1}/${R.par.steps}`;
  },
  judge(R) {
    const fish = tilesWhere(t => t.pfish), missing = fish.filter(i => !R.lit[i]), dogs = tilesWhere(t => t.dog && R.lit[t.i]);
    let order = [];
    if (R.ordered) { let k = 0; for (const i of R.path) if (R.tiles[i].pfish) { k++; if (R.tiles[i].ord !== k) order.push(i); } }
    const wrong = [...new Set([...missing, ...dogs, ...order])], checked = [...new Set([...R.path, ...wrong])];
    if (!wrong.length && R.sealed) return { pass: true, verdict: pick(PATH_PASS), checked };
    let verdict = pick(PATH_FAIL);
    if (dogs.length) verdict = PATH_FAIL[2]; else if (order.length) verdict = 'The fish have numbers for a reason. The reason is order. Fish 1 first.';
    else if (missing.length) verdict = PATH_FAIL[0]; else if (!R.sealed) verdict = 'The line never reached the exit. It is just… loitering.';
    return { pass: false, verdict, wrong, checked };
  },

  drawUnder(R, g) { rr(g, G.x - 7, G.y - 7, G.w + 14, G.h + 14, 12, '#141b33', 0); },
  drawTile(R, g, t, x, y, s) {
    if (t.wall) {
      rr(g, x, y, s, s, s * 0.1, '#0c1124', 0);
      g.save(); g.beginPath(); g.roundRect(x, y, s, s, s * 0.1); g.clip(); g.strokeStyle = '#1f2848'; g.lineWidth = s * 0.08;
      for (let k = -1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * s * 0.33, y + s); g.lineTo(x + k * s * 0.33 + s, y); g.stroke(); } g.restore();
      return true;
    }
    rr(g, x, y, s, s, s * 0.1, t.lit ? '#3a3f5c' : '#2a3458', 0);
    g.lineWidth = 2; g.strokeStyle = t.lit ? '#58587a' : '#36426c'; g.beginPath(); g.roundRect(x + 3, y + 3, s - 6, s - 6, s * 0.08); g.stroke();
    if (t.pfish || t.dog) {
      const cx = x + s / 2, cy = y + s / 2;
      if (t.pfish) circ(g, cx, cy, s * 0.36, t.lit ? 'rgba(255,214,90,.28)' : 'rgba(159,214,234,.18)', 0);
      if (t.dog) circ(g, cx, cy, s * 0.36, 'rgba(229,72,77,.2)', 0);
      drawIcon(g, t.pfish ? 'fish' : 'dog', cx, cy, s * 0.82);
      if (t.dog) {   // "avoid" sign: red ring + slash
        g.save(); g.strokeStyle = C.red; g.lineWidth = Math.max(3, s * 0.06); g.beginPath(); g.arc(cx, cy, s * 0.38, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(cx - s * 0.27, cy + s * 0.27); g.lineTo(cx + s * 0.27, cy - s * 0.27); g.stroke(); g.restore();
      }
      if (t.ord) { const bx = x + s * 0.8, by = y + s * 0.2, br = Math.max(9, s * 0.15); circ(g, bx, by, br, C.gold, 2); txt(String(t.ord), bx, by + 1, br * 1.3, C.ink, 'center', 700); }
    }
    return true;
  },
  drawOverlay(R, g) {
    const s = G.ts, foot = Math.min(s * 0.2, 20), ctr = i => cellCenter(i);
    const ex = ctr(R.exit), nubY = G.y + G.h + Math.min(14, s * 0.25);
    // exit nub (Witness style): a short rounded stub past the bottom edge
    rr(g, ex.x - s * 0.17, G.y + G.h - 2, s * 0.34, nubY - G.y - G.h + s * 0.12, s * 0.17, '#141b33', 0);
    if (!R.sealed) { g.save(); g.globalAlpha = 0.55 + 0.35 * Math.sin(time * 4); poly(g, [[ex.x - s * 0.09, nubY - s * 0.05], [ex.x + s * 0.09, nubY - s * 0.05], [ex.x, nubY + s * 0.06]], '#ffd25a', 0); g.restore(); }
    // start circle
    const st = ctr(R.start);
    circ(g, st.x, st.y, s * 0.24, '#3c4876', 0);
    // the line: centres of the lit cells, the tip follows the cat while it moves
    const pts = R.path.map(ctr).map(p => [p.x, p.y]);
    if (cat.mv && (mode === 'play' || mode === 'verifying')) pts.push([cat.x, cat.y - foot]);
    if (R.sealed && !cat.mv) pts.push([ex.x, nubY]);
    const glow = 0.5 + 0.12 * Math.sin(time * 3) + R.flash * 0.4;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const stroke = (w, col, a) => { g.globalAlpha = a; g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
    if (pts.length > 1) { stroke(s * 0.46, '#ffd25a', 0.12 * glow * 2); stroke(s * 0.3, '#ffe39a', 0.3 * glow * 1.6); stroke(s * 0.17, '#fff3cf', 1); stroke(s * 0.06, '#ffffff', 0.7); }
    g.globalAlpha = 1; g.restore();
    circ(g, st.x, st.y, s * 0.2, '#fff3cf', 0); circ(g, st.x, st.y, s * 0.27, null, 0);
    g.save(); g.globalAlpha = 0.35 * glow; circ(g, st.x, st.y, s * 0.3, '#ffd25a', 0); g.restore(); circ(g, st.x, st.y, s * 0.2, '#fff3cf', 0);
    if (R.sealed) { g.save(); g.globalAlpha = 0.6 + 0.3 * Math.sin(time * 6); circ(g, ex.x, nubY, s * 0.13, '#fff3cf', 0); g.restore(); }
  },
});
function pathSeal(R) {
  R.sealed = true; R.flash = 1;
  const c = cellCenter(R.exit); burst(c.x, c.y + G.ts * 0.6, '#ffe9a6', 9, 160, 4);
  [0, 2, 4].forEach((k, i) => tone(noteHz(k + 7), 0.25, 'sine', 0.04, 0, i * 0.06));
  if (R.hintT <= 0) { toastMsg('Line sealed! Walk onto VERIFY. (Walk back in to edit.)', 2.2); R.hintT = 2; }
}
function pathHint(R, msg) { if (R.hintT > 0) return; R.hintT = 1.6; toastMsg(msg, 2); tone(160, 0.08, 'sine', 0.05); }
