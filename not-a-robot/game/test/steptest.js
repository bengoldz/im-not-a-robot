// step-mode / pushing / walls / ice / mirror entity / free-mode pushing, via hidden test rounds registered at runtime
const { open } = require('./lib.js');
const fs = require('fs');
(async () => {
  const { b, p, errs, shot } = await open();
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const out = await p.evaluate(() => {
    const log = [], ev = [];
    const E = () => ({ empty: true });
    // 5x5: row-major. wall at 7, pushable crate at 12 (centre), cat starts at 22 (bottom middle)
    registerRound({ id: '_step', hidden: true, move: 'step', verify: 'pad',
      generate: () => ({ grid: 5, catStart: 22, tiles: [...Array(25)].map((_, i) => i === 7 ? { wall: true } : i === 12 ? { push: true, icon: 'house' } : E()), l1: 'test', big: 'step mode' }),
      onStep: (R, f, t, i) => ev.push(`step ${f}->${t} ${i.how}`), onHop: (R, f, t, i) => ev.push(`hop ${f}->${t} over ${i.over}`),
      onPush: (R, tile, f, t) => ev.push(`push ${f}->${t}`), onMove: (R, f, d, how, path) => ev.push(`move ${f} [${d}] ${how} ${JSON.stringify(path)}`),
      judge: () => ({ pass: true, verdict: 'ok' }) });
    DEV.play('_step', 0.5, 1); BOT.frame(30);
    const c = () => DEV.state().cat.cell;
    log.push('start cell ' + c());
    BOT.tap('up', 20); log.push('after up (pushes crate 12->7? no: wall at 7 blocks push) cell ' + c());
    BOT.tap('up', 20); log.push('after up again cell ' + c());
    BOT.tap('left', 20); BOT.tap('up', 20); log.push('left+up cell ' + c());
    BOT.tap('right', 20); log.push('right: push crate 12->13, cell ' + c() + ' crate at ' + R.tiles.findIndex(t => t.push));
    BOT.tap('hop', 2); key.left = true; BOT.frame(1); key.left = false; BOT.frame(40);
    log.push('hop (dir pressed just after) cell ' + c());
    pressed.left = true; pressed.hop = true; BOT.frame(40); log.push('hop left cell ' + c());
    pressed.dash = true; pressed.down = true; BOT.frame(40); log.push('dash down cell ' + c());
    BOT.tap('down', 25); log.push('down off the grid -> cell ' + c() + ' cat y ' + cat.y.toFixed(0));
    key.up = true; BOT.frame(30); key.up = false; BOT.frame(20); log.push('walk back up into grid (hold) -> cell ' + c());
    log.push('events: ' + ev.join(' | '));
    // ice + mirror ghost
    ev.length = 0;
    registerRound({ id: '_ice', hidden: true, move: 'step', exitGrid: false, verify: 'none',
      generate: () => ({ grid: 5, catStart: 20, tiles: [...Array(25)].map((_, i) => i === 3 ? { wall: true } : { empty: true }) }),
      enter(R) { R.ghost = addEntity({ cell: 24 }); },
      moveCat(R, from, dir, how) { if (how !== 'walk') return null; const path = []; let k = from; for (;;) { const j = stepCell(k, dir); if (j < 0 || !canEnterCell(k, j, { dir })) break; path.push(j); k = j; } return { path, how: 'slide' }; },
      onMove(R, from, dir) { moveEntity(R.ghost, [dir[0], -dir[1]]); },
      onSit(R, tile) { entitySit(R.ghost); ev.push(`sit cat ${tile && tile.i} ghost ${R.ghost.cell}`); } });
    DEV.play('_ice', 0.5, 1); BOT.frame(20);
    BOT.tap('up', 50); log.push('ice up: cat ' + c() + ' ghost ' + R.ghost.cell);
    BOT.tap('right', 50); log.push('ice right (wall at 3): cat ' + c() + ' ghost ' + R.ghost.cell);
    BOT.tap('down', 50); log.push('ice down: cat ' + c() + ' ghost ' + R.ghost.cell + ' (exitGrid false)');
    BOT.sit(); log.push(ev.join(' | '));
    // free-mode walls + push
    registerRound({ id: '_free', hidden: true, generate: () => ({ grid: 4, tiles: [...Array(16)].map((_, i) => i === 13 ? { push: true, icon: 'rock' } : i === 10 ? { wall: true } : i === 9 || i === 5 ? { empty: true } : { icon: 'fish' }) }), judge: () => ({ pass: true }) });
    DEV.play('_free', 0.5, 1); BOT.frame(10);
    const f13 = cellFoot(13); BOT.walkTo(f13.x, 500, { tol: 6 }); key.up = true; BOT.frame(60); key.up = false; BOT.frame(20);
    log.push('free: leaned up into crate at 13 -> crate now at ' + R.tiles.findIndex(t => t.push) + ', cat cell ' + catCell());
    const f14 = cellFoot(14); BOT.walkTo(f14.x, f14.y, { tol: 6 }); key.up = true; BOT.frame(60); key.up = false;
    log.push('free: from 14 hold up; wall at 10 -> cat cell ' + catCell() + ' (expect 14)');
    return log;
  });
  console.log(out.join('\n'));
  await shot('step-test');
  console.log('errors:', errs.join('\n'));
  await b.close();
})();
