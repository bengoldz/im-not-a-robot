# Round type API (I'm Not A Robot)

Read DESIGN.md first (rules, the new types, the juice budget). This file is the contract for writing a round type.
`game/src/rounds/lights.js` is the worked example: copy it.

## 1. Files, build, test

```
game/index.template.html     title, styles, markup, ART markers, /*@@SCRIPTS@@*/
game/src/00-core.js          constants, layout boxes, seeded RNG, input, audio core, shared state (mode, R, RUN, cat, bot)
game/src/10-art.js           SVG art loader, icons (ICON, drawIcon, iconTile, defineIcon), cat/robot rigs, drawCat, drawBot
game/src/20-juice.js         EASE, tween, after, hitstop, shake (budgeted), particles, tile juice, stamps, SFX, music
game/src/30-director.js      registerRound, makeRun (director), round lifecycle, verify flow, pads, defaultSit
game/src/40-grid.js          G (grid geometry), tiles, selection, pushing, entities, icon groups, default tile drawing
game/src/rounds/*.js         ONE FILE PER ROUND TYPE  <- you work here
game/src/50-cat.js           cat movement (free / step), hooks dispatch, entity movement, drawCats
game/src/80-ui.js            HUD, header, footer, title/end screens, overlays, render()
game/src/90-main.js          update(), loop, window.DEV, #hash dev links
game/build.js                -> game/dist/index.html (node --check'ed; fails loudly)
```

All files are plain scripts concatenated into ONE `<script>` (shared globals, no modules). Order: `src/0x..4x`,
then `src/rounds/*.js` alphabetically, then `src/5x..9x`. Consequence: at the TOP LEVEL of your round file you may
use anything from 00–40 (registerRound, ICONS, makeRng, …) but only call 50–90 functions (e.g. `catCell`, `txt`) from
inside your hooks. Prefix your file-level helpers with your id (`sokoPlan`, `ICE_ROCK`) to avoid global clashes;
`function` declarations are hoisted, `const`s are not (another round file must not use your consts at load time).

```
node game/build.js                                   # build (prints script list; non-zero exit on syntax error)
```
Test in the browser console or Playwright: `DEV.play('lights', 0.6, 42)` (id, d, seed, intro=false) starts a
1-round run (pass -> ACCESS GRANTED, fail -> DENIED). `DEV.state()` returns a JSON snapshot (round, tiles, cat cell,
progress, par, stats, result). `DEV.warp(cell)` puts the cat on a cell, `DEV.foot(cell)` gives its standing point.
`DEV.makeRun(seed)` shows a run's slots, `DEV.run(seed)` plays one. Hash links: `#round=lights&d=0.6&seed=42` or the
bare form `#lights-0.6-42` (only bare `#tokens` reach the page in the artifact viewer). Use `hidden: true` while
developing so the director never picks your type, then remove it.

Playwright recipe (deterministic: pause the rAF loop and step the game yourself):
```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));        // ignore the Google Fonts certificate error
await p.goto('file:///home/user/jam/not-a-robot/game/dist/index.html'); await p.waitForTimeout(1200);
await p.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  window.frame = (n = 1) => { for (let i = 0; i < n; i++) { update(1 / 60); render(); } };
  window.tap = (k, n = 20) => { pressed[k] = true; key[k] = true; frame(1); key[k] = false; frame(n); };   // k: up down left right hop dash sit
  DEV.play('lights', 0.5, 7); frame(40);
});
await p.evaluate(() => { DEV.warp(4); tap('sit'); });                 // or walk: hold key.left=true for N frames
console.log(await p.evaluate(() => DEV.state().round.progress));
await p.screenshot({ path: 'shot.png' });
```
Input is ONLY `key[k]` (held) and `pressed[k]` (this frame) for k in up/down/left/right/hop/dash/sit.
Check screenshots at d = 0, 0.5, 1. `game/test/` has the lead's harness: `lib.js` (open + step), `bot.js` (an autoplayer that solves every shipped type
through key state: walking, BFS, GF(2) for lights), `play.js` (DEV.play every type at d 0/0.5/1), `steptest.js`
(step mode, pushing, ice, mirror ghost via hidden test rounds — a good template), `director.js`, `run.js`, `ai.js` (asserts the game never touches `window.claude`: there is no live AI),
`traffic.js` (pixel-diffs 200 traffic scenes against the judge), `edges.js` (human-play edge cases: random imprecise
walking + sits on every free-mode type, dash/hop/sit timing, presses during transitions, mid-animation sits).
Run e.g. `node game/test/play.js lights` (screenshots go to game/test/shots/ or $SHOTS).

## 2. registerRound(def)

```js
registerRound({
  id: 'lights', name: 'Lights Out',
  minD: 0.25,          // earliest difficulty (0..1) at which the director may pick it
  weight: 1,           // pick weight among eligible types (match 1.4, absurd 0.9, checkbox 0.8, still 0.7)
  maxPerRun: 2,        // default 2 (match: 3)
  intro: 'One line the robot says on the FIRST appearance in a run (explain the mechanic).',
  again: 'line or [lines] for later appearances',   // optional
  move: 'free',        // 'free' (default) | 'step' — see §4
  verify: 'pad',       // 'pad' VERIFY pad submits (default) | 'auto' submit when solved(R) | 'both' | 'none' (you call finish)
  verifyBlocked: R => null, // optional: return a message to refuse the VERIFY pad right now (e.g. memory's show phase)
  exitGrid: true,      // step mode: may the cat walk off the grid edge (to reach VERIFY)?
  hideBot, loaf, hideTimerText, selShrink (default 0.82), noCheck (hide the blue check badge), autoDelay (0.35 s),
  hover: false (hide the free-mode hover outline on the cat's cell; only if your round draws its own),
  timeoutVerdict: 'text when R.limit runs out',
  parTime: R => seconds,   // default par if generate() returns none: { time: 14 + 12 d }
  hidden: false, boss: false,

  generate(d, rng, info) { return spec; },          // REQUIRED
  prepare(slot, rng) {},  enter(R) {},  update(R, dt) {},
  onSit(R, tile, info) {},  onStep(R, from, to, info) {},  onHop(R, from, to, info) {},  onMove(R, from, dir, how, path) {},
  canEnter(R, from, to, info) {},  moveCat(R, from, dir, how) {},  onPush(R, tile, from, to) {},  onTimeout(R) {},
  solved(R) {},  judge(R) {},  progress(R) {},
  drawUnder(R, g) {},  drawTile(R, g, tile, x, y, s) {},  drawOverlay(R, g) {},  drawTop(R, g) {},  drawTiles(R, g) {},
});
```

### generate(d, rng, info) -> spec  (required, pure)
- `d` 0..1. The director passes **0 on a type's first appearance in a run** (intro = easiest setting) and the slot's
  real d afterwards. `info = { intro, slot, d (target d of the slot), prep (from prepare), run }`.
- Use ONLY `rng` for randomness: `rng()`, `rng.f(a,b)`, `rng.int(a,b)` (inclusive), `rng.pick(arr)`,
  `rng.shuffle(arr)`, `rng.sample(arr,k)`, `rng.chance(p)`, `rng.weighted(items, fn)`, `rng.fork(tag)`. Never
  Math.random (runs and the DAILY must be reproducible). Do not read the live grid (`G`, `R`) here; use
  `gridMetrics(cols, rows, margin)` if you need pixel geometry.
- MUST return a solvable puzzle (construct it backwards, or BFS/solve-check and retry with the same rng).
- Spec fields the engine understands (everything else you return is copied onto `R` for your hooks):

| field | meaning |
|---|---|
| `grid: n` or `cols, rows` | grid size, up to 6x6 (0 = no grid, e.g. checkbox). Tiles are fitted into the GRID box (364x364). |
| `margin: {l,t,r,b}` | px to keep free inside the GRID box (e.g. nonogram clues: `{l: 70, t: 70}`); the grid shrinks and centres in the rest |
| `tiles: [...]` | `cols*rows` tile specs in reading order (object, or an icon name string). See §3. |
| `l1`, `big`, `l3` | header: small line, big line, hint line (all type themselves in) |
| `par` | `{ sits: k }`, `{ steps: k }`, `{ pushes: k }`, `{ hops }`, `{ time: s }` or a number (= seconds). PERFECT = pass and every par key ≤ (R.stats). |
| `limit` | seconds on the clock (timer bar; at 0: `onTimeout` or fail with `timeoutVerdict`) |
| `catStart` | cell index: the round starts with the cat standing on that cell (step mode) |
| `solution` | optional; shown in `DEV.state()` (tests) |

### R (the round instance, also passed to every hook)
`R = { ...spec, def, id, d, intro, slot, rng (seeded, for runtime randomness), tiles, cols, rows, par, limit, timeLeft,
stats: { t, sits, steps, hops, dashes, pushes }, ents: [], selN }`. Keep your state on R.

### Hooks (all optional; `this` is not used — always use the R argument)
| hook | when | return |
|---|---|---|
| `prepare(slot, rng)` | while the PREVIOUS round plays (slow precomputation) | value or Promise; becomes `info.prep` if it arrived in time |
| `enter(R)` | once, after tiles exist and the cat is placed | – |
| `update(R, dt)` | every frame while `mode === 'play'` | – |
| `onSit(R, tile, info)` | cat sat (C/X). `tile` = tile under the cat or `null` off-grid; `info = {x, y, cell}` | – (if you define onSit, call `defaultSit(R, tile)` for the normal select toggle) |
| `onStep(R, from, to, info)` | cat moved from cell `from` to `to` (-1 = off grid). `info = { dir: [dr,dc], how: 'walk'|'dash'|'slide'|'snap'|'exit' }` | – |
| `onHop(R, from, to, info)` | a hop landed (`from === to` = hop in place). `info = { dir, over }` (`over` = jumped-over cell in step mode, else -1) | – |
| `onMove(R, from, dir, how, path)` | step mode: the cat starts (or tries) a move; `path` = cells it will traverse (`[]` = blocked) — drive a mirror ghost here | – |
| `canEnter(R, from, to, info)` | may the cat / an entity enter `to`? `info = { dir, ent, push, hop }` | `true` / `false`, or `undefined` = default (no `wall`/`block`; pushables only if pushable that way) |
| `moveCat(R, from, dir, how)` | step mode: replace the path of one move (`how` = walk/hop/dash) | `null` = default, `[cells...]`, or `{ path, how: 'slide'|'walk'|'dash'|'hop', over }` |
| `onPush(R, tile, from, to)` | after a pushable tile moved | – |
| `solved(R)` | each frame for verify 'auto'/'both' | bool |
| `judge(R)` | on submit | `{ pass, verdict, wrong?: [cells], checked?: [cells], banned? }` or a Promise of it (shows "consulting the oracle") |
| `progress(R)` | every frame | short string for the header pill: `'Connected 4 / 7'` |
| `onTimeout(R)` | `limit` ran out | – (default: fail with `timeoutVerdict`) |
| `drawUnder(R, g)` | before the tiles (backgrounds, clues in the margins) | – |
| `drawTile(R, g, tile, x, y, s)` | per tile, inside its transform (squash/flip/wiggle/slide already applied) | `true` = handled, falsy = default face |
| `drawOverlay(R, g)` | after the tiles, below the cat (slot outlines, lines, hiding robots) | – |
| `drawTop(R, g)` | above the cat | – |
| `drawTiles(R, g)` | replaces ALL tile drawing (rarely needed) | – |

Verify flow (engine): judge → tiles in `checked` (default: selected ∪ wrong) are checked one by one in reading order:
green flash + rising chime, or red flash + bonk + wiggle for cells in `wrong` → VERIFIED stamp / strike. Give
`wrong` (and `checked` when the relevant tiles aren't the selected ones) so the sweep tells the player what was wrong.
`finish({ pass, verdict })` ends the round immediately (checkbox caught, the cat stepped on a mine, etc.).
Strikes, ACCESS DENIED, PERFECT, streaks, run summary and the robot's pass/fail lines are all automatic.

## 3. Grid and tiles

Geometry (`G`, set per round): `G.cols, G.rows, G.x, G.y` (top-left of cell 0), `G.w, G.h, G.pitch` (cell stride),
`G.ts` (tile size), `G.gap`, `G.area` (box after margins), `G.rowOff[]` (conveyor). Cells: `i = r * G.cols + c`.
`idx(r, c)` (-1 outside), `rcOf(i)`, `stepCell(i, dir, k=1)`, `neighbors4(i)`, `DIRS.up/right/down/left` = `[dr, dc]`,
`DIR4`, `cellXY(i)` (top-left px), `cellCenter(i)`, `cellFoot(i)` (where a cat stands), `cellAt(x, y)`.

Tiles: `R.tiles[i]` is the tile currently in cell i; `t.i / t.r / t.c` its cell, `t.home` its first cell. Fields the
default drawer and engine understand:

| field | |
|---|---|
| `icon` | icon tile (art/icons/<name>.svg or `defineIcon`) |
| `sel` | selected: blue check badge (stroke draws on) + slight shrink |
| `faceDown` | card back with the HUMANCHECK eye (memory, minesweeper) |
| `word` | wooden word block with that text (rules); `wordCol` optional colour |
| `pipe` (0..15), `rot` | cable bitmask 1=up 2=right 4=down 8=left, rotated `rot` quarter turns clockwise (`pipeMask(t)`); `lit` makes it glow cyan |
| `wall` / `block` | the cat (and pushes) can't enter. `wall` draws a block wall; `block` is invisible |
| `push` | pushable: walking into it moves it one cell if the target is `empty` and free |
| `empty` | bare floor (push targets) |
| `lit` / `dim` | warm glow / dark overlay |
| `hidden` | not drawn |  
| `noSelect` | `defaultSit` won't select it |
| `state` | `'ok'` · `'crumble'` (t = seconds left) · `'gone'` (hole: a cat standing on it falls -> fail) |

Helpers: `selectTile(t, on=!t.sel, {quiet, text})` (selection WITH juice + musical pop — use it instead of setting
`sel`), `selected()`, `tilesWhere(fn)`, `setTile(i, spec)`, `swapCells(a, b, {slide, dur})` (animated),
`canPush(i, dir)`, `pushTile(i, dir)` (slide + dust + thock + onPush), `canEnterCell(from, to, info)`,
`drawTileBase(t, x, y, s)` (default face without the card back), `drawTileFace`, `drawCardBack(g,x,y,s)`,
`drawWordTile(g, word, x, y, s)`, `drawPipe(g, t, x, y, s)`, `drawWall`, `drawFloor`, `drawCheckBadge`.
Things that belong to a CELL, not a tile (sokoban slot outlines, ice rocks), live in your own arrays on R and are drawn
in `drawUnder` / `drawOverlay`. Icon categories for "similar" decoys: `ICON_GROUPS`, `groupOf(icon)`,
`pickDecoy(target, similar0to1, rng)`. Icon names in `ICONS` (the 30 base icons; the absurd and match pools use this list).

## 4. The cat

- **Free mode** (`move: 'free'`, default): analog walking as in the original. `wall`/`block`/`push` tiles are solid;
  leaning into a pushable for 0.12 s pushes it. `onStep` fires when `catCell()` (below) changes (grounded),
  `onHop` when a hop lands. Sit -> `onSit`. Good for select-style puzzles (lights, memory, minesweeper, nonogram, spot).
- **Step mode** (`move: 'step'`): outside the grid the cat walks freely (to reach VERIFY / the pads); walking into the
  grid snaps it onto a cell, then each press moves one cell (holding keeps walking). Space hops two cells (over one),
  Shift dashes until blocked, walking off an edge leaves the grid (unless `exitGrid: false`). Pushes happen
  automatically when a walk enters a `push` tile. Use `catStart` to start on a cell. `moveCat` replaces the path:
  ```js
  moveCat(R, from, dir, how) {              // ice: slide until blocked
    if (how !== 'walk') return null;
    const path = []; let k = from;
    for (;;) { const j = stepCell(k, dir); if (j < 0 || !canEnterCell(k, j, { dir, push: false })) break; path.push(j); k = j; }
    return { path, how: 'slide' };         // [] = blocked (bump)
  }
  ```
- `catCell()` = the cell the cat is ON (-1 off grid). Free mode: the cell under the cat's BODY centre (`cat.y - CAT_BODY`,
  17 px above the feet; `cellFoot()` puts the body on the tile centre), with hysteresis (it stays on its cell until the body
  is `CAT_HYST` = 6 px past the middle of the gap). That one cell is what a sit acts on, what `onStep` / holes / conveyors
  use, and what the blue hover outline shows. Never use `cellAt(cat.x, cat.y)` (that's the feet, without hysteresis).
  A sit acts on the last rendered frame's state, stops the cat dead, and waits (buffered) while an entity is mid-move.
  `cat.x, cat.y` feet; `catToCell(i)`; `catFall()`; `catExclaim()`
  ("!" over the cat — use when the cat first touches your new tile type).
- **Entities** (second cat, e.g. the mirror ghost): `const e = addEntity({ cell, alpha: 0.62, filter: 'hue-rotate(180deg) …' })`
  (drawn as a pale glitchy cat), `moveEntity(e, dir, { push, how })` -> bool (respects walls / canEnter), `entitySit(e)`,
  `entityAt(i)`, `e.cell`, `e.onArrive = (from, to) => {}`. Mirror: in `onMove(R, from, dir)` call
  `moveEntity(R.ghost, [dir[0], -dir[1]])`; in `onSit` check `R.ghost.cell` and `catCell()`.

## 5. Juice (20-juice.js) — satisfying, NOT shaky

- **Never call `shake()`.** It only works for 'fail' / 'denied' (engine-owned). Use squash, flashes, particles.
- Tweens: `tween(obj, { x: 10, sq: [0.92, 1.04, 1] }, dur, { ease, delay, done })` (arrays = keyframes);
  `EASE.outBack / outCubic / inOutSine / spring / outQuad / linear`; `after(sec, fn)` (game-time timer, cancelled
  when the round ends); `hitstop(ms)` (freeze frame; engine already does 60 ms on verify/perfect).
- Tiles: `tileSquash(t)`, `tileFlash(t, col, dur)`, `tileWiggle(t)` (wrong), `tileFlip(t, { delay, dur, before })`
  (flip over; `before` = fields shown until the midpoint, e.g. `{ sel: was }` or `{ faceDown: true }`),
  `tileSlide(t, ox, oy)`, `tileSpin(t, fromRad)` (spring rotation: pipes `t.rot++; tileSpin(t, -Math.PI / 2)`), `tilePop(t)`.
- Particles: `burst(x, y, col, n, speed, size)` (ring), `dust(x, y, n, spread)`, `confetti(n)`, `addTxt(x, y, text, col)`.
- `stamp(text, col, { x, y, size, rot, life })`, `botWiggle()`, `say(line, mood, secs)` (moods: neutral happy
  ecstatic sad crying nervous), `toastMsg(text, secs)`.
- Sound (soft sine/triangle): `SFX.pop(k)` (do-re-mi by k), `SFX.toggle(k)`, `SFX.chime(k)`, `SFX.thock()` (push),
  `SFX.bonk()`, `SFX.chord()` (connected!), `SFX.tick()`, `SFX.desel()`, `SFX.whoosh()`, `SFX.stamp()`, `SFX.crumble()`,
  `SFX.beep()`, `SFX.meow()`. Low-level: `tone(f, dur, 'sine'|'triangle', vol, slide, delay)`, `noise(dur, vol, delay, lowpass)`.

## 6. Art and icons

- Procedural: `defineIcon('vacuum', 'indoor', g => { /* draw in a 100x100 box centred on 0,0 */ })` at the top of your
  file. Use the helpers `circ(g,x,y,r,fill,lw) ell rr(g,x,y,w,h,r,fill,lw) poly ln(g,pts,lw,col) sh` and the ink `O`.
- SVG: put `game/art/icons/<name>.svg` (512x512, style per art/ART_GUIDE.md); build.js embeds `game/art/<dir>/*.svg`
  as `ART['<dir>/<name>']` and `icons/<name>` automatically wins over the procedural icon. Draw any embedded SVG with
  `artDraw(g, 'dir/name', x, y, w, h)` (returns false until loaded — keep a procedural fallback). Never edit `art/`.
- Text on canvas: `txt(s, x, y, size, col, align, weight)` (80-ui.js; call from draw hooks only).

## 7. Checklist for a new type
1. `game/src/rounds/<id>.js` with `registerRound`, start with `hidden: true`.
2. `generate` pure + seeded + solvable at every d; intro (d = 0) is the easiest; `par` set; `l1/big/l3` fit the header.
3. `intro` line, 2–3 pass and fail quips in `judge` verdicts, `progress` readout.
4. Juice through the helpers above; no shake; no Math.random in generate.
5. `node game/build.js`, then DEV.play at d 0 / 0.5 / 1, solve it through key presses, screenshot, no page errors.
6. Remove `hidden`, pick `minD`/`weight` (see DESIGN.md table).

## 8. Worked example: game/src/rounds/lights.js
```js
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
```

## Reserved names on R
The engine owns these fields on the round object; don't use them for your own state (rename instead, e.g. `pslot`):
`slot`, `d`, `seed`, `id`, `kind`, `type`, `tiles`, `cols`, `rows`, `par`, `limit`, `ents`, `t`, `done`, `solution`.
Check `30-director.js` (`beginSlot`/`makeRound`) for the authoritative list if you add new engine fields.

## Extra cats
`addEntity` draws the ghost with alpha and an optional canvas `filter`. The default is now `null`: `ctx.filter` on the
rig is extremely slow in some browsers (seconds per frame in headless Chromium). Prefer alpha, tint overlays and
scanlines, as `mirror.js` does.
