// rounds/colorsort.js — BALL SORT / WATER SORT, re-skinned as "Sort the squares. Like a human would."
// The grid's columns are glass tubes (4 items each: balls, socks or fish in 3–6 colours); the cat walks along the shelf
// above them. SIT at a tube: the top item pops up and floats above the cat's head (bobbing). Walk to another tube and SIT to
// drop it: allowed into an empty tube or onto the same colour (and not full); otherwise the item shakes "nope" + soft buzz.
// HOP in place while carrying = put it back. Win: every tube empty or full of one colour (auto-verify, after a chime sweep
// up each tube). Dead ends are possible, so there is a RESET pad (the sit-to-reset pad from sokoban.js).
// Generator: low d = scrambled backwards from the sorted state (short, gentle); higher d = a random shuffle. Either way an
// A* solver (memo on canonical tube sets) proves it solvable; par = the solver's number of moves.

const CS_PASS = ['Sorted! Every tube is one colour. My tidiness module is purring.', 'Beautifully sorted. Like a human sock drawer, but real.', 'Perfect sorting. I am going to frame this. I do not have a wall.'];
const CS_FAIL = ['Still mixed up. Like my feelings.', 'Those tubes are not sorted. The balls know. They are embarrassed.'];
const CS_NOPE = ['nope', 'not there', 'wrong colour', 'that tube is full'];
const CS_PAL = [['#e5484d', '#b8323a'], ['#2f6fe4', '#1f4fb0'], ['#22b573', '#168a56'], ['#ffc93c', '#d99e12'], ['#9b5de5', '#7339b8'], ['#ff8c42', '#d4661c']];
const CS_CAP = 4;

// ---------- pure helpers: tubes = arrays of colour ints, bottom -> top ----------
const csFull = (t, cap = CS_CAP) => t.length === cap && t.every(v => v === t[0]);
function csDone(T, cap = CS_CAP) { return T.every(t => !t.length || csFull(t, cap)); }
function csKey(T) { return T.map(t => t.join('')).sort().join('|'); }
function csH(T) { let h = 0; for (const t of T) { let k = 1; while (k < t.length && t[k] === t[0]) k++; h += t.length - Math.min(k, t.length); } return h; }   // balls above each bottom run must move
function csLegal(T, a, b, cap = CS_CAP) { const A = T[a], B = T[b]; return a !== b && A.length > 0 && B.length < cap && (!B.length || B[B.length - 1] === A[A.length - 1]); }
function csMoves(T, cap) {
  const out = []; let firstEmpty = -1;
  for (let b = 0; b < T.length; b++) if (!T[b].length) { firstEmpty = b; break; }
  for (let a = 0; a < T.length; a++) {
    const A = T[a]; if (!A.length || csFull(A, cap)) continue;
    const uni = A.every(v => v === A[0]);
    for (let b = 0; b < T.length; b++) {
      if (!csLegal(T, a, b, cap)) continue;
      if (!T[b].length && (uni || b !== firstEmpty)) continue;   // pointless / symmetric moves
      out.push([a, b]);
    }
  }
  return out;
}
// A* (weight w; w = 1 is optimal since csH is admissible). Returns [[from, to], ...] or null.
function csSolve(T0, cap = CS_CAP, { w = 1, maxNodes = 60000 } = {}) {
  const nodes = [{ T: T0, g: 0, par: -1, mv: null }], seen = new Map([[csKey(T0), 0]]), heap = [[csH(T0) * w, 0]];
  const push = e => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const id = pop()[1], n = nodes[id];
    if (csDone(n.T, cap)) { const mv = []; for (let v = id; nodes[v].par >= 0; v = nodes[v].par) mv.push(nodes[v].mv); return mv.reverse(); }
    if (nodes.length > maxNodes) return null;
    for (const [a, b] of csMoves(n.T, cap)) {
      const T = n.T.map(t => t.slice()); T[b].push(T[a].pop());
      const k = csKey(T), g = n.g + 1, old = seen.get(k);
      if (old != null && nodes[old].g <= g) continue;
      nodes.push({ T, g, par: id, mv: [a, b] }); seen.set(k, nodes.length - 1);
      push([g + w * csH(T), nodes.length - 1]);
    }
  }
  return null;
}
// backwards scramble from the sorted state: the reverse of a legal move takes the top x of B (B empty below it or x again)
// and puts it on any non-full A — so the forward move A -> B is legal again
function csScramble(k, e, steps, rng) {
  const T = [...Array(k).keys()].map(c => new Array(CS_CAP).fill(c)).concat([...Array(e)].map(() => []));
  let last = null;
  for (let s = 0; s < steps * 6 && steps > 0; s++) {
    const opts = [];
    for (let b = 0; b < T.length; b++) {
      const B = T[b]; if (!B.length) continue; const x = B[B.length - 1];
      if (B.length > 1 && B[B.length - 2] !== x) continue;
      for (let a = 0; a < T.length; a++) if (a !== b && T[a].length < CS_CAP && !(last && last[0] === a && last[1] === b)) opts.push([b, a]);
    }
    if (!opts.length) break;
    const [b, a] = rng.pick(opts); T[a].push(T[b].pop()); last = [b, a]; steps--;
  }
  return rng.shuffle(T);
}
function csDeal(k, e, rng) {
  const balls = rng.shuffle([...Array(k * CS_CAP).keys()].map(i => i % k)), T = [];
  for (let c = 0; c < k; c++) T.push(balls.slice(c * CS_CAP, c * CS_CAP + CS_CAP));
  for (let j = 0; j < e; j++) T.splice(rng.int(0, T.length), 0, []);
  return T;
}
function csGenerate(d, rng) {
  const k = d < 0.45 ? 3 : d < 0.7 ? 4 : d < 0.9 ? 5 : 6, e = d < 0.7 ? 2 : 1;
  const [lo, hi] = d === 0 ? [3, 5] : d < 0.3 ? [5, 9] : d < 0.45 ? [7, 11] : d < 0.7 ? [11, 16] : d < 0.9 ? [15, 24] : [20, 30];
  let best = null;
  for (let a = 0; a < 160; a++) {
    const T = d < 0.3 ? csScramble(k, e, d === 0 ? 4 : Math.round(lerp(6, 11, d / 0.3)), rng) : csDeal(k, e, rng);
    if (csDone(T) || T.some(t => csFull(t))) continue;
    const sol = csSolve(T, CS_CAP, { w: k >= 5 ? 1.5 : 1 });
    if (!sol) continue;
    const miss = sol.length < lo ? lo - sol.length : sol.length > hi ? sol.length - hi : 0;
    if (!best || miss < best.miss) best = { T, sol, miss };
    if (!miss) break;
  }
  if (!best) throw new Error('colorsort: no solvable deal');
  return { k, e, T: best.T, sol: best.sol };
}

// ---------- drawing ----------
function csMark(g, ci, s) {   // a small white symbol per colour (so colours never rely on hue alone)
  const r = s * 0.11; g.save(); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = Math.max(1.8, s * 0.06); g.lineCap = 'round'; g.globalAlpha = 0.9;
  g.beginPath();
  if (ci === 0) g.arc(0, 0, r * 0.8, 0, 7), g.fill();
  else if (ci === 1) g.arc(0, 0, r, 0, 7), g.stroke();
  else if (ci === 2) { g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke(); }
  else if (ci === 3) { g.moveTo(-r, -r); g.lineTo(r, r); g.moveTo(r, -r); g.lineTo(-r, r); g.stroke(); }
  else if (ci === 4) { g.moveTo(0, -r * 1.1); g.lineTo(r, r * 0.8); g.lineTo(-r, r * 0.8); g.closePath(); g.stroke(); }
  else { g.moveTo(0, -r * 1.1); g.lineTo(0, r * 1.1); g.moveTo(-r * 1.1, 0); g.lineTo(r * 1.1, 0); g.stroke(); }
  g.restore();
}
function csItem(g, kind, ci, x, y, s, sc = 1) {
  const [col, dk] = CS_PAL[ci % CS_PAL.length];
  g.save(); g.translate(x, y); g.scale(sc, sc);
  const lw = Math.max(2, s * 0.07);
  if (kind === 'ball') {
    const r = s * 0.44;
    circ(g, 0, 0, r, col, 0);
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, 7); g.clip(); circ(g, r * 0.35, r * 0.4, r * 0.95, dk, 0); circ(g, -r * 0.12, -r * 0.1, r * 0.86, col, 0); g.restore();
    ell(g, -r * 0.38, -r * 0.42, r * 0.26, r * 0.17, 'rgba(255,255,255,.7)', 0);
    circ(g, 0, 0, r, null, lw);
  } else if (kind === 'sock') {
    const k = s / 92; g.save(); g.scale(k, k); g.translate(-10, -2); g.rotate(0.12);
    const path = () => { g.beginPath(); g.moveTo(-14, -38); g.lineTo(12, -38); g.lineTo(12, 8); g.quadraticCurveTo(38, 10, 34, 28); g.quadraticCurveTo(30, 42, 8, 38); g.lineTo(-6, 36); g.quadraticCurveTo(-16, 32, -14, 20); g.closePath(); };
    path(); g.fillStyle = col; g.fill();
    g.save(); path(); g.clip(); g.fillStyle = dk; g.fillRect(-20, 24, 60, 30); g.fillStyle = '#fff'; g.fillRect(-20, -42, 40, 12); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-12, -26, 5, 40); g.restore();
    path(); g.lineWidth = lw / k; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke();
    g.translate(-1, -6); g.scale(1 / k, 1 / k); csMark(g, ci, s); g.restore();
    g.restore(); return;
  } else {   // fish
    const k = s / 84; g.save(); g.scale(k, k); g.translate(-6, 0);
    poly(g, [[18, 0], [44, -18], [44, 18]], dk, lw / k);
    ell(g, -4, 0, 30, 19, col, lw / k);
    g.save(); g.beginPath(); g.ellipse(-4, 0, 30, 19, 0, 0, 7); g.clip(); ell(g, 4, 12, 30, 10, dk, 0); g.restore();
    ell(g, -4, 0, 30, 19, null, lw / k);
    circ(g, -20, -5, 5, '#fff', 0); circ(g, -19, -5, 2.6, C.ink, 0);
    g.translate(2, 1); g.scale(1 / k, 1 / k); csMark(g, ci, s * 0.9); g.restore();
    g.restore(); return;
  }
  csMark(g, ci, s);
  g.restore();
}
// tube geometry (column c): the glass spans rows 1..CS_CAP under the shelf row
function csTube(c) { const x0 = G.x + c * G.pitch, w = G.ts * 0.84, y = G.y + G.pitch - 2, h = CS_CAP * G.pitch - G.gap + 2; return { x: x0 + (G.ts - w) / 2, y, w, h, cx: x0 + G.ts / 2 }; }
function csSlot(c, j) { const t = csTube(c), sh = (t.h - 10) / CS_CAP; return { x: t.cx, y: t.y + t.h - 6 - (j + 0.5) * sh, s: Math.min(t.w * 0.86, sh * 0.96) }; }
function csHead() { return { x: cat.x + 2, y: cat.y - cat.z - 74 + Math.sin(time * 5) * 3 }; }

// ---------- runtime ----------
function csReset(R) {
  R.tubes = R.tubes0.map(t => t.slice()); R.held = null; R.drops = []; R.hide = R.tubes.map(() => 0);
  R.doneT = R.tubes.map(t => csFull(t)); R.flashT = R.tubes.map(() => [-9, -9, -9, -9]); R.party = false;
}
function csPick(R, c) {
  const T = R.tubes[c];
  if (!T.length) { addTxt(cat.x, cat.y - 54, 'empty tube', C.grey); tone(300, 0.08, 'sine', 0.04, -80); return; }
  if (csFull(T)) { addTxt(cat.x, cat.y - 54, 'already sorted ✓', '#178a56'); tone(880, 0.08, 'sine', 0.03); return; }
  const s = csSlot(c, T.length - 1), ci = T.pop();
  R.held = { ci, from: c, t0: time, x0: s.x, y0: s.y, wig: 0 };
  SFX.pop(ci + 2); tone(420, 0.14, 'triangle', 0.03, 300);
  burst(s.x, s.y, CS_PAL[ci][0], 6, 110, 3);
}
function csDrop(R, c, back) {
  const H = R.held, T = R.tubes[c];
  const ok = back || (T.length < CS_CAP && (!T.length || T[T.length - 1] === H.ci));
  if (!ok) {
    H.wig = 1; tween(H, { wig: 0 }, 0.4, { ease: 'linear' });
    tone(150, 0.16, 'triangle', 0.06, -20); tone(157, 0.16, 'triangle', 0.05, -20, 0.01);
    const tb = csTube(c); addTxt(tb.cx, tb.y + 26, T.length >= CS_CAP ? CS_NOPE[3] : pick(CS_NOPE.slice(0, 3)), C.red);
    return;
  }
  const h = csHead(), j = T.length;
  T.push(H.ci); R.held = null; R.hide[c]++;
  if (!back && c !== H.from) R.stats.moves++;
  R.busyT = time + 0.32;
  const d = { ci: H.ci, c, j, t0: time, x0: h.x, y0: h.y };
  R.drops.push(d);
  SFX.whoosh();
  after(0.3, () => {   // lands in the tube
    R.drops = R.drops.filter(q => q !== d); R.hide[c] = Math.max(0, R.hide[c] - 1);
    const s = csSlot(c, j); d.land = time;
    tone(1100 + j * 140, 0.07, 'sine', 0.05); tone(2200 + j * 280, 0.05, 'sine', 0.015, 0, 0.02);   // glassy clink
    R.flashT[c][j] = time; dust(s.x, s.y + s.s * 0.3, 2, 10, '#ffffff');
    if (csFull(R.tubes[c]) && !R.doneT[c]) {
      R.doneT[c] = true; const t = csTube(c);
      burst(t.cx, t.y + t.h / 2, C.gold, 8, 150, 4); after(0.05, () => SFX.chord());
      addTxt(t.cx, t.y - 8, 'sorted ✓', '#178a56');
    }
    if (!R.held && !R.drops.length && csDone(R.tubes) && !R.party) csParty(R);
  });
}
// the celebratory chime sweep: every full tube lights up bottom -> top, tube after tube
function csParty(R) {
  R.party = true; let k = 0;
  R.tubes.forEach((T, c) => {
    if (!T.length) return;
    for (let j = 0; j < T.length; j++) {
      const n = k++;
      after(0.05 + n * 0.045, () => { R.flashT[c][j] = time; const s = csSlot(c, j); burst(s.x, s.y, CS_PAL[T[j]][0], 5, 100, 3); SFX.chime(n % 10); });
    }
  });
  say(pick(['Look at them! All lined up! Like a human queue!', 'Sorted! Every colour has its own little home.']), 'happy', 2.5);
}

registerRound({
  id: 'colorsort', name: 'Sort the squares',
  minD: 0.35, weight: 1,
  intro: 'Sit at a tube to pick up the top thing, sit at another to drop it. Same colour or empty only. Hop to put it back.',
  again: ['Sorting again. Humans love sorting socks. Allegedly.', 'More tubes! One colour per tube. Like a very tidy rainbow.'],
  move: 'step', exitGrid: true, verify: 'auto', autoDelay: 1.4, noCheck: true,

  generate(d, rng) {
    const S = csGenerate(d, rng), n = S.T.length, kind = rng.pick(['ball', 'ball', 'sock', 'fish']);
    const tiles = [];
    for (let r = 0; r <= CS_CAP; r++) for (let c = 0; c < n; c++) tiles.push(r === 0 ? { shelf: true, noSelect: true } : { block: true, hidden: true });
    const name = kind === 'ball' ? 'balls' : kind === 'sock' ? 'socks' : 'fish';
    return {
      cols: n, rows: CS_CAP + 1, margin: { t: 20, b: 38 }, tiles, initTiles: tiles, catStart: Math.floor(n / 2),
      tubes0: S.T, item: kind, colors: S.k,
      l1: 'Sort the squares.', big: 'Like a human would.', l3: `Sit = pick up / drop ${name}.`,
      par: { moves: S.sol.length }, solution: S.sol,
    };
  },

  enter(R) { R.stats.moves = 0; R.padOn = false; R.busyT = 0; csReset(R); },
  update(R) { sokoPadUpdate(R); },

  onSit(R, tile) {
    if (sokoPadSit(R, R2 => { sokoRestore(R2); csReset(R2); })) return;
    if (!tile || !tile.shelf) { addTxt(cat.x, cat.y - 50, 'sat.', C.grey); return; }
    if (time < R.busyT || R.party) return;
    const c = tile.c;
    if (R.held) { if (c === R.held.from) csDrop(R, c, true); else csDrop(R, c, false); }
    else csPick(R, c);
  },
  onHop(R, from, to) {
    if (from === to && R.held && mode === 'play') { csDrop(R, R.held.from, true); addTxt(cat.x, cat.y - 52, 'put it back', C.grey); }
  },

  drawTile(R, g, t, x, y, s) {
    if (!t.shelf) return false;
    rr(g, x, y + s * 0.08, s, s * 0.84, s * 0.14, '#e6ebf3', 0);
    g.lineWidth = 2; g.strokeStyle = '#d3dae6'; g.beginPath(); g.roundRect(x + 3, y + s * 0.08 + 3, s - 6, s * 0.84 - 6, s * 0.12); g.stroke();
    poly(g, [[x + s / 2 - 7, y + s * 0.78], [x + s / 2 + 7, y + s * 0.78], [x + s / 2, y + s * 0.88]], '#c3cbd9', 0);   // "drop here" chevron
    return true;
  },
  drawUnder(R, g) {
    const ci = mode === 'play' && cat.cell >= 0 && cat.cell < G.cols && !cat.mv ? cat.cell : -1;
    R.tubes.forEach((T, c) => {
      const t = csTube(c), full = R.doneT[c], hov = c === ci, rad = [8, 8, t.w / 2, t.w / 2];
      g.beginPath(); g.roundRect(t.x + 3, t.y + 5, t.w, t.h, rad); g.fillStyle = 'rgba(29,36,51,.12)'; g.fill();
      g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, rad); g.fillStyle = hov ? '#eaf2ff' : full ? '#fff8e0' : 'rgba(234,241,250,.9)'; g.fill();
      // items
      const vis = T.length - R.hide[c];
      for (let j = 0; j < vis; j++) {
        const s = csSlot(c, j), ft = (time - R.flashT[c][j]) / 0.28, bump = ft >= 0 && ft < 1 ? 1 + 0.22 * Math.sin(ft * Math.PI) : 1;
        csItem(g, R.item, T[j], s.x, s.y, s.s, bump);
      }
      // glass front: highlight stripes + outline (gold when sorted, blue when the cat stands above it)
      g.save(); g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, rad); g.clip();
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(t.x + t.w * 0.14, t.y + 6, t.w * 0.1, t.h - 18); g.fillRect(t.x + t.w * 0.3, t.y + 6, t.w * 0.04, t.h - 30);
      g.restore();
      g.lineWidth = hov ? 4 : 3; g.strokeStyle = full ? C.gold : hov ? C.blue : C.ink; g.beginPath(); g.roundRect(t.x, t.y, t.w, t.h, rad); g.stroke();
      rr(g, t.x - 4, t.y - 3, t.w + 8, 7, 3.5, full ? C.gold : '#f7f9fc', 2.5);   // rim
    });
  },
  drawOverlay(R, g) { sokoPadDraw(R, g); },
  drawTop(R, g) {
    // drops: from the cat's head over to the tube mouth, then down the glass
    for (const d of R.drops) {
      const u = time - d.t0, t = csTube(d.c), s = csSlot(d.c, d.j); let x, y;
      if (u < 0.12) { const e = EASE.outQuad(u / 0.12); x = lerp(d.x0, t.cx, e); y = lerp(d.y0, t.y - 14, e) - Math.sin(e * Math.PI) * 10; }
      else { const e = clamp((u - 0.12) / 0.18, 0, 1); x = t.cx; y = lerp(t.y - 14, s.y, e * e); }
      csItem(g, R.item, d.ci, x, y, s.s);
    }
    // the carried item, bobbing over the cat's head (pops up out of the tube first; shakes on "nope")
    const H = R.held; if (!H) return;
    const h = csHead(), p = clamp((time - H.t0) / 0.22, 0, 1), e = EASE.outBack(p);
    let x = lerp(H.x0, h.x, e), y = lerp(H.y0, h.y, e) - Math.sin(p * Math.PI) * 26;
    if (H.wig > 0) x += Math.sin(H.wig * Math.PI * 7) * H.wig * 7;
    const sz = csSlot(H.from, 0).s;
    ell(g, h.x, cat.y - cat.z - 50, sz * 0.3, sz * 0.09, 'rgba(29,36,51,.12)', 0);
    csItem(g, R.item, H.ci, x, y, sz, 1 + 0.04 * Math.sin(time * 5));
    if (H.wig > 0) { g.save(); g.globalAlpha = H.wig; ln(g, [[x - sz * 0.62, y - sz * 0.62], [x + sz * 0.62, y + sz * 0.62]], 4, C.red); ln(g, [[x + sz * 0.62, y - sz * 0.62], [x - sz * 0.62, y + sz * 0.62]], 4, C.red); g.restore(); }
  },

  progress: R => `Sorted ${R.tubes ? R.tubes.filter(t => csFull(t)).length : 0} / ${R.colors} · moves ${R.stats.moves || 0} / ${R.par.moves}`,
  solved: R => !R.held && !R.drops.length && csDone(R.tubes),
  judge(R) {
    const shelf = [...Array(G.cols).keys()], bad = shelf.filter(c => R.tubes[c].length && !csFull(R.tubes[c]));
    if (!bad.length && !R.held) return { pass: true, verdict: pick(CS_PASS), checked: [] };
    return { pass: false, verdict: pick(CS_FAIL), wrong: bad, checked: shelf };
  },
});
