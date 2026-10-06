// rounds/timed.js — match against the clock; the timer shrinks with d (3x3 10s -> 7s, then 4x4 11s -> 8s).
registerRound({
  id: 'timed', name: 'Timed match', minD: 0.25, weight: 1,
  intro: 'It\'s timed! Run! Er, walk briskly, like a human!',
  generate(d, rng) {
    const n = d < 0.6 ? 3 : 4, s = matchSpec(d, rng, { n, l3: 'Quickly. Humans are fast.' });
    s.limit = n === 3 ? Math.round(lerp(10, 7, d / 0.6)) : Math.round(lerp(11, 8, (d - 0.6) / 0.4));
    return s;
  },
  parTime: R => Math.round(R.limit * 0.6),
  timeoutVerdict: 'Verification expired. Too slow. Suspiciously slow.',
  judge: matchJudge,
  progress: matchProgress,
});
