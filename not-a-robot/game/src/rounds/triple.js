// rounds/triple.js — TILE EXPLORER / TRIPLE MATCH 3D / ZEN MATCH, re-skinned as "Select all squares in sets of three".
// Cards lie in stacks of 2–4 on the grid cells (lower cards peek out, darkened; only the top card of a cell can be taken).
// SITTING on a cell flies its top card in an arc into the 7-slot tray under the grid (it lands next to its twins). Three
// alike in the tray merge with a pop + sparkle and clear. 7 cards in the tray with no set = the round is lost.
// Clear every card -> auto-verify.
// Generator: every icon count is a multiple of 3; the deal is checked by a DFS solver (memo over stack heights + tray
// counts, capped; re-deal if it fails). par = number of cards (one sit each).

const TRI_PASS = ['All sets of three collected. Three is a very human number.', 'Tray empty, grid empty, heart full. Verified.', 'Match, match, match. You are a matching machine. A HUMAN matching machine, I mean.'];
const TRI_FAIL = ['The tray is full. It is a very small tray. I am sorry about the tray.', 'Seven cards, no sets. HUMANCHECK suspects a card-counting robot.', 'Tray overflow. I would help, but my hands are mostly decorative.'];
const TRI_EASY = ['fish', 'car', 'sun', 'tree', 'pizza', 'ball', 'sock', 'crown', 'house', 'balloon', 'cactus', 'boat', 'umbrella', 'hydrant'];
const TRI_SIM = [['cat', 'dog'], ['car', 'bus'], ['sun', 'moon'], ['fish', 'duck'], ['bone', 'sock'], ['cloud', 'ghost']];   // look-alikes (high d)
const TRI_CAP = 7;

// ---------- pure helpers ----------
// DFS over (stack heights, tray counts per kind). stk: cell -> kinds bottom..top. Returns the cells to sit on, or null.
function triSolve(stk, K, cap = TRI_CAP, maxNodes = 40000) {
  const h = stk.map(s => s.length), tray = new Array(K).fill(0), seen = new Set(), path = [];
  let trayN = 0, left = h.reduce((a, b) => a + b, 0), nodes = 0;
  const rec = () => {
    if (!left) return true;
    const key = h.join(',') + '/' + tray.join('');
    if (seen.has(key) || ++nodes > maxNodes) return false;
    seen.add(key);
    const cand = [];
    for (let i = 0; i < h.length; i++) if (h[i]) { const k = stk[i][h[i] - 1]; cand.push([i, k, tray[k]]); }
    cand.sort((a, b) => b[2] - a[2] || h[b[0]] - h[a[0]]);   // complete a set first, then pair up, taller stacks first
    for (const [i, k, c] of cand) {
      if (c < 2 && trayN + 1 >= cap) continue;   // that card would fill the tray
      h[i]--; left--; path.push(i);
      if (c === 2) { tray[k] = 0; trayN -= 2; } else { tray[k]++; trayN++; }
      if (rec()) return true;
      if (c === 2) { tray[k] = 2; trayN += 2; } else { tray[k]--; trayN--; }
      h[i]++; left++; path.pop();
    }
    return false;
  };
  return rec() ? path.slice() : null;
}
// fairness: a player who can't see under the top cards and plays naively (finish a set, else pair up, else the tallest
// stack) should usually get through. Returns wins out of 6 seeded playouts.
function triFair(stk0, rng) {
  let wins = 0;
  for (let run = 0; run < 6; run++) {
    const stk = stk0.map(x => x.slice()), tray = {}, tie = stk.map(() => rng()); let n = 0, ok = true;
    for (;;) {
      let best = -1, bs = -1;
      for (let i = 0; i < stk.length; i++) if (stk[i].length) { const sc = (tray[stk[i][stk[i].length - 1]] || 0) * 10 + stk[i].length + tie[i]; if (sc > bs) { bs = sc; best = i; } }
      if (best < 0) break;
      const k = stk[best].pop(); tray[k] = (tray[k] || 0) + 1; n++; tie[best] = rng();
      if (tray[k] === 3) { tray[k] = 0; n -= 3; } else if (n >= TRI_CAP) { ok = false; break; }
    }
    if (ok) wins++;
  }
  return wins;
}
function triGenerate(d, rng) {
  const n = d < 0.2 ? 3 : d < 0.55 ? 4 : 5, N = n * n, L = d < 0.2 ? 2 : d < 0.5 ? 3 : 4;
  const triples = d === 0 ? 3 : Math.round(lerp(5, 12, d)), K = d === 0 ? 3 : Math.min(triples, Math.round(lerp(4, 8, d))), T = triples * 3;
  // icons: distinct easy ones; from d 0.6 one (later two) look-alike pairs
  const pairs = d < 0.6 ? 0 : d < 0.85 ? 1 : 2, kinds = [];
  for (const p of rng.sample(TRI_SIM, pairs)) kinds.push(...p);
  for (const k of rng.shuffle(TRI_EASY)) if (kinds.length < K && !kinds.includes(k)) kinds.push(k);
  for (let a = 0; a < 80; a++) {
    // heights: `fill` cells get >= 1 card, the rest piles up to L
    const fill = Math.min(N, Math.max(Math.ceil(T / L), Math.round(T / lerp(1.4, 2.1, d)))), h = new Array(N).fill(0);
    for (const i of rng.sample([...Array(N).keys()], fill)) h[i] = 1;
    for (let r = T - fill; r > 0; r--) { const ok = [...Array(N).keys()].filter(i => h[i] && h[i] < L); h[rng.pick(ok)]++; }
    // deck: one set of each kind, the other sets random kinds; shuffled and dealt bottom-up
    const sets = [...Array(K).keys()]; while (sets.length < triples) sets.push(rng.int(0, K - 1));
    const deck = rng.shuffle(sets.flatMap(k => [k, k, k]));
    const stk = h.map(x => deck.splice(0, x));
    const sol = triSolve(stk, K);
    if (sol && (a > 60 || triFair(stk, rng) >= 5)) return { n, L, stk, kinds, sol, T };
  }
  throw new Error('triple: no solvable deal');
}

// ---------- geometry + drawing ----------
function triTray() { const ss = 42, gap = 6, w = TRI_CAP * (ss + gap) - gap; return { x: GRID.x + (GRID.w - w) / 2, y: GRID.y + GRID.h - ss - 8, ss, gap, w }; }
// slot k of n visible cards (a set that is still merging can briefly push the count past 7: the row squeezes to fit)
function triSlot(k, n = 0) { const T = triTray(), pitch = n > TRI_CAP ? (T.w - T.ss) / (n - 1) : T.ss + T.gap; return { x: T.x + k * pitch + T.ss / 2, y: T.y + T.ss / 2 }; }
// where layer j of an h-card stack sits inside a cell (top card up-left, lower cards peeking out down-right)
function triLayer(x, y, s, h, j) { const cs = s * 0.84, off = s * 0.055, o = ((h - 1) / 2 - (h - 1 - j)) * -off; return { x: x + (s - cs) / 2 + o * 0.6, y: y + (s - cs) / 2 + o, s: cs }; }
function triCard(g, icon, x, y, s, dark = 0) {
  const rad = s * 0.16, lw = Math.max(1.5, s * 0.05);
  rr(g, x + s * 0.03, y + s * 0.06, s, s, rad, 'rgba(29,36,51,.22)', 0);
  rr(g, x, y, s, s, rad, '#fffdf6', 0);
  if (icon) { g.save(); g.beginPath(); g.roundRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, rad * 0.7); g.clip(); g.drawImage(iconTile(icon, Math.round(s)), x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84); g.restore(); }
  else { g.fillStyle = '#e7dcc4'; g.beginPath(); g.roundRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, rad * 0.6); g.fill(); }
  if (dark) { g.fillStyle = `rgba(15,22,48,${dark})`; g.beginPath(); g.roundRect(x, y, s, s, rad); g.fill(); }
  g.lineWidth = lw; g.strokeStyle = C.ink; g.beginPath(); g.roundRect(x + lw / 2, y + lw / 2, s - lw, s - lw, rad); g.stroke();
}

// ---------- runtime ----------
function triTake(R, tile) {
  const i = tile.i, st = R.stk[i], icon = st.pop(), p = cellXY(i), top = triLayer(p.x, p.y, G.ts, st.length + 1, st.length);
  R.left--; R.picks++;
  let at = R.tray.length;
  for (let k = R.tray.length - 1; k >= 0; k--) if (R.tray[k].icon === icon && !R.tray[k].gid) { at = k + 1; break; }
  const dur = 0.4, card = { icon, x: 0, y: 0, sq: 1, red: 0, mg: 0, gid: 0, fly: { t0: time, dur, x0: top.x + top.s / 2, y0: top.y + top.s / 2, s0: top.s } };
  R.tray.splice(at, 0, card);
  tileSquash(tile, 0.88, 1.05, 0.22);
  dust(top.x + top.s / 2, top.y + top.s * 0.9, 4, top.s * 0.5);
  SFX.pop(R.picks - 1); tone(520, 0.16, 'sine', 0.03, 380);
  after(dur, () => {   // landing in the tray
    card.fly = null; tween(card, { sq: [0.82, 1.1, 1] }, 0.22, { ease: 'outBack' });
    const s = triSlot(R.tray.indexOf(card), R.tray.length); dust(s.x, s.y + 18, 3, 16); SFX.thock();
  });
  const same = R.tray.filter(c => c.icon === icon && !c.gid);
  if (same.length === 3) { const gid = ++R.gidN; same.forEach(c => { c.gid = gid; }); after(dur + 0.08, () => triMerge(R, gid)); }
  else if (R.tray.filter(c => !c.gid).length >= TRI_CAP) {
    R.over = true;
    after(dur + 0.05, () => {
      R.tray.forEach((c, k) => { after(k * 0.04, () => { tween(c, { red: [0, 1, 0.7] }, 0.3); c.wig = 1; tween(c, { wig: 0 }, 0.4, { ease: 'linear' }); }); });
      SFX.bonk(); addTxt(GRID.x + GRID.w / 2, triTray().y - 12, 'tray full!', C.red);
      after(0.75, () => finish({ pass: false, verdict: pick(TRI_FAIL) }));
    });
  } else if (R.tray.filter(c => !c.gid).length === TRI_CAP - 1) say(pick(['One slot left! Careful. I am sweating oil.', 'The tray is almost full. Choose wisely, human.']), 'nervous', 2.5);
}
function triMerge(R, gid) {
  const grp = R.tray.filter(c => c.gid === gid); if (!grp.length) return;
  const mid = grp[1];
  grp.forEach(c => { c.mergeTo = mid; tween(c, { mg: 1 }, 0.2, { ease: x => x * x }); });
  after(0.2, () => {
    const s = triSlot(R.tray.indexOf(mid), R.tray.length);
    R.tray = R.tray.filter(c => c.gid !== gid); R.sets++;
    burst(s.x, s.y, C.gold, 8, 170, 4); burst(s.x, s.y, '#ffffff', 6, 90, 3); addP(s.x, s.y, 6, C.gold, 160, 0.6, 4);
    SFX.pop(R.sets + 3); after(0.06, () => SFX.chime(R.sets + 1)); after(0.12, () => tone(1568, 0.18, 'sine', 0.02));
    addTxt(s.x, s.y - 30, pick(['set ✓', '3 of a kind ✓', 'poof ✓']), '#178a56');
  });
}

registerRound({
  id: 'triple', name: 'Sets of three',
  minD: 0.3, weight: 1,
  intro: 'Sit on a stack to put its top card in the tray. Three alike vanish. Seven in the tray and we are done for.',
  again: ['Sets of three again. The tray has seven seats. Do not let it fill up.', 'Triples! Like a triple-decker sandwich. I have never had one. I have read about them.'],
  move: 'step', exitGrid: false, verify: 'auto', autoDelay: 0.5, noCheck: true,

  generate(d, rng) {
    const Gn = triGenerate(d, rng), n = Gn.n, stk = Gn.stk.map(s => s.map(k => Gn.kinds[k]));
    const tiles = stk.map(() => ({ noSelect: true }));
    const mid = (n - 1) * n + Math.floor(n / 2);
    return {
      grid: n, margin: { b: 62 }, tiles, catStart: mid, stk, kinds: Gn.kinds,
      l1: 'Select all squares', big: 'in sets of three', l3: 'Sit = top card to the tray.',
      par: { sits: Gn.T }, solution: Gn.sol, total: Gn.T, layers: Gn.L,
    };
  },

  enter(R) { R.left = R.total; R.tray = []; R.picks = 0; R.sets = 0; R.gidN = 0; R.over = false; R.lastDraw = time; },

  onSit(R, tile) {
    if (!tile) { addTxt(cat.x, cat.y - 50, 'sat.', C.grey); return; }
    if (R.over) return;
    if (!R.stk[tile.i].length) { addTxt(cat.x, cat.y - 50, pick(['nothing here', 'empty. like my inbox']), C.grey); tileSquash(tile, 0.97, 1.02, 0.16); return; }
    triTake(R, tile);
  },

  drawTile(R, g, t, x, y, s) {
    drawFloor(g, x, y, s);
    const st = R.stk[t.i], h = st.length;
    for (let j = 0; j < h; j++) {
      const L = triLayer(x, y, s, h, j), depth = h - 1 - j;
      triCard(g, depth ? null : st[j], L.x, L.y, L.s, depth ? Math.min(0.5, 0.16 + 0.1 * depth) : 0);
    }
    if (h > 1) { const L = triLayer(x, y, s, h, h - 1); rr(g, L.x + L.s - 15, L.y + L.s - 13, 17, 15, 7, C.ink, 0); txt(String(h), L.x + L.s - 6.5, L.y + L.s - 5, 11, '#fff', 'center', 700); }
    return true;
  },
  drawUnder(R, g) {
    const T = triTray();
    rr(g, T.x - 10, T.y - 8, T.w + 20, T.ss + 16, 14, '#e4eaf4', 0);
    g.lineWidth = 2; g.strokeStyle = C.line; g.beginPath(); g.roundRect(T.x - 10, T.y - 8, T.w + 20, T.ss + 16, 14); g.stroke();
    const full = R.tray ? R.tray.filter(c => !c.gid).length : 0;
    for (let k = 0; k < TRI_CAP; k++) {
      const s = triSlot(k), warn = full >= TRI_CAP - 1 && k >= full;
      rr(g, s.x - T.ss / 2, s.y - T.ss / 2, T.ss, T.ss, 9, warn ? `rgba(229,72,77,${0.12 + 0.08 * Math.sin(time * 6)})` : '#f7f9fc', 0);
      g.save(); g.setLineDash([4, 4]); g.lineWidth = 1.5; g.strokeStyle = warn ? C.red : '#c3cbd9'; g.beginPath(); g.roundRect(s.x - T.ss / 2 + 2, s.y - T.ss / 2 + 2, T.ss - 4, T.ss - 4, 8); g.stroke(); g.restore();
    }
  },
  drawTop(R, g) {
    const dt = Math.max(0, Math.min(0.1, time - R.lastDraw)); R.lastDraw = time;
    const T = triTray();
    // tray cards (landed): ease towards their slot; merging cards slide into the middle one
    R.tray.forEach((c, k) => {
      const s = triSlot(k, R.tray.length);
      if (c.fly) return;
      if (!c.x) { c.x = s.x; c.y = s.y; }
      const kx = 1 - Math.exp(-dt * 16); c.x += (s.x - c.x) * kx; c.y += (s.y - c.y) * kx;
      let x = c.x, y = c.y, sc = c.sq;
      if (c.mg > 0 && c.mergeTo) { x = lerp(c.x, c.mergeTo.x, c.mg); y = lerp(c.y, c.mergeTo.y, c.mg) - 6 * Math.sin(c.mg * Math.PI); sc *= 1 + 0.18 * c.mg; }
      if (c.wig) x += Math.sin(c.wig * Math.PI * 6) * c.wig * 5;
      const sz = T.ss * sc; triCard(g, c.icon, x - sz / 2, y - sz / 2, sz);
      if (c.red > 0) { g.fillStyle = `rgba(229,72,77,${0.45 * c.red})`; g.beginPath(); g.roundRect(x - sz / 2, y - sz / 2, sz, sz, sz * 0.16); g.fill(); }
      if (c.mg > 0) { g.fillStyle = `rgba(255,255,255,${0.7 * c.mg})`; g.beginPath(); g.roundRect(x - sz / 2, y - sz / 2, sz, sz, sz * 0.16); g.fill(); }
    });
    // cards in flight: an arc from the stack to their slot (shrinking, a little spin)
    R.tray.forEach((c, k) => {
      if (!c.fly) return;
      const f = c.fly, p = clamp((time - f.t0) / f.dur, 0, 1), e = EASE.inOutSine(p), s = triSlot(k, R.tray.length);
      const x = lerp(f.x0, s.x, e), y = lerp(f.y0, s.y, e) - Math.sin(p * Math.PI) * (60 + Math.abs(s.y - f.y0) * 0.25), sz = lerp(f.s0, T.ss, e) * (1 + 0.15 * Math.sin(p * Math.PI));
      c.x = s.x; c.y = s.y;
      g.save(); g.translate(x, y); g.rotate(Math.sin(p * Math.PI) * 0.35); triCard(g, c.icon, -sz / 2, -sz / 2, sz); g.restore();
    });
    // the top card under the cat (the cat hides it): a little bubble above its head
    const i = mode === 'play' && !cat.mv ? catCell() : -1;
    if (i >= 0 && R.stk[i].length) {
      const bx = cat.x + 26, by = cat.y - cat.z - 74, bs = 30;
      rr(g, bx - bs / 2 - 4, by - bs / 2 - 4, bs + 8, bs + 8, 10, '#fff', 2.5); poly(g, [[bx - 10, by + bs / 2 + 3], [bx - 2, by + bs / 2 + 3], [bx - 12, by + bs / 2 + 11]], '#fff', 0);
      g.drawImage(iconTile(R.stk[i][R.stk[i].length - 1], 64), bx - bs / 2, by - bs / 2, bs, bs);
    }
  },

  progress: R => `Tray ${R.tray ? R.tray.filter(c => !c.gid).length : 0} / ${TRI_CAP} · ${R.left} left`,
  solved: R => R.left === 0 && R.tray.length === 0,
  judge(R) {
    const all = R.tiles.map(t => t.i), left = tilesWhere((t, i) => R.stk[i].length > 0);
    if (!left.length && !R.tray.length) return { pass: true, verdict: pick(TRI_PASS), checked: all };
    return { pass: false, verdict: pick(TRI_FAIL), wrong: left, checked: left };
  },
});
