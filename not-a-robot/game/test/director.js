const { open } = require('./lib.js');
(async () => {
  const { b, p, errs } = await open();
  const out = await p.evaluate(() => {
    const types = Object.fromEntries(DEV.types().map(t => [t.id, t]));
    const runs = [], viol = []; let fallback = 0;
    for (let k = 0; k < 50; k++) {
      const seed = (Math.random() * 4294967296) >>> 0, s = DEV.makeRun(seed);
      if (JSON.stringify(s) !== JSON.stringify(DEV.makeRun(seed))) viol.push(`seed ${seed}: not deterministic`);
      runs.push(s);
      if (s.length !== 12) viol.push(`seed ${seed}: len ${s.length}`);
      if (s[11].id !== 'boss') viol.push(`seed ${seed}: last not boss`);
      const cnt = {};
      s.forEach((x, i) => {
        if (i && s[i - 1].id === x.id) viol.push(`seed ${seed}: ${x.id} twice in a row at ${i}`);
        cnt[x.id] = (cnt[x.id] || 0) + 1;
        if (cnt[x.id] > types[x.id].maxPerRun && !types[x.id].boss) viol.push(`seed ${seed}: ${x.id} x${cnt[x.id]}`);
        if (x.d < types[x.id].minD - 1e-9 && !types[x.id].boss) { const gentlest = Math.min(...Object.values(types).filter(t => !t.boss && t.id !== (i ? s[i-1].id : '')).map(t => t.minD)); if (types[x.id].minD > gentlest + 1e-9) viol.push(`seed ${seed}: ${x.id} at d ${x.d} < minD ${types[x.id].minD}`); else fallback++; }
        if (Math.abs(x.d - i / 11) > 0.0806) viol.push(`seed ${seed}: slot ${i} d ${x.d} off curve`);
        const first = cnt[x.id] === 1;
        if (!types[x.id].boss && (x.intro !== first || (first ? x.genD !== 0 : x.genD !== x.d))) viol.push(`seed ${seed}: intro rule broken at ${i}`);
      });
      if (!s.slice(3, 9).some(x => x.id === 'absurd')) viol.push(`seed ${seed}: no absurd in 3..8`);
    }
    const ids = Object.keys(types).sort(), hist = ids.map(id => [id, ...[...Array(12)].map((_, i) => runs.filter(r => r[i].id === id).length)]);
    const dstat = [...Array(12)].map((_, i) => { const ds = runs.map(r => r[i].d); return [Math.min(...ds), ds.reduce((a, b) => a + b, 0) / ds.length, Math.max(...ds)].map(v => v.toFixed(2)).join('/'); });
    const daily1 = dailyInfo(new Date(2026, 9, 5)), daily2 = dailyInfo(new Date(2026, 9, 5, 23, 59)), daily3 = dailyInfo(new Date(2026, 9, 6));
    return { fallback, viol, hist, dstat, daily: [daily1, daily2, daily3], sample: runs[0].map(x => x.id + (x.intro ? '*' : '') + '@' + x.d.toFixed(2)).join(' ') };
  });
  console.log('violations:', out.viol.length, out.viol.slice(0, 20), ' (gentlest-type fallbacks when nothing fits d:', out.fallback + ')');
  console.log('slot      ' + [...Array(12)].map((_, i) => String(i).padStart(4)).join(''));
  for (const [id, ...c] of out.hist) console.log(id.padEnd(10) + c.map(v => String(v || '.').padStart(4)).join(''));
  console.log('d min/mean/max per slot:\n ' + out.dstat.map((s, i) => `${i}:${s}`).join('  '));
  console.log('daily', JSON.stringify(out.daily));
  console.log('sample run:', out.sample);
  console.log('errors:', errs);
  await b.close();
})();
