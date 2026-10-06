# Shared brief — Jamference AI Game Jam prototypes

Jam theme: "Cat and Robot". Mandatory restriction: MOVEMENT INPUT ONLY.
- Every input is movement: walk/run (arrows or WASD), jump (Up/W/Space), dash (Shift), crouch (Down/S).
- NO attack/shoot/interact buttons and NO clickable UI in the game. Menus are walkable rooms;
  actions happen by stepping on pads/plates. Start screen = a small room where you walk onto a "START" pad.
  Restart = walk onto a pad or simply die/respawn. (Pressing a movement key to dismiss a title card is fine.)
- Touch: add on-screen movement buttons (left/right/jump/crouch/dash) shown only on touch devices
  (`matchMedia('(pointer: coarse)')`). They are movement inputs, so they're allowed.

## Deliverable
ONE self-contained file: /home/user/jam/<slug>/index.html. Vanilla JS + <canvas>, no libraries,
no external assets (draw everything procedurally; sounds via WebAudio started after the first keypress).
It gets published as a claude.ai Artifact, so follow this contract:
- Do NOT write <!doctype>, <html>, <head> or <body> tags. Start the file with <title>Game Name</title>,
  then <style>, then markup, then <script>. A skeleton with charset + viewport meta is added at publish time.
- The page is a deliberately single-look game screen: set `body` background and all colors explicitly
  (define colors as CSS custom properties on :root; set `color-scheme: dark` on :root if the look is dark).
- Use `html,body{height:100%}`, not 100vh. The canvas scales to fit the viewport and keeps its aspect ratio
  (fixed internal resolution e.g. 960x540, CSS-scaled, `image-rendering: pixelated` if pixel art). There must be no page scroll and no horizontal overflow at 400px width.
- Fonts: Google Fonts <link> allowed (fonts.googleapis.com) with a fallback stack; pick something with character, NOT Inter/Space Grotesk.
- No alert/confirm/prompt. Wrap any localStorage use (e.g. best score) in try/catch.
- Respect prefers-reduced-motion by toning down screen shake.
- Must parse and run with no console errors. Before finishing, run a syntax check: extract the
  <script> contents and run `node --check` on them. If you can, also do a quick headless smoke test with
  Playwright (Chromium is at /opt/pw-browsers; it's preconfigured) that loads the file, presses a few keys
  for ~3 seconds, and reports any page errors. Do ONE smoke test pass, fix what it shows, and stop.

## Live AI (the jam requires that AI is genuinely in the build; make it live in-game)
The page can ask Claude through the artifact runtime. Use EXACTLY this pattern, and the game MUST be
fully playable without it (itch.io copies won't have `window.claude`):

```js
let sample = null;          // live AI function, or null
(async () => {
  try { if (window.claude && window.claude.use) sample = await window.claude.use("sample"); } catch (e) { sample = null; }
})();
let aiBusy = false, aiDisabled = false;
async function askAI(prompt, fallback) {
  // returns a string; never throws; never more than one call in flight
  if (!sample || aiDisabled || aiBusy) return fallback();
  aiBusy = true;
  try {
    const { text } = await sample(prompt, { modelTier: "quick", cache: false });
    return (text || "").trim() || fallback();
  } catch (e) {
    if (["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].includes(e && e.code)) aiDisabled = true;
    return fallback();
  } finally { aiBusy = false; }
}
// For structured data use sample.json(prompt, {modelTier:"quick", cache:false}) in the same guarded way.
```
Rules: call the AI only on discrete game events (level start, death, level clear), never per frame, never
from a timer loop, at most one call in flight. Never block gameplay waiting on it: show the
fallback/scripted line immediately or a short "…" and swap in the AI line when it arrives. Keep prompts short
and ask for one short line (≤ 90 chars) in character. Write a good pool of hand-written fallback lines
(15+), so the scripted version is fun too. Show a tiny HUD tag "AI: live" vs "AI: scripted".
The first AI call shows the viewer a consent dialog, so make that first call happen when the player steps
onto an "AI ON" pad in the start room (default is scripted). Movement only, so the consent comes from stepping on that pad.

## Quality bar
This is a jam prototype: fun in the first 10 seconds beats feature count. Requirements:
- Tight controls (coyote time + jump buffering for platformers), juicy feedback (particles, squash/stretch, small shake, sfx).
- 3–5 short hand-built levels or one strong replayable loop, a win state, and a clear goal on screen.
- A cute, readable cat; robots that look like robots. Cohesive palette chosen for this game (avoid cream+terracotta and purple gradients).
- Keep code organized in one file (aim for 800–1500 lines). Comment section headers only.

When done, reply with: the controls, how the AI is used, what you tested and the result, and known issues. Keep it short.
