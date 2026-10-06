# I'm Not A Robot: puzzle overhaul design (shared contract for all agents)

Base build: /home/user/jam/not-a-robot/versions/rig/index.html (the "Rigged" version the team picked).
Hard rules that never change:
- Movement-only input: walk (arrows/WASD), hop (Space), dash (Shift), sit (C/X). Sitting on a tile = "select / act".
  The tile the cat is on (under its body centre, with a little hysteresis) is outlined in blue: that is the one a sit acts on.
  Walking onto the VERIFY pad = submit. No other buttons, no mouse.
- The playfield is the CAPTCHA tile grid inside the HUMANCHECK panel. The cat walks on top of it, top-down.
- The robot friend comments from the left panel. Everything is scripted: there is no live AI / network call anywhere
  (absurd rounds use hand-written prompts, accepted icon sets and verdicts).

## 1. Runs are random, difficulty rises slowly

A run is 12 rounds. Round i (0-based) has a target difficulty d = i / 11 (0 → 1), plus jitter of ±0.08, clamped.
The director picks a round TYPE for each slot, then that type GENERATES a fresh puzzle for d with a seeded RNG.

Director rules:
- Each type declares `minD` (earliest it may appear) and `weight`. Pick from types with minD ≤ d, weighted.
- No type twice in a row; no type more than twice per run (the classic "match" type may appear 3 times).
- The FIRST time a run uses a mechanic, it's generated at that type's easiest setting (intro), and the robot
  explains it in one line. A type's 2nd appearance in a run uses the real d.
- Slot 11 (the last) is always the BOSS ("select all squares containing a robot"; the friend hides on the grid).
- At least one absurd round between slots 3 and 8 (keeps the joke in every run).
- Runs are seeded. Seed = random by default; a "DAILY" pad on the title screen uses the date as the seed, so
  everyone gets the same run that day (shown as "DAILY HUMANCHECK #<day>").
- Strikes: 3 strikes = ACCESS DENIED (as now). A perfect round (no strike, under par time) gives a "PERFECT" stamp.

## 2. Round types

Existing ones are kept and turned into generators: match (select all X; grid 3x3 → 4x4 → 5x5, decoys get more
similar as d rises, e.g. car vs bus), traffic (object across tiles), absurd (subjective prompts like "feel lonely", judged against a hand-written accepted set), timed match, runaway
checkbox, conveyor rows, falling tiles, stand-still, boss.

New "insane" types, each inspired by a great puzzle game, re-skinned as a CAPTCHA:

| id | Name on screen (prompt) | Inspired by | Mechanic | Difficulty knobs |
|---|---|---|---|---|
| `rules` | "Select all squares with [FISH]" where the prompt's noun is a pushable WORD TILE on the grid | Baba Is You | Some tiles are word tiles (FISH, CAT, SOCK, NOTHING...). The cat pushes them (walk into them) into the prompt slot at the top row of the grid to change what the prompt asks for. The grid has no fish? Push the word "SOCK" into the slot and select the socks. Or push NOTHING into the slot and verify with nothing selected. | number of word tiles, walls, pushing order constraints |
| `sokoban` | "Assemble the image" | Sokoban | A picture (traffic light, bus, robot) is split across 2–4 tiles that are scattered; the cat pushes picture tiles into the outlined slots. Tiles can't be pulled. | piece count, grid 4x4→5x5, obstacles; generator must verify solvable by BFS |
| `lights` | "Select ALL squares" | Lights Out | Sitting on a tile toggles it AND its 4 neighbours. Goal: all selected. | grid 3→4→5, scramble depth; generate by applying k random presses to a solved board, so it's always solvable |
| `ice` | "Select all squares with fish. The floor is freshly mopped." | Pokémon ice caves / Ice Pick Lodge | Tiles are slippery: one move slides the cat until it hits a wall/obstacle/edge. Sit on each target. Rocks (non-slippery) are stoppers. | target count, obstacles; BFS-verified |
| `pipes` | "Connect the internet to your robot friend" | Pipe Mania / Loop / Infinity Loop | Every tile is a pipe/cable segment; sitting on a tile rotates it 90°. Connect the router (left edge) to the robot (right edge). The cable lights up as it connects (juicy). | grid size, number of scrambled tiles, decoy branches; generate a random path then scramble rotations |
| `memory` | "Select all squares that HAD fish" | Simon / memory games | Tiles show for N seconds, then flip face-down (card backs with the HUMANCHECK eye). Select from memory. | show time, grid size, target count, similar decoys |
| `minesweeper` | "Select all squares WITHOUT a vacuum" | Minesweeper / Hexcells | Tiles are face-down. Sitting on a tile reveals it: a number of adjacent vacuums, or a vacuum (strike). Reveal all safe tiles. First sit is always safe. | grid size, mine count; generate boards that are solvable without guessing (simple constraint solver) |
| `nonogram` | "Select the squares that match the numbers" | Picross / Nonograms | Row and column clue numbers around the grid; sit to select; picture appears when solved (it's a cat). | grid 4x4→5x5→6x6; only use pictures with a unique solution (check with a line solver) |
| `mirror` | "Two cats. One verification." | Herding / The Witness mirror puzzles / Snakebird-like | A mirrored ghost cat (pale, glitchy) copies your moves horizontally mirrored. Both cats must SIT on target tiles at the same moment. Walls block each independently. | wall count, mirror axis (h, then v at higher d), BFS-verified |
| `path` | "Draw a line through all fish. Do not cross yourself." | The Witness | Every tile the cat enters leaves a glowing line; you can't re-enter a lit tile (hop over it). Visit every fish tile in one continuous path, ending on VERIFY. Leaving a wrong tile lit = invalid. Sitting retracts the last step (undo). | grid size, targets, blocked tiles; generate by random self-avoiding walk |
| `gravity` | "Select all squares with fish. Some assembly required." | Threes / 2048 / Tetris | Tiles fall down whenever there's a gap below. Sitting on a tile POPS it (removes it), and the column above drops. Make all fish end up in the bottom row, then verify. | grid size, fish count, number of pops allowed (par) |
| `spot` | "Select the square that is different" | Spot the difference / Where's Waldo | 16–25 near-identical tiles (same icon), one has a tiny change (eye color, missing stripe, mirrored). The difference is drawn procedurally by tweaking the icon (rotation, tint, flip, scale, missing detail overlay). | grid size, subtlety of the change |

Every new type needs: an intro line for the robot, 2–3 pass/fail quips, a par (moves or seconds) and a clear
on-screen goal readout ("2 / 3 fish", "Connected 4 / 7", "Lights 18 / 25").

## 3. Juice (satisfying, NOT shaky)

Screen shake budget: only on a FAILED verify (one small shake, 6 px max, 0.25 s), and on ACCESS DENIED. Never on
selection, pushes, pops, or success. Respect prefers-reduced-motion (no shake at all).
Use instead:
- Tile select: the tile squashes down (scale 0.92 → 1.04 → 1, 0.2 s, easeOutBack), a check-mark draws on with a stroke
  animation, a ring burst of 6–8 small particles in the UI blue, and a soft "pop" sound with pitch rising per selection
  in the same round (do-re-mi), so selecting feels musical.
- Verify sequence: the tiles are checked one by one in reading order (60 ms each), each correct tile flashes green
  with a rising chime; the big panel stamp "VERIFIED ✓" slams in with a squash, confetti of small checkmarks and
  paw prints falls from the header, and the robot does a happy wiggle. A wrong tile flashes red with a low "bonk"
  and a tiny horizontal wiggle of THAT TILE only.
- Hit-stop: 60 ms freeze on the frame of a successful verify and on a perfect stamp.
- Pushing tiles (sokoban, rules): tiles slide with easeOutCubic, a dust puff, a wooden "thock".
- Pipes: rotate with a spring overshoot; when connected, light runs along the cable from the router to the robot,
  then the robot's screen shows a loading bar and "Connected" with a chord.
- Cat feedback: small dust puffs when walking fast, landing puffs on hop, a "!" over the cat when it enters a new
  mechanic's tile type.
- Round transitions: the grid tiles flip over in a diagonal wave (0.4 s) to reveal the next puzzle; the prompt bar
  types itself in.
- Combo: consecutive perfect rounds build a "HUMAN SCORE" streak meter in the HUD with a gentle glow (no flashing).
- Audio: everything is WebAudio synth, consistent soft palette (sine/triangle, short envelopes), master volume low.
  Music optional: a soft 2-chord loop that adds a layer every 3 rounds (only after the first keypress).

## 4. Code structure (so several people can work in parallel)

The game is split into source files under /home/user/jam/not-a-robot/game/src/ and built into ONE html file:
- game/index.template.html: title, styles, markup, and the placeholders `/*@@SCRIPTS@@*/` and the ART markers.
- game/src/*.js: plain scripts (no modules), concatenated in filename order into one <script>, sharing globals.
  e.g. 00-core.js (constants, rng, input, audio), 10-art.js (art loader, rigs), 20-juice.js (tweens, particles,
  hitstop, sfx helpers), 30-director.js (runs, difficulty, round registry), 40-grid.js (tile grid, cat movement on
  grid, selection), rounds/*.js (one file per round type), 80-ui.js (panel, HUD, screens), 90-main.js (loop).
- game/build.js: concatenates, embeds art (art/ + art-rig/ as rig/), writes game/dist/index.html, runs node --check.
- Each round type registers itself:
  ```js
  registerRound({
    id: 'lights', name: 'Lights Out', minD: 0.25, weight: 1,
    intro: 'Sitting flips the square AND its neighbours. Make them all checked.',
    generate(d, rng) { return { grid: 4, ...state } },   // pure, seeded; must return a solvable puzzle
    enter(R) {}, update(R, dt) {}, onSit(R, tile) {}, onStep(R, from, to) {},  // hooks; return values documented in 30-director.js
    drawTiles(R, ctx) {}, drawOverlay(R, ctx) {},        // optional custom drawing; default draws icon tiles
    judge(R) { return { pass, verdict, wrong: [indices] } },   // or a Promise of it
    progress(R) { return '3 / 7 connected' },
  });
  ```
- Dev URL hash for testing: `#round=lights&d=0.6&seed=42` jumps straight into that round (only a bare #token
  reaches the page in the artifact viewer, so the build also exposes `window.DEV.play('lights', 0.6, 42)`).
