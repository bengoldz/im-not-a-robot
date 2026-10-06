// shared Playwright helpers: open the built game with the rAF loop paused and a deterministic step()
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const D = process.env.SHOTS || require('path').join(__dirname, 'shots');
const URL = process.env.GAME_URL || 'file:///home/user/jam/not-a-robot/game/dist/index.html';
async function open(opts = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: opts.dsf || 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CERT|net::/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.goto(URL + (opts.hash || '')); await p.waitForTimeout(opts.wait || 1200);
  if (!opts.live) await p.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    window.step = (ms) => { const n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { update(1 / 60); render(); } };
    window.press = (k, holdMs = 50) => { pressed[k] = true; key[k] = true; anyPressed = true; step(holdMs); key[k] = false; };
    window.hold = (k, ms) => { key[k] = true; step(ms); key[k] = false; };
  });
  const shot = async (name) => { await p.evaluate(() => render()); await p.screenshot({ path: `${D}/${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 720 } }); return `${D}/${name}.png`; };
  return { b, p, errs, shot, D };
}
fs.mkdirSync(D, { recursive: true });
module.exports = { open, D };
