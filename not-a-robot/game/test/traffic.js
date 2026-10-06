// traffic: what you SEE must be what is judged. 200 rounds across seeds and d: render the scene with and without the light,
// diff the pixels inside every tile's visible area, and assert
//   - every square with >= 1 visibly changed pixel is required (headT) or optional (poleT)
//   - every required square shows a big chunk of the light (>= 12 x 12 px of changed pixels, in 960x540 units)
//   - every optional square shows a real chunk too (no slivers), and the generator never had to give up (R.clean)
//   - judge: head only passes, head + all pole passes, one untouched square fails, a missing head square fails
// Also runs 20 rounds with the SVG art disabled (procedural fallback) and solves a few through key presses (+ screenshots).
//   node game/test/traffic.js [--dsf=2]
const { open } = require('./lib.js');
const fs = require('fs');
const dsf = +((process.argv.find(a => a.startsWith('--dsf=')) || '').split('=')[1] || 1);
(async () => {
  const { b, p, errs, shot } = await open({ dsf });
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/bot.js', 'utf8') });
  const out = await p.evaluate(() => {
    const fails = [], stats = { rounds: 0, req: 0, opt: 0, forb: 0, minReq: 1e9, minOpt: 1e9, maxForbPix: 0, n4: 0, n5: 0, fallback: 0 };
    const TH = 8;   // a channel difference > 8/255 counts as a visible light pixel
    function check(tag, fallback) {
      if (!artReady('scene/traffic_bg') && !fallback) { fails.push(tag + ': art not ready'); return; }
      const lit = R.scene, bg = paintTraffic(R, false), k = lit.k, W = lit.width;
      const A = lit.getContext('2d').getImageData(0, 0, W, W).data, B = bg.getContext('2d').getImageData(0, 0, W, W).data;
      const req = new Set(R.headT), opt = new Set(R.poleT);
      if (!R.clean) fails.push(tag + ': generator gave up (no clean placement)');
      for (let j = 0; j < R.tiles.length; j++) {
        const t = R.tiles[j], hc = t.home % G.cols, hr = Math.floor(t.home / G.cols);
        // the tile shows scene rect (hc * pitch, hr * pitch, ts, ts); scan every backing pixel that touches it
        const x0 = Math.floor(hc * G.pitch * k), x1 = Math.ceil((hc * G.pitch + G.ts) * k), y0 = Math.floor(hr * G.pitch * k), y1 = Math.ceil((hr * G.pitch + G.ts) * k);
        let n = 0, bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
        for (let y = y0; y < Math.min(W, y1); y++) for (let x = x0; x < Math.min(W, x1); x++) {
          const o = (y * W + x) * 4;
          if (Math.abs(A[o] - B[o]) > TH || Math.abs(A[o + 1] - B[o + 1]) > TH || Math.abs(A[o + 2] - B[o + 2]) > TH) { n++; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
        }
        const bw = n ? (bx1 - bx0 + 1) / k : 0, bh = n ? (by1 - by0 + 1) / k : 0, chunk = Math.min(bw, bh);
        if (n && !req.has(j) && !opt.has(j)) { fails.push(`${tag}: square ${j} shows ${n} light pixels (${bw.toFixed(1)}x${bh.toFixed(1)}) but is FORBIDDEN`); stats.maxForbPix = Math.max(stats.maxForbPix, n); }
        if (req.has(j)) { stats.req++; stats.minReq = Math.min(stats.minReq, chunk); if (chunk < 12) fails.push(`${tag}: required square ${j} only shows ${bw.toFixed(1)}x${bh.toFixed(1)} px`); }
        else if (opt.has(j)) { stats.opt++; stats.minOpt = Math.min(stats.minOpt, chunk); if (chunk < 10) fails.push(`${tag}: optional square ${j} is a sliver ${bw.toFixed(1)}x${bh.toFixed(1)} px`); }
        else stats.forb++;
      }
      // judge
      const N = R.tiles.length, forb = [...Array(N).keys()].filter(j => !req.has(j) && !opt.has(j));
      const judgeWith = list => { R.tiles.forEach((t, i) => t.sel = list.includes(i)); const r = R.def.judge(R); R.tiles.forEach(t => t.sel = false); return r.pass; };
      if (!judgeWith(R.headT)) fails.push(tag + ': head only did not pass');
      if (!judgeWith(R.headT.concat(R.poleT))) fails.push(tag + ': head + pole did not pass');
      if (forb.length && judgeWith(R.headT.concat([forb[0]]))) fails.push(tag + ': head + untouched square passed');
      if (R.headT.length && judgeWith(R.headT.slice(1).concat(R.poleT))) fails.push(tag + ': missing head square passed');
      if (!R.headT.length) fails.push(tag + ': no head squares');
    }
    const ds = [0, 0.3, 0.5, 0.8, 1];
    for (let s = 0; s < 40; s++) for (const d of ds) {
      const seed = 9000 + s * 37;
      DEV.play('traffic', d, seed); BOT.frame(2); stats.rounds++; stats['n' + G.cols]++;
      check(`seed ${seed} d ${d}`, false);
    }
    // procedural fallback (art not loaded): same guarantees
    const a = ARTIMG['scene/traffic_light'], bgA = ARTIMG['scene/traffic_bg'];
    a.ok = false; bgA.ok = false;
    for (let s = 0; s < 20; s++) { DEV.play('traffic', s % 2 ? 1 : 0, 400 + s); BOT.frame(2); stats.fallback++; check(`fallback seed ${400 + s}`, true); }
    a.ok = true; bgA.ok = true;
    return { fails, stats };
  });
  console.log('stats', JSON.stringify(out.stats));
  // a few rounds through real key presses: head only, and head + pole
  const play = await p.evaluate(() => {
    const res = [];
    for (const [seed, d, pole] of [[3, 0, false], [4, 1, true], [5, 0.5, true], [6, 1, false]]) {
      DEV.play('traffic', d, seed); BOT.frame(40);
      BOT.selectAll(pole ? R.headT.concat(R.poleT) : R.headT); BOT.toVerify(); const r = BOT.awaitResult();
      res.push({ seed, d, pole, pass: r && r.pass, verdict: r && r.verdict });
    }
    return res;
  });
  for (const r of play) if (!r.pass) out.fails.push('key-press round failed ' + JSON.stringify(r));
  console.log('key-press rounds', JSON.stringify(play));
  for (const [seed, d] of [[9000, 0], [9037, 1]]) { await p.evaluate(([s, d]) => { DEV.play('traffic', d, s); BOT.frame(60); }, [seed, d]); await shot(`traffic-${seed}-d${d}`); }
  console.log(out.fails.length ? `FAIL (${out.fails.length})\n` + out.fails.slice(0, 40).join('\n') : 'PASS: 200 rounds, every visible square is required/optional, required squares show a big chunk');
  console.log('errors:', errs.join('\n'));
  await b.close();
  process.exitCode = out.fails.length || errs.length ? 1 : 0;
})();
