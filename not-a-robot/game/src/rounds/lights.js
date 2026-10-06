// rounds/lights.js — LIGHTS OUT, re-skinned as "Select ALL squares".
// THE REFERENCE ROUND TYPE: copy this file to start a new one (see game/API.md). It shows:
//   - a pure, seeded generate(d, rng) that is solvable by construction and returns a par
//   - a custom onSit (instead of the default select toggle) with juice: tile flips in a ripple, bursts, musical sfx
//   - a per-tile custom face (drawTile) built on the default face (drawTileBase)
//   - progress readout, auto-verify via solved(), judge() with `wrong` tiles for the verify sweep, quips

// Cells toggled by pressing cell p on an n x n board: itself + its 4 neighbours (pure: does not touch the live grid)
function lightsArea(p, n) {
  const r = Math.floor(p / n), c = p % n, out = [p];
  if (r > 0) out.push(p - n); if (c < n - 1) out.push(p + 1); if (r < n - 1) out.push(p + n); if (c > 0) out.push(p - 1);
  return out;   // order: centre, up, right, down, left -> the ripple order
}
const LIGHTS_THEMES = ['sun', 'moon', 'balloon', 'crown', 'duck'];
const LIGHTS_PASS = ['Every square selected. That is the most squares. Very human.', 'All lights on. Your electricity bill looks extremely human.', 'Maximum selection achieved. HUMANCHECK is dazzled.'];
const LIGHTS_FAIL = ['Some squares are still in the dark. They feel left out.', 'Not ALL squares. We said ALL. In capitals.'];

registerRound({
  id: 'lights', name: 'Lights Out',
  minD: 0.25,                // the director may pick it once the run's difficulty reaches 0.25
  weight: 1,                 // relative pick weight among eligible types
  intro: 'Sitting flips the square AND its neighbours. Make them all checked.',   // said on the first appearance in a run
  again: 'Light switches again! Flip them ALL on. Humans love electricity.',       // said on later appearances
  verify: 'auto',            // no VERIFY pad: the engine submits by itself 0.35 s after solved(R) turns true
  selShrink: 0.94,           // selected tiles shrink a little less than the default 0.82 (every tile ends up selected)

  // d: 0 (intro / easiest) .. 1 (hardest). rng: seeded (rng.int, rng.pick, rng.sample, rng.shuffle, rng.chance, rng.f).
  // Start from the SOLVED board (all on) and apply `presses` random distinct presses: pressing is its own inverse, so
  // pressing the same cells again solves it -> always solvable, and `presses` is a fair par.
  generate(d, rng) {
    const n = d < 0.4 ? 3 : d < 0.75 ? 4 : 5, N = n * n;
    const presses = clamp(Math.round(lerp(2, N * 0.36, d)), 2, N - 1);
    let on, picks;
    do {
      picks = rng.sample([...Array(N).keys()], presses);
      on = new Array(N).fill(true);
      for (const p of picks) for (const j of lightsArea(p, n)) on[j] = !on[j];
    } while (on.every(Boolean));   // (some press sets cancel out on 4x4 / 5x5: never hand out a solved board)
    const theme = rng.pick(LIGHTS_THEMES);
    return {
      grid: n,                                           // n x n (or cols / rows for rectangles)
      tiles: on.map(v => ({ icon: theme, sel: v })),     // tile specs, reading order
      l1: 'Select', big: 'ALL squares', l3: 'Sit = flip it and its neighbours.',
      par: { sits: presses },                            // PERFECT = solved with <= presses sits
      solution: picks.sort((a, b) => a - b),            // extra fields are kept on R (tests read it via DEV.state())
    };
  },

  // tile = the tile the cat sits on, or null when it sits outside the grid
  onSit(R, tile) {
    if (!tile) { defaultSit(R, null); return; }
    const area = lightsArea(tile.i, G.cols);
    area.forEach((j, k) => {
      const t = R.tiles[j], was = t.sel;
      t.sel = !t.sel;                                                     // logic changes now ...
      tileFlip(t, { delay: k * 0.045, dur: 0.2, before: { sel: was } });  // ... the picture flips over in a quick ripple
      after(k * 0.045 + 0.1, () => {                                      // at each flip's midpoint:
        const c = cellCenter(j);
        if (t.sel) burst(c.x, c.y, C.blue, 6, 120, 3); else dust(c.x, c.y + G.ts * 0.3, 2, 10);
        if (k === 0) SFX.pop(R.tiles.filter(u => u.sel).length);         // centre: musical pop, pitch = lights on
        else SFX.toggle(k + 2);
      });
    });
    tileSquash(tile, 0.9, 1.06, 0.24);
  },

  // custom face: the default icon tile, dimmed when off, with a warm glow when on
  drawTile(R, g, t, x, y, s) {
    drawTileBase(t, x, y, s);
    if (t.sel) { g.save(); g.lineWidth = Math.max(3, s * 0.05); g.strokeStyle = '#ffd25a'; g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth); g.restore(); }
    else { g.fillStyle = 'rgba(15,22,48,.58)'; g.fillRect(x, y, s, s); }
    return true;   // handled (the engine still draws the check badge, flashes, squash, flips)
  },

  progress: R => `Lights ${R.tiles.filter(t => t.sel).length} / ${R.tiles.length} · par ${R.par.sits}`,
  solved: R => R.tiles.every(t => t.sel),
  judge(R) {
    const all = R.tiles.map(t => t.i), off = tilesWhere(t => !t.sel);
    if (!off.length) return { pass: true, verdict: pick(LIGHTS_PASS), checked: all };
    return { pass: false, verdict: pick(LIGHTS_FAIL), wrong: off, checked: all };
  },
});
