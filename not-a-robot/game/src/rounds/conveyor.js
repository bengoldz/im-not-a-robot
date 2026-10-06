// rounds/conveyor.js — match on rows that slide sideways (alternating directions) and carry the cat; speed scales with d.
registerRound({
  id: 'conveyor', name: 'Conveyor', minD: 0.4, weight: 1,
  intro: 'The squares are moving. That is normal internet behavior.',
  generate(d, rng) {
    const s = matchSpec(d, rng, { n: d < 0.75 ? 4 : 5, targets: MATCH_TARGETS.filter(t => ['bus', 'car', 'fish', 'boat', 'duck', 'bicycle'].includes(t.icon)), l3: 'The squares are on a conveyor. Normal.' });
    s.speed = Math.round(lerp(26, 46, d));
    return s;
  },
  update(R, dt) {
    for (let r = 0; r < G.rows; r++) G.rowOff[r] += R.speed * (r % 2 ? -1 : 1) * dt;
    if (cat.hopT <= 0 && cat.fall <= 0) { const t = catCell(); if (t >= 0) cat.x = clamp(cat.x + R.speed * ((Math.floor(t / G.cols) % 2) ? -1 : 1) * dt, PANEL.x + 14, PANEL.x + PANEL.w - 14); }
  },
  parTime: R => Math.round(8 + R.cols * R.cols * 0.7),
  judge: matchJudge,
  progress: matchProgress,
});
