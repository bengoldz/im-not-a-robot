// rounds/checkbox.js — "Please click the checkbox": it runs away from the cat (faster with d, tires over time). No grid,
// no VERIFY pad: sitting next to it ends the round.
registerRound({
  id: 'checkbox', name: 'Runaway checkbox', minD: 0.3, weight: 0.8, verify: 'none',
  intro: 'The checkbox is scared of you. Sit on it. Gently.',
  generate(d) {
    return { grid: 0, l1: 'Please', big: 'click the checkbox', l3: 'Sit on it. It may be shy.', limit: Math.round(lerp(24, 18, d)), speed: lerp(215, 290, d),
      box: { x: 480, y: 220, vx: 0, vy: 0, wig: 0, checked: false } };
  },
  timeoutVerdict: 'Checkbox escaped. It is living its best life now.',
  parTime: R => Math.round(R.limit * 0.5),
  update(R, dt) {
    const b = R.box, dx = b.x - cat.x, dy = b.y - (cat.y - 10), d = Math.hypot(dx, dy) || 1;
    const tired = Math.min(0.55, (R.limit - R.timeLeft) / 30), sp = R.speed * 1.1 * (1 - tired);
    if (d < 175) {
      let ax = dx / d, ay = dy / d; const cx = 480 - b.x, cy = 286 - b.y;
      if (b.x < 330 || b.x > 630) ay += Math.sign(cy || 1) * 0.9 + Math.sign(dy || 1) * 0.3;
      if (b.y < 140 || b.y > 430) ax += Math.sign(cx || 1) * 0.9 + Math.sign(dx || 1) * 0.3;
      const l = Math.hypot(ax, ay) || 1; b.vx += (ax / l * sp - b.vx) * Math.min(1, dt * 6); b.vy += (ay / l * sp - b.vy) * Math.min(1, dt * 6);
      if (Math.random() < dt * 0.8) addTxt(b.x, b.y - 40, pick(['nope!', 'eek', 'no thx', 'bye']), C.red);
    } else { b.vx *= 0.9; b.vy *= 0.9; }
    b.x = clamp(b.x + b.vx * dt, 312, 648); b.y = clamp(b.y + b.vy * dt, 128, 448); b.wig += dt * (d < 175 ? 20 : 3);
  },
  onSit(R) {
    const b = R.box;
    if (Math.abs(cat.x - b.x) < 44 && Math.abs(cat.y - 10 - b.y) < 44) {
      SFX.pop(4); burst(b.x, b.y, C.green, 8, 200); addP(b.x, b.y, 16, C.green, 160); b.checked = true;
      finish({ pass: true, verdict: pick(['Checkbox caught. That is the most human thing we have seen.', 'Checked. The checkbox will need therapy.']) });
    } else { addTxt(cat.x, cat.y - 50, 'missed!', C.red); SFX.desel(); }
  },
  drawOverlay(R) {
    const b = R.box, wob = Math.sin(b.wig) * 4;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.sin(b.wig * 0.7) * 0.08);
    // ui/runner_*.svg (256x320): box 150 units at x 53..203, y 36..186 (centre 128,111) -> the old 60x60 box
    const rk = 0.4, rn = b.checked ? 'ui/runner_checked' : Math.sin(b.wig) >= 0 ? 'ui/runner_0' : 'ui/runner_1';
    const art = artDraw(ctx, rn, -128 * rk, -111 * rk + wob * 0.3, 256 * rk, 320 * rk);
    if (!art) {
      rr(ctx, -30, -30 + wob * 0.3, 60, 60, 8, '#fff', 4); if (b.checked) ln(ctx, [[-18, 0], [-4, 14], [20, -16]], 8, C.green);
      ln(ctx, [[-14, 30], [-20 - wob, 44]], 4); ln(ctx, [[14, 30], [20 + wob, 44]], 4);
      circ(ctx, -10, -6, 5, '#fff', 2); circ(ctx, 10, -6, 5, '#fff', 2); circ(ctx, -9, -5, 2.4, O, 0); circ(ctx, 11, -5, 2.4, O, 0);
    }
    ctx.restore(); txt("I'm not a robot", b.x, art ? Math.min(b.y + 92, 518) : b.y + 58, 15, C.grey, 'center', 600); // art legs are longer: label sits below the feet
  },
});
