// rounds/boss.js — always the last slot: "select all squares containing a robot" while your robot friend hides on the
// grid, hopping between squares. Selecting him = FRIEND BANNED.
registerRound({
  id: 'boss', name: 'Final check', boss: true, minD: 0, weight: 0, hideBot: true, mood: 'nervous',
  intro: 'Okay. Act natural. I am a... lamp. Don\'t select me.',
  generate(d, rng) {
    const n = 4, N = n * n, k = rng.int(4, 5), hit = rng.sample([...Array(N).keys()], k).sort((a, b) => a - b);
    const others = ICONS.filter(x => !['robot', 'toaster'].includes(x));
    return { grid: n, tiles: [...Array(N).keys()].map(j => ({ icon: hit.includes(j) ? 'robot' : rng.pick(others) })), hit, friendStart: rng.pick(hit),
      hopEvery: [lerp(3.4, 2.6, d), lerp(4.6, 3.6, d)],
      l1: 'FINAL CHECK. Select all squares containing', big: 'a robot', l3: 'All of them. Every single robot.' };
  },
  enter(R) { R.friend = { tile: R.friendStart, x: 0, y: 0, moveT: 3.5, hop: 0 }; },
  parTime: () => 22,
  update(R, dt) {
    const f = R.friend; f.moveT -= dt;
    if (f.moveT <= 0) {
      f.moveT = R.rng.f(R.hopEvery[0], R.hopEvery[1]);
      const nb = neighbors4(f.tile).filter(i => !R.tiles[i].sel), bots = nb.filter(i => R.tiles[i].icon === 'robot');
      if (nb.length) { f.prev = f.tile; f.tile = (bots.length && R.rng.chance(0.6)) ? R.rng.pick(bots) : R.rng.pick(nb); f.hop = 1; SFX.beep(); }
      if (R.tiles[f.tile].sel) say('Uh. I am standing on a checked square. Is that bad?', 'nervous', 3);
    }
    const p = cellXY(f.tile), tx = p.x + G.ts / 2, ty = p.y + G.ts * 0.8;
    if (!f.x) { f.x = tx; f.y = ty; } f.x += (tx - f.x) * Math.min(1, dt * 6); f.y += (ty - f.y) * Math.min(1, dt * 6); f.hop = Math.max(0, f.hop - dt * 2.5);
  },
  onSit(R, tile) {
    defaultSit(R, tile);
    if (tile && tile.sel && tile.i === R.friend.tile) { say('Hey! HEY! That\'s me! Unsit! UNSIT!', 'nervous', 3); SFX.beep(); }
  },
  drawOverlay(R) {
    const f = R.friend; if (!f || !f.x) return;
    const sel = R.tiles[f.tile].sel;
    ctx.save(); ctx.translate(0, -Math.sin(f.hop * Math.PI) * 16); drawBot(f.x, f.y, 0.42, sel ? 'nervous' : 'neutral', 'friend'); ctx.restore();
    if (sel) txt('!', f.x + 22, f.y - 76, 26, C.red, 'center', 700);
  },
  judge(R) {
    // he freezes when you verify: judge the square he is VISIBLY on. Caught mid-hop (still nearer his old square), the hop
    // is undone; otherwise he lands. Either way he snaps onto the judged square.
    const f = R.friend, at = i => { const p = cellXY(i); return { x: p.x + G.ts / 2, y: p.y + G.ts * 0.8 }; };
    if (f.prev != null && f.x) { const a = at(f.tile), b = at(f.prev); if (Math.hypot(f.x - b.x, f.y - b.y) < Math.hypot(f.x - a.x, f.y - a.y)) f.tile = f.prev; }
    if (f.x) { const p = at(f.tile); f.x = p.x; f.y = p.y; } f.hop = 0;
    const sel = selected(), set = new Set(R.hit), ft = f.tile;
    if (sel.includes(ft)) return { pass: false, verdict: 'Robot detected: your friend. Banned for 1000 years.', banned: true, wrong: [ft] };
    const want = R.hit.filter(j => j !== ft), wrong = sel.filter(j => !set.has(j)), miss = want.filter(j => !sel.includes(j));
    if (!wrong.length && !miss.length) return { pass: true, verdict: 'All robots removed. Only humans remain. Welcome.' };
    if (wrong.length) return { pass: false, verdict: `That is a ${iconName(R.tiles[wrong[0]].icon)}. Not a robot. Rude.`, wrong: wrong.concat(miss) };
    return { pass: false, verdict: 'A robot slipped through. We are... checking who.', wrong: miss };
  },
  progress: R => `${selected().length} selected`,
});
