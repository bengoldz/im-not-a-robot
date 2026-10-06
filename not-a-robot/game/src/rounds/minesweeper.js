// rounds/minesweeper.js — MINESWEEPER ("Select all squares WITHOUT a robot vacuum"). Inspired by Minesweeper / Hexcells.
//   - every tile starts face-down (the HUMANCHECK card back from memory.js)
//   - SIT on a tile = reveal it: a coloured number (vacuums in the 8 surrounding tiles) or a robot vacuum
//   - the FIRST reveal is always safe and always a 0: it opens a flood fill that cascades out in ripple order (rising pitch)
//   - HOP in place on a face-down tile = plant / remove a little paw flag (flagged tiles can't be revealed by sitting)
//   - reveal every safe tile -> auto-verify
//   - a vacuum = a STRIKE (the run's real strike counter) + VRRR + the robot gasps; the round CONTINUES (the vacuum tile stays
//     revealed so you can use it as information) unless that was the run's 3rd strike, in which case the round fails right
//     there. Rationale: every board is no-guess, so a vacuum is always a mistake, but losing the whole round to one slip on a
//     36-tile board felt too harsh; costing a strike (and the PERFECT) is the right sting.
//   - generate() is pure: it precomputes, for EVERY possible first tile, a board where that tile and its neighbours are safe
//     and the whole board is solvable WITHOUT guessing by a simple constraint solver (single-cell rules + subset rule).

// ---------- pure board helpers (no live grid access) ----------
function msNbrs(i, cols, rows) {
  const r = Math.floor(i / cols), c = i % cols, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr2 = r + dr, cc = c + dc; if (rr2 >= 0 && rr2 < rows && cc >= 0 && cc < cols) out.push(rr2 * cols + cc); }
  return out;
}
function msNumbers(cols, rows, mines) {
  const m = new Set(mines);
  return [...Array(cols * rows).keys()].map(i => m.has(i) ? -1 : msNbrs(i, cols, rows).filter(j => m.has(j)).length);
}
// flood reveal from `start` over zeros. Returns [{ i, d }] in BFS (ripple) order; d = ring distance. `open` (Set) = already open.
function msFlood(cols, rows, nums, start, open = new Set()) {
  if (open.has(start) || nums[start] < 0) return [];
  const out = [{ i: start, d: 0 }], seen = new Set([start]), q = [{ i: start, d: 0 }];
  while (q.length) {
    const { i, d } = q.shift();
    if (nums[i] !== 0) continue;
    for (const j of msNbrs(i, cols, rows)) if (!seen.has(j) && !open.has(j) && nums[j] >= 0) { seen.add(j); out.push({ i: j, d: d + 1 }); q.push({ i: j, d: d + 1 }); }
  }
  return out;
}
// One deduction pass from what a player can SEE. known[i]: null = face-down/unknown, number = revealed count, 'M' = known vacuum
// (a woken vacuum or one already deduced). Returns { safe: [...], mines: [...] } (newly deduced, deduped).
function mineDeduce(cols, rows, known) {
  const N = cols * rows, safe = new Set(), mines = new Set(), cons = [];
  for (let i = 0; i < N; i++) {
    if (typeof known[i] !== 'number') continue;
    const nb = msNbrs(i, cols, rows), H = nb.filter(j => known[j] == null), M = nb.filter(j => known[j] === 'M').length;
    if (!H.length) continue;
    const rem = known[i] - M;
    if (rem === 0) H.forEach(j => safe.add(j));
    else if (rem === H.length) H.forEach(j => mines.add(j));
    cons.push({ H, rem, set: new Set(H) });
  }
  // subset rule: A.H ⊆ B.H  =>  B.H \ A.H holds exactly B.rem - A.rem vacuums
  for (const A of cons) for (const B of cons) {
    if (A === B || A.H.length >= B.H.length || !A.H.every(j => B.set.has(j))) continue;
    const diff = B.H.filter(j => !A.set.has(j)), k = B.rem - A.rem;
    if (k === 0) diff.forEach(j => safe.add(j)); else if (k === diff.length) diff.forEach(j => mines.add(j));
  }
  return { safe: [...safe].filter(j => !mines.has(j)), mines: [...mines] };
}
// can a player clear this board from `start` with deductions only?  -> number of deduction rounds, or -1
function mineSolvable(cols, rows, mines, start) {
  const nums = msNumbers(cols, rows, mines), N = cols * rows, known = new Array(N).fill(null), open = new Set();
  if (nums[start] < 0) return -1;
  const reveal = i => { for (const { i: j } of msFlood(cols, rows, nums, i, open)) { open.add(j); known[j] = nums[j]; } };
  reveal(start);
  const safeTotal = N - mines.length; let rounds = 0;
  while (open.size < safeTotal) {
    const { safe, mines: ms } = mineDeduce(cols, rows, known);
    let progress = false;
    for (const j of ms) if (known[j] !== 'M') { known[j] = 'M'; progress = true; }
    for (const j of safe) if (!open.has(j)) { if (nums[j] < 0) return -1; reveal(j); progress = true; }
    if (!progress || ++rounds > 200) return -1;
  }
  return rounds;
}
// a no-guess board for first tile `start`: start + its neighbours are vacuum-free (so the first sit opens a 0 cascade)
function mineBoardFor(cols, rows, count, start, rng) {
  const N = cols * rows, keep = new Set([start, ...msNbrs(start, cols, rows)]), pool = [...Array(N).keys()].filter(i => !keep.has(i));
  for (let k = count; k >= 1; k--) {
    for (let tries = 0; tries < 400; tries++) {
      const mines = rng.sample(pool, Math.min(k, pool.length)).sort((a, b) => a - b);
      if (mineSolvable(cols, rows, mines, start) >= 0) return mines;
    }
  }
  return [];
}

const MS_PASS = ['All clean. The vacuums slept through it. So did I, a little.', 'Every safe square found. You crossed a minefield. A lint-field.', 'Zero vacuums woken. My dust bunnies salute you.'];
const MS_PASS_HIT = ['Cleared! Only {n} woke up. It will tell the others.', 'Done. One vacuum is now awake and VERY interested in cat hair. But done!'];
const MS_FAIL = ['The vacuum woke up. It ate the verification. And a sock.', 'VRRRRRR. That is the sound of failure. And of carpets.', 'You found a vacuum the hard way. I would have gasped, but I already gasped.'];
const MS_DIGIT = ['#9aa6bb', '#2f6fe4', '#1f9a5c', '#e5484d', '#1f3d8a', '#a3352f', '#168f8f', '#1d2433', '#7b8597'];

registerRound({
  id: 'minesweeper', name: 'Minesweeper',
  minD: 0.5, weight: 0.9,
  intro: 'Sit to reveal. Numbers count the robot vacuums next door. Never sit on a vacuum!',
  again: ['Vacuum field again. Tiptoe. Cats are good at tiptoe.', 'Numbers, then vacuums. Hop in place to plant a paw flag.'],
  verify: 'auto', autoDelay: 0.5, noCheck: true, selShrink: 1,

  generate(d, rng) {
    const n = d < 0.3 ? 4 : d < 0.65 ? 5 : 6, N = n * n;
    const mines = n === 4 ? (d < 0.15 ? 2 : 3) : n === 5 ? Math.round(lerp(4, 5, (d - 0.3) / 0.35)) : Math.round(lerp(6, 8, clamp((d - 0.65) / 0.3, 0, 1)));
    const boards = [];
    for (let s = 0; s < N; s++) boards.push(mineBoardFor(n, n, mines, s, rng.fork('board', s)));
    const safe = N - mines;
    return {
      grid: n, tiles: [...Array(N).keys()].map(() => ({ back: true, noSelect: true })),
      boards, mines, safeTotal: safe,
      l1: 'Select all squares WITHOUT a', big: 'robot vacuum', l3: 'Sit = reveal. Numbers = vacuums nearby. Hop in place = paw flag.',
      par: { time: Math.round(8 + safe * 1.05 + mines * 1.6), vacuums: 0 },
      solution: null,   // the bot must not peek: it plays from the revealed numbers + mineDeduce only
    };
  },

  enter(R) {
    R.board = null; R.nums = null; R.stats.vacuums = 0; R.woken = 0; R.revealed = 0;
    after(0, () => { for (const t of R.tiles) if (t.fx.before) t.fx.before = { back: true }; });
  },

  update(R, dt) {
    for (const t of R.tiles) if (t.vrr > 0) {
      t.vrr -= dt;
      if (Math.floor(t.vrr * 2.5) !== Math.floor((t.vrr + dt) * 2.5) && t.vrr > 0.3) { const c = cellCenter(t.i); addTxt(c.x + rnd(-14, 14), c.y - G.ts * 0.2, pick(['VRRR', 'vrrRRR', 'VRRRR!']), C.red); dust(c.x, c.y + G.ts * 0.3, 2, 16); }
    }
  },

  onSit(R, tile) {
    if (!tile) { defaultSit(R, null); return; }
    if (tile.flag) { addTxt(cat.x, cat.y - 54, 'flagged · hop to unflag', C.grey); SFX.desel(); return; }
    if (!tile.back) { tileSquash(tile, 0.97, 1.02, 0.14); SFX.tick(); return; }
    if (!R.board) msStart(R, tile.i);
    msReveal(R, tile.i);
  },

  // hop in place on a face-down tile: plant / pull a paw flag
  onHop(R, from, to) {
    if (to < 0 || from !== to) return;
    const t = R.tiles[to]; if (!t.back) return;
    t.flag = !t.flag; t.flagT = time;
    tween(t.fx, { sq: [0.94, 1.05, 1] }, 0.22, { ease: 'outBack' });
    const c = cellCenter(to);
    if (t.flag) { burst(c.x, c.y, C.gold, 6, 110, 3); tone(784, 0.08, 'triangle', 0.05); tone(1046, 0.1, 'triangle', 0.04, 0, 0.06); addTxt(c.x, c.y - G.ts * 0.4, 'flagged!', '#c98a00'); }
    else { SFX.desel(); addTxt(c.x, c.y - G.ts * 0.4, 'unflagged', C.grey); }
  },

  drawTile(R, g, t, x, y, s) {
    if (t.back) {
      memCardBack(g, x, y, s);
      if (t.flag) msFlag(g, x + s * 0.5, y + s * 0.55, s, clamp((time - (t.flagT || 0)) / 0.25, 0, 1));
      return true;
    }
    if (t.mine) {
      g.fillStyle = t.woke ? '#fde3e3' : '#e9edf4'; g.fillRect(x, y, s, s);
      g.strokeStyle = t.woke ? '#f3b4b4' : '#d5dbe6'; g.lineWidth = Math.max(1.5, s * 0.03); g.strokeRect(x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9);
      const awake = t.vrr > 0, j = awake ? Math.sin(time * 70) * s * 0.025 : 0;
      msVacuum(g, x + s / 2 + j, y + s / 2, s * 0.78, t.woke, awake ? time * 14 : 0);
      if (!t.woke) txt('z', x + s * 0.78, y + s * 0.2 - Math.sin(time * 2) * 3, Math.max(10, s * 0.18), '#7b8597', 'center', 700);
      return true;
    }
    // revealed floor + coloured digit
    g.fillStyle = '#f2f5fa'; g.fillRect(x, y, s, s);
    g.fillStyle = '#e3e8f1'; g.fillRect(x, y + s * 0.9, s, s * 0.1);
    g.strokeStyle = '#dde3ee'; g.lineWidth = Math.max(1, s * 0.02); g.strokeRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88);
    if (t.num > 0) {
      const fs = Math.round(s * 0.56), col = MS_DIGIT[t.num] || C.ink;
      g.font = `700 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(29,36,51,.12)'; g.fillText(String(t.num), x + s / 2 + s * 0.025, y + s * 0.53 + s * 0.035);
      g.fillStyle = col; g.fillText(String(t.num), x + s / 2, y + s * 0.53);
    } else {
      g.fillStyle = 'rgba(123,133,151,.16)'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * 0.05, 0, 7); g.fill();
    }
    return true;
  },

  progress(R) {
    const fl = R.tiles.filter(t => t.flag).length;
    return `Safe ${R.revealed} / ${R.safeTotal} · ${R.mines} vacuums${fl ? ` · ${fl} flag${fl > 1 ? 's' : ''}` : ''}`;
  },
  solved: R => !!R.board && R.revealed >= R.safeTotal,
  judge(R) {
    // reveal the sleeping vacuums (zzz) left on the board
    let k = 0;
    for (const t of R.tiles) if (t.back) { t.back = false; t.flag = false; tileFlip(t, { delay: 0.08 * k++, dur: 0.24, before: { back: true } }); }
    const all = tilesWhere(t => !t.mine);
    if (R.woken) return { pass: true, verdict: pick(MS_PASS_HIT).replace('{n}', R.woken === 1 ? 'one' : R.woken), checked: all };
    return { pass: true, verdict: pick(MS_PASS), checked: all };
  },
});

// first sit: pick the precomputed no-guess board for this tile and write it onto the tiles
function msStart(R, i) {
  R.board = R.boards[i]; const ms = new Set(R.board), n = G.cols;
  R.nums = msNumbers(n, G.rows, R.board); R.mines = R.board.length; R.safeTotal = n * G.rows - R.mines;
  R.tiles.forEach((t, j) => { t.mine = ms.has(j); t.num = R.nums[j]; });
  catExclaim();
}
function msReveal(R, i) {
  const t = R.tiles[i];
  if (t.mine) { msWake(R, t); return; }
  const open = new Set(tilesWhere(u => !u.back)), list = msFlood(G.cols, G.rows, R.nums, i, open);
  let maxD = 0;
  for (const { i: j, d } of list) {
    const u = R.tiles[j]; if (!u.back) continue;
    u.back = false; u.flag = false; R.revealed++; maxD = Math.max(maxD, d);
    const dl = d * 0.055;
    tileFlip(u, { delay: dl, dur: 0.2, before: { back: true } });
    after(dl + 0.1, () => { const c = cellCenter(j); if (u.num > 0) burst(c.x, c.y, C.blue, 5, 90, 2.5); else dust(c.x, c.y + G.ts * 0.2, 1, 8); });
  }
  // rising pitch per ring of the cascade (do-re-mi-fa…), one note per ring
  for (let d = 0; d <= maxD; d++) after(d * 0.055 + 0.1, () => SFX.pop(d));
  if (list.length > 6) after(maxD * 0.055 + 0.25, () => { tone(1568, 0.16, 'sine', 0.025); addTxt(cat.x, cat.y - 60, list.length + ' squares!', C.green); });
  tileSquash(t, 0.9, 1.06, 0.24);
}
function msWake(R, t) {
  t.back = false; t.flag = false; t.woke = true; t.vrr = 1.6; R.woken++; R.stats.vacuums++;
  tileFlip(t, { dur: 0.18, before: { back: true } }); tileFlash(t, C.red, 0.5);
  noise(1.1, 0.045, 0, 500); tone(85, 1.1, 'triangle', 0.05, 30); tone(170, 0.9, 'sine', 0.02, 60, 0.1);
  say(pick(['*GASP*! A VACUUM! My ancient enemy!', '*GASP* It is awake. Do not make eye contact.', 'AAA! VRRR! Okay. Okay. I am calm. I am a calm toaster.']), 'nervous', 3.5);
  addTxt(cat.x, cat.y - 60, 'VRRRR!', C.red);
  if (strikes + 1 >= 3) { after(0.6, () => finish({ pass: false, verdict: pick(MS_FAIL) })); return; }
  strikes++;   // a real run strike; the round goes on (see header comment)
  const c = cellCenter(t.i); after(0.35, () => addTxt(c.x, c.y + G.ts * 0.15, `STRIKE ${strikes}/3`, C.red));
}

// ---------- drawing ----------
// robot vacuum, top-down: disc body, lid, bumper, LED eye(s); woke = angry eyes; spin = brush angle
function msVacuum(g, cx, cy, s, woke, spin) {
  const k = s / 100;
  g.save(); g.translate(cx, cy); g.scale(k, k);
  for (let b = 0; b < 2; b++) {   // side brushes
    g.save(); g.translate(b ? 30 : -30, 26); g.rotate(spin * (b ? 1 : -1));
    for (let a = 0; a < 3; a++) { g.rotate(Math.PI * 2 / 3); ln(g, [[0, 0], [0, -16]], 3, '#5d6a85'); }
    g.restore();
  }
  circ(g, 0, 0, 40, '#3b4660', 5);
  g.beginPath(); g.arc(0, 0, 40, Math.PI * 1.08, Math.PI * 1.92); g.lineWidth = 9; g.strokeStyle = '#2a3247'; g.stroke();   // bumper
  circ(g, 0, 4, 28, '#6b7896', 3);
  circ(g, -8, -4, 9, 'rgba(255,255,255,.18)', 0);
  if (woke) {
    ell(g, -10, 4, 6, 7, '#ff5a5f', 0); ell(g, 10, 4, 6, 7, '#ff5a5f', 0);
    ln(g, [[-18, -6], [-4, -1]], 3.5); ln(g, [[18, -6], [4, -1]], 3.5);
    g.beginPath(); g.arc(0, 20, 6, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 3; g.strokeStyle = O; g.stroke();
  } else {
    ln(g, [[-15, 5], [-6, 5]], 3); ln(g, [[6, 5], [15, 5]], 3);   // sleeping eyes
    circ(g, 0, -30, 3.5, '#5ff3ff', 0);
  }
  g.restore();
}
// a little paw flag: pole + pennant with a paw print. p = plant animation 0..1
function msFlag(g, cx, cy, s, p) {
  const k = s / 100, e = EASE.outBack(p);
  g.save(); g.translate(cx, cy + 18 * k); g.scale(k, k * e);
  ell(g, 0, 2, 14, 5, 'rgba(15,22,48,.35)', 0);
  ln(g, [[0, 0], [0, -50]], 5, O);
  poly(g, [[2, -50], [34, -40], [2, -28]], C.gold, 3);
  g.fillStyle = O; g.beginPath(); g.ellipse(14, -38, 4, 3.4, 0, 0, 7); g.fill();
  for (const [x, y] of [[9.5, -43], [13, -45.5], [17, -45], [19.5, -41.5]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  g.restore();
}
