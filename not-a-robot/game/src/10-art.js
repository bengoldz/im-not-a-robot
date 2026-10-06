// ===== 10-art.js: SVG art loader, icons + tile rasterizing, cat/robot cutout rigs =====
// ===== Art loader =====
// Each SVG in ART becomes an Image (Blob URL). artCanvas() rasterizes it once per (name, pixel size) so drawing stays crisp and fast.
// Until an image has loaded, artCanvas() returns null and every draw function falls back to its procedural drawing.
const ARTIMG = {}, artCache = new Map();
// Resolution: the main canvas backing store matches the on-screen pixel size.
// RK = clamp(cssScale * devicePixelRatio, 1, 3) -> backing store <= 2880x1620; game logic stays in 960x540 units
// (render() starts every frame with setTransform(RK)). artScaleV (sprite raster scale) follows RK, but only after
// a short debounce so dragging the window edge does not re-rasterize every SVG on every resize event.
let RK = 1, artScaleV = 1, rkTimer = 0;
function rkCalc() {
  const w = cv.getBoundingClientRect().width || W;
  return clamp(w / W * (window.devicePixelRatio || 1), 1, 3);
}
function applyArtScale() {
  if (artScaleV === RK) return;
  artScaleV = RK; artCache.clear();
  for (const k in tileCache) delete tileCache[k];
  try { if (R && R.scene && R.scene.repaint) R.scene = R.scene.repaint(); } catch (e) {} // R is not declared yet on the first call
}
function resizeCanvas(now) {
  const k = rkCalc(), pw = Math.round(W * k), ph = Math.round(H * k);
  RK = k; if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  clearTimeout(rkTimer);
  if (now) applyArtScale(); else rkTimer = setTimeout(applyArtScale, 150);
}
addEventListener('resize', () => resizeCanvas(false));
(function watchDpr() { // devicePixelRatio changes (browser zoom, moving to another monitor) don't always fire 'resize'
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  const on = () => { mq.removeEventListener('change', on); resizeCanvas(false); watchDpr(); };
  mq.addEventListener('change', on);
})();
for (const k in (typeof ART === 'object' && ART) || {}) {
  const svg = ART[k], vb = ((svg.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 256 256').split(/[\s,]+/).map(Number);
  // explicit width/height so every browser can rasterize it onto a canvas
  const src = /^<svg[^>]*\swidth=/.test(svg) ? svg : svg.replace('<svg', `<svg width="${vb[2]}" height="${vb[3]}"`);
  const a = ARTIMG[k] = { img: new Image(), ok: false, w: vb[2], h: vb[3] };
  a.img.onload = () => { a.ok = true; };
  a.img.src = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
}
const artReady = (...names) => names.every(k => ARTIMG[k] && ARTIMG[k].ok);
function artCanvas(name, w, h) {
  const a = ARTIMG[name]; if (!a || !a.ok) return null;
  const pw = Math.max(1, Math.round(w * artScaleV)), ph = Math.max(1, Math.round(h * artScaleV)), key = name + '|' + pw + 'x' + ph;
  let c = artCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = pw; c.height = ph;
  try { c.getContext('2d').drawImage(a.img, 0, 0, pw, ph); } catch (e) { return null; }
  artCache.set(key, c); return c;
}
function artDraw(g, name, x, y, w, h) { const c = artCanvas(name, w, h); if (!c) return false; g.drawImage(c, x, y, w, h); return true; }

// ===== Icons =====
const O = C.ink;
function sh(g, fill, lw = 3) { if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = O; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); } }
function circ(g, x, y, r, f, lw) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); sh(g, f, lw); }
function ell(g, x, y, rx, ry, f, lw) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); sh(g, f, lw); }
function rr(g, x, y, w, h, r, f, lw) { g.beginPath(); g.roundRect(x, y, w, h, r); sh(g, f, lw); }
function poly(g, p, f, lw) { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); sh(g, f, lw); }
function ln(g, p, lw = 3, col = O) { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
function blob(g, cs, f) { cs.forEach(c => circ(g, c[0], c[1], c[2], null, 7)); cs.forEach(c => circ(g, c[0], c[1], c[2], f, 0)); }
function eyes(g, x1, x2, y, r = 3) { circ(g, x1, y, r, O, 0); circ(g, x2, y, r, O, 0); }
const ICON = {
  fish: ['water', g => { poly(g, [[16, 0], [42, -18], [42, 18]], '#ff8c42'); ell(g, -6, 0, 28, 17, '#ff8c42'); poly(g, [[-8, -15], [4, -28], [12, -13]], '#ffb26b'); ln(g, [[6, -10], [10, 0], [6, 10]], 2.5); circ(g, -20, -4, 5, '#fff', 2); circ(g, -19, -4, 2.5, O, 0); circ(g, -38, -26, 4, null, 2); circ(g, -30, -36, 3, null, 2); }],
  trafficlight: ['street', g => { rr(g, -4, 14, 8, 36, 2, '#4a5060'); rr(g, -15, -46, 30, 64, 7, '#2a2f3a'); circ(g, 0, -32, 7, '#ff4d4d', 2); circ(g, 0, -14, 7, '#ffd23f', 2); circ(g, 0, 4, 7, '#3ddc84', 2); }],
  bicycle: ['street', g => { circ(g, -24, 16, 17, null, 4); circ(g, 24, 16, 17, null, 4); ln(g, [[-24, 16], [-4, 16], [12, -8], [-14, -8], [-24, 16]], 4, '#e8435a'); ln(g, [[12, -8], [24, 16]], 4, '#e8435a'); ln(g, [[-14, -8], [-16, -18]], 3); rr(g, -24, -22, 16, 6, 3, '#333'); ln(g, [[12, -8], [14, -20], [24, -22]], 3); circ(g, -4, 16, 3, O, 0); }],
  cat: ['indoor', g => { ln(g, [[14, 26], [32, 22], [36, 4]], 6, '#6b7385'); ell(g, 0, 16, 19, 20, '#7d8597'); poly(g, [[-15, -22], [-12, -42], [-2, -28]], '#7d8597'); poly(g, [[15, -22], [12, -42], [2, -28]], '#7d8597'); circ(g, 0, -14, 17, '#7d8597'); ell(g, -6, -15, 3, 4.5, '#c6f36b', 0); ell(g, 6, -15, 3, 4.5, '#c6f36b', 0); poly(g, [[-2, -8], [2, -8], [0, -6]], '#ff9db0', 0); }],
  robot: ['indoor', g => { ln(g, [[0, -32], [0, -42]], 3); circ(g, 0, -44, 5, '#ff4d6d', 2); rr(g, -24, -32, 48, 34, 7, '#a9b8c9'); rr(g, -17, -26, 34, 20, 4, C.screen, 2); circ(g, -8, -16, 4, C.cyan, 0); circ(g, 8, -16, 4, C.cyan, 0); rr(g, -18, 6, 36, 30, 5, '#8fa1b5'); circ(g, 0, 20, 5, '#ffd23f', 2); ln(g, [[-18, 14], [-28, 26]], 4); ln(g, [[18, 14], [28, 26]], 4); }],
  sun: ['sky', g => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ln(g, [[Math.cos(a) * 28, Math.sin(a) * 28], [Math.cos(a) * 42, Math.sin(a) * 42]], 5, '#f5a623'); } circ(g, 0, 0, 23, '#ffd23f'); eyes(g, -8, 8, -4); g.beginPath(); g.arc(0, 4, 8, 0.2, Math.PI - 0.2); sh(g, null, 2.5); }],
  cloud: ['sky', g => { blob(g, [[-20, 8, 16], [0, -4, 22], [21, 8, 16], [0, 12, 18]], '#fff'); }],
  tree: ['grass', g => { rr(g, -7, 6, 14, 36, 3, '#8b5a2b'); blob(g, [[-16, -6, 18], [14, -6, 18], [0, -24, 20], [0, 4, 16]], '#4caf50'); }],
  car: ['street', g => { poly(g, [[-24, -2], [-14, -22], [14, -22], [26, -2]], '#e84a5f'); poly(g, [[-16, -4], [-9, -17], [-1, -17], [-1, -4]], '#bfe6ff', 2); poly(g, [[3, -4], [3, -17], [11, -17], [18, -4]], '#bfe6ff', 2); rr(g, -40, -4, 80, 24, 9, '#e84a5f'); circ(g, -22, 20, 10, '#2a2f3a'); circ(g, 22, 20, 10, '#2a2f3a'); circ(g, -22, 20, 4, '#ccc', 0); circ(g, 22, 20, 4, '#ccc', 0); circ(g, 36, 4, 3, '#ffd23f', 0); }],
  bus: ['street', g => { rr(g, -46, -28, 92, 48, 8, '#ffc93c'); for (let i = 0; i < 4; i++) rr(g, -38 + i * 20, -20, 15, 14, 3, '#bfe6ff', 2); rr(g, -46, 0, 92, 5, 0, '#e8435a', 0); circ(g, -26, 22, 9, '#2a2f3a'); circ(g, 26, 22, 9, '#2a2f3a'); }],
  crosswalk: ['street', g => { rr(g, -50, -50, 100, 100, 0, '#555b66', 0); for (let i = 0; i < 5; i++) rr(g, -44 + i * 19, -36, 11, 72, 2, '#f2f2f2', 0); }],
  hydrant: ['street', g => { rr(g, -20, 30, 40, 9, 3, '#b52a33'); rr(g, -14, -14, 28, 46, 4, '#e63946'); rr(g, -25, 0, 11, 12, 3, '#e63946'); rr(g, 14, 0, 11, 12, 3, '#e63946'); circ(g, 0, -22, 11, '#e63946'); ell(g, 0, -15, 19, 6, '#b52a33'); circ(g, 0, 6, 5, '#ffd23f', 2); }],
  stairs: ['indoor', g => { poly(g, [[-42, 40], [-42, 20], [-21, 20], [-21, 0], [0, 0], [0, -20], [21, -20], [21, -40], [42, -40], [42, 40]], '#b08968'); }],
  boat: ['water', g => { ln(g, [[0, 8], [0, -40]], 3); poly(g, [[3, -38], [32, 4], [3, 4]], '#fff'); poly(g, [[-3, -30], [-24, 4], [-3, 4]], '#ffe08a'); poly(g, [[0, -40], [14, -36], [0, -32]], '#e63946', 2); poly(g, [[-40, 8], [40, 8], [28, 28], [-28, 28]], '#8b5a2b'); }],
  crown: ['indoor', g => { poly(g, [[-34, 24], [-36, -16], [-18, 4], [0, -26], [18, 4], [36, -16], [34, 24]], '#ffcc33'); circ(g, 0, 12, 5, '#e63946', 2); circ(g, -20, 13, 4, '#3ddc84', 2); circ(g, 20, 13, 4, '#4fa3e0', 2); circ(g, 0, -26, 4, '#fff', 2); }],
  sock: ['indoor', g => { g.beginPath(); g.moveTo(-14, -38); g.lineTo(12, -38); g.lineTo(12, 10); g.quadraticCurveTo(38, 12, 34, 30); g.quadraticCurveTo(30, 44, 8, 40); g.lineTo(-6, 38); g.quadraticCurveTo(-16, 34, -14, 22); g.closePath(); sh(g, '#f28fb0'); rr(g, -14, -38, 26, 8, 2, '#fff', 2); rr(g, -14, -24, 26, 6, 0, '#fff', 0); }],
  dog: ['grass', g => { ell(g, -24, 4, 9, 19, '#8a5a2b'); ell(g, 24, 4, 9, 19, '#8a5a2b'); ell(g, 0, 0, 24, 23, '#c98b4f'); ell(g, 0, 12, 13, 10, '#f0d2a8'); circ(g, 0, 6, 4.5, O, 0); eyes(g, -9, 9, -6, 3.5); g.beginPath(); g.ellipse(0, 20, 4, 6, 0, 0, Math.PI); sh(g, '#ff7a8a', 2); }],
  bone: ['grass', g => { [[-28, -8], [-28, 8], [28, -8], [28, 8]].forEach(p => circ(g, p[0], p[1], 9, null, 6)); rr(g, -28, -7, 56, 14, 4, null, 6); [[-28, -8], [-28, 8], [28, -8], [28, 8]].forEach(p => circ(g, p[0], p[1], 9, '#f7f2e8', 0)); rr(g, -28, -7, 56, 14, 4, '#f7f2e8', 0); }],
  house: ['grass', g => { rr(g, -28, -4, 56, 40, 2, '#7fb3d5'); poly(g, [[-38, -2], [0, -36], [38, -2]], '#d1495b'); rr(g, -7, 14, 14, 22, 2, '#5b3a29'); rr(g, -22, 4, 11, 10, 1, '#fff2a8', 2); rr(g, 11, 4, 11, 10, 1, '#fff2a8', 2); }],
  mountain: ['sky', g => { poly(g, [[-48, 40], [-10, -30], [12, 6], [26, -12], [50, 40]], '#7d8597'); poly(g, [[-10, -30], [-21, -10], [-14, -13], [-8, -6], [-1, -14]], '#fff', 2); }],
  cactus: ['sand', g => { rr(g, -27, -12, 12, 26, 6, '#3fa34d'); rr(g, 15, -22, 12, 24, 6, '#3fa34d'); rr(g, -22, 6, 20, 10, 4, '#3fa34d', 0); rr(g, 4, -2, 18, 10, 4, '#3fa34d', 0); rr(g, -10, -38, 20, 68, 10, '#3fa34d'); circ(g, 0, -40, 4, '#ff7ab0', 2); rr(g, -18, 26, 36, 16, 3, '#6c8bb0'); }],
  umbrella: ['sky', g => { for (let i = 0; i < 6; i++) ln(g, [[-40 + i * 16, 18 + (i % 2) * 14], [-43 + i * 16, 26 + (i % 2) * 14]], 2, '#4f88c6'); ln(g, [[0, 0], [0, 30]], 4); g.beginPath(); g.arc(-7, 30, 7, 0, Math.PI); sh(g, null, 4); g.beginPath(); g.moveTo(-42, 2); g.quadraticCurveTo(-40, -38, 0, -40); g.quadraticCurveTo(40, -38, 42, 2); for (let i = 0; i < 4; i++) g.quadraticCurveTo(31 - i * 21, -8, 21 - i * 21, 2); g.closePath(); sh(g, '#4fa3e0'); }],
  pizza: ['indoor', g => { poly(g, [[-32, -28], [36, -20], [-2, 40]], '#ffd166'); ln(g, [[-32, -28], [36, -20]], 9, '#d08c3a'); circ(g, -8, -6, 6, '#d62828', 2); circ(g, 12, -6, 5, '#d62828', 2); circ(g, 0, 16, 5, '#d62828', 2); }],
  moon: ['night', g => { circ(g, -4, 0, 28, '#ffe9a6'); circ(g, 10, -10, 24, '#2b3a63', 0); eyes(g, -18, -10, 2, 2.5); }],
  toaster: ['indoor', g => { rr(g, -18, -40, 15, 30, 3, '#e0a96d'); rr(g, 4, -34, 15, 24, 3, '#e0a96d'); rr(g, -36, -16, 72, 46, 12, '#c0c7d1'); rr(g, -22, -16, 16, 4, 2, O, 0); rr(g, 4, -16, 16, 4, 2, O, 0); rr(g, 36, -2, 9, 6, 2, '#333'); eyes(g, -10, 10, 6, 3); g.beginPath(); g.arc(0, 12, 6, 0.2, Math.PI - 0.2); sh(g, null, 2.5); }],
  ghost: ['night', g => { g.beginPath(); g.moveTo(-24, 32); g.lineTo(-24, -6); g.quadraticCurveTo(-24, -38, 0, -38); g.quadraticCurveTo(24, -38, 24, -6); g.lineTo(24, 32); for (let i = 0; i < 3; i++) g.quadraticCurveTo(20 - i * 16, 22, 12 - i * 16, 32); g.quadraticCurveTo(-20, 22, -24, 32); g.closePath(); sh(g, '#f8f9fb'); ell(g, -8, -10, 4, 7, O, 0); ell(g, 8, -10, 4, 7, O, 0); ell(g, 0, 8, 4, 5, O, 0); }],
  duck: ['water', g => { ell(g, 6, 14, 30, 18, '#ffd23f'); circ(g, -16, -14, 15, '#ffd23f'); poly(g, [[-29, -16], [-44, -10], [-29, -5]], '#ff8c42'); circ(g, -18, -18, 2.8, O, 0); g.beginPath(); g.ellipse(10, 10, 14, 8, 0.3, 0, Math.PI); sh(g, '#f5b800', 2); }],
  ball: ['grass', g => { circ(g, 0, 0, 30, '#ff6b6b'); g.save(); g.beginPath(); g.arc(0, 0, 28, 0, Math.PI * 2); g.clip(); ln(g, [[-30, -10], [30, 10]], 8, '#fff'); ln(g, [[-14, -30], [10, 30]], 8, '#4fa3e0'); g.restore(); circ(g, 0, 0, 30, null); }],
  balloon: ['sky', g => { ln(g, [[0, 22], [6, 32], [-4, 40], [4, 48]], 2); poly(g, [[-5, 24], [5, 24], [0, 18]], '#b52a33', 2); ell(g, 0, -8, 24, 30, '#e63946'); ell(g, -9, -20, 5, 9, 'rgba(255,255,255,.65)', 0); }],
  rock: ['grass', g => { g.beginPath(); g.moveTo(-34, 30); g.quadraticCurveTo(-40, -8, -10, -14); g.quadraticCurveTo(24, -24, 36, 10); g.quadraticCurveTo(40, 30, 0, 32); g.closePath(); sh(g, '#9aa0a6'); circ(g, -10, 4, 7, '#fff', 2); circ(g, 10, 2, 7, '#fff', 2); circ(g, -8, 6, 3, O, 0); circ(g, 12, 4, 3, O, 0); ln(g, [[-4, 18], [4, 18]], 2.5); }],
};
const ICONS = Object.keys(ICON);
const BG = { sky:'#bfe1ff', grass:'#bde6a8', street:'#c3c8d2', water:'#9fd6ea', indoor:'#dbe5f0', night:'#2b3a63', sand:'#f3dd9b' };
const tileCache = {};
function drawIcon(g, name, cx, cy, s) {
  if (artDraw(g, 'icons/' + name, cx - s / 2, cy - s / 2, s, s)) return;
  if (!ICON[name]) { g.save(); g.font = `700 ${s * 0.5}px ${FONT}`; g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy); g.restore(); return; }
  g.save(); g.translate(cx, cy); g.scale(s / 100, s / 100); ICON[name][1](g); g.restore();
}
resizeCanvas(true);
const TILE_GRAIN = false; // the old speckle grain muddies the new cel-shaded art
// Register a procedural icon (drawn in a 100x100 box centred on 0,0, like the ones above) for a new round type.
// bg = tile background key (sky grass street water indoor night sand). An SVG at game/art/icons/<name>.svg wins over it.
// Icons added this way are NOT added to ICONS (the list the absurd / match pools draw from).
function defineIcon(name, bg, draw) { ICON[name] = [bg, draw]; for (const k in tileCache) if (k.startsWith(name)) delete tileCache[k]; }
function iconTile(name, size) {
  if (!ICON[name] && !ARTIMG['icons/' + name]) ICON[name] = ['indoor', g => { g.font = `700 50px ${FONT}`; g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 0); }];
  const bg = (ICON[name] || ['indoor'])[0], art = artReady('tiles/' + bg, 'icons/' + name);
  const k = name + size + (art ? '@' : '#') + artScaleV; if (tileCache[k]) return tileCache[k];
  let s = 0; for (const ch of name) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  if (art) {
    const P = Math.round(size * artScaleV), c = document.createElement('canvas'); c.width = c.height = P; const g = c.getContext('2d');
    g.drawImage(ARTIMG['tiles/' + bg].img, 0, 0, P, P);
    const is = P * 0.86; g.drawImage(ARTIMG['icons/' + name].img, (P - is) / 2, (P - is) / 2, is, is);
    if (TILE_GRAIN) { const d = Math.max(1, Math.round(2 * artScaleV)); for (let i = 0; i < size * 1.2; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)'; g.fillRect(r() * P, r() * P, d, d); } }
    return tileCache[k] = c;
  }
  const K = artScaleV, c = document.createElement('canvas'); c.width = c.height = Math.round(size * K); const g = c.getContext('2d'); g.scale(c.width / size, c.width / size);
  g.fillStyle = BG[bg]; g.fillRect(0, 0, size, size);
  if (bg === 'grass') { g.fillStyle = '#9fd38a'; g.fillRect(0, size * 0.72, size, size); }
  if (bg === 'street') { g.fillStyle = '#a7adb9'; g.fillRect(0, size * 0.75, size, size); }
  if (bg === 'sand') { g.fillStyle = '#e8c97a'; g.beginPath(); g.ellipse(size * 0.5, size, size * 0.8, size * 0.25, 0, 0, 7); g.fill(); }
  if (bg === 'night') for (let i = 0; i < 10; i++) { g.fillStyle = '#fff'; g.fillRect(r() * size, r() * size, 2, 2); }
  if (bg === 'water') { g.strokeStyle = '#ffffff88'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = r() * size; g.beginPath(); g.moveTo(r() * size * 0.6, y); g.lineTo(r() * size * 0.6 + 20, y); g.stroke(); } }
  drawIcon(g, name, size / 2, size / 2, size * 0.86);
  for (let i = 0; i < size * 1.2; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)'; g.fillRect(r() * size, r() * size, 2, 2); }
  return tileCache[k] = c; // fallback key uses '#', so the art version ('@') takes over once loaded
}

// robot/*.svg: 400x600, tread bottom y=572, centre x=200, antenna top y≈26 -> fit to the old 165 px tall robot (treads at the anchor)
const BOTK = 165 / 546, BOT_MOOD = { neutral: 'neutral', happy: 'happy', ecstatic: 'ecstatic', sad: 'sad', crying: 'crying', nervous: 'nervous' };
function drawBot(x, y, s, mood, id = 'main') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (id === 'main' && bot.wig > 0) ctx.rotate(Math.sin(bot.wig * Math.PI * 6) * 0.07 * bot.wig * RM); // happy wiggle (botWiggle)
  const bob = Math.sin(time * 3) * 2, lift = bot.bounce * 8 * Math.abs(Math.sin(time * 12)), b = bob - lift;
  const m = 'robot/' + (BOT_MOOD[mood] || 'neutral'), bw = 400 * BOTK, bh = 600 * BOTK;
  const spr = (m === 'robot/neutral' && (time % 4) < 0.12 && artCanvas('robot/neutral_blink', bw * s, bh * s)) || artCanvas(m, bw * s, bh * s);
  ell(ctx, 0, 0, 44, 9, 'rgba(0,0,0,.3)', 0);
  if (rigBot(id, s, BOT_MOOD[mood] || 'neutral', bob, lift)) { ctx.restore(); return; }
  if (spr) { ctx.drawImage(spr, -200 * BOTK, -572 * BOTK + b, bw, bh); ctx.restore(); return; }
  rr(ctx, -40, -22, 80, 22, 8, '#3b4660'); for (let i = 0; i < 5; i++) circ(ctx, -30 + i * 15, -11, 5, '#6b7896', 2);
  ctx.translate(0, b);
  rr(ctx, -30, -82, 60, 60, 10, C.bot); rr(ctx, -16, -66, 32, 26, 5, C.botD); circ(ctx, 0, -53, 6, (Math.sin(time * 4) > 0) ? '#ffd23f' : '#ff8c42', 2);
  const arm = mood === 'ecstatic' || mood === 'happy' ? -1 : 1;
  ln(ctx, [[-30, -70], [-46, -70 + 26 * arm]], 7, O); ln(ctx, [[-30, -70], [-46, -70 + 26 * arm]], 4, C.bot);
  ln(ctx, [[30, -70], [46, -70 + 26 * arm]], 7, O); ln(ctx, [[30, -70], [46, -70 + 26 * arm]], 4, C.bot);
  ln(ctx, [[0, -140], [0, -156]], 3); circ(ctx, 0, -159, 6, (time % 1 < 0.5) ? '#ff4d6d' : '#ffb3c1', 2);
  rr(ctx, -42, -142, 84, 60, 12, C.bot); rr(ctx, -34, -134, 68, 44, 7, C.screen, 2);
  ctx.strokeStyle = C.cyan; ctx.fillStyle = C.cyan; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const ey = -114, blink = (time % 4) < 0.12;
  if (blink) { ln(ctx, [[-18, ey], [-8, ey]], 3, C.cyan); ln(ctx, [[8, ey], [18, ey]], 3, C.cyan); }
  else if (mood === 'happy' || mood === 'ecstatic') { ctx.beginPath(); ctx.arc(-13, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(13, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(0, ey + 8, 8, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else if (mood === 'sad' || mood === 'crying') { ln(ctx, [[-20, ey - 3], [-8, ey - 8]], 3, C.cyan); ln(ctx, [[20, ey - 3], [8, ey - 8]], 3, C.cyan); circ(ctx, -13, ey + 3, 4, C.cyan, 0); circ(ctx, 13, ey + 3, 4, C.cyan, 0); ctx.beginPath(); ctx.arc(0, ey + 20, 8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); if (mood === 'crying' || time % 3 < 1.5) { const ty = ((time * 40) % 30); circ(ctx, -16, ey + 10 + ty, 3, '#7fd1ff', 0); } }
  else if (mood === 'nervous') { circ(ctx, -13, ey, 5, C.cyan, 0); circ(ctx, 13, ey, 5, C.cyan, 0); ln(ctx, [[-10, ey + 14], [-5, ey + 10], [0, ey + 14], [5, ey + 10], [10, ey + 14]], 2.5, C.cyan); circ(ctx, 34, ey - 18, 3, '#7fd1ff', 0); }
  else { circ(ctx, -13, ey, 5, C.cyan, 0); circ(ctx, 13, ey, 5, C.cyan, 0); ln(ctx, [[-6, ey + 13], [6, ey + 13]], 3, C.cyan); }
  ctx.restore();
}

// cat/*.svg: 256x256 facing right, feet on y=232, centre x=128; stand spans ~220 units with the tail -> ~50 px on screen like the old cat
const CATK = 0.23;
// ===== Rig (cutout animation) =====
// art-rig/*.svg are the cat/robot frame art cut into parts. Each part keeps the coordinate space of the frame it came from
// (cat: 256 units, feet y=232; robot: 400x600, treads y=572), so drawing it at its own viewBox rebuilds the original frame;
// animation moves/rotates/scales parts around the pivot stored in the SVG's data-pivot. Parts are rasterized once per scale
// through artCanvas (cached), legs/tail/arms/tread teeth are stroked procedurally in the same colours/widths as the art.
// If any rig part is missing or not loaded yet, drawCat/drawBot fall back to the frame sprites.
const RIGVB = {};
for (const k in (typeof ART === 'object' && ART) || {}) if (k.startsWith('rig/')) {
  const s = ART[k], v = ((s.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 1 1').split(/[\s,]+/).map(Number);
  const p = ((s.match(/data-pivot="([^"]+)"/) || [])[1] || '0 0').split(/[\s,]+/).map(Number);
  RIGVB[k.slice(4)] = { x: v[0], y: v[1], w: v[2], h: v[3], px: p[0], py: p[1] };
}
const RM = REDUCED ? 0.3 : 1; // secondary-motion amount (antenna wobble, tail sway, ear twitch, waving)
const D2R = Math.PI / 180, ease = t => t * t * (3 - 2 * t);
let rigK = 1, rigOK = { cat: false, robot: false };
function rigReady(pre) {
  if (rigOK[pre]) return true;
  const ks = Object.keys(RIGVB).filter(k => k.startsWith(pre + '_'));
  return (rigOK[pre] = ks.length > 0 && artReady(...ks.map(k => 'rig/' + k)));
}
// draw part `name` at its rest place (optionally faded)
function rp(g, name, alpha = 1) {
  const v = RIGVB[name]; if (!v || alpha <= 0) return;
  const c = artCanvas('rig/' + name, v.w * rigK, v.h * rigK); if (!c) return;
  if (alpha < 1) { const a = g.globalAlpha; g.globalAlpha = a * alpha; g.drawImage(c, v.x, v.y, v.w, v.h); g.globalAlpha = a; }
  else g.drawImage(c, v.x, v.y, v.w, v.h);
}
// draw part moved by (dx,dy), rotated r and scaled (sx,sy) around its pivot
function rpT(g, name, dx, dy, r, sx, sy, alpha = 1) {
  const v = RIGVB[name]; if (!v) return;
  g.save(); g.translate(v.px + dx, v.py + dy); if (r) g.rotate(r); if (sx !== 1 || sy !== 1) g.scale(sx, sy); g.translate(-v.px, -v.py);
  rp(g, name, alpha); g.restore();
}
function strokeLine(g, x1, y1, x2, y2, w, col) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineWidth = w; g.strokeStyle = col; g.stroke(); }

// ---------- CAT ----------
const CK = { ink: '#1d2433', O: '#f39a33', OS: '#dc7a1e', STR: '#c4661a', BEL: '#ffd9a8', FAR: '#d9771c', FARS: '#c2650f', FARSOCK: '#ecc08e', SW: 7 };
// poses = the original frames: g = group transform [tx, ty, rotDeg, px, py]; legs = [hipX, hipY, footX, footY] for
// back-far, back-near, front-far, front-near; front = leg drawn over the torso; show = leg visible; head = [x, y, rotDeg]
const CATP = {
  stand: { g: [0, 0, 0, 128, 170], torso: 'cat_torso_stand', tail: [76, 162, 44, 164, 26, 132, 36, 98], tw: 11, tailFront: 0,
    legs: [[86, 182, 89, 219], [100, 184, 97, 219], [138, 182, 135, 219], [152, 184, 155, 219]], far: [1, 0, 1, 0], front: [0, 0, 0, 0], show: [1, 1, 1, 1],
    head: [178, 114, 0], ears: [0, 0], eyes: 'open', mouth: 'w' },
  sit: { g: [8, 0, 0, 128, 170], torso: 'cat_torso_sit', tail: [96, 220, 60, 226, 36, 220, 38, 190], tw: 11, tailFront: 0,
    legs: [[104, 206, 112, 219], [112, 208, 120, 219], [138, 190, 138, 219], [154, 192, 156, 219]], far: [1, 0, 1, 0], front: [0, 0, 1, 1], show: [0, 0, 1, 1],
    head: [136, 102, 0], ears: [0, 0], eyes: 'open', mouth: 'w' },
  loaf: { g: [-10, 0, 0, 128, 170], torso: 'cat_torso_loaf', tail: [62, 214, 66, 226, 100, 224, 136, 220], tw: 10, tailFront: 1, mid: 'cat_loaf_paws',
    legs: [[90, 200, 92, 214], [104, 202, 106, 216], [150, 200, 150, 214], [166, 202, 168, 216]], far: [1, 0, 1, 0], front: [0, 0, 0, 0], show: [0, 0, 0, 0],
    head: [178, 158, 4], ears: [0, 0], eyes: 'content', mouth: 'w' },
  hop: { g: [10, -14, -12, 128, 170], torso: 'cat_torso_hop', tail: [70, 162, 44, 160, 22, 146, 18, 118], tw: 11, tailFront: 0,
    legs: [[88, 180, 72, 196], [100, 182, 82, 196], [146, 180, 166, 190], [158, 182, 178, 190]], far: [1, 0, 1, 0], front: [0, 1, 0, 1], show: [1, 1, 1, 1],
    head: [184, 128, 6], ears: [0, 0], eyes: 'open', mouth: 'w' },
  dash: { g: [-8, 4, 0, 128, 170], torso: 'cat_torso_dash', back: 'cat_dash_lines', tail: [70, 166, 56, 160, 44, 150, 40, 140], tw: 11, tailFront: 0,
    legs: [[82, 182, 52, 204], [96, 184, 62, 212], [170, 180, 210, 196], [180, 182, 220, 206]], far: [1, 0, 1, 0], front: [0, 1, 0, 1], show: [1, 1, 1, 1],
    head: [202, 150, 8], ears: [-58, -52], eyes: 'squint', mouth: 'w' },
  fall: { g: [-4, 0, 0, 128, 170], torso: 'cat_torso_fall', back: 'cat_tail_fall', top: 'cat_fall_marks', tail: null, tw: 11, tailFront: 0,
    legs: [[112, 204, 96, 218], [150, 204, 166, 218], [108, 150, 78, 116], [158, 150, 192, 112]], far: [1, 0, 0, 0], front: [0, 0, 1, 1], show: [1, 1, 1, 1],
    head: [136, 100, -4], ears: [-28, 30], eyes: 'scared', mouth: 'o' },
};
const CAT_TAIL0 = [76, 162, 44, 164, 26, 132, 36, 98];
function clonePose(p) {
  return { g: p.g.slice(), torso: p.torso, back: p.back, mid: p.mid, top: p.top, tail: (p.tail || CAT_TAIL0).slice(), tailOn: p.tail ? 1 : 0, tw: p.tw, tailFront: p.tailFront,
    legs: p.legs.map(l => l.slice()), far: p.far, front: p.front, show: p.show, head: p.head.slice(), ears: p.ears.slice(), eyes: p.eyes, mouth: p.mouth,
    ts: [0, 0, 1, 1], partS: 1, eyeOpen: 1 }; // ts = torso [dx, dy, sx, sy] around its pivot; partS = back/top part scale
}
function blendPose(a, b, t) {
  if (t >= 1) return b;
  const o = clonePose(t < 0.5 ? a : b), L = (x, y) => x.map((v, i) => lerp(v, y[i], t));
  o.g = L(a.g, b.g); o.tail = L(a.tail, b.tail); o.tw = lerp(a.tw, b.tw, t); o.legs = a.legs.map((l, i) => L(l, b.legs[i]));
  o.head = L(a.head, b.head); o.ears = L(a.ears, b.ears); o.ts = L(a.ts, b.ts); o.partS = lerp(a.partS, b.partS, t); o.eyeOpen = lerp(a.eyeOpen, b.eyeOpen, t);
  if (a.torso !== b.torso) { const q = Math.sin(Math.PI * t); o.ts[2] *= 1 + 0.05 * q; o.ts[3] *= 1 - 0.09 * q; } // body shapes swap at the midpoint under a squash
  o.mix = { a, b, t }; return o;
}
const CR = { key: null, from: null, cur: null, t: 1, dur: 0.12, lt: -1, lx: 0, ly: 0, phase: 0, walkW: 0, blinkT: 0, blinkD: 0.14, nextBlink: 2,
  earT: 0, earSide: 0, nextEar: 3, settle: 0, tapT: 0 };
const GAIT = { duty: 0.4, amp: 24, lift: 9, off: [0, 0.5, 0.54, 0.04] }; // foot stance sweep ±amp units; diagonal trot pairs
const GAIT_CYCLE = 2 * GAIT.amp / GAIT.duty * CATK; // px moved per gait cycle -> planted feet move exactly with the ground
function gaitFoot(u) { // u in [0,1): stance (foot planted, slides back in body space) then swing (lifts and reaches forward)
  if (u < GAIT.duty) return [GAIT.amp - 2 * GAIT.amp * u / GAIT.duty, 0];
  const s = (u - GAIT.duty) / (1 - GAIT.duty);
  return [-GAIT.amp + 2 * GAIT.amp * ease(s), Math.sin(Math.PI * s) * GAIT.lift];
}
function catTarget(k, c, dt, S = CR) {
  const P = clonePose(CATP[k]), t = time;
  // blink / ear twitch timers
  S.nextBlink -= dt; if (S.nextBlink <= 0) { S.blinkD = k === 'sit' && Math.random() < 0.6 ? 0.5 : 0.14; S.blinkT = S.blinkD; S.nextBlink = rnd(2.2, 4.8); }
  if (S.blinkT > 0) { S.blinkT -= dt; const p = 1 - Math.max(0, S.blinkT) / S.blinkD; P.eyeOpen = S.blinkD > 0.3 ? 1 - Math.min(1, Math.sin(Math.PI * p) * 1.6) : 1 - Math.sin(Math.PI * p); }
  S.nextEar -= dt; if (S.nextEar <= 0) { S.earT = 0.28; S.earSide = Math.random() < 0.5 ? 0 : 1; S.nextEar = rnd(2.5, 6); }
  const twitch = S.earT > 0 ? Math.sin(Math.PI * (1 - S.earT / 0.28)) * RM : 0; S.earT -= dt;
  const T = P.tail;
  if (k === 'stand') {
    const w = S.walkW, br = (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 2.4)) * (1 - w);
    P.ts = [0, 0, 1 + 0.01 * br, 1 + 0.02 * br]; P.head[1] -= br * 1.4;
    // tail: slow S-sway (idle) / counter-sway (walk)
    const a = t * 1.7, sw = (1 - w) * RM;
    T[2] += Math.sin(a) * 3 * sw; T[4] += Math.sin(a - 0.9) * 6 * sw; T[6] += Math.sin(a - 1.8) * 9 * sw; T[7] += Math.cos(a - 1.8) * 2 * sw;
    if (S.earT > 0) P.ears[S.earSide] += (S.earSide ? 16 : -18) * twitch;
    if (w > 0.001) {
      const ph = S.phase, bob = -2.6 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 4)) * w;
      for (let i = 0; i < 4; i++) {
        const [gx, gy] = gaitFoot((((ph + GAIT.off[i]) % 1) + 1) % 1), l = P.legs[i];
        l[1] += bob; l[2] = lerp(l[2], l[0] + gx, w); l[3] -= gy * w;
      }
      P.ts[1] += bob; P.head[1] += -2.6 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 4 - 0.8)) * w; P.head[2] += Math.sin(ph * Math.PI * 4 - 0.8) * 1.5 * w;
      const sway = -Math.sin(ph * Math.PI * 2) * 5 * D2R * w * Math.max(0.5, RM), cs = Math.cos(sway), sn = Math.sin(sway);
      for (let i = 0; i < 8; i += 2) { const x = T[i] - 74, y = T[i + 1] + bob - 168; T[i] = 74 + x * cs - y * sn; T[i + 1] = 168 + x * sn + y * cs; }
    }
  } else if (k === 'sit') {
    if (S.settle > 0) { // settle-down squash right after sitting
      const p = 1 - S.settle / 0.4, sq = Math.sin(p * Math.PI * 2) * (1 - p) * 0.09; S.settle -= dt;
      P.ts = [0, 0, 1 + sq * 0.6, 1 - sq]; P.head[1] += sq * 90; for (const i of [2, 3]) P.legs[i][1] += sq * 30;
    }
    const br = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 2.8); P.ts[3] *= 1 + 0.015 * br; P.head[1] -= br * 1.5;
    S.tapT = (S.tapT + dt) % 1.9; const tap = S.tapT < 0.34 ? Math.sin(Math.PI * S.tapT / 0.34) : 0, curl = Math.sin(t * 1.3) * RM;
    T[4] += curl * 3; T[5] -= curl * 2; T[6] += 4 * tap + curl * 4; T[7] -= 13 * tap; T[5] -= 4 * tap;
    if (S.earT > 0) P.ears[S.earSide] += (S.earSide ? 16 : -18) * twitch;
  } else if (k === 'loaf') {
    const br = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 3.4); P.ts = [0, 0, 1 + 0.008 * br, 1 + 0.02 * br]; P.head[1] -= br * 1.5;
    T[6] += Math.sin(t * 1.1) * 3 * RM; T[7] -= (0.5 + 0.5 * Math.sin(t * 1.1)) * 3 * RM;
    P.eyeOpen = 1; if (S.earT > 0) P.ears[S.earSide] += (S.earSide ? 12 : -14) * twitch;
  } else if (k === 'hop') {
    const p = c.hopT > 0 ? 1 - c.hopT / HOPD : 1, q = 0.5 - p; // q: +0.5 take-off .. -0.5 landing
    P.g[2] = -12 + (p - 0.5) * 20;
    for (const i of [0, 1]) { P.legs[i][2] -= 14 * q; P.legs[i][3] += 12 * q; } // hind legs push off, then tuck
    for (const i of [2, 3]) { P.legs[i][2] -= 6 * q; P.legs[i][3] -= 20 * q; } // front legs tucked, then reach for the ground
    T[6] += 6 * q; T[7] += 18 * q; T[4] += 3 * q; T[5] += 8 * q; // tail trails the motion
    P.ears = [-14 * q, -12 * q]; P.head[2] -= 8 * q; P.eyeOpen = 1;
  } else if (k === 'dash') {
    P.ts = [0, 0, 1.06, 0.96]; P.eyeOpen = 1;
    const v = Math.sin(t * 40) * 1.5 * RM; T[5] += v * 0.5; T[7] += v;
  } else if (k === 'fall') {
    const j = 1 + 0.045 * Math.sin(t * 47) + 0.03 * Math.sin(t * 29); // fur puff
    P.ts = [0, 0, j, 2 - j * 0.98 + 0.02 * Math.sin(t * 37)]; P.partS = 1 + 0.05 * Math.sin(t * 41 + 1); P.eyeOpen = 1;
    P.legs[2][2] += Math.sin(t * 26) * 5; P.legs[2][3] += Math.cos(t * 26) * 4; P.legs[3][2] -= Math.sin(t * 23 + 1) * 5; P.legs[3][3] += Math.cos(t * 23 + 1) * 4;
    P.head[2] += Math.sin(t * 31) * 3;
  }
  return P;
}
const _tp = new Float32Array(58), _tl = new Float32Array(29);
function catTail(g, T, w, ink) {
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const s = i / n, a = (1 - s) ** 3, b = 3 * (1 - s) ** 2 * s, c = 3 * (1 - s) * s * s, d = s ** 3;
    _tp[i * 2] = a * T[0] + b * T[2] + c * T[4] + d * T[6]; _tp[i * 2 + 1] = a * T[1] + b * T[3] + c * T[5] + d * T[7];
    _tl[i] = i ? _tl[i - 1] + Math.hypot(_tp[i * 2] - _tp[i * 2 - 2], _tp[i * 2 + 1] - _tp[i * 2 - 1]) : 0;
  }
  const path = (t0, t1) => {
    const tot = _tl[n], s0 = t0 * tot, s1 = t1 * tot, at = s => { let i = 1; while (i < n && _tl[i] < s) i++; const u = (s - _tl[i - 1]) / Math.max(1e-9, _tl[i] - _tl[i - 1]); return [lerp(_tp[i * 2 - 2], _tp[i * 2], u), lerp(_tp[i * 2 - 1], _tp[i * 2 + 1], u)]; };
    g.beginPath(); const p0 = at(s0); g.moveTo(p0[0], p0[1]);
    for (let i = 0; i <= n; i++) if (_tl[i] > s0 && _tl[i] < s1) g.lineTo(_tp[i * 2], _tp[i * 2 + 1]);
    const p1 = at(s1); g.lineTo(p1[0], p1[1]);
  };
  path(0, 1); g.lineWidth = w + 2 * CK.SW; g.strokeStyle = ink; g.stroke();
  g.lineWidth = w; g.strokeStyle = CK.OS; g.stroke();
  g.save(); g.translate(-1.6, -1.6); g.lineWidth = w * 0.55; g.strokeStyle = CK.O; g.stroke(); g.restore();
  g.lineCap = 'butt'; g.strokeStyle = CK.STR; g.lineWidth = w;
  for (const [a, b] of [[0.42, 0.5], [0.62, 0.7], [0.82, 0.9]]) { path(a, b); g.stroke(); }
  g.lineCap = 'round';
}
function catLeg(g, l, far) {
  const [hx, hy, fx, fy] = l, L = Math.hypot(fx - hx, fy - hy) || 1, ux = (fx - hx) / L, uy = (fy - hy) / L;
  strokeLine(g, hx, hy, fx, fy, 12 + 2 * CK.SW, CK.ink);
  strokeLine(g, hx, hy, fx, fy, 12, far ? CK.FARS : CK.OS);
  strokeLine(g, hx - 1.5, hy - 1, fx - 1.5, fy - 1, 6, far ? CK.FAR : CK.O);
  strokeLine(g, fx - ux * 2, fy - uy * 2, fx, fy, 12, far ? CK.FARSOCK : CK.BEL);
}
function catEyes(g, kind, open, alpha) {
  if (kind === 'open' && open < 0.4) rp(g, 'cat_eyes_blink', alpha);
  else if (kind === 'open' && open < 1) rpT(g, 'cat_eyes_open', 0, 0, 0, 1, open, alpha);
  else rp(g, 'cat_eyes_' + kind, alpha);
}
function drawCatPose(g, P, torsoAlpha) {
  const G = P.g;
  g.save(); g.translate(G[0], G[1]); if (G[2]) { g.translate(G[3], G[4]); g.rotate(G[2] * D2R); g.translate(-G[3], -G[4]); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (P.back) rpT(g, P.back, 0, 0, 0, P.partS, P.partS);
  if (P.tailOn && !P.tailFront) catTail(g, P.tail, P.tw, CK.ink);
  const order = [0, 2, 1, 3];
  for (const i of order) if (P.show[i] && !P.front[i]) catLeg(g, P.legs[i], P.far[i]);
  const m = P.mix, ts = P.ts;
  rpT(g, P.torso, ts[0], ts[1], 0, ts[2], ts[3]);
  if (P.tailOn && P.tailFront) catTail(g, P.tail, P.tw, CK.ink);
  if (P.mid) rp(g, P.mid);
  for (const i of order) if (P.show[i] && P.front[i]) catLeg(g, P.legs[i], P.far[i]);
  // head: ears (twitch around their roots), skull, eye layer
  const H = P.head; g.save(); g.translate(H[0], H[1]); if (H[2]) g.rotate(H[2] * D2R);
  rpT(g, 'cat_ear_l', 0, 0, P.ears[0] * D2R, 1, 1); rpT(g, 'cat_ear_r', 0, 0, P.ears[1] * D2R, 1, 1);
  rp(g, P.mouth === 'o' ? 'cat_head_o' : 'cat_head');
  if (m && m.a.eyes !== m.b.eyes) { catEyes(g, m.a.eyes, P.eyeOpen, 1 - m.t); catEyes(g, m.b.eyes, P.eyeOpen, m.t); }
  else catEyes(g, P.eyes, P.eyeOpen, 1);
  g.restore();
  if (P.top) rpT(g, P.top, 0, 0, 0, P.partS, P.partS);
  g.restore();
}
// called inside drawCat's transform (origin = feet, already flipped/squashed); returns false -> frame fallback
function newCatRig() { return { key: null, from: null, cur: null, t: 1, dur: 0.12, lt: -1, lx: 0, ly: 0, phase: 0, walkW: 0, blinkT: 0, blinkD: 0.14, nextBlink: 2,
  earT: 0, earSide: 0, nextEar: 3, settle: 0, tapT: 0 }; }
function rigCat(c, k, S = CR) {
  if (!rigReady('cat')) return false;
  const dt = S.lt < 0 ? 0 : clamp(time - S.lt, 0, 0.05); S.lt = time;
  const d = Math.hypot(c.x - S.lx, c.y - S.ly); S.lx = c.x; S.ly = c.y;
  if (d < 40 && c.hopT <= 0 && c.fall <= 0) S.phase = (S.phase + d / GAIT_CYCLE) % 1; // gait driven by distance moved
  const walking = k === 'stand' && Math.hypot(c.vx, c.vy) > 20;
  S.walkW = clamp(S.walkW + (walking ? 1 : -1) * dt * 9, 0, 1);
  if (k !== S.key) {
    if (S.key && S.cur) { S.from = S.cur; S.t = 0; S.dur = k === 'dash' || S.key === 'dash' ? 0.07 : 0.12; } else S.t = 1;
    if (k === 'sit' && S.key !== 'loaf') S.settle = 0.4;
    S.key = k;
  }
  const tgt = catTarget(k, c, dt, S);
  S.t = Math.min(1, S.t + (dt > 0 ? dt / S.dur : 0));
  const P = S.from && S.t < 1 ? blendPose(S.from, tgt, ease(S.t)) : tgt;
  S.cur = P;
  rigK = CATK; ctx.save(); ctx.scale(CATK, CATK); ctx.translate(-128, -232);
  drawCatPose(ctx, P); ctx.restore();
  return true;
}

// ---------- ROBOT ----------
const RBK = { ink: '#1d2433', RB: '#9fb6cc', RBS: '#839cb5', RD: '#5d7590', TRS: '#2d3650', TRB: '#262e44', WHH: '#8d99b4' };
const TREAD_PATH = typeof Path2D === 'function' ? new Path2D('M95 500H305A33 33 0 0 1 338 533A33 33 0 0 1 305 566H95A33 33 0 0 1 62 533A33 33 0 0 1 95 500Z') : null;
// hand offsets from the left shoulder (106,350) per mood (right arm is mirrored): straight from the frame art
const ARM_POSE = { down: [-54, 82], up: [-62, -88], ecstatic: [-72, -114], droop: [-38, 92], fidget: [-30, 88] };
const botRig = {};
function botState(id) {
  return botRig[id] || (botRig[id] = { lt: -1, wx: null, wy: 0, hx: 0, hy: 0, hvx: 0, hvy: 0, pvx: 0, pvy: 0, ant: 0, antV: 0, wheel: 0, teeth: 0,
    mood: null, prev: null, mt: 1, arms: null, blinkT: 0, nextBlink: 2.5, tears: [], tearCd: 0, sweatT: 0 });
}
function armTarget(mood, side, t) { // returns [angle, length] of shoulder->hand, side 0 = left (screen), 1 = right
  const key = mood === 'ecstatic' ? 'ecstatic' : mood === 'happy' ? 'up' : mood === 'sad' || mood === 'crying' ? 'droop' : mood === 'nervous' ? 'fidget' : 'down';
  const v = ARM_POSE[key]; let a = Math.atan2(v[1], side ? -v[0] : v[0]), l = Math.hypot(v[0], v[1]), dir = side ? -1 : 1;
  if (key === 'up') a += dir * (side ? Math.sin(t * 9) * 0.38 : Math.sin(t * 9 + 1) * 0.08) * Math.max(0.4, RM); // right hand waves
  else if (key === 'ecstatic') a += dir * Math.sin(t * 12 + side * Math.PI) * 0.3 * Math.max(0.4, RM);
  else if (key === 'droop') a += dir * (Math.sin(t * 1.2 + side) * 0.05 + (mood === 'crying' ? Math.sin(t * 17) * 0.05 : 0));
  else if (key === 'fidget') { a += dir * (Math.sin(t * 13 + side * 2) * 0.12 + Math.sin(t * 7.3 + side) * 0.08) * Math.max(0.4, RM); l += Math.sin(t * 9 + side * 3) * 4; }
  else a += dir * Math.sin(t * 1.5 + side * 0.6) * 0.05;
  return [a, l];
}
function botArm(g, sx, sy, a, l) {
  const hx = sx + Math.cos(a) * l, hy = sy + Math.sin(a) * l;
  strokeLine(g, sx, sy, hx, hy, 14 + 2 * 11 * 0.8, RBK.ink); strokeLine(g, sx, sy, hx, hy, 14, RBK.RBS);
  strokeLine(g, sx - 2, sy - 1.5, hx - 2, hy - 1.5, 8, RBK.RB);
  g.beginPath(); g.arc((sx + hx) / 2, (sy + hy) / 2, 9, 0, Math.PI * 2); g.fillStyle = RBK.RD; g.fill(); g.lineWidth = 6.6 * 0.8; g.strokeStyle = RBK.ink; g.stroke();
  rpT(g, 'robot_hand', hx, hy, 0, 1, 1);
}
// called with the origin at the robot's feet, scaled by s; b = gentle bob (px), lift = bounce (px). Returns false -> frame fallback.
function rigBot(id, s, mood, b, lift) {
  if (!rigReady('robot')) return false;
  const B = botState(id), t = time, dt = B.lt < 0 ? 0 : clamp(t - B.lt, 0, 0.05); B.lt = t;
  // world position (art units) of the body from the current transform -> head spring, antenna wobble, tread motion
  const M = ctx.getTransform(), K = BOTK, wx = M.e / M.a / K, wy = M.f / M.d / K + (b - lift) / K;
  if (B.wx === null || Math.hypot(wx - B.wx, wy - B.wy) > 400) { B.wx = wx; B.wy = wy; B.hx = wx; B.hy = wy; B.hvx = B.hvy = 0; }
  const dx = wx - B.wx, dy = wy - B.wy; B.wx = wx; B.wy = wy;
  if (dt > 0) {
    // head = damped spring trailing the body (a little lag + overshoot)
    const ax = 260 * (wx - B.hx) - 12 * B.hvx, ay = 260 * (wy - B.hy) - 12 * B.hvy;
    B.hvx += ax * dt; B.hvy += ay * dt; B.hx += B.hvx * dt; B.hy += B.hvy * dt;
    // antenna: spring-damped, kicked by the head's acceleration
    const vx = dx / dt, vy = dy / dt, accx = (vx - B.pvx) / dt, accy = (vy - B.pvy) / dt; B.pvx = vx; B.pvy = vy;
    const force = clamp(-accx * 0.0009 + accy * 0.0005, -40, 40) * RM;
    B.antV += (-110 * B.ant - 3.2 * B.antV + force) * dt; B.ant = clamp(B.ant + B.antV * dt, -0.6, 0.6);
    B.wheel += (dx + dy * 0.6) / 17; B.teeth += dx + dy * 0.6;
  }
  const hox = clamp(B.hx - wx, -14, 14), hoy = clamp(B.hy - wy, -16, 16);
  // mood change: cross-fade face layers + eye squash; arms ease to the new pose
  if (mood !== B.mood) { B.prev = B.mood; B.mood = mood; B.mt = B.prev ? 0 : 1; }
  B.mt = Math.min(1, B.mt + dt / 0.18);
  if (!B.arms) B.arms = [armTarget(mood, 0, t), armTarget(mood, 1, t)];
  for (let i = 0; i < 2; i++) { const tg = armTarget(mood, i, t), A = B.arms[i], k = Math.min(1, dt * 12); A[0] += (tg[0] - A[0]) * k; A[1] += (tg[1] - A[1]) * k; }
  B.nextBlink -= dt; if (B.nextBlink <= 0) { B.blinkT = 0.14; B.nextBlink = rnd(2.5, 5); }
  let open = 1; if (B.blinkT > 0) { B.blinkT -= dt; open = 1 - Math.sin(Math.PI * (1 - Math.max(0, B.blinkT) / 0.14)); }
  rigK = BOTK * s; const g = ctx; g.save(); g.translate(0, -lift); g.scale(K, K); g.translate(-200, -572);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const by = b / K; // body bob in art units (treads stay planted)
  g.save(); g.translate(0, by);
  botArm(g, 106, 350, B.arms[0][0], B.arms[0][1]); botArm(g, 294, 350, B.arms[1][0], B.arms[1][1]);
  rp(g, 'robot_neck'); g.restore();
  // treads: fill, scrolling teeth (top runs forward, bottom backward), outline, rotating wheels
  rp(g, 'robot_tread');
  if (TREAD_PATH) {
    g.save(); g.clip(TREAD_PATH); g.lineWidth = 5;
    const o = ((B.teeth % 20) + 20) % 20;
    g.strokeStyle = RBK.TRS; g.beginPath(); for (let x = 72 + o; x < 330; x += 20) { g.moveTo(x, 503); g.lineTo(x, 509); } g.stroke();
    g.strokeStyle = RBK.TRB; g.beginPath(); for (let x = 92 - o; x < 330; x += 20) { if (x < 70) continue; g.moveTo(x, 557); g.lineTo(x, 563); } g.stroke();
    g.restore(); g.lineWidth = 11; g.strokeStyle = RBK.ink; g.stroke(TREAD_PATH);
  }
  for (let i = 0; i < 5; i++) { const x = 100 + i * 50; rpT(g, 'robot_wheel', x, 533, B.wheel, 1, 1); rpT(g, 'robot_wheel_hl', x, 533, 0, 1, 1); }
  g.save(); g.translate(0, by); rp(g, 'robot_body');
  // head group (spring offset + a little tilt from the lag)
  g.translate(hox, hoy); g.translate(200, 304); g.rotate(hox * 0.006 + (mood === 'crying' ? Math.sin(t * 17) * 0.012 : 0)); g.translate(-200, -304);
  const antA = B.ant + Math.sin(t * 2.1) * 0.03 * RM;
  g.save(); g.translate(200, 108); g.rotate(antA); g.translate(-200, -108); rp(g, 'robot_antenna');
  if (mood === 'ecstatic') { g.lineWidth = 5; g.strokeStyle = RBK.ink; g.beginPath(); for (const [x1, y1, x2, y2] of [[172, 36, 160, 30], [176, 58, 162, 62], [244, 34, 256, 28], [242, 58, 256, 62]]) { const k = 1 + 0.15 * Math.sin(t * 10); g.moveTo(x1, y1); g.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k); } g.stroke(); }
  g.restore();
  rp(g, 'robot_head_back'); rp(g, 'robot_head');
  const face = (m, al, sq) => {
    if (al <= 0 || !m) return;
    const eyes = m === 'neutral' && open < 0.4 ? 'robot_eyes_blink' : 'robot_eyes_' + m, ey = m === 'neutral' && open < 0.4 ? 1 : Math.max(0.15, open) * sq;
    rpT(g, eyes, 0, 0, 0, 1 + (1 - sq) * 0.25, ey, al);
    rpT(g, 'robot_mouth_' + m, m === 'nervous' ? Math.sin(t * 30) * 1.2 * RM : 0, 0, 0, m === 'ecstatic' ? 1 + 0.04 * Math.sin(t * 8) : 1, m === 'ecstatic' ? 1 + 0.06 * Math.sin(t * 8) : 1, al);
  };
  const sq = 1 - 0.45 * Math.sin(Math.PI * B.mt);
  if (B.mt < 1) face(B.prev, 1 - B.mt, sq);
  face(mood, B.mt, sq);
  rp(g, 'robot_screen_top');
  if (mood === 'nervous') { // sweat drop sliding down the side of the head
    B.sweatT = (B.sweatT + dt) % 1.8; const p = B.sweatT / 1.8, al = Math.min(1, p / 0.15, (1 - p) / 0.25);
    g.save(); g.translate(352, 140 + 34 * p * p); g.rotate(10 * D2R); g.scale(1.2, 1.2 + 0.1 * p); rp(g, 'robot_tear', al); g.restore();
  }
  if (mood === 'crying' && dt > 0) { // tears spring out of the screen sides and fall
    B.tearCd -= dt;
    if (B.tearCd <= 0) { B.tearCd = rnd(0.12, 0.2); const side = B.tears.length % 2 ? 1 : -1;
      B.tears.push({ x: 200 + side * 128 + hox, y: 248 + hoy, vx: side * rnd(70, 130), vy: -rnd(60, 120), s: rnd(0.7, 1), life: 0, max: rnd(0.55, 0.75) }); }
  }
  g.restore();
  for (let i = B.tears.length - 1; i >= 0; i--) {
    const d = B.tears[i]; d.life += dt; d.vy += 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.life >= d.max) { B.tears.splice(i, 1); continue; }
    const al = Math.min(1, (d.max - d.life) / (d.max * 0.35));
    g.save(); g.translate(d.x, d.y + by); g.rotate(Math.atan2(-d.vx, d.vy)); g.scale(d.s, d.s * (1 + Math.min(0.4, Math.hypot(d.vx, d.vy) / 900))); rp(g, 'robot_tear', al); g.restore();
  }
  if (mood === 'ecstatic') for (const [i, [x, y, r]] of [[28, 160, 14], [372, 150, 16], [360, 92, 9]].entries()) {
    const k = r / 16 * (0.75 + 0.3 * Math.sin(t * 6 + i * 2.1)) ; g.save(); g.translate(x + hox, y + hoy + by); g.rotate(Math.sin(t * 2 + i) * 0.3 * RM); g.scale(k, k); rp(g, 'robot_sparkle'); g.restore();
  }
  g.restore();
  return true;
}
// Draws a cat. c = the main `cat` or a grid entity (see addEntity in 40-grid.js); S = its rig state;
// opts.alpha / opts.filter (canvas filter string, e.g. a hue shift for the mirror ghost).
function drawCat(c = cat, S = CR, opts = {}) {
  let sc = 1, alpha = opts.alpha == null ? 1 : opts.alpha;
  if (c.fall > 0) { sc = Math.max(0, 1 - c.fall / 0.8); alpha *= sc; }
  ctx.save(); ctx.globalAlpha = alpha; if (opts.filter) ctx.filter = opts.filter;
  ell(ctx, c.x, c.y, 18 * (1 - c.z / 60) * sc, 6 * (1 - c.z / 60) * sc, 'rgba(0,0,0,.22)', 0);
  ctx.translate(c.x, c.y - c.z); if (c.fall > 0) ctx.rotate(c.fall * 8);
  ctx.scale(c.face * c.sx * sc, c.sy * sc);
  const main = c === cat, held = main ? key.sit : c.sitHold;
  const sitting = c.hopT <= 0 && c.dashT <= 0 && (held || c.sitT > 0 || (main && (mode === 'verifying' || mode === 'result'))) && c.fall <= 0;
  const loaf = sitting && R && R.def && R.def.loaf && held;
  const moving = Math.hypot(c.vx, c.vy) > 20, lg = moving ? Math.sin(c.walkT) * 4 : 0;
  const tailW = Math.sin(time * 4) * 0.4;
  const blink = (time % 3.5) < 0.12;
  const fr = c.fall > 0 ? 'fall' : (c.hopT > 0 || c.z > 0) ? 'hop' : c.dashT > 0 ? 'dash' : loaf ? 'loaf'
    : sitting ? (blink ? 'sit_blink' : 'sit') : moving ? 'walk_' + (((Math.floor(c.walkT / (Math.PI / 2)) % 4) + 4) % 4) : blink ? 'stand_blink' : 'stand';
  const rk = c.fall > 0 ? 'fall' : (c.hopT > 0 || c.z > 0) ? 'hop' : c.dashT > 0 ? 'dash' : loaf ? 'loaf' : sitting ? 'sit' : 'stand';
  const csz = 256 * CATK, rigged = rigCat(c, rk, S), spr = rigged ? null : artCanvas('cat/' + fr, csz, csz);
  if (rigged) { /* cutout rig drew the cat */ }
  else if (spr) ctx.drawImage(spr, -128 * CATK, -232 * CATK, csz, csz);
  else if (loaf) {
    ell(ctx, 0, -10, 20, 11, C.cat); ln(ctx, [[-6, -19], [-6, -13]], 3, C.catD); ln(ctx, [[2, -20], [2, -14]], 3, C.catD);
    drawCatHead(12, -18, true);
  } else if (sitting) {
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-24, 0, -20 + tailW * 6, -14); sh(ctx, null, 7); ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-24, 0, -20 + tailW * 6, -14); ctx.lineWidth = 4; ctx.strokeStyle = C.cat; ctx.stroke();
    ell(ctx, 0, -14, 13, 15, C.cat); ell(ctx, 3, -11, 7, 10, C.catL, 0); ln(ctx, [[-9, -20], [-4, -18]], 2.5, C.catD); ln(ctx, [[-10, -13], [-4, -12]], 2.5, C.catD);
    rr(ctx, -2, -4, 6, 5, 2, C.cat, 2); rr(ctx, 5, -4, 6, 5, 2, C.cat, 2);
    drawCatHead(3, -33, false);
  } else {
    ctx.beginPath(); ctx.moveTo(-15, -16); ctx.quadraticCurveTo(-30, -20, -28 + tailW * 8, -36); ctx.lineWidth = 7; ctx.strokeStyle = O; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = C.cat; ctx.stroke();
    [[-10, lg], [-4, -lg], [7, -lg], [13, lg]].forEach(l => rr(ctx, l[0] - 3, -10, 6, 10 + l[1] * 0.5, 3, C.catD, 2));
    ell(ctx, 0, -16, 18, 10, C.cat); ln(ctx, [[-8, -24], [-6, -18]], 2.5, C.catD); ln(ctx, [[-1, -25], [0, -19]], 2.5, C.catD);
    drawCatHead(15, -26, false);
  }
  ctx.restore();
}
function drawCatHead(x, y, sleepy) {
  poly(ctx, [[x - 10, y - 5], [x - 8, y - 18], [x - 1, y - 9]], C.cat, 2.5); poly(ctx, [[x + 10, y - 5], [x + 8, y - 18], [x + 1, y - 9]], C.cat, 2.5);
  circ(ctx, x, y, 11, C.cat, 2.5); ln(ctx, [[x - 3, y - 10], [x - 2, y - 6]], 2, C.catD); ln(ctx, [[x + 3, y - 10], [x + 2, y - 6]], 2, C.catD);
  if (sleepy || (time % 3.5) < 0.12) { ln(ctx, [[x - 6, y], [x - 2, y]], 2); ln(ctx, [[x + 3, y], [x + 7, y]], 2); }
  else { let lx = 0; if (R && R.fly && mode === 'play') lx = Math.cos(R.fly.a * 3) * 1.5; circ(ctx, x - 4 + lx, y - 1, 2.6, O, 0); circ(ctx, x + 5 + lx, y - 1, 2.6, O, 0); }
  poly(ctx, [[x, y + 3], [x + 3, y + 3], [x + 1.5, y + 5]], '#ff8fa3', 0);
  ln(ctx, [[x + 9, y + 3], [x + 17, y + 1]], 1.2, '#00000066'); ln(ctx, [[x + 9, y + 5], [x + 17, y + 6]], 1.2, '#00000066');
}
