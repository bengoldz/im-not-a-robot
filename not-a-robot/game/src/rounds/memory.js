// rounds/memory.js — MEMORY ("Select all squares that HAD fish"). Inspired by Simon / concentration games.
//   - the tiles show their icons for a countdown (ring timer running around the header + a pulsing MEMORIZE pill)
//   - then they flip face-down in a diagonal wave to an elegant HUMANCHECK card back (memCardBack, also used by minesweeper)
//   - the cat selects from memory (sit = toggle), walks onto VERIFY; the cards flip face-up one by one to reveal
//   - knobs: show time 6 s -> 2.5 s, grid 3x3 -> 5x5, targets 2 -> 6, look-alike decoys (cat/dog, car/bus, sun/moon)
//   - twist (d > 0.7): while face-down, ONE target card swaps places with a neighbour (lift + slide + whoosh). Follow it!

const MEM_TARGETS = [
  { icon: 'fish', label: 'fish' }, { icon: 'cat', label: 'cats' }, { icon: 'dog', label: 'dogs' }, { icon: 'car', label: 'cars' },
  { icon: 'bus', label: 'buses' }, { icon: 'sun', label: 'suns' }, { icon: 'moon', label: 'moons' }, { icon: 'duck', label: 'ducks' },
  { icon: 'bicycle', label: 'bicycles' }, { icon: 'cloud', label: 'clouds' },
];
// hand-picked look-alikes (the "is it a cat or a dog?" moment), on top of the ICON_GROUPS decoys
const MEM_LOOKALIKE = { fish: ['duck', 'boat'], cat: ['dog'], dog: ['cat'], car: ['bus'], bus: ['car'], sun: ['moon', 'balloon'], moon: ['sun', 'cloud'], duck: ['fish'], bicycle: ['car'], cloud: ['moon', 'balloon'] };
const MEM_PASS = ['Perfect recall. Better than my hard drive, which mostly remembers error codes.', 'Every single one. I forget things on purpose to feel human. You don\'t even have to try.', 'Your memory is suspiciously good. For a human. Which you are. Obviously.'];
const MEM_FAIL = ['Those cards remember it differently. Card-related tragedy.', 'You remembered the vibe, not the squares. Relatable.', 'I also forgot. We are bonding. In failure.'];

function memLabel(k) { const t = MEM_TARGETS.find(x => x.icon === k); return t ? t.label : k; }

registerRound({
  id: 'memory', name: 'Memory',
  minD: 0.2, weight: 1,
  intro: 'Memorize where they are! The cards flip over, then you select from memory.',
  again: ['Memory again! Look hard. Blink later.', 'Remember the squares. I would help but my RAM is full of cat pictures.'],
  selShrink: 0.9,

  generate(d, rng) {
    const n = d < 0.3 ? 3 : d < 0.65 ? 4 : 5, N = n * n;
    const k = clamp(Math.round(lerp(2, 6, d)), 2, n === 3 ? 3 : n === 4 ? 5 : 6);
    const show = Math.round(lerp(6, 2.5, d) * 10) / 10;
    const tg = rng.pick(MEM_TARGETS);
    const hit = rng.sample([...Array(N).keys()], k).sort((a, b) => a - b), hs = new Set(hit);
    const similar = clamp(d * 1.2 - 0.1, 0, 0.9), look = MEM_LOOKALIKE[tg.icon] || [];
    const tiles = [...Array(N).keys()].map(i => {
      if (hs.has(i)) return { icon: tg.icon, hit: true };
      const icon = look.length && rng.chance(similar * 0.6) ? rng.pick(look) : pickDecoy(tg.icon, similar, rng);
      return { icon, hit: false };
    });
    // twist: one target swaps with an orthogonal non-target neighbour while face-down
    let swap = null;
    if (d > 0.7) {
      const pairs = [];
      for (const a of hit) { const r = Math.floor(a / n), c = a % n; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const rr2 = r + dr, cc = c + dc; if (rr2 >= 0 && rr2 < n && cc >= 0 && cc < n && !hs.has(rr2 * n + cc)) pairs.push([a, rr2 * n + cc]); } }
      if (pairs.length) swap = rng.pick(pairs);
    }
    const after = hit.map(i => swap ? (i === swap[0] ? swap[1] : i) : i).sort((a, b) => a - b);
    return {
      grid: n, tiles, target: tg.icon, label: tg.label, show, swap, k,
      l1: 'Memorize the squares with', big: tg.label, l3: swap ? 'Then they flip. Psst: watch the cards closely.' : 'They will flip over in a moment. Remember them!',
      // par: the countdown + a brisk walk to each target + VERIFY (+ the shuffle)
      par: { time: Math.round(show + 4 + k * 1.9 + (n - 3) * 1.5 + (swap ? 1.5 : 0)) },
      solution: after,
    };
  },

  enter(R) {
    R.phase = 'show'; R.showT = R.show; R.lastSec = Math.ceil(R.show);
    // the engine's round-start wave flips from its plain card back: show OUR card back during that wave instead
    after(0, () => { for (const t of R.tiles) if (t.fx.before) t.fx.before = { back: true }; });
  },

  update(R, dt) {
    if (R.phase !== 'show') return;
    R.showT -= dt;
    const sec = Math.ceil(R.showT);
    if (sec !== R.lastSec && R.showT > 0) { R.lastSec = sec; if (sec <= 2) tone(880 + (2 - sec) * 220, 0.06, 'sine', 0.04); else SFX.tick(); }
    if (R.showT <= 0) memFlipDown(R);
  },

  onSit(R, tile) {
    if (R.phase === 'show') { addTxt(cat.x, cat.y - 54, 'memorizing…', C.grey); return; }
    if (R.phase === 'flip') { addTxt(cat.x, cat.y - 54, 'wait for it…', C.grey); return; }
    defaultSit(R, tile);
  },

  drawTile(R, g, t, x, y, s) {
    if (t.back) { memCardBack(g, x, y, s); return true; }
    drawTileBase(t, x, y, s);
    if (R.phase === 'show') {   // a soft "memorize" breathing glow on every face (same on all: no hints)
      const k = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
      g.save(); g.strokeStyle = `rgba(255,201,60,${0.25 + 0.35 * k})`; g.lineWidth = Math.max(2, s * 0.04); g.strokeRect(x + 2, y + 2, s - 4, s - 4); g.restore();
    }
    return true;
  },

  drawTop(R, g) {
    if (R.phase !== 'show' || mode !== 'play') return;
    const f = clamp(R.showT / R.show, 0, 1), hx = HEAD.x + 8, hy = HEAD.y + 8, hw = HEAD.w - 16, hh = HEAD.h - 8, rad = 6;
    // ring timer: a gold line running around the header, shrinking as time runs out
    const per = 2 * (hw + hh) - 8 * rad + 2 * Math.PI * rad;
    g.save();
    g.lineWidth = 4; g.strokeStyle = '#ffffff33'; g.beginPath(); g.roundRect(hx + 2, hy + 2, hw - 4, hh - 4, rad); g.stroke();
    g.strokeStyle = f < 0.34 ? '#ff9f9f' : C.gold; g.setLineDash([per * f, per]); g.lineCap = 'round';
    g.beginPath(); g.roundRect(hx + 2, hy + 2, hw - 4, hh - 4, rad); g.stroke(); g.setLineDash([]);
    // the round ring + seconds (top right) and the pulsing MEMORIZE pill
    const cx = HEAD.x + HEAD.w - 40, cy = HEAD.y + 34, beat = 1 + 0.12 * Math.pow(1 - ((R.show - R.showT) % 1), 3);
    g.translate(cx, cy); g.scale(beat, beat);
    g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fillStyle = C.blueD; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#ffffff40'; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.stroke();
    g.strokeStyle = f < 0.34 ? '#ff9f9f' : C.gold; g.beginPath(); g.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.stroke();
    txt(String(Math.max(1, Math.ceil(R.showT))), 0, 1, 16, '#fff', 'center', 700);
    g.restore();
    const pk = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 1.5), pw = 92;
    g.save(); g.translate(cx - 30 - pw / 2, cy); g.scale(1 + 0.05 * pk, 1 + 0.05 * pk);
    rr(g, -pw / 2, -11, pw, 22, 11, `rgba(255,201,60,${0.75 + 0.25 * pk})`, 0); txt('MEMORIZE', 0, 1, 13, C.ink, 'center', 700);
    g.restore();
  },

  progress(R) {
    if (R.phase === 'show') return `Memorize · ${Math.max(0, R.showT).toFixed(1)}s`;
    return `${selected().length} selected · ${R.k} ${R.label}`;
  },

  verifyBlocked: R => (R.phase === 'show' || R.phase === 'flip') ? 'Memorize first. HUMANCHECK is still showing you things.' : null,
  judge(R) {
    // cards flip face-up one by one (reading order) while the engine sweeps the verdict over them
    R.tiles.forEach((t, k) => { if (!t.back) return; t.back = false; tileFlip(t, { delay: k * 0.035, dur: 0.2, before: { back: true } }); after(k * 0.035 + 0.1, () => SFX.toggle(k % 7)); });
    R.phase = 'reveal';
    const hit = tilesWhere(t => t.hit), sel = selected();
    const wrong = sel.filter(i => !R.tiles[i].hit), miss = hit.filter(i => !R.tiles[i].sel);
    const checked = [...new Set(sel.concat(hit))];
    if (!wrong.length && !miss.length) return { pass: true, verdict: pick(MEM_PASS), checked };
    let verdict = pick(MEM_FAIL);
    if (wrong.length && R.tiles[wrong[0]].icon !== R.target && Math.random() < 0.6) verdict = `That card had a ${iconName(R.tiles[wrong[0]].icon)}. Not ${R.label}. It feels misremembered.`;
    else if (!wrong.length && miss.length) verdict = `You forgot ${miss.length === 1 ? 'one' : miss.length}. ${miss.length === 1 ? 'It' : 'They'} will remember YOU though.`;
    return { pass: false, verdict, wrong: wrong.concat(miss), checked };
  },
});

// face-down wave: diagonal from the top-left, then (twist) one shuffle
function memFlipDown(R) {
  R.phase = 'flip'; R.showT = 0;
  const span = Math.max(1, G.cols + G.rows - 2);
  for (const t of R.tiles) {
    const dl = (t.r + t.c) / span * 0.42;
    t.back = true; tileFlip(t, { delay: dl, dur: 0.22, before: { back: false } });
    after(dl + 0.11, () => { if ((t.r + t.c) % 2 === 0) SFX.toggle(t.r + t.c); });
  }
  SFX.whoosh();
  after(0.75, () => {
    if (R.phase !== 'flip') return;   // verified during the flip: the round is over, no shuffle during the check
    R.l1 = 'Select all squares that HAD'; R.big = R.label; R.typeT = 0;
    R.l3 = R.swap ? 'Two cards swapped places. Follow the moving card!' : 'Sit to select. Then walk onto VERIFY.';
    if (!R.swap) { R.phase = 'pick'; return; }
    // the shuffle: both cards lift, slide past each other, settle (slow enough to follow)
    const [a, b] = R.swap, A = R.tiles[a], B = R.tiles[b];
    tween(A.fx, { sq: [1, 1.12] }, 0.18, { ease: 'outQuad' }); tween(B.fx, { sq: [1, 1.12] }, 0.18, { ease: 'outQuad' });
    { const ca = cellCenter(a), cb = cellCenter(b); addTxt((ca.x + cb.x) / 2, (ca.y + cb.y) / 2 - G.ts * 0.3, 'shuffle!', C.gold); }
    after(0.25, () => {
      if (R.phase !== 'flip') return;
      swapCells(a, b, { dur: 0.55 }); SFX.whoosh(); tone(330, 0.5, 'triangle', 0.035, 220);
      after(0.55, () => {
        if (R.phase !== 'flip') return;
        for (const t of [A, B]) { tween(t.fx, { sq: [1.12, 0.94, 1] }, 0.22, { ease: 'outBack' }); const c = cellCenter(t.i); dust(c.x, c.y + G.ts * 0.35, 3, 14); }
        SFX.thock(); R.solution = tilesWhere(t => t.hit); R.phase = 'pick';
      });
    });
  });
}

// ---- the HUMANCHECK card back (shared with minesweeper.js): blue gradient, fine lattice, double border, logo medallion ----
const MEM_BACKS = {};
function memCardBack(g, x, y, s) {
  const S = Math.round(s), key = S + '|' + artScaleV + '|' + (artReady('ui/logo') ? 1 : 0);
  let c = MEM_BACKS[key];
  if (!c) {
    if (Object.keys(MEM_BACKS).length > 12) for (const k in MEM_BACKS) delete MEM_BACKS[k];
    c = MEM_BACKS[key] = document.createElement('canvas'); c.width = c.height = Math.max(1, Math.round(S * artScaleV));
    const q = c.getContext('2d'); q.scale(c.width / S, c.width / S); memPaintBack(q, S);
  }
  g.drawImage(c, x, y, s, s);
}
function memPaintBack(q, s) {
  const gr = q.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#3b7cf0'); gr.addColorStop(1, '#1f4fb0');
  q.fillStyle = gr; q.fillRect(0, 0, s, s);
  // subtle diamond lattice
  q.save(); q.beginPath(); q.rect(s * 0.07, s * 0.07, s * 0.86, s * 0.86); q.clip();
  q.strokeStyle = 'rgba(255,255,255,.09)'; q.lineWidth = Math.max(1, s * 0.012);
  const st = s / 7;
  for (let k = -s; k < s * 2; k += st) { q.beginPath(); q.moveTo(k, 0); q.lineTo(k + s, s); q.moveTo(k + s, 0); q.lineTo(k, s); q.stroke(); }
  q.restore();
  // double border
  q.strokeStyle = 'rgba(255,255,255,.55)'; q.lineWidth = Math.max(1.5, s * 0.022); q.strokeRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86);
  q.strokeStyle = 'rgba(255,255,255,.22)'; q.lineWidth = Math.max(1, s * 0.01); q.strokeRect(s * 0.11, s * 0.11, s * 0.78, s * 0.78);
  // corner pips (little diamonds)
  q.fillStyle = 'rgba(255,255,255,.6)';
  for (const [px, py] of [[0.11, 0.11], [0.89, 0.11], [0.11, 0.89], [0.89, 0.89]]) { q.beginPath(); const r = s * 0.03; q.moveTo(px * s, py * s - r); q.lineTo(px * s + r, py * s); q.lineTo(px * s, py * s + r); q.lineTo(px * s - r, py * s); q.closePath(); q.fill(); }
  // medallion with the shield-eye logo
  const cx = s / 2, cy = s / 2, R0 = s * 0.27;
  q.beginPath(); q.arc(cx, cy, R0 + s * 0.035, 0, 7); q.fillStyle = 'rgba(255,255,255,.18)'; q.fill();
  q.beginPath(); q.arc(cx, cy, R0, 0, 7); q.fillStyle = '#f7f9fc'; q.fill(); q.lineWidth = Math.max(1.5, s * 0.02); q.strokeStyle = '#1f4fb0'; q.stroke();
  const L = R0 * 1.62;
  if (!artDraw(q, 'ui/logo', cx - L / 2, cy - L / 2 + s * 0.005, L, L)) {
    q.save(); q.translate(cx, cy); const k = R0 / 16; q.scale(k, k);
    q.beginPath(); q.moveTo(0, -12); q.lineTo(11, -8); q.lineTo(9, 5); q.quadraticCurveTo(5, 11, 0, 13); q.quadraticCurveTo(-5, 11, -9, 5); q.lineTo(-11, -8); q.closePath(); q.fillStyle = '#3a7bf0'; q.fill();
    q.beginPath(); q.ellipse(0, 0, 6, 4, 0, 0, 7); q.fillStyle = '#fff'; q.fill(); q.beginPath(); q.arc(0, 0, 2.4, 0, 7); q.fillStyle = C.ink; q.fill(); q.restore();
  }
}
