// rounds/traffic.js — one traffic light painted across the whole grid; does the pole count? Any answer that includes every
// square with a real chunk of the lamp head and nothing the light doesn't touch passes; pole squares are optional.
// Grid 4x4 -> 5x5 with d.
// The judge works from the DRAWN geometry: TRAFFIC_BANDS are the visible bounds of art/scene/traffic_light.svg (viewBox
// 0 0 120 512), measured by rasterizing it at 8x and scanning alpha > 0, merged into bands [y0, y1, x0, x1] in svg units
// (rounded outward to 0.5). y < 196.5 is the lamp head incl. its rounded top cap and visors; below it the pole, its two
// clamps and the foot. trafficLayout() is the exact transform paintTraffic draws the sprite with.
const TRAFFIC_BANDS = [[3.5,4,25.5,94.5],[4,5,22.5,97.5],[4.5,6.5,20,100],[6,8,17.5,102.5],[7.5,10.5,14.5,105.5],[10,13.5,12,108],[13.5,20.5,9.5,110.5],
  [20,186.5,9.5,110.5],[186,190,12,108],[189.5,192.5,14.5,105.5],[192,194,17,103],[193.5,195.5,20,100],[195,196,22.5,97.5],[196,196.5,25.5,94.5],
  [196.5,204.5,40,80],[204,208,37.5,82.5],[207.5,225.5,37,83],[225.5,227,40,80],[226.5,304.5,40,80],[304,308,37.5,82.5],[307.5,321.5,37,83],[321.5,323,40,80],
  [322.5,481.5,42.5,77.5],[481.5,483,36.5,83.5],[483,490,34,86],[489.5,498.5,31.5,88.5],[498,510.5,29.5,90.5]];
const TRAFFIC_HEAD_END = 196.5, TRAFFIC_CUT = 197, TRAFFIC_MIN = 14;   // MIN: a touched square shows >= 14 x 14 px of the light
// head box (svg 14..106 x 8..192) fitted onto { x: px - 20, y: hy, w: 40, h: hh }; the pole part (svg y >= 197) is stretched
// so the foot (svg y 506) lands at S * 0.9
function trafficLayout(px, hy, hh, S) {
  const kx = 40 / 92, ky = hh / 184, lx = px - 60 * kx, top = hy - 8 * ky, mid = top + TRAFFIC_CUT * ky, bot = S * 0.9;
  return { kx, ky, lx, top, mid, bot, k2: (bot - mid) / (506 - TRAFFIC_CUT) };
}
// the light's visible pixels as scene-space rects { x, y, w, h, head }
function trafficRects(L) {
  const Y = y => y <= TRAFFIC_CUT ? L.top + y * L.ky : L.mid + (y - TRAFFIC_CUT) * L.k2, out = [];
  for (const [y0, y1, x0, x1] of TRAFFIC_BANDS) {
    const cuts = y0 < TRAFFIC_CUT && y1 > TRAFFIC_CUT ? [[y0, TRAFFIC_CUT], [TRAFFIC_CUT, y1]] : [[y0, y1]];
    for (const [a, b] of cuts) out.push({ x: L.lx + x0 * L.kx, y: Y(a), w: (x1 - x0) * L.kx, h: Y(b) - Y(a), head: b <= TRAFFIC_HEAD_END });
  }
  return out;
}
// bounding boxes of the light (all) and of the head inside cell rect r (grown by pad px), or null where it doesn't touch
function trafficCover(rects, r, pad = 0) {
  const box = { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }, res = { all: null, head: null };
  for (const q of rects) {
    const x0 = Math.max(box.x, q.x), x1 = Math.min(box.x + box.w, q.x + q.w), y0 = Math.max(box.y, q.y), y1 = Math.min(box.y + box.h, q.y + q.h);
    if (x1 <= x0 || y1 <= y0) continue;
    for (const k of q.head ? ['all', 'head'] : ['all']) { const b = res[k]; res[k] = b ? { x0: Math.min(b.x0, x0), x1: Math.max(b.x1, x1), y0: Math.min(b.y0, y0), y1: Math.max(b.y1, y1) } : { x0, x1, y0, y1 }; }
  }
  for (const k of ['all', 'head']) if (res[k]) { const b = res[k]; b.w = b.x1 - b.x0; b.h = b.y1 - b.y0; }
  return res;
}
const trafficBig = b => !!b && b.w >= TRAFFIC_MIN && b.h >= TRAFFIC_MIN;
function paintTraffic(R, light = true) {
  const S = GRID.w, { px, hy, hh, bld } = R.scn;
  const art = artReady('scene/traffic_bg', 'scene/traffic_light');
  const K = artScaleV, c = document.createElement('canvas'); c.width = c.height = Math.round(S * K); c.k = c.width / S; c.repaint = () => paintTraffic(R, light);
  const g = c.getContext('2d'); g.scale(c.k, c.k); g.imageSmoothingQuality = 'high';
  const T = trafficLayout(px, hy, hh, S);
  if (art) {
    g.drawImage(ARTIMG['scene/traffic_bg'].img, 0, 0, S, S);
    drawIcon(g, 'car', S - 70, S * 0.8, 70);
    if (!light) return c;
    const L = ARTIMG['scene/traffic_light'].img, cut = TRAFFIC_CUT;
    g.drawImage(L, 0, cut, 120, 512 - cut, T.lx, T.mid, 120 * T.kx, (512 - cut) * T.k2);
    g.drawImage(L, 0, 0, 120, cut, T.lx, T.top, 120 * T.kx, cut * T.ky);
    return c;
  }
  const sky = g.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, '#9fd0ff'); sky.addColorStop(1, '#e3f1ff'); g.fillStyle = sky; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7; i++) { const { w, h } = bld[i], x = i * 55 - 10; g.fillStyle = ['#c1c8d6', '#aeb7c8', '#d0d6e2'][i % 3]; g.fillRect(x, S * 0.72 - h, w, h); g.fillStyle = '#ffffff66'; for (let wy = S * 0.72 - h + 10; wy < S * 0.68; wy += 18) for (let wx = x + 6; wx < x + w - 10; wx += 14) g.fillRect(wx, wy, 7, 9); }
  g.fillStyle = '#8d95a5'; g.fillRect(0, S * 0.72, S, S); g.fillStyle = '#5c6372'; g.fillRect(0, S * 0.8, S, S);
  g.fillStyle = '#eee'; for (let x = 10; x < S; x += 40) g.fillRect(x, S * 0.9, 22, 5);
  drawIcon(g, 'car', S - 70, S * 0.8, 70);
  if (!light) return c;
  // no art: fill exactly the measured silhouette, so the judge still matches what is drawn
  for (const q of trafficRects(T)) { g.fillStyle = q.head ? '#2a2f3a' : '#4a5060'; g.fillRect(q.x, q.y, q.w, q.h); }
  for (const [k, col] of [[0, '#ff4d4d'], [1, '#5a4a22'], [2, '#1f4a33']]) circ(g, px, T.top + (48 + 54 * k) * T.ky, 23 * T.kx, col);
  return c;
}
registerRound({
  id: 'traffic', name: 'Traffic light', minD: 0.05, weight: 1,
  intro: 'Ah, the classic. Does the pole count? Philosophers still argue.',
  // Placement is rerolled until every square the light touches shows >= TRAFFIC_MIN px of it in both directions (and the head
  // likewise), and every square it doesn't touch is >= 2 px clear of it: no slivers, no "it sticks in by 3 px" squares.
  // headT = squares with a real chunk of the head (required); poleT = every other square the light touches (optional).
  generate(d, rng) {
    const n = d < 0.5 ? 4 : 5, N = n * n, M = gridMetrics(n, n), S = GRID.w, hh = 92;
    const cellR = j => ({ x: (j % n) * M.pitch, y: Math.floor(j / n) * M.pitch, w: M.ts, h: M.ts });
    let px, hy, cover, ok = false;
    for (let tries = 0; tries < 400 && !ok; tries++) {
      const col = rng.int(1, n - 2);
      px = col * M.pitch + rng.f(-10, M.ts + 10); hy = rng.f(26, 66);
      const rects = trafficRects(trafficLayout(px, hy, hh, S));
      cover = [...Array(N)].map((_, j) => trafficCover(rects, cellR(j)));
      ok = cover.every((cv, j) => cv.all ? trafficBig(cv.all) && (!cv.head || trafficBig(cv.head)) : !trafficCover(rects, cellR(j), 2).all);
    }
    const headT = [], poleT = [];
    cover.forEach((cv, j) => { if (trafficBig(cv.head)) headT.push(j); else if (cv.all) poleT.push(j); });
    const bld = [...Array(7)].map(() => ({ w: rng.f(40, 70), h: rng.f(90, 200) }));
    return { grid: n, tiles: [...Array(N)].map(() => ({ icon: 'trafficlight' })), scn: { px, hy, hh, bld }, headT, poleT, clean: ok,
      l1: 'Select all squares with', big: 'traffic lights', l3: 'Does the pole count? Nobody knows.' };
  },
  enter(R) { R.scene = paintTraffic(R); },
  parTime: R => R.cols === 4 ? 14 : 18,
  judge(R) {
    const sel = selected(), okSet = new Set(R.headT.concat(R.poleT)), checked = [...new Set(sel.concat(R.headT))];
    const bad = sel.filter(j => !okSet.has(j));
    if (bad.length) return { pass: false, wrong: bad, checked, verdict: 'That square contains a building. Buildings are not lights.' };
    const miss = R.headT.filter(j => !sel.includes(j));
    if (miss.length) return { pass: false, wrong: miss, checked, verdict: 'Missed part of the light. It turned red out of spite.' };
    const pl = sel.filter(j => R.poleT.includes(j)).length;
    return { pass: true, verdict: pl === 0 ? 'Pole excluded. Bold. Correct. Probably.' : pl === R.poleT.length ? 'Pole included. HUMANCHECK respects your choice.' : 'Some of the pole. A true moderate. Accepted.' };
  },
  progress: matchProgress,
});
