// rounds/ice.js — ICE CAVE (Pokémon ice puzzles), re-skinned as "Select all squares with fish. The floor is freshly mopped."
// Every walk slides the cat until it hits a WET FLOOR sign (a stopper), or the edge. Sitting only works when stopped, so
// a fish counts only if the cat can STOP on it. Generation: random stoppers + start, targets picked among reachable stop
// cells; a BFS over (cell, fish collected) proves it solvable and gives par = minimum slides. Puzzles with dead ends
// (a stop cell from which some fish can no longer be reached) are rejected, so there is no reset.

const ICE_PASS = ['All fish collected. You glided like a figure skater. Who is also a cat.', 'Slippery AND verified. The janitor is so proud of you.', 'Every fish, zero falls. Humans fall on wet floors constantly. Suspicious. But approved.'];
const ICE_FAIL = ['A fish is still out there, flopping. Emotionally.', 'You slid right past the point. And the fish.'];
const ICE_K = ['U', 'R', 'D', 'L'];

// slide from cell i in direction k until the next cell is a stopper or outside: returns the stop cell (i = blocked)
function iceSlide(i, k, n, rock) { for (;;) { const j = sokoNb(i, k, n); if (j < 0 || rock[j]) return i; i = j; } }
// stop cells reachable from `from` (BFS over slides): { dist[], par[] }
function iceReach(n, rock, from) {
  const N = n * n, dist = new Array(N).fill(-1), par = new Array(N).fill(-1), q = [from]; dist[from] = 0;
  for (let h = 0; h < q.length; h++) { const u = q[h]; for (let k = 0; k < 4; k++) { const v = iceSlide(u, k, n, rock); if (v === u || dist[v] >= 0) continue; dist[v] = dist[u] + 1; par[v] = u * 4 + k; q.push(v); } }
  return { dist, par };
}
// min slides to stop on every target (any order): BFS over (cell, mask). -> { len, toks } (toks include 'S' sits)
function iceSolve(n, rock, start, targets) {
  const T = targets.length, full = (1 << T) - 1, N = n * n, key = (c, m) => m * N + c;
  const bit = c => { const t = targets.indexOf(c); return t < 0 ? 0 : 1 << t; };
  const m0 = bit(start), nodes = [{ c: start, m: m0, par: -1, tok: '' }], seen = new Set([key(start, m0)]);
  for (let h = 0; h < nodes.length; h++) {
    const s = nodes[h];
    if (s.m === full) {
      const path = []; for (let v = h; v >= 0; v = nodes[v].par) path.push(nodes[v]);
      path.reverse(); const toks = []; let got = 0;
      for (const p of path) { if (p.tok) toks.push(p.tok); if (bit(p.c) && !(got & bit(p.c))) { got |= bit(p.c); toks.push('S'); } }
      return { len: path.length - 1, toks };
    }
    for (let k = 0; k < 4; k++) {
      const v = iceSlide(s.c, k, n, rock); if (v === s.c) continue;
      const m = s.m | bit(v), kk = key(v, m); if (seen.has(kk)) continue; seen.add(kk);
      nodes.push({ c: v, m, par: h, tok: ICE_K[k] });
    }
  }
  return null;
}
function iceTry(d, rng, attempt) {
  const n = d < 0.25 ? 4 : d < 0.7 ? 5 : 6, N = n * n;
  const nt = d < 0.25 ? 1 : d < 0.55 ? 2 : d < 0.9 ? 3 : 4;
  const nr = d < 0.25 ? rng.int(0, 1) : Math.round(lerp(2, 7, d)) + rng.int(0, 1);
  const rock = new Array(N).fill(false);
  for (const i of rng.sample([...Array(N).keys()], nr)) rock[i] = true;
  const free = [...Array(N).keys()].filter(i => !rock[i]);
  const start = rng.pick(free), R0 = iceReach(n, rock, start);
  const minD = d < 0.5 ? 1 : 2;   // higher d: every fish needs a ricochet route (2+ slides)
  let cands = free.filter(i => i !== start && R0.dist[i] >= minD);
  if (cands.length < nt) return null;
  // prefer far cells as d rises
  const targets = [];
  for (let t = 0; t < nt; t++) {
    const pickFrom = cands.filter(c => !targets.includes(c));
    const far = rng.weighted(pickFrom, c => Math.pow(R0.dist[c], d * 2.5));
    targets.push(far);
  }
  // no dead ends: from every reachable stop cell, every fish must still be reachable
  for (let c = 0; c < N; c++) if (R0.dist[c] >= 0) { const Rc = iceReach(n, rock, c); if (targets.some(t => Rc.dist[t] < 0)) return null; }
  const res = iceSolve(n, rock, start, targets); if (!res) return null;
  const relax = Math.floor(attempt / 25);
  const minL = d === 0 ? 1 : Math.max(nt, Math.round(lerp(2, 11, d)) - relax), maxL = d === 0 ? 2 : 99;
  if (res.len < minL || res.len > maxL) return null;
  // walls must matter at higher d: at least one stopper is used
  return { n, rock, start, targets, res };
}
function iceFallback() {
  const n = 5, rock = new Array(25).fill(false); rock[1] = rock[8] = rock[13] = rock[21] = true;
  const start = 24, targets = [2, 22];   // L (stop at 22), U (slide up to 2)
  return { n, rock, start, targets, res: iceSolve(n, rock, start, targets) };
}

// ---------- drawing ----------
function iceDrawFloor(g, x, y, s, i) {
  g.fillStyle = '#e9f6fd'; g.fillRect(x, y, s, s);
  g.fillStyle = '#d6edf9'; g.fillRect(x, y + s * 0.82, s, s * 0.18);
  g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
  // mop streaks + a soft moving sheen
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(2, s * 0.05); g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + s * 0.18, y + s * 0.42); g.lineTo(x + s * 0.42, y + s * 0.18); g.moveTo(x + s * 0.3, y + s * 0.5); g.lineTo(x + s * 0.48, y + s * 0.32); g.stroke();
  const ph = ((time * 0.35 + (i % 7) * 0.13) % 1.6) - 0.3, sx = x + ph * s * 1.4;
  const gr = g.createLinearGradient(sx - s * 0.3, y, sx + s * 0.3, y + s);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(x, y, s, s);
  g.restore();
  g.strokeStyle = '#c8e3f3'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, s - 2, s - 2);
}
// the stopper: a yellow WET FLOOR sign + a mop bucket
function iceDrawRock(g, x, y, s) {
  iceDrawFloor(g, x, y, s, 3);
  ell(g, x + s * 0.5, y + s * 0.86, s * 0.4, s * 0.07, 'rgba(29,36,51,.18)', 0);
  // bucket (right)
  const bx = x + s * 0.62, by = y + s * 0.52, bw = s * 0.3, bh = s * 0.32, lw = Math.max(2, s * 0.035);
  ln(g, [[bx + bw * 0.55, by - s * 0.02], [bx + bw * 0.95, y + s * 0.1]], lw * 1.6, '#8b5a2b');
  poly(g, [[bx, by], [bx + bw, by], [bx + bw * 0.88, by + bh], [bx + bw * 0.12, by + bh]], '#4fa3e0', lw);
  ln(g, [[bx + bw * 0.08, by + bh * 0.3], [bx + bw * 0.92, by + bh * 0.3]], lw * 0.8, '#2f7fc0');
  g.beginPath(); g.arc(bx + bw / 2, by, bw * 0.45, Math.PI, 0); g.lineWidth = lw * 0.8; g.strokeStyle = O; g.stroke();
  // A-frame sign (left)
  const sx = x + s * 0.12, sy = y + s * 0.14, sw = s * 0.5, sh = s * 0.7;
  poly(g, [[sx + sw * 0.18, sy], [sx + sw * 0.82, sy], [sx + sw, sy + sh], [sx, sy + sh]], '#ffd23f', lw);
  poly(g, [[sx + sw * 0.32, sy + sh * 0.12], [sx + sw * 0.68, sy + sh * 0.12], [sx + sw * 0.6, sy + sh * 0.36], [sx + sw * 0.4, sy + sh * 0.36]], '#1d2433', 0);
  circ(g, sx + sw * 0.5, sy + sh * 0.2, s * 0.03, '#ffd23f', 0);   // a tiny slipping person, abstract
  const fs = Math.max(6, s * 0.11);
  txt('WET', sx + sw / 2, sy + sh * 0.53, fs, C.ink, 'center', 800);
  txt('FLOOR', sx + sw / 2, sy + sh * 0.74, fs * 0.92, C.ink, 'center', 800);
}
function iceDrawFish(g, x, y, s, t) {
  iceDrawFloor(g, x, y, s, t.i);
  ell(g, x + s / 2, y + s * 0.62, s * 0.34, s * 0.12, 'rgba(79,163,224,.25)', 0);   // little puddle
  const bob = Math.sin(time * 3 + t.i) * s * 0.015;
  drawIcon(g, 'fish', x + s / 2, y + s * 0.47 + bob, s * 0.72);
}

registerRound({
  id: 'ice', name: 'Freshly mopped',
  minD: 0.25, weight: 1,
  intro: 'Wet floor! You slide until something stops you. Stop ON each fish and sit on it.',
  again: ['Freshly mopped again. Slide carefully. Or carelessly. You are a cat.', 'The janitor mopped AGAIN. Use the signs to stop.'],
  move: 'step', verify: 'auto', exitGrid: false, autoDelay: 0.4, selShrink: 0.9,

  generate(d, rng) {
    let L = null;
    for (let a = 0; a < 100 && !L; a++) L = iceTry(d, rng, a);
    if (!L) L = iceFallback();
    const { n, rock, start, targets, res } = L;
    const tiles = [...Array(n * n)].map((_, i) => rock[i] ? { rock: true, block: true, noSelect: true } : targets.includes(i) ? { fish: true, ice: true } : { ice: true, empty: true });
    return {
      grid: n, tiles, catStart: start,
      l1: 'Select all squares with fish.', big: 'The floor is freshly mopped.', l3: 'You slide until stopped. Sit on a fish to select it.',
      par: { moves: res.len }, solution: res.toks,
    };
  },

  enter(R) { R.stats.moves = 0; R.trail = []; R.rigs = [newCatRig(), newCatRig(), newCatRig()]; },
  update(R, dt) {
    // afterimage trail while sliding
    if (cat.mv && cat.mv.how === 'slide') R.trail.push({ x: cat.x, y: cat.y, face: cat.face, t: time });
    while (R.trail.length && time - R.trail[0].t > 0.22) R.trail.shift();
  },
  moveCat(R, from, dir, how) {
    if (how === 'hop') return { path: [from], how: 'hop' };   // hopping on a wet floor: in place only
    const path = []; let k = from;
    for (;;) { const j = stepCell(k, dir); if (j < 0 || R.tiles[j].block) break; path.push(j); k = j; }
    return { path, how: 'slide' };
  },
  onMove(R, from, dir, how, path) {
    if (how === 'hop' || !path.length) return;
    R.stats.moves++;
    noise(0.12 + path.length * 0.05, 0.025, 0, 0, 2200);   // swish
    cat.sx = 1.12; cat.sy = 0.9;
  },
  onStep(R, from, to, info) {
    if (info.how !== 'slide' || cat.mv) return;
    // skid to a stop: squash, puff in front, scrape sound
    const dir = info.dir || [0, 0];
    cat.sx = dir[1] ? 0.8 : 1.2; cat.sy = dir[1] ? 1.18 : 0.82;
    dust(cat.x + dir[1] * 14, cat.y + dir[0] * 6, 6, 14, '#e6f4ff');
    noise(0.09, 0.03, 0, 900); tone(180, 0.06, 'triangle', 0.03, -40);
    const t = R.tiles[to];
    if (t && t.fish && !t.sel) addTxt(cat.x, cat.y - 54, 'sit!', C.blue);
  },
  onSit(R, tile) {
    if (tile && tile.fish) { if (!tile.sel) selectTile(tile, true, { text: false }), addTxt(cat.x, cat.y - 54, pick(['fish secured ✓', 'mine ✓', 'got it ✓']), C.blue); else addTxt(cat.x, cat.y - 54, 'already mine', C.grey); }
    else addTxt(cat.x, cat.y - 50, pick(['sat. floor is cold.', 'brr.', 'wet butt.']), C.grey);
  },

  drawTile(R, g, t, x, y, s) {
    if (t.rock) { iceDrawRock(g, x, y, s); return true; }
    if (t.fish) { iceDrawFish(g, x, y, s, t); return true; }
    if (t.ice) { iceDrawFloor(g, x, y, s, t.i); return true; }
    return false;
  },
  drawOverlay(R, g) {
    // motion-blur afterimages + speed lines behind the sliding cat
    const tr = R.trail; if (!tr || !tr.length) return;
    const pickAt = age => { for (let i = tr.length - 1; i >= 0; i--) if (time - tr[i].t >= age) return tr[i]; return null; };
    [0.05, 0.1, 0.16].forEach((age, k) => {
      const p = pickAt(age); if (!p) return;
      drawCat({ x: p.x, y: p.y, z: 0, vx: 0, vy: 0, face: p.face, sx: 1, sy: 1, hopT: 0, dashT: 0, sitT: 0, fall: 0, walkT: 0, sitHold: false }, R.rigs[k], { alpha: 0.3 - k * 0.08 });
    });
    const o = tr[0]; g.save(); g.globalAlpha = 0.6; g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (const dy of [-26, -16, -6]) { g.beginPath(); g.moveTo(o.x, o.y + dy); g.lineTo(lerp(o.x, cat.x, 0.8), lerp(o.y, cat.y, 0.8) + dy); g.stroke(); }
    g.restore();
  },

  progress: R => `Fish ${R.tiles.filter(t => t.fish && t.sel).length} / ${R.tiles.filter(t => t.fish).length} · slides ${R.stats.moves || 0} / par ${R.par.moves}`,
  solved: R => R.tiles.every(t => !t.fish || t.sel),
  judge(R) {
    const fish = tilesWhere(t => t.fish), wrong = fish.filter(i => !R.tiles[i].sel);
    return wrong.length ? { pass: false, verdict: pick(ICE_FAIL), wrong, checked: fish } : { pass: true, verdict: pick(ICE_PASS), checked: fish };
  },
});
