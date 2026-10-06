// rounds/arrows.js — TAP AWAY / ARROWS – PUZZLE ESCAPE, re-skinned as "Select all squares to send them home".
// Every square is a card with a bold arrow badge. SITTING on a card launches it the way its arrow points: if the road to
// the grid edge is clear it whooshes off (speed trail, a little bounce off the panel edge); if something is in the way it
// slides until it bonks the blocker, wiggles back home and costs a heart (3 hearts at low d, 2 at high d; none left = fail).
// Orange "rotating" arrows (high d) turn 90° clockwise every time a neighbour leaves.
// Generator: build BACKWARDS from an empty board, placing cards whose road is clear (so removing them in reverse placement
// order always works), biased to park new cards on the roads of older ones (dependency chains). Rotating cards get a start
// direction that lands on the planned direction at their turn; a DFS solver (memo over removed-sets) re-checks the deal and
// seeded random playouts reject deals where a careless order can deadlock. par = card count (one sit each).

const ARR_PASS = ['Every square went home. They waved. I waved back. Nobody saw me.', 'Grid cleared! Air traffic control would like your number.', 'All squares sent home. Empty grid. Very clean. Very human.'];
const ARR_FAIL = ['Too many bonks. The squares have filed a complaint.', 'Out of hearts. I knew I should have bought more hearts.', 'Bonk, bonk, bonk. That is robot for "oh no".'];
const ARR_OUCH = ['Bonk! That one was in the way.', 'Ow. Look where it points first. Humans do that. Allegedly.', 'Traffic jam! The squares need a clear road.'];
const ARR_THEMES = [['car', 'bus', 'bicycle'], ['fish', 'duck', 'boat'], ['balloon', 'cloud', 'umbrella'], ['sock', 'ball', 'bone'], ['pizza', 'crown', 'toaster'], ['dog', 'cat', 'house']];
const ARR_DR = [-1, 0, 1, 0], ARR_DC = [0, 1, 0, -1];   // 0 up, 1 right, 2 down, 3 left (same order as DIR4)

// ---------- pure helpers (no live grid) ----------
function arrNb(i, k, cols, rows) { const r = Math.floor(i / cols) + ARR_DR[k], c = i % cols + ARR_DC[k]; return r < 0 || r >= rows || c < 0 || c >= cols ? -1 : r * cols + c; }
// first occupied cell on the road from i to the edge in direction k (-1 = the road is clear)
function arrBlocker(i, k, cols, rows, occ) { for (let j = arrNb(i, k, cols, rows); j >= 0; j = arrNb(j, k, cols, rows)) if (occ(j)) return j; return -1; }
function arrOnRoad(from, k, cell, cols, rows) { for (let j = arrNb(from, k, cols, rows); j >= 0; j = arrNb(j, k, cols, rows)) if (j === cell) return true; return false; }
// direction of the card in cell i once the cells in `gone` have left (rotating cards turn once per departed neighbour)
function arrDirNow(b, i, gone, cols, rows) {
  const t = b[i]; if (!t.rot) return t.d;
  let k = 0; for (let q = 0; q < 4; q++) { const j = arrNb(i, q, cols, rows); if (j >= 0 && b[j] && gone[j]) k++; }
  return (t.d + k) % 4;
}
function arrClear(b, i, gone, cols, rows) { return arrBlocker(i, arrDirNow(b, i, gone, cols, rows), cols, rows, j => !!b[j] && !gone[j]) < 0; }
// DFS over removal sets. A clear card with no rotating neighbour is a SAFE move (it only ever frees roads), so it is taken
// without branching. Returns the removal order or null.
function arrSolve(b, cols, rows, cap = 40000) {
  const N = cols * rows, cells = [], gone = new Array(N).fill(false), dead = new Set(), order = [];
  for (let i = 0; i < N; i++) if (b[i]) cells.push(i);
  const rotNb = i => { for (let q = 0; q < 4; q++) { const j = arrNb(i, q, cols, rows); if (j >= 0 && b[j] && b[j].rot && !gone[j]) return true; } return false; };
  let nodes = 0;
  const rec = left => {
    if (!left) return true;
    const key = gone.map(v => (v ? 1 : 0)).join('');
    if (dead.has(key) || ++nodes > cap) return false;
    const clear = cells.filter(i => !gone[i] && arrClear(b, i, gone, cols, rows));
    const safe = clear.find(i => !rotNb(i));
    for (const i of safe != null ? [safe] : clear) {
      gone[i] = true; order.push(i);
      if (rec(left - 1)) return true;
      order.pop(); gone[i] = false;
    }
    dead.add(key); return false;
  };
  return rec(cells.length) ? order : null;
}
// greedy "rounds" (every clear card leaves at once): a measure of how long the dependency chains are
function arrDepth(b, cols, rows) {
  const gone = b.map(v => !v); let left = b.filter(Boolean).length, rounds = 0;
  while (left) {
    const now = []; for (let i = 0; i < b.length; i++) if (!gone[i] && arrClear(b, i, gone, cols, rows)) now.push(i);
    if (!now.length) return -1;
    now.forEach(i => { gone[i] = true; }); left -= now.length; rounds++;
  }
  return rounds;
}
// random careless playouts: does picking any clear card in any order ever deadlock? (rotating cards only)
function arrRobust(b, cols, rows, rng, tries = 40) {
  const cells = []; for (let i = 0; i < b.length; i++) if (b[i]) cells.push(i);
  for (let t = 0; t < tries; t++) {
    const gone = b.map(v => !v);
    for (let left = cells.length; left; left--) {
      const clear = cells.filter(i => !gone[i] && arrClear(b, i, gone, cols, rows));
      if (!clear.length) return false;
      gone[rng.pick(clear)] = true;
    }
  }
  return true;
}
// backwards build: place `count` cards one by one, each with a clear road at the time it is placed
function arrBuild(n, count, d, rng) {
  const N = n * n, b = new Array(N).fill(null), placed = [], bias = lerp(0.35, 0.92, d);
  for (let p = 0; p < count; p++) {
    const occ = j => !!b[j], cands = [], chain = [];
    for (let i = 0; i < N; i++) if (!b[i]) for (let k = 0; k < 4; k++) {
      if (arrBlocker(i, k, n, n, occ) >= 0) continue;
      cands.push([i, k]);
      if (placed.some(q => arrOnRoad(q, b[q].d, i, n, n))) chain.push([i, k]);   // it parks on an older card's road
    }
    if (!cands.length) return null;
    const [i, k] = chain.length && rng.chance(bias) ? rng.pick(chain) : rng.pick(cands);
    b[i] = { d: k, rot: false }; placed.push(i);
  }
  return { b, order: placed.slice().reverse(), depth: arrDepth(b, n, n) };
}
// turn some cards into rotating ones: start direction = planned direction minus the turns it will make before its turn
function arrAddRot(L, n, m, rng) {
  const pos = new Map(L.order.map((c, k) => [c, k]));
  const before = c => { let k = 0; for (let q = 0; q < 4; q++) { const j = arrNb(c, q, n, n); if (j >= 0 && L.b[j] && pos.get(j) < pos.get(c)) k++; } return k; };
  const cands = L.order.filter(c => before(c) > 0);
  for (let tries = 0; tries < 12 && m > 0; tries++) {
    const b = L.b.map(t => t && { d: t.d, rot: false });
    for (const c of rng.sample(cands, Math.min(m, cands.length))) b[c] = { d: (L.b[c].d - before(c) + 8) % 4, rot: true };
    if (arrSolve(b, n, n) && arrRobust(b, n, n, rng)) return b;
    if (tries % 4 === 3) m--;
  }
  return L.b;
}
function arrGenerate(d, rng) {
  const n = d < 0.2 ? 3 : d < 0.45 ? 4 : d < 0.75 ? 5 : 6, N = n * n;
  const count = d === 0 ? 4 : clamp(Math.round(N * lerp(0.5, 0.82, d)), 4, N - 1);
  const want = d === 0 ? 2 : Math.round(lerp(2, 6, d)), nRot = d < 0.55 ? 0 : Math.round(lerp(1, 4, (d - 0.55) / 0.45));
  let best = null;
  for (let a = 0; a < 40; a++) {
    const L = arrBuild(n, count, d, rng); if (!L || L.depth < 0) continue;
    if (!best || L.depth > best.depth) best = L;
    if (L.depth >= want) break;
  }
  const b = nRot ? arrAddRot(best, n, nRot, rng) : best.b;
  const order = arrSolve(b, n, n);
  if (!order) throw new Error('arrows: unsolvable deal');   // (cannot happen: the plain backwards build is always solvable)
  return { n, b, order, depth: best.depth, nRot: b.filter(t => t && t.rot).length };
}

// ---------- drawing helpers ----------
// a bold arrow pointing up (rotated by ang), centred on x, y, in a badge of radius r
function arrDrawArrow(g, x, y, r, ang, col = '#fff') {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0, -r * 0.72); g.lineTo(r * 0.58, -r * 0.08); g.lineTo(r * 0.22, -r * 0.08); g.lineTo(r * 0.22, r * 0.62);
  g.lineTo(-r * 0.22, r * 0.62); g.lineTo(-r * 0.22, -r * 0.08); g.lineTo(-r * 0.58, -r * 0.08); g.closePath();
  g.fillStyle = col; g.fill(); g.restore();
}
// the card face: icon tile on a white card, ink outline, arrow badge in the top-right corner
function arrDrawCard(g, icon, dirAng, rot, x, y, s) {
  const rad = s * 0.14, lw = Math.max(2, s * 0.045);
  rr(g, x + 1, y + 1, s - 2, s - 2, rad, '#fff', 0);
  g.save(); g.beginPath(); g.roundRect(x + s * 0.07, y + s * 0.07, s * 0.86, s * 0.86, rad * 0.7); g.clip();
  g.drawImage(iconTile(icon, Math.round(s)), x + s * 0.07, y + s * 0.07, s * 0.86, s * 0.86); g.restore();
  g.lineWidth = lw; g.strokeStyle = C.ink; g.beginPath(); g.roundRect(x + 1 + lw / 2, y + 1 + lw / 2, s - 2 - lw, s - 2 - lw, rad); g.stroke();
  const br = s * 0.2, bx = x + s - br - s * 0.05, by = y + br + s * 0.05;
  circ(g, bx + 1.5, by + 2, br, 'rgba(29,36,51,.25)', 0);
  circ(g, bx, by, br, rot ? '#ff8c42' : C.blue, Math.max(2, s * 0.035));
  if (rot) {   // rotating card: a little circular-arrow ring around the badge
    g.save(); g.beginPath(); g.arc(bx, by, br * 1.32, -2.4, 0.9); g.lineWidth = Math.max(2, s * 0.03); g.strokeStyle = '#ff8c42'; g.lineCap = 'round'; g.stroke();
    const a = 0.9, ex = bx + Math.cos(a) * br * 1.32, ey = by + Math.sin(a) * br * 1.32;
    poly(g, [[ex + 4, ey - 3], [ex - 3, ey + 5], [ex - 5, ey - 4]], '#ff8c42', 0); g.restore();
  }
  arrDrawArrow(g, bx, by, br, dirAng);
}
function arrHeart(g, x, y, s, fill, lw = 2.5) {
  g.beginPath(); g.moveTo(x, y + s * 0.38);
  g.bezierCurveTo(x - s * 0.62, y - s * 0.02, x - s * 0.42, y - s * 0.62, x, y - s * 0.26);
  g.bezierCurveTo(x + s * 0.42, y - s * 0.62, x + s * 0.62, y - s * 0.02, x, y + s * 0.38); g.closePath();
  sh(g, fill, lw);
}

// ---------- runtime ----------
function arrLaunch(R, t) {
  const i = t.i, k = t.adir, c = cellCenter(i), half = G.ts * 0.42;
  const L = k === 0 ? c.y - (PANEL.y + 6) - half : k === 1 ? PANEL.x + PANEL.w - 6 - c.x - half : k === 2 ? PANEL.y + PANEL.h - 6 - c.y - half : c.x - (PANEL.x + 6) - half;
  const v0 = 140, acc = 2600, tHit = (-v0 + Math.sqrt(v0 * v0 + 2 * acc * Math.max(10, L))) / acc;   // s = v0 t + acc t^2 / 2
  R.flyers.push({ icon: t.icon, k, rot: !!t.arot, x0: c.x, y0: c.y, t0: time, v0, acc, L: Math.max(10, L), tHit, s: G.ts });
  setTile(i, { empty: true });
  R.cleared++;
  SFX.whoosh(); SFX.pop(R.cleared - 1); tone(380, 0.18, 'sine', 0.035, 520);
  dust(c.x - ARR_DC[k] * G.ts * 0.3, c.y - ARR_DR[k] * G.ts * 0.3 + G.ts * 0.2, 6, G.ts * 0.5);
  burst(c.x, c.y, C.blue, 7, 130, 3);
  addTxt(c.x, c.y - G.ts * 0.5, pick(['bye!', 'whoosh', 'home ✓', 'zoom']), C.blue);
  after(tHit, () => {   // the little bounce off the panel edge
    const ex = c.x + ARR_DC[k] * (L + half), ey = c.y + ARR_DR[k] * (L + half);
    burst(ex, ey, '#ffd25a', 6, 110, 3); tone(880, 0.06, 'triangle', 0.03); tone(1320, 0.05, 'sine', 0.015, 0, 0.03);
  });
  // rotating neighbours turn a quarter clockwise (spring)
  let turned = 0;
  for (let q = 0; q < 4; q++) {
    const j = stepCell(i, DIR4[q]), u = j >= 0 ? R.tiles[j] : null;
    if (!u || !u.arot || u.adir == null) continue;
    u.adir = (u.adir + 1) % 4; u.aspin = 1; tween(u, { aspin: 0 }, 0.4, { ease: 'spring', delay: 0.05 });
    after(0.05 + turned * 0.04, () => { SFX.toggle(5 + turned); const p = cellCenter(j); burst(p.x + G.ts * 0.28, p.y - G.ts * 0.28, '#ff8c42', 5, 90, 3); });
    turned++;
  }
  // deadlock check (rotating cards only): nothing left can move -> the round is lost
  if (R.cleared < R.total && !R.tiles.some(u => u.adir != null && arrBlocker(u.i, u.adir, G.cols, G.rows, j => R.tiles[j].adir != null) < 0)) {
    R.over = true;
    after(0.8, () => finish({ pass: false, verdict: 'Gridlock. Every square is waiting for another square. Like a meeting.' }));
  }
}
function arrBonk(R, t, blk) {
  const k = t.adir, [r0, c0] = rcOf(t.i), [r1, c1] = rcOf(blk), dist = Math.abs(r1 - r0) + Math.abs(c1 - c0);
  const slide = (dist - 1) * G.pitch + G.gap + 2, f = tileFx(t), dur = 0.06 + 0.055 * dist;
  t.abusy = true; R.hearts--;
  const out = R.hearts <= 0; if (out) R.over = true;
  tone(300, dur, 'triangle', 0.025, 220);
  tween(f, { ox: ARR_DC[k] * slide, oy: ARR_DR[k] * slide }, dur, { ease: x => x * x, done: () => {
    const p = cellCenter(blk), bt = R.tiles[blk];
    SFX.bonk(); tileSquash(bt, 0.9, 1.05, 0.22);
    const cx = p.x - ARR_DC[k] * G.pitch / 2, cy = p.y - ARR_DR[k] * G.pitch / 2;
    burst(cx, cy, '#ffd25a', 7, 120, 3); addTxt(cx, cy - 14, 'bonk!', C.red);
    R.heartFx = { k: R.hearts, t0: time }; R.heartsShown = R.hearts;
    tween(f, { ox: 0, oy: 0 }, 0.32, { ease: 'outBack', done: () => { tileWiggle(t, 0.3); t.abusy = false; } });
    after(0.12, () => tone(240, 0.22, 'sine', 0.05, -120));
    if (out) after(0.75, () => finish({ pass: false, verdict: pick(ARR_FAIL) }));
    else say(pick(ARR_OUCH), 'nervous', 2.4);
  } });
}

registerRound({
  id: 'arrows', name: 'Send them home',
  minD: 0.15, weight: 1,
  intro: 'Sit on a square to launch it where its arrow points. If something is in the way: bonk. I only have 3 hearts.',
  again: ['Arrows again. Clear the runway first, then launch. Like airports, but squarer.', 'More arrow squares. Look where they point before you sit. That is the whole secret.'],
  move: 'step', exitGrid: false, verify: 'auto', autoDelay: 0.75, noCheck: true,

  generate(d, rng) {
    const A = arrGenerate(d, rng), n = A.n, N = n * n, theme = rng.pick(ARR_THEMES);
    const tiles = A.b.map(t => t ? { icon: rng.pick(theme), adir: t.d, arot: t.rot, noSelect: true } : { empty: true });
    // the cat starts on an empty cell near the bottom middle if there is one (else the bottom middle card)
    const mid = (n - 1) * n + Math.floor(n / 2), empties = [...Array(N).keys()].filter(i => !A.b[i]);
    const dist = i => Math.abs(Math.floor(i / n) - (n - 1)) * 1.2 + Math.abs(i % n - Math.floor(n / 2));
    const catStart = empties.length ? empties.sort((a, b) => dist(a) - dist(b))[0] : mid;
    return {
      grid: n, margin: { t: 30 }, tiles, catStart,
      l1: 'Select all squares', big: 'to send them home',
      l3: A.nRot ? 'Orange arrows turn as neighbours leave.' : 'Sit = launch it. Bonks cost hearts.',
      par: { sits: A.order.length }, solution: A.order, total: A.order.length, heartsMax: d < 0.6 ? 3 : 2, depth: A.depth,
    };
  },

  enter(R) { R.cleared = 0; R.hearts = R.heartsShown = R.heartsMax; R.flyers = []; R.heartFx = null; R.over = false; },

  onSit(R, tile) {
    if (!tile || tile.adir == null) { addTxt(cat.x, cat.y - 50, tile ? pick(['just floor', 'sat on nothing', 'floor: still floor']) : 'sat.', C.grey); return; }
    if (tile.abusy || R.over) return;
    const blk = arrBlocker(tile.i, tile.adir, G.cols, G.rows, j => R.tiles[j].adir != null);
    tileSquash(tile, 0.9, 1.06, 0.2);
    if (blk < 0) arrLaunch(R, tile); else arrBonk(R, tile, blk);
  },

  drawTile(R, g, t, x, y, s) {
    if (t.adir == null) return false;
    arrDrawCard(g, t.icon, (t.adir - (t.aspin || 0)) * Math.PI / 2, t.arot, x, y, s);
    return true;
  },
  drawUnder(R, g) {
    // hearts ("mistakes left") in the strip above the grid
    const y = G.area.y - 14, n = R.heartsMax, hs = 18, x1 = G.x + G.w - 4;
    txt('mistakes left', x1 - n * 24 - 6, y, 13, C.grey, 'right', 600);
    for (let k = 0; k < n; k++) {
      const hx = x1 - (n - 1 - k) * 24 - 9, alive = k < R.heartsShown, fx = R.heartFx && R.heartFx.k === k ? clamp((time - R.heartFx.t0) / 0.5, 0, 1) : 1;
      if (alive) { const b = 1 + 0.06 * Math.sin(time * 4 + k); arrHeart(g, hx, y, hs * b, C.red); continue; }
      arrHeart(g, hx, y, hs, '#e3e8f1', 2);
      if (fx < 1) {   // just broken: the two halves fall apart and fade
        g.save(); g.globalAlpha = 1 - fx;
        for (const sd of [-1, 1]) { g.save(); g.translate(hx + sd * fx * 10, y + fx * fx * 14); g.rotate(sd * fx * 0.6); g.beginPath(); g.rect(sd < 0 ? -hs : 0, -hs, hs, hs * 2); g.clip(); arrHeart(g, 0, 0, hs, C.red); g.restore(); }
        g.restore();
      }
    }
  },
  drawOverlay(R, g) {
    // where the card under the cat would go: a dotted road to the edge (under the cat)
    const i = mode === 'play' && !cat.mv ? catCell() : -1, t = i >= 0 ? R.tiles[i] : null;
    if (!t || t.adir == null || t.abusy) return;
    const c = cellCenter(i), k = t.adir, edge = k === 0 ? G.y - 4 : k === 1 ? G.x + G.w + 4 : k === 2 ? G.y + G.h + 4 : G.x - 4;
    const ex = k % 2 ? edge : c.x, ey = k % 2 ? c.y : edge;
    g.save(); g.setLineDash([3, 7]); g.lineDashOffset = -time * 30; g.lineWidth = 3.5; g.lineCap = 'round'; g.strokeStyle = 'rgba(47,111,228,.75)';
    g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(ex, ey); g.stroke(); g.restore();
    arrDrawArrow(g, ex, ey, 11, k * Math.PI / 2, 'rgba(47,111,228,.9)');
  },
  drawTop(R, g) {
    // flying cards: accelerate along the arrow, speed trail, bounce off the panel edge, fade
    R.flyers = R.flyers.filter(f => time - f.t0 < f.tHit + 0.45);
    for (const f of R.flyers) {
      const tau = time - f.t0, dx = ARR_DC[f.k], dy = ARR_DR[f.k], pos = u => Math.min(f.L, f.v0 * u + f.acc * u * u / 2);
      let s = pos(tau), a = 1, sc = 1, spin = 0;
      if (tau >= f.tHit) { const u = tau - f.tHit; s = f.L - 22 * Math.sin(Math.min(1, u / 0.16) * Math.PI / 2) + (u > 0.16 ? (u - 0.16) * 30 : 0); a = 1 - clamp((u - 0.12) / 0.3, 0, 1); sc = 1 - 0.35 * clamp(u / 0.4, 0, 1); spin = Math.sin(u * 30) * 0.12 * (1 - clamp(u / 0.3, 0, 1)); }
      const x = f.x0 + dx * s, y = f.y0 + dy * s;
      if (tau < f.tHit + 0.05) {   // speed trail: a fading streak + two speed lines
        const s0 = pos(Math.max(0, tau - 0.08)), tx = f.x0 + dx * s0, ty = f.y0 + dy * s0, w = f.s * 0.7;
        const gr = g.createLinearGradient(tx, ty, x, y); gr.addColorStop(0, 'rgba(47,111,228,0)'); gr.addColorStop(1, 'rgba(47,111,228,.35)');
        g.save(); g.lineCap = 'round'; g.strokeStyle = gr; g.lineWidth = w; g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5;
        for (const o of [-0.32, 0.32]) { const px = -dy * o * f.s, py = dx * o * f.s; g.beginPath(); g.moveTo(tx + px - dx * 10, ty + py - dy * 10); g.lineTo(x + px - dx * f.s * 0.5, y + py - dy * f.s * 0.5); g.stroke(); }
        g.restore();
      }
      g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(spin); g.scale(sc, sc);
      arrDrawCard(g, f.icon, f.k * Math.PI / 2, f.rot, -f.s / 2, -f.s / 2, f.s); g.restore();
    }
  },

  progress: R => `Cleared ${R.cleared} / ${R.total}`,
  solved: R => R.cleared >= R.total,
  judge(R) {
    const all = R.tiles.map(t => t.i), left = tilesWhere(t => t.adir != null);
    if (!left.length) return { pass: true, verdict: pick(ARR_PASS), checked: all };
    return { pass: false, verdict: pick(ARR_FAIL), wrong: left, checked: left };
  },
});
