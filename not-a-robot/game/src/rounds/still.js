// rounds/still.js — "stand still for 5 seconds" while the cat gets the zoomies (more often with d). Hold SIT to loaf.
registerRound({
  id: 'still', name: 'Stand still', minD: 0.6, weight: 0.7, verify: 'none', loaf: true, hideTimerText: true,
  intro: 'Stand still? YOU? Oh no.',
  generate(d) {
    const need = d < 0.5 ? 5 : 6;
    return { grid: 0, l1: 'Prove you are human:', big: `stand still for ${need} seconds`, l3: 'Easy. Humans do this all the time.', limit: 26,
      need, still: 0, fly: { a: 0 }, zoom: lerp(1.5, 2.2, d) };
  },
  timeoutVerdict: 'Movement detected. Constantly. Suspiciously feline.',
  parTime: R => R.need + 6,
  update(R, dt) {
    const moving = Math.hypot(cat.vx, cat.vy) > 8 || cat.hopT > 0 || cat.dashT > 0;
    if (!key.sit && cat.auto <= 0 && time - lastInputT > 1.2 && Math.random() < dt * R.zoom) { const a = rnd(0, 6.28); cat.auto = rnd(0.35, 0.7); cat.autoD = { x: Math.cos(a), y: Math.sin(a) }; addTxt(cat.x, cat.y - 56, pick(['zoomies!', '(cats can\'t)', 'a bug!', '!!!', 'brb']), C.red); }
    if (moving) { if (R.still > 0.6) addTxt(cat.x, cat.y - 60, 'movement detected', C.red); R.still = 0; } else R.still += dt;
    R.fly.a += dt;
    if (R.timeLeft < 20 && !R.hinted) { R.hinted = true; toastMsg('Hint: cats are liquid. HOLD sit to loaf.', 5); }
    if (R.still >= R.need) finish({ pass: true, verdict: pick([`${cap(['zero', 'one', 'two', 'three', 'four', 'five', 'six'][R.need])} seconds of stillness. Disturbingly loaf-like. Accepted.`, 'Stillness verified. That was a loaf, but fine.']) });
  },
  onSit() {},
  progress: R => `still ${Math.min(R.still, R.need).toFixed(1)} / ${R.need}s`,
  drawOverlay(R) {
    const f = Math.min(1, R.still / R.need);
    rr(ctx, 330, 300, 300, 26, 13, '#e3e8f1', 0); rr(ctx, 330, 300, 300 * f, 26, 13, f >= 1 ? C.green : C.blue, 0);
    txt(`stillness ${R.still.toFixed(1)} / ${R.need.toFixed(1)} s`, 480, 314, 15, f > 0.5 ? '#fff' : C.ink, 'center', 600);
    txt(`${Math.ceil(R.timeLeft)}s left to be human`, 480, 344, 14, C.grey, 'center', 500);
    const fx = cat.x + Math.cos(R.fly.a * 3) * 40, fy = cat.y - 50 + Math.sin(R.fly.a * 5) * 16;
    if (!artDraw(ctx, 'ui/fly', fx - 9, fy - 9, 18, 18)) { circ(ctx, fx, fy, 3, O, 0); ell(ctx, fx - 3, fy - 4, 4, 2, '#ffffffcc', 0); ell(ctx, fx + 3, fy - 4, 4, 2, '#ffffffcc', 0); }
    txt('(do not look at the fly)', 480, 140, 15, C.grey, 'center', 500);
  },
});
