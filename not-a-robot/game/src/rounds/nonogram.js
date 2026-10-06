// rounds/nonogram.js — PICROSS / NONOGRAMS, re-skinned as "Select the squares that match the numbers".
// Row clues on the left, column clues on top (the grid shrinks into the rest of the box via spec.margin). Sitting toggles
// a square (an inked square when filled). A clue greys out once its line matches. When every line matches, the squares
// flip over in a diagonal wave to reveal the picture in colour (cat, fish, robot, heart, paw, ...) and the round verifies.
// Pictures are hand-authored pixel masks; only masks that a pure LINE SOLVER solves completely are used, which proves the
// clues have exactly one solution (and that it can be found without guessing). par = number of filled squares.

const NONO_PASS = ['It is a picture! HUMANCHECK loves art. Humans make art. Therefore: human.', 'Pixel-perfect. My screen-face is blushing in cyan.', 'You solved the numbers and made a drawing. Robots cannot do both. I checked.'];
const NONO_FAIL = ['The numbers do not match. The numbers are very upset.', 'That picture is abstract. HUMANCHECK prefers realism.'];
const NONO_COL = { o: '#f39a33', k: '#1d2433', r: '#e5484d', y: '#ffc93c', g: '#22b573', b: '#2f6fe4', w: '#ffffff', n: '#9a6435', s: '#9fb6cc', c: '#5ff3ff', p: '#ff8fa3', d: '#c4661a' };
const NONO_BG = '#bfe1ff';
// '.' = empty, any letter = filled with that colour (see NONO_COL)
const NONO_MASKS = [
  // ---- 4 x 4 ----
  { name: 'tree', px: ['.gg.', 'gggg', 'gggg', '.nn.'] },
  { name: 'house', px: ['.rr.', 'rrrr', 'yyyy', 'ynny'] },
  { name: 'mushroom', px: ['.rr.', 'rwrr', '.ww.', '.ww.'] },
  { name: 'cup', px: ['b..b', 'b..b', 'bbbb', '.bb.'] },
  { name: 'arrow', px: ['..b.', 'bbbb', 'bbbb', '..b.'] },
  { name: 'cat face', px: ['o..o', 'oooo', 'kook', 'oppo'] },
  { name: 'robot', px: ['.r..', 'ssss', 'cscs', 'ssss'] },
  { name: 'flag', px: ['nrrr', 'nrrr', 'n...', 'n...'] },
  { name: 'boat', px: ['..w.', '.ww.', 'nnnn', '.nn.'] },
  { name: 'ghost', px: ['.ww.', 'wkkw', 'wwww', 'w.ww'] },
  { name: 'umbrella', px: ['.bb.', 'bbbb', '..n.', '.nn.'] },
  { name: 'key', px: ['yy..', 'yyyy', '...y', '..yy'] },
  { name: 'heart', px: ['rr.r', 'rrrr', '.rrr', '..r.'] },
  // ---- 5 x 5 ----
  { name: 'heart', px: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'] },
  { name: 'cat face', px: ['o...o', 'oo.oo', 'o.o.o', 'oopoo', '.ooo.'] },
  { name: 'fish', px: ['.....', 'o.oo.', 'oooko', 'o.oo.', '.....'] },
  { name: 'robot', px: ['..r..', 'sssss', 'scscs', 'sssss', '.s.s.'] },
  { name: 'paw', px: ['o.o.o', '.....', '.ppp.', 'ppppp', '.ppp.'] },
  { name: 'mushroom', px: ['.rrr.', 'rrwrr', 'rrrrr', '..w..', '.www.'] },
  { name: 'tree', px: ['..g..', '.ggg.', 'ggggg', '..n..', '..n..'] },
  { name: 'sun', px: ['y.y.y', '.yyy.', 'yyyyy', '.yyy.', 'y.y.y'] },
  { name: 'ghost', px: ['.www.', 'wkwkw', 'wwwww', 'wwwww', 'w.w.w'] },
  { name: 'smiley', px: ['.yyy.', 'ykyky', 'yyyyy', 'ykkky', '.yyy.'] },
  { name: 'boat', px: ['..w..', '..ww.', '..w..', 'nnnnn', '.nnn.'] },
  { name: 'umbrella', px: ['.bbb.', 'bbbbb', '..n..', '..n..', '.nn..'] },
  { name: 'house', px: ['..r..', '.rrr.', 'rrrrr', '.y.y.', '.yny.'] },
  { name: 'duck', px: ['.yy..', 'yyko.', '.yy..', 'yyyyy', '.yyy.'] },
  // ---- 6 x 6 ----
  { name: 'cat face', px: ['o....o', 'oo..oo', 'oooooo', 'o.oo.o', 'ooppoo', '..oo..'] },
  { name: 'fish', px: ['..ooo.', 'o.oooo', 'ooooko', 'o.oooo', '..ooo.', '......'] },
  { name: 'heart', px: ['.rr.rr', 'rrrrrr', 'rrrrrr', '.rrrr.', '..rr..', '......'] },
  { name: 'robot', px: ['..rr..', 'ssssss', 'sckksc', 'ssssss', 's.ss.s', '.s..s.'] },
  { name: 'paw', px: ['.d..d.', '......', '..dd..', '.dddd.', 'dddddd', '.dddd.'] },
  { name: 'house', px: ['..rr..', '.rrrr.', 'rrrrrr', '.yyyy.', '.ynny.', '.ynny.'] },
  { name: 'tree', px: ['..gg..', '.gggg.', 'gggggg', '.gggg.', '..nn..', '..nn..'] },
  { name: 'mushroom', px: ['.rrrr.', 'rrwrrr', 'rrrrrr', '..ww..', '..ww..', '.wwww.'] },
  { name: 'ghost', px: ['.wwww.', 'wwwwww', 'wkwwkw', 'wwwwww', 'wwwwww', 'w.ww.w'] },
  { name: 'crown', px: ['y.yy.y', 'y.yy.y', 'yyyyyy', 'yryyry', 'yyyyyy', '......'] },
  { name: 'moon', px: ['..yyy.', '.yy...', 'yy....', 'yy....', '.yy...', '..yyy.'] },
  { name: 'smiley', px: ['.yyyy.', 'yyyyyy', 'ykyyky', 'yyyyyy', 'ykkkky', '.yyyy.'] },
  { name: 'duck', px: ['.yy...', 'yyko..', '.yy..y', '.yyyyy', '..yyy.', '......'] },
];

// run lengths of a 0/1 line ([] = empty line)
function nonoClue(line) { const out = []; let k = 0; for (const v of line) { if (v) k++; else if (k) { out.push(k); k = 0; } } if (k) out.push(k); return out; }
const NONO_OPTS = {};
// every 0/1 line of length n whose clue is `clue` (n <= 6 -> at most 64 candidates)
function nonoOptions(n, clue) {
  const key = n + ':' + clue.join(','); if (NONO_OPTS[key]) return NONO_OPTS[key];
  const out = [];
  for (let m = 0; m < (1 << n); m++) { const line = [...Array(n)].map((_, i) => (m >> i) & 1); if (nonoClue(line).join(',') === clue.join(',')) out.push(line); }
  return NONO_OPTS[key] = out;
}
// pure line solver: repeat "intersect all placements consistent with what is known" over rows and columns.
// -> { grid (1 filled / 2 empty / 0 unknown), passes, solved }
function nonoSolve(rowC, colC) {
  const n = rowC.length, g = new Array(n * n).fill(0);
  let passes = 0, changed = true;
  while (changed && passes < 50) {
    changed = false; passes++;
    for (let L = 0; L < 2 * n; L++) {
      const cells = [...Array(n)].map((_, k) => L < n ? L * n + k : k * n + (L - n)), clue = L < n ? rowC[L] : colC[L - n];
      const opts = nonoOptions(n, clue).filter(o => o.every((v, k) => !g[cells[k]] || (g[cells[k]] === 1) === !!v));
      if (!opts.length) return { grid: g, passes, solved: false, contradiction: true };
      for (let k = 0; k < n; k++) {
        if (g[cells[k]]) continue;
        if (opts.every(o => o[k])) { g[cells[k]] = 1; changed = true; } else if (opts.every(o => !o[k])) { g[cells[k]] = 2; changed = true; }
      }
    }
  }
  return { grid: g, passes, solved: g.every(v => v) };
}
function nonoCluesOf(px) {
  const n = px.length, f = (r, c) => px[r][c] !== '.' ? 1 : 0;
  return { rows: [...Array(n)].map((_, r) => nonoClue([...Array(n)].map((_, c) => f(r, c)))), cols: [...Array(n)].map((_, c) => nonoClue([...Array(n)].map((_, r) => f(r, c)))) };
}
let NONO_VALID = null;
// the masks whose clues the line solver resolves completely (unique solution), grouped by size, easiest first
function nonoValid() {
  if (NONO_VALID) return NONO_VALID;
  NONO_VALID = {};
  for (const m of NONO_MASKS) {
    const n = m.px.length; if (m.px.some(r => r.length !== n)) continue;
    const cl = nonoCluesOf(m.px), s = nonoSolve(cl.rows, cl.cols);
    if (!s.solved || s.grid.some((v, i) => (v === 1) !== (m.px[Math.floor(i / n)][i % n] !== '.'))) continue;
    (NONO_VALID[n] = NONO_VALID[n] || []).push({ ...m, n, clues: cl, passes: s.passes });
  }
  for (const k in NONO_VALID) NONO_VALID[k].sort((a, b) => a.passes - b.passes || a.name.localeCompare(b.name));
  return NONO_VALID;
}

registerRound({
  id: 'nonogram', name: 'Picross',
  minD: 0.55, weight: 1,
  verify: 'auto', autoDelay: 1.6, noCheck: true, selShrink: 0.97,
  intro: 'The numbers say how many squares in a row are filled. Sit to fill. It makes a picture! Probably a cat.',
  again: ['Numbers again! Fill the squares, find the picture. I hope it is me.', 'Picture time. Count carefully. HUMANCHECK counts back.'],

  generate(d, rng) {
    const n = d < 0.35 ? 4 : d < 0.75 ? 5 : 6, list = nonoValid()[n];
    // intro: one of the easiest pictures; later: anything of that size, harder ones a bit more likely with d
    const pool = d < 0.15 ? list.slice(0, Math.max(1, Math.ceil(list.length / 3))) : list;
    const m = rng.weighted(pool, x => 1 + d * x.passes);
    const sol = [], cols = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const ch = m.px[r][c]; sol.push(ch !== '.' ? 1 : 0); cols.push(ch !== '.' ? NONO_COL[ch] : null); }
    const mg = n === 4 ? 58 : n === 5 ? 64 : 72;
    return {
      grid: n, margin: { l: mg, t: mg, r: 0, b: 8 },
      tiles: sol.map(() => ({ nono: true })),
      l1: 'Select the squares that', big: 'match the numbers.', l3: 'Numbers = runs of filled squares.',
      par: { sits: sol.reduce((a, b) => a + b, 0) },
      sol, colors: cols, rowC: m.clues.rows, colC: m.clues.cols, picName: m.name,
      solution: sol.map((v, i) => v ? i : -1).filter(i => i >= 0),
    };
  },

  enter(R) { R.revealed = false; R.clueFx = new Array(2 * G.cols).fill(0); R.sat = nonoSatisfied(R); },
  update(R, dt) { for (let k = 0; k < R.clueFx.length; k++) R.clueFx[k] = Math.max(0, R.clueFx[k] - dt * 2.5); },

  onSit(R, tile) {
    if (!tile) { defaultSit(R, null); return; }
    selectTile(tile, !tile.sel, { text: false });
    const c = cellCenter(tile.i); addTxt(c.x, c.y - G.ts * 0.6, tile.sel ? pick(['inked ✓', '■', 'filled']) : 'erased', tile.sel ? C.ink : C.grey);
    const before = R.sat; R.sat = nonoSatisfied(R);
    let k = 0; R.sat.forEach((v, L) => { if (v && !before[L]) { R.clueFx[L] = 1; tone(noteHz(5 + k++, 784), 0.12, 'sine', 0.035, 0, 0.05); } });
    const solved = R.sat.every(Boolean);
    if (solved && !R.revealed) nonoReveal(R);
    else if (!solved && R.revealed) { R.revealed = false; R.tiles.forEach(t => { t.rev = false; }); }
  },

  solved: R => R.sat.every(Boolean),
  progress(R) { const ok = R.sat.filter(Boolean).length; return `Lines ${ok} / ${R.sat.length} · filled ${R.tiles.filter(t => t.sel).length}`; },
  judge(R) {
    const wrong = R.tiles.map((t, i) => (t.sel ? 1 : 0) !== R.sol[i] ? i : -1).filter(i => i >= 0);
    if (!wrong.length) return { pass: true, verdict: `It's a ${R.picName}! ` + pick(NONO_PASS), checked: R.solution };
    return { pass: false, verdict: pick(NONO_FAIL), wrong };
  },

  drawUnder(R, g) {
    const n = G.cols, fs = Math.max(11, Math.min(17, G.pitch * 0.34)), ci = catCell(), cr = ci >= 0 ? Math.floor(ci / n) : -1, cc = ci >= 0 ? ci % n : -1;
    const lx = G.area.x - R.margin.l + 4, ty = G.area.y - R.margin.t + 4;
    // clue strips
    for (let r = 0; r < n; r++) {
      const y = G.y + r * G.pitch, sat = R.sat[r], fx = R.clueFx[r];
      rr(g, lx, y, G.x - lx - 5, G.ts, 6, r === cr ? '#dce8ff' : sat ? '#eef1f5' : '#e6ecf6', 0);
      if (fx > 0) { g.save(); g.globalAlpha = fx * 0.6; rr(g, lx, y, G.x - lx - 5, G.ts, 6, '#9be3b9', 0); g.restore(); }
      const cl = R.rowC[r].length ? R.rowC[r] : [0];
      cl.slice().reverse().forEach((v, k) => txt(String(v), G.x - 14 - k * fs * 0.95, y + G.ts / 2 + 1, fs, sat ? '#aab3c2' : C.ink, 'center', 700));
    }
    for (let c = 0; c < n; c++) {
      const x = G.x + c * G.pitch, sat = R.sat[n + c], fx = R.clueFx[n + c];
      rr(g, x, ty, G.ts, G.y - ty - 5, 6, c === cc ? '#dce8ff' : sat ? '#eef1f5' : '#e6ecf6', 0);
      if (fx > 0) { g.save(); g.globalAlpha = fx * 0.6; rr(g, x, ty, G.ts, G.y - ty - 5, 6, '#9be3b9', 0); g.restore(); }
      const cl = R.colC[c].length ? R.colC[c] : [0];
      cl.slice().reverse().forEach((v, k) => txt(String(v), x + G.ts / 2, G.y - 14 - k * fs * 1.0, fs, sat ? '#aab3c2' : C.ink, 'center', 700));
    }
    // frame + every-other line marks like a real picross board
    rr(g, G.x - 4, G.y - 4, G.w + 8, G.h + 8, 8, '#cfd6e2', 0);
  },
  drawTile(R, g, t, x, y, s) {
    if (t.rev) {
      const col = R.colors[t.i];
      rr(g, x, y, s, s, s * 0.08, col || NONO_BG, 0);
      if (col) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.12); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + s * 0.1, y + s * 0.8, s * 0.8, s * 0.1); }
      return true;
    }
    rr(g, x, y, s, s, s * 0.08, '#fbf8f1', 0);
    g.lineWidth = 1.5; g.strokeStyle = '#e4ddcd'; g.beginPath(); g.roundRect(x + 2.5, y + 2.5, s - 5, s - 5, s * 0.06); g.stroke();
    if (t.sel) {
      // an inked square: ink fill, a hand-stamped edge and a soft highlight
      rr(g, x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, s * 0.08, C.ink, 0);
      g.fillStyle = '#ffffff1f'; g.fillRect(x + s * 0.14, y + s * 0.14, s * 0.5, s * 0.08);
      g.fillStyle = '#2c3550'; g.fillRect(x + s * 0.14, y + s * 0.74, s * 0.72, s * 0.08);
    }
    return true;
  },
});

function nonoSatisfied(R) {
  const n = G.cols, f = i => R.tiles[i].sel ? 1 : 0, out = [];
  for (let r = 0; r < n; r++) out.push(nonoClue([...Array(n)].map((_, c) => f(r * n + c))).join(',') === R.rowC[r].join(','));
  for (let c = 0; c < n; c++) out.push(nonoClue([...Array(n)].map((_, r) => f(r * n + c))).join(',') === R.colC[c].join(','));
  return out;
}
// solved: every tile flips over in a diagonal wave and shows its pixel colour
function nonoReveal(R) {
  R.revealed = true;
  const n = G.cols;
  R.tiles.forEach(t => {
    t.rev = true;
    const k = (t.r + t.c) / Math.max(1, 2 * n - 2), delay = 0.12 + k * 0.45;
    tileFlip(t, { delay, dur: 0.24, before: { rev: false } });
    after(delay + 0.12, () => { if (!R.revealed) return; const c = cellCenter(t.i); if (R.colors[t.i]) burst(c.x, c.y, R.colors[t.i] === '#ffffff' ? '#cfe6ff' : R.colors[t.i], 5, 110, 3); if ((t.r + t.c) % 2 === 0) SFX.toggle(t.r + t.c + 4); });
  });
  after(0.75, () => { if (!R.revealed) return; SFX.chord(); toastMsg(`It's a ${R.picName}!`, 2); say(`A ${R.picName}! I knew it. I absolutely did not know it.`, 'happy', 3); });
}
