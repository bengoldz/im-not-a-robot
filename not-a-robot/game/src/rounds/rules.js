// rounds/rules.js — BABA IS YOU, re-skinned as "Select all squares with [NOUN]".
// The noun in the prompt is a pushable WORD TILE sitting in the prompt slot (a cell on the top row of the grid). Push a
// different word into the slot and the question changes (the header retypes itself). Then do what it says: select every
// square with that thing, or, for NOTHING, verify with nothing selected. The judge reads whatever is in the slot.
// Difficulty: more words, walls, the slot starts holding a word whose things are walled off (push it out first), word
// tiles blocked by icons. Every puzzle is BFS-verified (push phase + a greedy select tour + walk to the bottom edge);
// par = that solver's move count. Dead ends are possible (a word pushed into a corner) -> RESET pad (sokoban.js helpers).

const RULES_NOUNS = ['fish', 'sock', 'duck', 'pizza', 'bone', 'crown', 'ball', 'moon', 'tree', 'car', 'bus', 'cloud', 'cactus', 'dog', 'sun', 'house', 'balloon', 'umbrella'];
const RULES_NOTHING = 'NOTHING';
const RULES_K = ['U', 'R', 'D', 'L'];
const RULES_PASS = ['You changed the question and then answered it. That is called politics. Very human.', 'HUMANCHECK asked exactly what YOU wanted it to ask. Flawless social engineering.', 'Rules are just tiles you can push. I am writing that on my heart. I do not have a heart.'];
const RULES_FAIL = ['That is not all the squares with that thing. The word was RIGHT there.', 'You picked the word and then ignored it. The word feels used.', 'So close. The question said one thing and your paws said another.'];
const RULES_FAIL_NOTHING = ['NOTHING means nothing. Not even a little something. HUMANCHECK checked.', 'You chose NOTHING and then selected something. Very confusing. Very cat.'];
const RULES_FAIL_BLANK = ['The question is blank. HUMANCHECK cannot verify a blank. Neither can I.', 'Select all squares with... nothing written? Push a word into the slot first.'];

// ---------- pure helpers ----------
function rulesNb(i, k, n) { return sokoNb(i, k, n); }
// BFS distances from `from` through cells where pass(i) is true
function rulesDist(n, from, pass) {
  const N = n * n, d = new Array(N).fill(-1), par = new Array(N).fill(-1), q = [from]; d[from] = 0;
  for (let h = 0; h < q.length; h++) { const u = q[h]; for (let k = 0; k < 4; k++) { const v = rulesNb(u, k, n); if (v < 0 || d[v] >= 0 || !pass(v)) continue; d[v] = d[u] + 1; par[v] = u * 4 + k; q.push(v); } }
  return { d, par };
}
function rulesPathTo(D, to) { const out = []; let v = to; while (D.d[v] > 0) { const p = D.par[v]; out.push(RULES_K[p % 4]); v = Math.floor(p / 4); } return out.reverse(); }
// after the right word is in the slot: greedy walk to every target (sit on each), then to the nearest bottom-row cell
// and step off the grid ('X'). Words are obstacles (walking into one would push it). -> { cost, toks } or null
function rulesTour(n, wall, occ, cat, targets) {
  const pass = v => !wall[v] && !occ[v];
  let cur = cat, cost = 0; const rest = targets.slice(), toks = [];
  while (rest.length) {
    const D = rulesDist(n, cur, pass); let bi = -1;
    for (let j = 0; j < rest.length; j++) if (D.d[rest[j]] >= 0 && (bi < 0 || D.d[rest[j]] < D.d[rest[bi]])) bi = j;
    if (bi < 0) return null;
    const t = rest.splice(bi, 1)[0]; cost += D.d[t]; toks.push(...rulesPathTo(D, t), 'S'); cur = t;
  }
  const D = rulesDist(n, cur, pass); let best = -1;
  for (let c = 0; c < n; c++) { const v = (n - 1) * n + c; if (D.d[v] >= 0 && (best < 0 || D.d[v] < D.d[best])) best = v; }
  if (best < 0) return null;
  cost += D.d[best]; toks.push(...rulesPathTo(D, best), 'X');
  return { cost, toks };
}
// L = { n, wall[], icon[] (noun|null), words: [{ word, noun|null }], wpos: [cells], cat, slot }
// Returns { total, push, toks } (min over push-phase depth + tour) or null. `trivial` = solvable without pushing.
function rulesSolve(L, cap = 140000) {
  const { n, wall, icon, words, slot } = L, N = n * n, W = words.length;
  const iconCells = {}; icon.forEach((k, i) => { if (k) (iconCells[k] = iconCells[k] || []).push(i); });
  const enc = (c, ps) => { let k = c; for (let i = 0; i < W; i++) k = k * N + ps[i]; return k; };
  const evalGoal = (c, ps) => {
    const wi = ps.indexOf(slot); if (wi < 0) return null;
    const w = words[wi], occ = new Array(N).fill(false); ps.forEach(p => occ[p] = true);
    return rulesTour(n, wall, occ, c, w.noun ? (iconCells[w.noun] || []) : []);
  };
  const nodes = [{ c: L.cat, ps: L.wpos.slice(), d: 0, par: -1, tok: '' }], seen = new Set([enc(L.cat, L.wpos)]);
  let best = null, capped = false;
  for (let h = 0; h < nodes.length; h++) {
    const s = nodes[h];
    if (best && s.d >= best.total) break;
    const g = evalGoal(s.c, s.ps);
    if (g && (!best || s.d + g.cost < best.total)) {
      const toks = []; for (let v = h; nodes[v].par >= 0; v = nodes[v].par) toks.push(nodes[v].tok);
      best = { total: s.d + g.cost, push: s.d, toks: toks.reverse().concat(g.toks), word: words[s.ps.indexOf(slot)].word };
    }
    if (nodes.length > cap) { capped = true; continue; }
    for (let k = 0; k < 4; k++) {
      const j = rulesNb(s.c, k, n); if (j < 0 || wall[j]) continue;
      let ps = s.ps; const wi = ps.indexOf(j);
      if (wi >= 0) { const j2 = rulesNb(j, k, n); if (j2 < 0 || wall[j2] || icon[j2] || ps.includes(j2)) continue; ps = ps.slice(); ps[wi] = j2; }
      const key = enc(j, ps); if (seen.has(key)) continue; seen.add(key);
      nodes.push({ c: j, ps, d: s.d + 1, par: h, tok: RULES_K[k] });
    }
  }
  if (best) { best.capped = capped; best.trivial = !!evalGoal(L.cat, L.wpos); }
  return best;
}

function rulesTry(d, rng, attempt) {
  const n = d < 0.3 ? 4 : 5, N = n * n;
  const nNoun = d < 0.25 ? 1 : d < 0.6 ? 2 : 3;
  const useNothing = d >= 0.3 && rng.chance(lerp(0.3, 0.7, d));
  const locked = d >= 0.4 && rng.chance(d >= 0.6 ? 0.85 : 0.5);
  const nWalls = d < 0.2 ? 0 : Math.round(lerp(0, 3, d)) + rng.int(0, 1);
  const wall = new Array(N).fill(false), icon = new Array(N).fill(null), wordAt = new Array(N).fill(null);
  const slot = rng.int(1, n - 2), rc = i => [Math.floor(i / n), i % n];
  const nouns = rng.sample(RULES_NOUNS, nNoun + 3);
  const taken = i => wall[i] || icon[i] || wordAt[i] || i === slot;
  const freeCells = (f = () => true) => [...Array(N).keys()].filter(i => !taken(i) && f(i));
  const words = [], wpos = [];
  // intro: one word straight below the slot, the cat below it: push up twice, select, done
  if (d === 0) {
    const noun = nouns[0], wcell = 2 * n + slot, cat = 3 * n + slot;
    wordAt[wcell] = noun; words.push({ word: noun.toUpperCase(), noun }); wpos.push(wcell);
    for (const i of rng.sample(freeCells(i => i !== cat && i % n !== slot && rc(i)[0] > 0), rng.int(1, 2))) icon[i] = noun;
    for (const i of rng.sample(freeCells(i => i !== cat && i % n !== slot && rc(i)[0] > 0), 1)) icon[i] = nouns[1];   // a decoy
    return { n, wall, icon, words, wpos, cat, slot };
  }
  // a locked noun: its thing sits in a walled-off corner, and its word starts IN the slot (push it out first)
  let lockedNoun = null;
  if (locked) {
    const corners = [[N - n, [N - 2 * n, N - n + 1]], [N - 1, [N - n - 1, N - 2]], [0, [n, 1]], [n - 1, [2 * n - 1, n - 2]]]
      .filter(([c, ws]) => c !== slot && !ws.includes(slot) && !ws.includes(slot - 1) && !ws.includes(slot + 1));
    if (corners.length) {
      const [c, ws] = rng.pick(corners); lockedNoun = nouns[nNoun];
      icon[c] = lockedNoun; ws.forEach(w => wall[w] = true);
      wordAt[slot] = lockedNoun; words.push({ word: lockedNoun.toUpperCase(), noun: lockedNoun }); wpos.push(slot);
    }
  }
  for (const i of rng.sample(freeCells(i => rc(i)[0] > 0), nWalls)) wall[i] = true;
  for (let k = 0; k < nNoun; k++) for (const i of rng.sample(freeCells(), rng.int(1, 2))) icon[i] = nouns[k];
  for (const i of rng.sample(freeCells(i => rc(i)[0] > 0), rng.int(0, 1))) icon[i] = nouns[nNoun + 1];   // decor / decoys
  const corner = i => (rc(i)[0] === 0 || rc(i)[0] === n - 1) && (rc(i)[1] === 0 || rc(i)[1] === n - 1);
  const wlist = nouns.slice(0, nNoun).map(noun => ({ word: noun.toUpperCase(), noun }));
  if (useNothing) wlist.push({ word: RULES_NOTHING, noun: null });
  for (const w of rng.shuffle(wlist)) {
    const cells = freeCells(i => !corner(i) && (rc(i)[0] > 0 || d >= 0.5));
    if (!cells.length) return null;
    const i = rng.pick(cells); wordAt[i] = w.word; words.push(w); wpos.push(i);
  }
  const cc = freeCells(i => rc(i)[0] > 0);
  if (!cc.length) return null;
  return { n, wall, icon, words, wpos, cat: rng.pick(cc), slot };
}
function rulesFallback() {
  // 5x5 hand-made: SOCK starts in the slot but the sock is walled into the corner; push it out, push FISH in
  const n = 5, N = 25, wall = new Array(N).fill(false), icon = new Array(N).fill(null);
  icon[20] = 'sock'; wall[15] = wall[21] = true; icon[8] = 'fish'; icon[18] = 'fish'; icon[11] = 'duck';
  return { n, wall, icon, words: [{ word: 'SOCK', noun: 'sock' }, { word: 'FISH', noun: 'fish' }], wpos: [2, 12], cat: 17, slot: 2 };
}

function rulesSlotWord(R) { const t = R.tiles[R.pslot]; return t && t.word ? t : null; }
// update the header prompt from the slot: a quick split-flap flip, then the noun retypes itself
function rulesSetPrompt(R, animate = true) {
  const t = rulesSlotWord(R), big = t ? `[ ${t.word} ]` : '[ ____ ]';
  if (!animate) { R.big = big; return; }
  R.flipT = 1; tween(R, { flipT: 0 }, 0.3, { ease: 'linear' });
  after(0.14, () => { R.big = big; R.typeT = R.l1.length / 70; });
}
function rulesDrawLabel(g, word, x, y, s, hot) {
  const m = s * 0.08, w = s - m * 2, h = s * 0.58, top = y + (s - h) / 2 - s * 0.03, r = s * 0.08, sd = Math.max(3, s * 0.06);
  if (hot) { g.save(); g.globalAlpha = 0.55 + 0.25 * Math.sin(time * 5); rr(g, x + m - 4, top - 4, w + 8, h + 8, r + 4, '#ffe58a', 0); g.restore(); }
  rr(g, x + m + sd, top + sd, w, h, r, '#9c8558', 0);                                // offset print shadow
  rr(g, x + m, top, w, h, r, word === RULES_NOTHING ? '#efe9fb' : '#fff6dc', Math.max(2.5, s * 0.045));
  g.strokeStyle = word === RULES_NOTHING ? '#d6cdee' : '#ead9ad'; g.lineWidth = 1.5; g.strokeRect(x + m + s * 0.05, top + s * 0.05, w - s * 0.1, h - s * 0.1);
  let fs = s * 0.25; g.font = `800 ${fs}px ${FONT}`;
  while (fs > 8 && g.measureText(word).width > w * 0.84) { fs -= 1; g.font = `800 ${fs}px ${FONT}`; }
  g.fillStyle = word === RULES_NOTHING ? '#5b4a8a' : C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, x + s / 2, top + h / 2 + 1);
}
function rulesDrawSlotFloor(g, x, y, s) {
  g.fillStyle = '#dce8ff'; g.fillRect(x, y, s, s);
  g.fillStyle = 'rgba(47,111,228,.10)'; g.fillRect(x + 6, y + s * 0.38, s - 12, s * 0.24);
  g.strokeStyle = '#a9c3f5'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x + s * 0.25, y + s * 0.7); g.lineTo(x + s * 0.75, y + s * 0.7); g.stroke(); g.setLineDash([]);
}

registerRound({
  id: 'rules', name: 'Rule pushing',
  minD: 0.35, weight: 1,
  intro: 'The question is a tile! Push a WORD into the [slot] to change it, select what it says, then VERIFY.',
  again: ['Word tiles again. The question is negotiable. Push it around.', 'Remember: you can change what they ask. Lawyers hate this one trick.'],
  move: 'step', verify: 'pad', exitGrid: true,

  generate(d, rng) {
    let L = null, res = null;
    for (let a = 0; a < 80 && !res; a++) {
      L = rulesTry(d, rng, a); if (!L) continue;
      res = rulesSolve(L);
      if (!res || res.trivial) { res = null; continue; }
      const relax = Math.floor(a / 20);
      const minPush = d === 0 ? 1 : Math.max(2, Math.round(lerp(3, 9, d)) - relax * 2);
      if (res.push < minPush || (d === 0 && res.push > 3)) res = null;
    }
    if (!res) { L = rulesFallback(); res = rulesSolve(L); }
    const { n, wall, icon, words, wpos, slot } = L;
    const tiles = [...Array(n * n)].map((_, i) => {
      const wi = wpos.indexOf(i);
      if (wi >= 0) return { word: words[wi].word, noun: words[wi].noun, push: true, noSelect: true };
      return wall[i] ? { wall: true } : icon[i] ? { icon: icon[i] } : { empty: true };
    });
    const sw = wpos.indexOf(slot);
    return {
      grid: n, margin: { t: 18, b: SOKO_MARGIN.b }, tiles, initTiles: tiles, catStart: L.cat, pslot: slot,
      l1: 'Select all squares with', big: sw >= 0 ? `[ ${words[sw].word} ]` : '[ ____ ]', l3: 'Push a WORD into the [slot] to change the question.',
      par: { moves: res.total }, solution: res.toks, answer: res.word,
    };
  },

  enter(R) { R.stats.moves = 0; R.flipT = 0; R.padOn = false; },
  update(R) { sokoPadUpdate(R); },
  moveCat(R, from, dir, how) { return how === 'hop' ? { path: [from], how: 'hop' } : null; },   // no hopping over walls
  onMove(R, from, dir, how, path) { if (how !== 'hop' && path.length) R.stats.moves += path.length; },
  onPush(R, tile, from, to) {
    if (to === R.pslot || from === R.pslot) {
      rulesSetPrompt(R);
      const c = cellCenter(R.pslot);
      if (to === R.pslot) { tilePop(tile); after(0.12, () => { burst(c.x, c.y, C.gold, 8, 150, 3); tone(523, 0.1, 'triangle', 0.06); tone(784, 0.16, 'sine', 0.05, 0, 0.08); }); addTxt(c.x, c.y - G.ts * 0.5, tile.word === RULES_NOTHING ? 'nothing it is.' : 'new question!', C.blue); }
      else { addTxt(c.x, c.y - G.ts * 0.5, 'prompt cleared', C.grey); tone(400, 0.1, 'sine', 0.04, -150); }
    }
  },
  onSit(R, tile) { if (!sokoPadSit(R, R2 => { sokoRestore(R2); rulesSetPrompt(R2); })) defaultSit(R, tile); },

  drawTile(R, g, t, x, y, s) {
    if (t.word) { if (t.i === R.pslot) rulesDrawSlotFloor(g, x, y, s); else drawFloor(g, x, y, s); rulesDrawLabel(g, t.word, x, y, s, t.i === R.pslot); return true; }
    if (t.i === R.pslot && t.empty) { rulesDrawSlotFloor(g, x, y, s); return true; }
    return false;
  },
  drawOverlay(R, g) {
    const p = cellXY(R.pslot), s = G.ts, k = 0.5 + 0.5 * Math.sin(time * 4), bx = s * 0.16, col = C.blue;
    // the [ ] brackets around the slot + a tiny tag above it
    ln(g, [[p.x + bx, p.y + 3], [p.x + 3, p.y + 3], [p.x + 3, p.y + s - 3], [p.x + bx, p.y + s - 3]], 4 + k, col);
    ln(g, [[p.x + s - bx, p.y + 3], [p.x + s - 3, p.y + 3], [p.x + s - 3, p.y + s - 3], [p.x + s - bx, p.y + s - 3]], 4 + k, col);
    txt('▼ PROMPT', p.x + s / 2, p.y - 9, 10, C.blue, 'center', 700);
    sokoPadDraw(R, g);
  },
  drawTop(R, g) {
    if (!(R.flipT > 0)) return;
    const a = 1 - Math.abs(1 - 2 * R.flipT), h = 28 * a;   // the big line folds shut and opens again (split-flap)
    g.fillStyle = C.blueD; g.fillRect(HEAD.x + 18, 56 - h / 2, HEAD.w - 36, h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(HEAD.x + 18, 56 - 1, (HEAD.w - 36) * a, 2);
  },

  progress(R) {
    const t = rulesSlotWord(R), n = selected().length;
    if (!t) return 'prompt: blank';
    if (!t.noun) return `NOTHING · ${n} selected`;
    const need = R.tiles.filter(u => u.icon === t.noun).length, got = R.tiles.filter(u => u.icon === t.noun && u.sel).length;
    return `${t.word} ${got} / ${need}` + (n > got ? ` · ${n - got} extra` : '');
  },
  judge(R) {
    const t = rulesSlotWord(R), sel = selected();
    if (!t) return { pass: false, verdict: pick(RULES_FAIL_BLANK), wrong: sel.length ? sel : [R.pslot], checked: sel.concat([R.pslot]) };
    if (!t.noun) return sel.length ? { pass: false, verdict: pick(RULES_FAIL_NOTHING), wrong: sel } : { pass: true, verdict: pick(RULES_PASS), checked: [R.pslot] };
    const want = tilesWhere(u => u.icon === t.noun), wrong = sel.filter(i => !want.includes(i)).concat(want.filter(i => !R.tiles[i].sel));
    const checked = [...new Set(sel.concat(want))];
    return wrong.length ? { pass: false, verdict: pick(RULES_FAIL), wrong, checked } : { pass: true, verdict: pick(RULES_PASS), checked };
  },
});
