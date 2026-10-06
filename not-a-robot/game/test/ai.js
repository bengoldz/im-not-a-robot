// There is NO live AI in the game. This test proves it never touches window.claude (a spy getter counts every access,
// including `'claude' in window`-style probes via a Proxy on the spy object), while playing the title screen, a full
// scripted run and many absurd rounds. It also checks the scripted absurd pool: >= 16 prompts, varied, every generated
// board has accepted and rejected squares, and the scripted judge passes / fails with the prompt's own verdicts.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    window.__claudeTouches = [];
    const spy = new Proxy({}, { get(t, k) { window.__claudeTouches.push('get .' + String(k)); return undefined; }, has(t, k) { window.__claudeTouches.push('has ' + String(k)); return false; } });
    Object.defineProperty(window, 'claude', { configurable: false, get() { window.__claudeTouches.push('window.claude read'); return spy; }, set() { window.__claudeTouches.push('window.claude write'); } });
  });
  await p.goto(process.env.GAME_URL || 'file:///home/user/jam/not-a-robot/game/dist/index.html'); await p.waitForTimeout(800);
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const r = await p.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    const out = { fails: [] }, F = m => out.fails.push(m);
    // title: every pad is reachable, no AI pad
    out.pads = Object.keys(TPADS);
    if (TPADS.ai) F('TPADS still has an ai pad');
    for (const k of ['daily', 'howto']) { const a = TPADS[k]; BOT.walkTo(a.x + a.w / 2, a.y + a.h / 2, { tol: 10 }); BOT.frame(3); if (cat.pad !== k) F('could not stand on pad ' + k); }
    // the absurd pool
    out.prompts = ABSURD.length; if (ABSURD.length < 16) F('only ' + ABSURD.length + ' absurd prompts');
    for (const a of ABSURD) {
      if (!a.l1 || !a.big || a.pass.length < 2 || a.fail.length < 2) F('incomplete prompt ' + a.big);
      const bad = a.acc.filter(k => !ICONS.includes(k)); if (bad.length) F(a.big + ': unknown icons ' + bad);
      if (/\bAI\b|claude/i.test(JSON.stringify(a))) F('prompt mentions AI: ' + a.big);
    }
    const seen = new Set();
    for (let s = 0; s < 120; s++) for (const d of [0, 0.6]) {
      DEV.play('absurd', d, 5000 + s); BOT.frame(30);
      seen.add(R.big);
      const acc = R.acc, rej = R.tiles.map((t, i) => i).filter(i => !acc.includes(i));
      if (!acc.length || !rej.length) { F(`seed ${s} d ${d}: acc ${acc.length} rej ${rej.length}`); continue; }
      if (R.src || R.gen) F('round still has AI fields');
      // judge directly: one accepted square passes with the prompt's own verdict; one rejected square fails
      R.tiles.forEach(t => t.sel = false); R.tiles[acc[0]].sel = true;
      const ok = R.def.judge(R); if (!ok.pass || !R.a.pass.includes(ok.verdict) || typeof ok.then === 'function') F(`seed ${s}: accepted square not passed (${ok.verdict})`);
      R.tiles[acc[0]].sel = false; R.tiles[rej[0]].sel = true;
      const no = R.def.judge(R); if (no.pass || !R.a.fail.includes(no.verdict) || !no.wrong.includes(rej[0])) F(`seed ${s}: rejected square not failed (${no.verdict})`);
      R.tiles[rej[0]].sel = false;
      const none = R.def.judge(R); if (none.pass) F('empty selection passed');
    }
    out.distinct = seen.size; if (seen.size < 16) F('only ' + seen.size + ' distinct prompts in 240 rounds');
    // play two absurd rounds through real key presses: pass then fail
    for (const want of [true, false]) {
      DEV.play('absurd', 0.5, want ? 11 : 12); BOT.frame(40);
      const rej = R.tiles.map((t, i) => i).filter(i => !R.acc.includes(i));
      BOT.selectAll(want ? [R.acc[0]] : [rej[0]]); BOT.toVerify(); const res = BOT.awaitResult();
      if (!res || res.pass !== want) F('absurd key-press round: wanted ' + want + ' got ' + JSON.stringify(res));
      if (V && V.async) F('absurd verify was async (oracle)');
    }
    // a full run from the title screen
    DEV.title(); BOT.frame(10);
    const s = TPADS.start; BOT.walkTo(s.x + 180, s.y + 60, { tol: 10 }); BOT.sit();
    for (let f = 0; f < 200 && mode !== 'play'; f++) BOT.frame();
    for (let k = 0; k < 14 && mode !== 'win' && mode !== 'denied'; k++) { BOT.solve(true); BOT.log.length = 0; BOT.next(); }
    out.runEnd = mode;
    out.globals = ['aiLive', 'askAI', 'askJSON', 'aiJudge', 'genPrompt', 'validateGen', 'aiOn', 'aiMsg'].filter(n => { try { return typeof eval(n) !== 'undefined'; } catch (e) { return false; } });
    if (out.globals.length) F('AI globals still defined: ' + out.globals);
    return out;
  });
  const touches = await p.evaluate(() => window.__claudeTouches);
  if (touches.length) r.fails.push('window.claude was touched ' + touches.length + 'x: ' + [...new Set(touches)].join(', '));
  console.log(JSON.stringify({ pads: r.pads, prompts: r.prompts, distinct: r.distinct, runEnd: r.runEnd }));
  console.log(r.fails.length ? 'FAIL\n' + r.fails.slice(0, 30).join('\n') : 'PASS: no window.claude access; ' + r.prompts + ' scripted absurd prompts (' + r.distinct + ' seen)');
  console.log('errors', errs);
  await p.screenshot({ path: (process.env.SHOTS || __dirname + '/shots') + '/ai-none-title.png' });
  await b.close();
  process.exitCode = r.fails.length || errs.length ? 1 : 0;
})();
