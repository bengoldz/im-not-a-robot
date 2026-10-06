// rounds/match.js — the classic "Select all squares with X". Grid 3x3 -> 4x4 -> 5x5 with d; decoys come from the same
// category as the target more often as d rises (vehicles vs vehicles, animals vs animals). matchSpec / matchJudge are
// shared with timed.js, conveyor.js and falling.js.
const MATCH_TARGETS = [
  { icon: 'fish', label: 'fish' }, { icon: 'car', label: 'cars' }, { icon: 'bus', label: 'buses' }, { icon: 'bicycle', label: 'bicycles' },
  { icon: 'boat', label: 'boats' }, { icon: 'dog', label: 'dogs' }, { icon: 'duck', label: 'ducks' }, { icon: 'cat', label: 'cats' },
  { icon: 'hydrant', label: 'fire hydrants' }, { icon: 'cloud', label: 'clouds' }, { icon: 'umbrella', label: 'umbrellas' }, { icon: 'tree', label: 'trees' },
];
const iconName = k => k === 'trafficlight' ? 'traffic light' : k;
// o: { n (grid size), target (icon), targets (pool), l3 }
function matchSpec(d, rng, o = {}) {
  const n = o.n || (d < 0.34 ? 3 : d < 0.7 ? 4 : 5), N = n * n;
  const tg = o.target ? MATCH_TARGETS.find(t => t.icon === o.target) : rng.pick(o.targets || MATCH_TARGETS);
  const lo = n === 3 ? 2 : n === 4 ? 3 : 4, hi = n === 3 ? 4 : n === 4 ? 6 : 8;
  const k = rng.int(lo, hi), hit = rng.sample([...Array(N).keys()], k);
  const similar = clamp(d * 1.1 - 0.05, 0, 0.9);
  const tiles = [...Array(N).keys()].map(j => ({ icon: hit.includes(j) ? tg.icon : pickDecoy(tg.icon, similar, rng) }));
  return { grid: n, tiles, target: tg.icon, label: tg.label, hit: hit.sort((a, b) => a - b),
    l1: 'Select all squares with', big: tg.label, l3: o.l3 || 'If there are none, sit anyway.' };
}
function matchJudge(R) {
  const sel = selected(), set = new Set(R.hit);
  const wrong = sel.filter(j => !set.has(j)), miss = R.hit.filter(j => !sel.includes(j));
  if (!wrong.length && !miss.length) return { pass: true, verdict: pick([`${cap(R.label)} confirmed. You may proceed, human.`, `Flawless. Almost too flawless.`, `Correct. HUMANCHECK is mildly impressed.`]) };
  const res = { pass: false, wrong: wrong.concat(miss), checked: [...new Set(sel.concat(R.hit))] };
  res.verdict = wrong.length ? `That was a ${iconName(R.tiles[wrong[0]].icon)}. Not ${R.label}. Hmm.` : `You missed ${miss.length === 1 ? 'one' : miss.length}. It saw you. It is hurt.`;
  return res;
}
function matchProgress(R) { return `${selected().length} selected`; }

registerRound({
  id: 'match', name: 'Select all X', minD: 0, weight: 1.4, maxPerRun: 3,
  intro: 'Easy one. Find them, sit on them, walk to VERIFY.',
  generate: (d, rng) => matchSpec(d, rng),
  parTime: R => Math.round(6 + R.cols * R.cols * 0.6),
  judge: matchJudge,
  progress: matchProgress,
});
