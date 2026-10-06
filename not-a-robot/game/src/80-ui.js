// ===== 80-ui.js: background, robot panel, HUD, CAPTCHA panel (header, footer, title + end floors), overlays =====
function txt(s, x, y, size, col, align = 'left', weight = 600, font = FONT) { ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
function wrap(s, maxW, size, weight = 500, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`; const words = String(s).split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function fitSize(s, maxW, size, weight = 700) { ctx.font = `${weight} ${size}px ${FONT}`; while (size > 12 && ctx.measureText(s).width > maxW) { size -= 1; ctx.font = `${weight} ${size}px ${FONT}`; } return size; }
function ellipsize(s, maxW, size, weight = 500) { ctx.font = `${weight} ${size}px ${FONT}`; if (ctx.measureText(s).width <= maxW) return s; while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; }
const inRound = () => R && (mode === 'play' || mode === 'verifying' || mode === 'result');
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function drawBackground() {
  ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff10'; for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) ctx.fillRect(x, y, 2, 2);
  ctx.strokeStyle = '#5ff3ff18'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = 40 + i * 90, o = (time * 40 + i * 70) % 260; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 20); ctx.stroke(); ctx.fillStyle = '#5ff3ff55'; ctx.fillRect(700 + o, y + 20 * (700 + o) / W - 2, 6, 4); }
}
function drawLeft() {
  const hidden = inRound() && R.def.hideBot;
  if (!hidden) drawBot(bot.x, bot.y, 1, bot.mood);
  else { txt('(he\'s on the grid,', 135, 420, 16, '#9fb0d6', 'center', 500); txt('pretending)', 135, 440, 16, '#9fb0d6', 'center', 500); }
  if (mode === 'title' || mode === 'denied') { ctx.save(); ctx.translate(135, 272); ctx.rotate(-0.06); rr(ctx, -78, -18, 156, 36, 4, '#fff7d6'); txt('PLS LET ME IN', 0, 1, 16, C.ink, 'center', 700); ctx.restore(); }
  if (bot.say && bot.sayT > 0) {
    const lines = wrap(bot.say, 210, 17, 500), bh = lines.length * 22 + 20, by = 210 - bh;
    rr(ctx, 20, by, 230, bh, 14, '#ffffff'); poly(ctx, [[110, by + bh - 2], [130, by + bh - 2], [122, by + bh + 16]], '#ffffff', 0);
    lines.forEach((l, i) => txt(l, 34, by + 20 + i * 22, 17, C.ink, 'left', 500));
  }
  txt('your robot friend', 135, 520, 15, '#7d8bb3', 'center', 500);
}
function drawHUD() {
  const x = 712, w = 232, len = RUN ? RUN.slots.length : RUN_LEN;
  rr(ctx, x, 14, w, 276, 16, C.navy2, 0);
  const label = RUN && RUN.dev ? `DEV: ${RUN.slots[0].id} d=${(+RUN.slots[0].genD).toFixed(2)}` : RUN && RUN.daily ? `DAILY HUMANCHECK #${RUN.day}` : 'HUMANCHECK™ session';
  txt(label, x + 16, 36, 15, RUN && RUN.daily ? C.gold : '#9fb0d6', 'left', RUN && RUN.daily ? 700 : 500);
  const rd = mode === 'title' || !RUN ? '—' : `${Math.min(roundIdx + 1, len)}/${len}`;
  txt('ROUND', x + 16, 66, 16, '#9fb0d6', 'left', 600); txt(rd, x + w - 16, 66, 28, '#fff', 'right', 700);
  txt('VERIFIED', x + 16, 98, 16, '#9fb0d6', 'left', 600); txt(String(verified), x + w - 16, 98, 28, C.green, 'right', 700);
  txt('STRIKES', x + 16, 130, 16, '#9fb0d6', 'left', 600);
  for (let i = 0; i < 3; i++) { const bx = x + w - 108 + i * 34; rr(ctx, bx, 116, 28, 28, 6, i < strikes ? C.red : '#2c3963', 0); if (i < strikes) { ln(ctx, [[bx + 8, 124], [bx + 20, 136]], 3, '#fff'); ln(ctx, [[bx + 20, 124], [bx + 8, 136]], 3, '#fff'); } }
  txt('BEST', x + 16, 162, 16, '#9fb0d6', 'left', 600); txt(`${best}/${RUN_LEN}`, x + w - 16, 162, 22, '#fff', 'right', 700);
  // HUMAN SCORE: consecutive PERFECT rounds, gentle glow (no flashing)
  const st = RUN ? RUN.streak : 0;
  txt('HUMAN SCORE', x + 16, 194, 16, '#9fb0d6', 'left', 600); txt(st ? `×${st}` : '—', x + w - 16, 194, 18, st ? C.gold : '#5d6a93', 'right', 700);
  for (let i = 0; i < 6; i++) {
    const on = i < st, px = x + 16 + i * 35;
    if (on) { ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 8 + 3 * Math.sin(time * 2 + i * 0.5); rr(ctx, px, 210, 29, 8, 4, C.gold, 0); ctx.restore(); }
    else rr(ctx, px, 210, 29, 8, 4, '#2c3963', 0);
  }
  txt('TIME', x + 16, 256, 16, '#9fb0d6', 'left', 600); txt(RUN && mode !== 'title' ? fmtTime(RUN.elapsed) : '—', x + w - 16, 256, 16, '#9fb0d6', 'right', 600);
  const ctl = [['WASD / ↑↓←→', 'walk'], ['SPACE', 'hop'], ['SHIFT', 'dash'], ['C / X', 'sit = select'], ['VERIFY pad', 'walk onto it']];
  rr(ctx, x, 300, w, 176, 16, '#151e3c', 0); txt('CONTROLS', x + 16, 320, 15, '#9fb0d6', 'left', 600);
  ctl.forEach((c, i) => { txt(c[0], x + 16, 346 + i * 26, 16, C.gold, 'left', 600, FONT); txt(c[1], x + w - 16, 346 + i * 26, 16, '#dbe3ff', 'right', 500); });
  txt('Movement is the only input.', x + w / 2, 500, 14, '#7d8bb3', 'center', 500);
}
function drawPanelBase() {
  rr(ctx, PANEL.x + 6, PANEL.y + 8, PANEL.w, PANEL.h, 10, 'rgba(0,0,0,.35)', 0);
  rr(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 10, C.panel, 0);
  let hc = C.blue; if (mode === 'denied') hc = C.red; if (mode === 'win') hc = C.green;
  ctx.save(); ctx.beginPath(); ctx.roundRect(HEAD.x + 8, HEAD.y + 8, HEAD.w - 16, HEAD.h - 8, 6); ctx.fillStyle = hc; ctx.fill(); ctx.restore();
  ctx.fillStyle = C.line; ctx.fillRect(PANEL.x + 10, 472, PANEL.w - 20, 2);
}
function drawHeader() {
  const hx = HEAD.x + 22;
  if (mode === 'title') { txt('HUMANCHECK™', hx, 40, 30, '#fff', 'left', 700); txt('Verify you are human to continue to THE INTERNET.', hx, 72, 15, '#dbe7ff', 'left', 500); return; }
  if (mode === 'denied') { txt('ACCESS DENIED', hx, 40, 30, '#fff', 'left', 700); txt('Reason: suspected robot. And cat.', hx, 72, 16, '#ffe0e0', 'left', 500); return; }
  if (mode === 'win') { txt('ACCESS GRANTED', hx, 40, 30, '#fff', 'left', 700); txt('Welcome, definitely-human visitor(s).', hx, 72, 16, '#e0ffe9', 'left', 500); return; }
  if (!R) return;
  // progress readout pill (bottom right of the header)
  let pw = 0; const prog = R.def.progress ? String(R.def.progress(R) || '') : '';
  if (prog) { ctx.font = `700 12px ${FONT}`; pw = ctx.measureText(prog).width + 20; rr(ctx, HEAD.x + HEAD.w - 18 - pw, 71, pw, 18, 9, '#ffffff33', 0); txt(prog, HEAD.x + HEAD.w - 18 - pw / 2, 80.5, 12, '#fff', 'center', 700); }
  const maxW = R.dog ? 300 : 370, n = REDUCED ? 999 : Math.floor(R.typeT * 70);
  const l1 = R.l1.slice(0, Math.max(0, n)), big = R.big.slice(0, Math.max(0, n - R.l1.length));
  txt(l1, hx, 32, fitSize(R.l1, maxW, 15, 500), '#dbe7ff', 'left', 500);
  const bs = fitSize(R.big, maxW, 28); txt(big, hx, 56, bs, '#fff', 'left', 700);
  if (n < R.l1.length + R.big.length && Math.floor(time * 6) % 2 === 0) { ctx.font = `700 ${bs}px ${FONT}`; const cx = hx + (big ? ctx.measureText(big).width : 0) + 2; ctx.fillStyle = '#fff'; ctx.fillRect(cx, 44, 2, 24); }
  const l3W = Math.min(maxW, 370 - (pw ? pw + 10 : 0));
  const l3s = fitSize(R.l3 || '', l3W, 13, 500); txt(ellipsize(R.l3 || '', l3W, l3s, 500), hx, 80, l3s, '#c3d6ff', 'left', 500);
  if (R.dog) { drawIcon(ctx, 'dog', 652, 70, 38); rr(ctx, 620, 22, 46, 26, 12, '#fff', 2); txt('?', 643, 35, 18, C.ink, 'center', 700); circ(ctx, 640, 54, 3, '#fff', 1.5); }
  if (R.limit && mode === 'play') {
    const f = R.timeLeft / R.limit; ctx.fillStyle = '#ffffff33'; ctx.fillRect(HEAD.x + 8, HEAD.y + HEAD.h - 4, HEAD.w - 16, 4);
    ctx.fillStyle = f < 0.3 ? '#ff8a8a' : '#fff'; ctx.fillRect(HEAD.x + 8, HEAD.y + HEAD.h - 4, (HEAD.w - 16) * f, 4);
    if (!R.def.hideTimerText) txt(Math.ceil(R.timeLeft) + 's', HEAD.x + HEAD.w - 22, 32, 18, f < 0.3 ? '#ffd0d0' : '#fff', 'right', 700);
  }
}
function drawFooter() {
  const fy = 501;
  if (inRound()) {
    const icons = { reload: '⟳', audio: '♪', info: 'i' };
    for (const k in FOOTPADS) { const p = FOOTPADS[k]; circ(ctx, p.x, p.y, 14, cat.pad === k ? '#dfe8ff' : '#eef1f6', 2); txt(icons[k], p.x, p.y + 1, 16, k === 'audio' && !musicOn ? '#c0c6d2' : C.grey, 'center', 700); }
    const disabled = R.def.verify === 'none' || R.def.verify === 'auto', on = cat.pad === 'verify';
    rr(ctx, VERIFY.x, VERIFY.y + (on ? 3 : 0), VERIFY.w, VERIFY.h, 6, disabled ? '#b6c2d9' : on ? C.blueD : C.blue, 0);
    if (!on) { ctx.fillStyle = disabled ? '#98a5bf' : C.blueD; ctx.fillRect(VERIFY.x + 6, VERIFY.y + VERIFY.h, VERIFY.w - 12, 3); }
    txt(R.def.verify === 'auto' ? 'AUTO' : 'VERIFY', VERIFY.x + VERIFY.w / 2, VERIFY.y + VERIFY.h / 2 + (on ? 3 : 0), 18, '#fff', 'center', 700);
    drawLogo(408, fy, 0.75);
  } else { drawLogo(300, fy, 1); txt('Privacy · Terms · Meow', 660, fy, 13, C.grey, 'right', 500); }
}
function drawLogo(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const lk = 31 / 235; // ui/logo.svg shield spans y 13..248 of 256 -> same ~31 px tall shield as before
  if (!artDraw(ctx, 'ui/logo', -128 * lk, 1 - 130.5 * lk, 256 * lk, 256 * lk)) {
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(13, -9); ctx.lineTo(11, 6); ctx.quadraticCurveTo(6, 13, 0, 16); ctx.quadraticCurveTo(-6, 13, -11, 6); ctx.lineTo(-13, -9); ctx.closePath(); sh(ctx, '#3a7bf0', 2);
    ell(ctx, 0, 0, 7, 5, '#fff', 0); circ(ctx, 0, 0, 3, C.ink, 0);
  }
  txt('HUMANCHECK™', 20, 1, 15, C.grey, 'left', 700); ctx.restore();
}
function drawCheckbox(x, y, size, checked, label, labelSize) {
  const k = size / 207; // checkbox svg: box spans 24..231 of 256
  if (!artDraw(ctx, checked ? 'ui/checkbox_checked' : 'ui/checkbox_empty', x - 24 * k, y - 24 * k, 256 * k, 256 * k)) {
    rr(ctx, x, y, size, size, 6, '#fff', 3);
    if (checked) ln(ctx, [[x + size * 0.18, y + size * 0.52], [x + size * 0.42, y + size * 0.76], [x + size * 0.84, y + size * 0.22]], size * 0.13, C.green);
  }
  if (label) txt(label, x + size + 16, y + size / 2, labelSize, C.ink, 'left', 600);
}
function padBox(r, on, fill) { rr(ctx, r.x, r.y, r.w, r.h, 8, fill, 0); ctx.strokeStyle = on ? C.blue : C.line; ctx.lineWidth = 3; ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3); }
function spinner(x, y, r, w) { ctx.save(); ctx.translate(x, y); ctx.rotate(time * 8); ctx.beginPath(); ctx.arc(0, 0, r, 0, 4.5); ctx.lineWidth = w; ctx.strokeStyle = C.blue; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }
function drawTitleFloor() {
  const s = TPADS.start, on = cat.pad === 'start';
  padBox(s, on, on ? '#eef4ff' : '#f2f4f8');
  const checking = mode === 'verifying' && V && V.res && V.res.start;
  if (checking && !V.res.daily) { spinner(s.x + 54, s.y + 54, 22, 6); txt("I'm not a robot", s.x + 98, s.y + 54, 30, C.ink, 'left', 600); }
  else drawCheckbox(s.x + 28, s.y + 28, 52, false, "I'm not a robot", 30);
  drawLogo(s.x + s.w - 126, s.y + s.h - 18, 0.7);
  txt('SIT here to start', s.x + 98, s.y + 86, 14, C.grey, 'left', 500);
  const d = TPADS.daily, dn = cat.pad === 'daily', di = dailyInfo();
  padBox(d, dn, dn ? '#fff6dc' : '#f2f4f8');
  if (checking && V.res.daily) spinner(d.x + d.w / 2, d.y + 40, 16, 5);
  else { txt('DAILY', d.x + d.w / 2, d.y + 32, 22, C.ink, 'center', 700); txt('#' + di.day, d.x + d.w / 2, d.y + 56, 16, '#c98a00', 'center', 700); }
  txt('step + SIT', d.x + d.w / 2, d.y + 80, 13, C.grey, 'center', 500);
  const h = TPADS.howto, ho = cat.pad === 'howto';
  padBox(h, ho, howto ? '#e8efff' : '#f2f4f8');
  txt('HOW TO', h.x + h.w / 2, h.y + 38, 22, C.ink, 'center', 700); txt('step to read', h.x + h.w / 2, h.y + 70, 13, C.grey, 'center', 500);
  const lines = howto ? ['You are the cat. The squares are the floor.', 'SIT on a square to select it (sit again to unselect).', 'Walk onto VERIFY to submit. HOP gaps, DASH to slide.', '12 checks. 3 strikes = ACCESS DENIED.']
    : ['Help your robot friend sneak onto the internet.', 'Walk with arrows / WASD. Sit with C or X.', 'DAILY: the same 12 checks for everyone today.'];
  lines.slice(0, 4).forEach((l, i) => txt(l, 480, 382 + i * 22, 15, C.ink, 'center', 500));
}
function drawEndFloor() {
  const win = mode === 'win', len = RUN ? RUN.slots.length : RUN_LEN;
  txt(win ? 'Your robot friend is online.' : 'Your robot friend has been flagged.', 480, 128, 20, C.ink, 'center', 600);
  txt(`Verified ${verified}/${len} · strikes ${strikes}/3 · best ${best}/${RUN_LEN}`, 480, 154, 16, C.grey, 'center', 500);
  if (RUN) {
    txt(`Perfect ${RUN.perfects} · best streak ${RUN.bestStreak} · time ${fmtTime(RUN.elapsed)} · ${RUN.daily ? 'DAILY #' + RUN.day : 'seed ' + RUN.seed}`, 480, 176, 13, C.grey, 'center', 500);
    // one square per round: green check, gold star = perfect, red x, grey = not reached
    const sz = 20, gp = 6, x0 = 480 - (len * (sz + gp) - gp) / 2;
    for (let i = 0; i < len; i++) {
      const r = RUN.results[i], x = x0 + i * (sz + gp), y = 190;
      rr(ctx, x, y, sz, sz, 5, !r ? '#e3e8f1' : r.perfect ? C.gold : r.pass ? C.green : C.red, 0);
      if (r && r.pass) ln(ctx, [[x + 5, y + 10], [x + 9, y + 14], [x + 15, y + 6]], 2.5, '#fff');
      else if (r) { ln(ctx, [[x + 6, y + 6], [x + 14, y + 14]], 2.5, '#fff'); ln(ctx, [[x + 14, y + 6], [x + 6, y + 14]], 2.5, '#fff'); }
    }
  }
  if (win) {
    rr(ctx, 370, 220, 220, 112, 8, '#fff', 3); ctx.fillStyle = '#e6ecf5'; ctx.fillRect(372, 222, 216, 18); circ(ctx, 384, 231, 4, C.red, 0); circ(ctx, 398, 231, 4, C.gold, 0); circ(ctx, 412, 231, 4, C.green, 0);
    for (let i = 0; i < 3; i++) ctx.drawImage(iconTile('cat', 56), 384 + i * 66, 248, 56, 56);
    txt('cat_videos.html', 480, 320, 13, C.grey, 'center', 500);
  } else {
    for (let i = 0; i < 3; i++) { const x = 368 + i * 82; rr(ctx, x, 224, 60, 60, 6, '#fbe5e5', 0); ln(ctx, [[x + 17, 241], [x + 43, 267]], 6, C.red); ln(ctx, [[x + 43, 241], [x + 17, 267]], 6, C.red); }
    txt('"suspected robot"', 480, 310, 18, C.red, 'center', 600);
  }
  const r = TPADS.retry, on = cat.pad === 'retry';
  padBox(r, on, on ? '#eef4ff' : '#f2f4f8');
  drawCheckbox(r.x + 24, r.y + 22, 46, false, win ? 'Verify again (why?)' : "I'm STILL not a robot", 24);
  txt('SIT here to try again', 480, 452, 14, C.grey, 'center', 500);
}
function drawOverlay() {
  if (mode === 'verifying' && V && !(V.res && V.res.start)) {
    if (V.phase === 'wait') {
      ctx.fillStyle = 'rgba(247,249,252,.82)'; ctx.fillRect(GRID.x - 6, GRID.y - 4, GRID.w + 12, GRID.h + 8);
      spinner(480, 260, 30, 7);
      txt('Verifying…', 480, 320, 24, C.ink, 'center', 700);
      txt(V.async ? 'consulting the HUMANCHECK oracle' : 'counting whiskers', 480, 348, 15, C.grey, 'center', 500);
    } else if (V.phase === 'sweep') {
      const S = V.sweep, t = `checking squares… ${S.k}/${S.order.length}`; ctx.font = `600 13px ${FONT}`; const w = ctx.measureText(t).width + 28; rr(ctx, 480 - w / 2, 446, w, 22, 11, C.ink, 0); txt(t, 480, 457, 13, '#fff', 'center', 600);
    }
  }
  if (mode === 'result') {
    const k = Math.min(1, RES.t * 5), ok = RES.pass;
    ctx.globalAlpha = k; ctx.fillStyle = ok ? 'rgba(232,250,240,.9)' : 'rgba(253,236,236,.9)'; ctx.fillRect(GRID.x - 6, GRID.y - 4, GRID.w + 12, GRID.h + 8); ctx.globalAlpha = 1;
    wrap(RES.verdict, 330, 18, 500).forEach((l, i) => txt(l, 480, 276 + i * 24, 18, C.ink, 'center', 500));
    if (R && R.par && ok) { const pk = Object.keys(R.par)[0], pv = R.par[pk], have = pk === 'time' ? R.stats.t.toFixed(1) + 's' : R.stats[pk]; txt(`${RES.perfect ? 'PERFECT · ' : ''}${pk === 'time' ? 'time' : pk} ${have} · par ${pk === 'time' ? pv + 's' : pv}`, 480, 392, 13, RES.perfect ? '#c98a00' : C.grey, 'center', 600); }
    if (!ok && strikes < 3) txt(`strike ${strikes} of 3`, 480, 410, 15, C.red, 'center', 600);
  }
  if (toast.t > 0 && toast.text) {
    const a = Math.min(1, toast.t * 3); ctx.globalAlpha = a;
    const lines = wrap(toast.text, 340, 15, 600); const h = lines.length * 20 + 14;
    rr(ctx, 300, 432 - h, 360, h, 10, C.ink, 0); lines.forEach((l, i) => txt(l, 480, 432 - h + 17 + i * 20, 15, '#fff', 'center', 600));
    ctx.globalAlpha = 1;
  }
}
function render() {
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); // RK, exact for the rounded backing store
  ctx.save();
  const [sx, sy] = shakeOffset(); if (sx || sy) ctx.translate(sx, sy);
  drawBackground(); drawLeft(); drawHUD();
  drawPanelBase(); drawHeader();
  if (mode === 'title' || (mode === 'verifying' && V && V.res && V.res.start)) drawTitleFloor();
  else if (mode === 'denied' || mode === 'win') drawEndFloor();
  else { drawGrid(); drawCatHover(); if (R && R.def.drawOverlay) R.def.drawOverlay(R, ctx); }
  drawFooter();
  drawCats();
  if (inRound() && R.def.drawTop) R.def.drawTop(R, ctx);
  drawParts(); drawOverlay(); drawStamps();
  ctx.restore();
}
