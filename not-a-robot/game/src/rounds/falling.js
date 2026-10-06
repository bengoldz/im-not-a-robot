// rounds/falling.js — match where every square you leave crumbles away (faster with d). Hop over holes.
function crumbleTile(R, i) { const t = i >= 0 ? R.tiles[i] : null; if (t && t.state === 'ok') { t.state = 'crumble'; t.t = R.crumble; } }
registerRound({
  id: 'falling', name: 'Falling floor', minD: 0.55, weight: 1,
  intro: 'The floor is leaving. Hop over the holes!',
  generate(d, rng) {
    const s = matchSpec(d, rng, { n: d < 0.8 ? 4 : 5, l3: 'Squares fall away behind you. HOP gaps.' });
    s.crumble = lerp(0.6, 0.35, d);
    return s;
  },
  onStep(R, from) { crumbleTile(R, from); },
  onHop(R, from, to) { if (to !== from) crumbleTile(R, from); },
  update(R, dt) {
    // walking off the sides of the grid (inside its vertical band) is a fall too
    if (cat.hopT > 0 || cat.fall > 0) return;
    const t = catCell(), by = cat.y - CAT_BODY, inGridY = by > G.y - 2 && by < G.y + G.h + 4;
    if (t < 0 && inGridY) { R.offT = (R.offT || 0) + dt; if (R.offT > 0.09) catFall(); } else R.offT = 0;
  },
  parTime: R => Math.round(8 + R.cols * R.cols * 0.7),
  judge: matchJudge,
  progress: matchProgress,
});
