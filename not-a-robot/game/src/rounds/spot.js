// rounds/spot.js — SPOT THE DIFFERENCE ("Select the square that is different"). Inspired by spot-the-difference / Waldo.
//   - 16 or 25 tiles of the SAME icon; exactly one is a fake, drawn procedurally with ONE tweak:
//     rotation, mirror flip, scale, hue tint, a missing detail (a patch in the underlying colour painted over a feature),
//     an extra detail (tiny top hat, mustache, blush) or a different eye (robot: red eye; others: a wink)
//   - subtlety rises with d: upside-down at d = 0 ... a faint tint / 10° tilt / a missing bubble at d = 1
//   - at high d every tile's background gets a slight brightness jitter (noise), so "it looks a bit different" stops working
//   - sit on the odd one (selecting another moves your pick), walk onto VERIFY; the fake gets a gold magnifier ring + a verdict
//     that says what was wrong with it. Par = time.

// Feature tables in the icon's 512x512 SVG space (art/icons/*.svg). skin = colour used to paint a feature away.
const SPOT_ICONS = {
  fish: { label: 'fish', asym: true, skin: '#ff8c42', eyes: [[122, 268, 30]], hat: [150, 212, -0.25], stache: [92, 300, 0.8], cheeks: [[160, 312]],
    missing: [{ at: [122, 268, 31], col: '#ff8c42', what: 'had no eye' }, { at: [92, 162, 22], col: '#a9dbee', what: 'was missing a bubble' }] },
  cat: { label: 'cat', skin: '#f39a33', eyes: [[211, 188, 22], [301, 188, 22]], hat: [256, 104, 0], stache: [256, 240, 1],
    missing: [{ at: [256, 120, 26], col: '#f39a33', what: 'had no forehead stripes' }, { at: [301, 188, 23], col: '#f39a33', what: 'was missing an eye' }] },
  robot: { label: 'robot', robo: true, skin: '#14202f', eyes: [[214, 206, 22], [298, 206, 22]], hat: [256, 124, 0.12], stache: [256, 250, 1.05], cheeks: [[184, 248], [328, 248]],
    missing: [{ at: [256, 390, 27], col: '#5d7590', what: 'had no chest light' }, { at: [256, 72, 27], col: '#dbe5f0', what: 'lost its antenna bulb' }] },
  duck: { label: 'duck', asym: true, skin: '#ffd23f', eyes: [[208, 192, 20]], hat: [200, 140, -0.12], stache: [132, 232, 0.7],
    missing: [{ at: [208, 192, 21], col: '#ffd23f', what: 'had no eye' }, { at: [226, 230, 20], col: '#ffd23f', what: 'forgot to blush' }] },
  sun: { label: 'sun', skin: '#ffd23f', eyes: [[214, 238, 24], [298, 238, 24]], hat: [256, 142, 0.1], stache: [256, 280, 1],
    missing: [{ at: [298, 238, 25], col: '#ffd23f', what: 'was missing an eye' }, { at: [330, 286, 26], col: '#ffd23f', what: 'only blushed on one side' }] },
  dog: { label: 'dog', skin: '#c98b4f', eyes: [[208, 250, 22], [304, 250, 22]], hat: [256, 134, 0.1], stache: [256, 318, 1], cheeks: [[176, 300], [336, 300]],
    missing: [{ at: [306, 214, 18], col: '#c98b4f', what: 'was missing an eyebrow' }, { at: [304, 250, 23], col: '#c98b4f', what: 'was missing an eye' }] },
  ghost: { label: 'ghost', skin: '#f8f9fb', eyes: [[224, 204, 27], [290, 204, 27]], hat: [256, 72, 0], stache: [257, 244, 0.9],
    missing: [{ at: [257, 270, 22], col: '#f8f9fb', what: 'had no mouth' }, { at: [324, 248, 20], col: '#f8f9fb', what: 'only blushed on one side' }] },
};
// tweak kinds and the d window in which each may be picked
const SPOT_TWEAKS = [
  { k: 'rot', lo: 0, hi: 1 }, { k: 'flip', lo: 0.05, hi: 0.55 }, { k: 'hat', lo: 0.1, hi: 0.5 }, { k: 'stache', lo: 0.15, hi: 0.6 },
  { k: 'scale', lo: 0.3, hi: 0.8 }, { k: 'blush', lo: 0.35, hi: 0.8 }, { k: 'eye', lo: 0.4, hi: 1 }, { k: 'missing', lo: 0.5, hi: 1 }, { k: 'tint', lo: 0.6, hi: 1 },
];
const SPOT_TINTS = [['#2f6fe4', 'was a little bit blue'], ['#22b573', 'was slightly green'], ['#a040ff', 'was faintly purple'], ['#ff2d55', 'was a touch too pink']];
const SPOT_PASS = ['That {n} was a fake. We knew.', 'Impostor {n} detected. It {w}. Amateur.', 'Correct. The {n} that {w} has been escorted off the internet.'];
const SPOT_FAIL = ['That one was a perfectly normal {n}. It is offended.', 'Wrong {n}. The real impostor {w}. It got away.', 'HUMANCHECK expected you to notice it {w}. HUMANCHECK is disappointed.'];

registerRound({
  id: 'spot', name: 'Spot the difference',
  minD: 0.15, weight: 1,
  intro: 'One of these is a fake! Sit on the odd one out, then walk onto VERIFY.',
  again: ['Another impostor. Squint. Humans love squinting.', 'Spot the fake again. I can\'t tell. They all look like icons to me.'],

  generate(d, rng) {
    const n = d < 0.45 ? 4 : 5, N = n * n;
    const icon = rng.pick(Object.keys(SPOT_ICONS)), F = SPOT_ICONS[icon];
    let tw;
    if (d < 0.08) tw = { k: 'rot', deg: 180, what: 'was upside down' };
    else {
      const ok = SPOT_TWEAKS.filter(t => d >= t.lo && d <= t.hi && (t.k !== 'flip' || F.asym) && (t.k !== 'blush' || F.cheeks));
      const k = rng.pick(ok).k, u = clamp(d, 0, 1);
      if (k === 'rot') { const deg = Math.round(lerp(55, 10, u)) * (rng.chance(0.5) ? 1 : -1); tw = { k, deg, what: `was tilted ${Math.abs(deg)}°` }; }
      else if (k === 'flip') tw = { k, what: 'was facing the wrong way' };
      else if (k === 'hat') tw = { k, what: 'wore a tiny hat' };
      else if (k === 'stache') tw = { k, what: 'had a mustache' };
      else if (k === 'blush') tw = { k, what: 'was blushing' };
      else if (k === 'scale') { const f = Math.round(lerp(1.3, 1.12, (u - 0.3) / 0.5) * 100) / 100, big = rng.chance(0.6); tw = { k, f: big ? f : Math.round(100 / f) / 100, what: big ? 'was slightly too big' : 'was slightly too small' }; }
      else if (k === 'eye') { const e = rng.int(0, F.eyes.length - 1); tw = { k, e, what: F.robo ? 'had a red eye' : 'was winking' }; }
      else if (k === 'missing') { const m = rng.pick(F.missing); tw = { k, m, what: m.what }; }
      else { const [col, what] = rng.pick(SPOT_TINTS); tw = { k: 'tint', col, a: Math.round(lerp(0.42, 0.24, (u - 0.6) / 0.4) * 100) / 100, what }; }
    }
    const odd = rng.int(0, N - 1), noise = d > 0.55 ? (d - 0.55) * 0.15 : 0;
    const tiles = [...Array(N).keys()].map(i => ({ icon, odd: i === odd, nz: noise ? Math.round(rng.f(-noise, noise) * 1000) / 1000 : 0 }));
    return {
      grid: n, tiles, icon, label: F.label, tweak: tw, odd,
      l1: 'Select the square that is', big: 'different', l3: 'One of these is a fake. Sit on it, then walk onto VERIFY.',
      par: { time: Math.round(9 + 12 * d + (n - 4) * 3) },
      solution: [odd],
    };
  },

  onSit(R, tile) {
    if (!tile) { defaultSit(R, null); return; }
    if (tile.sel) { selectTile(tile, false); return; }
    for (const t of R.tiles) if (t.sel) selectTile(t, false, { quiet: true, text: false });
    selectTile(tile, true, { text: false });
    addTxt(cat.x, cat.y - 54, pick(['suspicious…', 'this one. ✓', 'J\'accuse! ✓', 'fake? ✓']), C.blue);
  },

  drawTile(R, g, t, x, y, s) { spotDrawTile(R, g, t, x, y, s); return true; },

  drawTop(R, g) {
    if (!R.reveal || !R.tiles) return;
    const t = R.tiles.find(u => u.odd), c = cellCenter(t.i), k = clamp((time - R.reveal) / 0.35, 0, 1), e = EASE.outBack(k);
    const r = G.ts * 0.62 * e, pulse = 1 + 0.04 * Math.sin(time * 6);
    g.save(); g.translate(c.x, c.y); g.scale(pulse, pulse);
    g.lineWidth = 7; g.strokeStyle = C.ink; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    g.lineWidth = 4; g.strokeStyle = C.gold; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    if (k > 0.3) { ln(g, [[r * 0.72, r * 0.72], [r * 1.12, r * 1.12]], 11, C.ink); ln(g, [[r * 0.74, r * 0.74], [r * 1.1, r * 1.1]], 6, '#8b5a2b'); }
    g.restore();
    if (k >= 1 && mode !== 'result') { const lbl = 'the fake'; g.font = `700 13px ${FONT}`; const w = g.measureText(lbl).width + 16; rr(g, c.x - w / 2, c.y - G.ts * 0.62 - 26, w, 20, 10, C.gold, 0); txt(lbl, c.x, c.y - G.ts * 0.62 - 15.5, 13, C.ink, 'center', 700); }
  },

  progress: R => `Suspect ${selected().length} / 1 · ${R.tiles.length} ${R.label === 'fish' ? 'fish' : R.label + 's'}`,

  judge(R) {
    R.reveal = time; after(0.05, () => { const c = cellCenter(R.odd); burst(c.x, c.y, C.gold, 8, 170, 4); tone(988, 0.12, 'sine', 0.05); tone(1319, 0.18, 'sine', 0.04, 0, 0.08); });
    const sel = selected(), fill = s => s.replace('{n}', R.label).replace('{w}', R.tweak.what);
    if (sel.length === 1 && sel[0] === R.odd) return { pass: true, verdict: fill(pick(SPOT_PASS)), checked: [R.odd] };
    if (!sel.length) return { pass: false, verdict: fill(`You picked nothing. The fake {n} is still out there. It {w}.`), wrong: [R.odd], checked: [R.odd] };
    return { pass: false, verdict: fill(pick(SPOT_FAIL)), wrong: sel.filter(i => i !== R.odd), checked: [...new Set(sel.concat([R.odd]))] };
  },
});

// tinted copy of an icon (source-atop wash: works without ctx.filter), cached per size
const SPOT_TINT_CACHE = {};
function spotTinted(icon, size, col, a) {
  const P = Math.max(1, Math.round(size * artScaleV)), key = icon + P + col + a + (artReady('icons/' + icon) ? '@' : '#');
  if (SPOT_TINT_CACHE[key]) return SPOT_TINT_CACHE[key];
  const c = document.createElement('canvas'); c.width = c.height = P; const q = c.getContext('2d');
  drawIcon(q, icon, P / 2, P / 2, P);
  q.globalCompositeOperation = 'source-atop'; q.globalAlpha = a; q.fillStyle = col; q.fillRect(0, 0, P, P);
  return SPOT_TINT_CACHE[key] = c;
}
function spotDrawTile(R, g, t, x, y, s) {
  const icon = R.icon, F = SPOT_ICONS[icon], bg = (ICON[icon] || ['indoor'])[0], tw = t.odd ? R.tweak : null, is = s * 0.86;
  if (!artDraw(g, 'tiles/' + bg, x, y, s, s)) { g.fillStyle = BG[bg] || '#dbe5f0'; g.fillRect(x, y, s, s); }
  if (t.nz) { g.fillStyle = t.nz > 0 ? `rgba(255,255,255,${t.nz})` : `rgba(15,22,48,${-t.nz})`; g.fillRect(x, y, s, s); }
  g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
  g.translate(x + s / 2, y + s / 2);
  if (tw && tw.k === 'rot') g.rotate(tw.deg * Math.PI / 180);
  if (tw && tw.k === 'flip') g.scale(-1, 1);
  if (tw && tw.k === 'scale') g.scale(tw.f, tw.f);
  if (tw && tw.k === 'tint') g.drawImage(spotTinted(icon, is, tw.col, tw.a), -is / 2, -is / 2, is, is);
  else drawIcon(g, icon, 0, 0, is);
  // overlays in the icon's 512-unit space
  if (tw && ['hat', 'stache', 'blush', 'eye', 'missing'].includes(tw.k) && artReady('icons/' + icon)) {
    g.scale(is / 512, is / 512); g.translate(-256, -256);
    if (tw.k === 'missing') { const [mx, my, mr] = tw.m.at; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fillStyle = tw.m.col; g.fill(); }
    else if (tw.k === 'hat') spotHat(g, F.hat[0], F.hat[1], F.hat[2]);
    else if (tw.k === 'stache') spotStache(g, F.stache[0], F.stache[1], F.stache[2]);
    else if (tw.k === 'blush') for (const [cx, cy] of F.cheeks) { g.beginPath(); g.ellipse(cx, cy, 24, 14, 0, 0, 7); g.fillStyle = 'rgba(255,110,140,.62)'; g.fill(); }
    else if (tw.k === 'eye') {
      const [ex, ey, er] = F.eyes[tw.e];
      if (F.robo) { g.beginPath(); g.arc(ex, ey, er + 6, 0, 7); g.fillStyle = F.skin; g.fill(); g.beginPath(); g.arc(ex, ey, er * 1.15, 0, 7); g.fillStyle = 'rgba(255,77,109,.25)'; g.fill(); g.beginPath(); g.arc(ex, ey, er * 0.8, 0, 7); g.fillStyle = '#ff4d6d'; g.fill(); g.beginPath(); g.arc(ex - 5, ey - 6, 4, 0, 7); g.fillStyle = '#fff'; g.fill(); }
      else { g.beginPath(); g.arc(ex, ey, er, 0, 7); g.fillStyle = F.skin; g.fill(); g.beginPath(); g.arc(ex, ey + er * 0.35, er * 0.62, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = 9; g.strokeStyle = C.ink; g.lineCap = 'round'; g.stroke(); }
    }
  }
  g.restore();
}
function spotHat(g, x, y, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1.35, 1.35);
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = C.ink;
  g.beginPath(); g.roundRect(-36, -78, 72, 74, 8); g.fillStyle = '#2a3045'; g.fill(); g.stroke();
  g.fillStyle = '#e5484d'; g.fillRect(-32, -26, 64, 14);
  g.beginPath(); g.ellipse(0, -4, 62, 13, 0, 0, 7); g.fillStyle = '#2a3045'; g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-26, -70, 10, 40);
  g.restore();
}
function spotStache(g, x, y, k) {
  g.save(); g.translate(x, y); g.scale(k * 1.25, k * 1.25); g.fillStyle = C.ink;
  for (const sd of [-1, 1]) { g.save(); g.scale(sd, 1); g.beginPath(); g.moveTo(2, -6); g.bezierCurveTo(22, -24, 52, -16, 60, 2); g.bezierCurveTo(64, 10, 56, 14, 52, 6); g.bezierCurveTo(40, 2, 24, 12, 2, 6); g.closePath(); g.fill(); g.restore(); }
  g.restore();
}
