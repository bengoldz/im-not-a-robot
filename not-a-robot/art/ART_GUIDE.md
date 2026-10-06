# I'm Not A Robot: art guide (polish pass)

Goal: keep the prototype's look (bold dark outlines, chunky friendly shapes, flat bright colors),
and make it feel finished and premium: better silhouettes, cel shading, highlights, small details, charm.
The current prototype art is exported as PNGs in /home/user/jam/not-a-robot-unity/Assets/Art/Prototype/
(Icons/, Tiles/, Cat/, Robot/, UI/). Look at them first. Every new asset must still be instantly
recognizable as the same thing (same colors, same basic design), just better.

## Format
- Hand-written SVG, one file per asset, UTF-8, `xmlns="http://www.w3.org/2000/svg"`, a viewBox and NO width/height attributes.
- Allowed: path, circle, ellipse, rect, polygon, polyline, line, g, transform, clipPath, defs/use, linearGradient
  (gradients only for sky/water backgrounds; characters and icons are cel-shaded with flat fills).
- NOT allowed: text/fonts, filters (blur, drop-shadow), external images, CSS classes, scripts. Keep each file under ~25 KB.
- Ground shadows are NOT drawn in sprites (the game draws them).

## Style rules
- Outline color: #1d2433 (ink). Outer silhouette stroke: 14 units in a 512 viewBox (scale proportionally:
  7 units at 256, 11 at 400x600). Inner detail lines: about 60% of that. stroke-linejoin and stroke-linecap = round.
  Achieve a clean outer outline by drawing the silhouette shape with the stroke first, or by stroking each part. Avoid hairline gaps.
- Light comes from the top-left. Each colored part has: base fill, ONE shadow tone (cel shape on the lower-right side,
  ~15–20% darker, same hue, slightly more saturated) and ONE highlight (small, upper-left, ~20% lighter or white at
  50–70% opacity for shiny things). Shadows and highlights have no outline.
- Small charm details are welcome (a stitch on the sock, a rivet on the robot, a whisker, a sparkle), but keep the
  silhouette readable at 64 px. Test: the asset must read clearly when rendered at 64x64.
- Faces on objects: only where the prototype had them (sun, moon, ghost, etc.). Eyes = solid ink ovals with a tiny white glint.

## Palette (keep these as base colors; derive shades from them)
ink #1d2433 · cat orange #f39a33, cat dark stripes #c4661a, cat belly #ffd9a8, nose #ff8fa3
robot body #9fb6cc, robot dark #5d7590, robot screen #14202f, robot face glow #5ff3ff, treads #3b4660, tread wheels #6b7896
UI: blue #2f6fe4, blue dark #1f4fb0, green #22b573, red #e5484d, panel #f7f9fc, line #d5dbe6, grey #7b8597, gold #ffc93c
Tile backgrounds: sky #bfe1ff, grass #bde6a8 (ground #9fd38a), street #c3c8d2 (ground #a7adb9), water #9fd6ea,
indoor #dbe5f0, night #2b3a63, sand #f3dd9b (dune #e8c97a)
Icon base colors: match each prototype icon's colors.

## Asset specs
### Icons (art/icons/<name>.svg): viewBox 0 0 512 512, transparent, subject centered, kept inside 48..464.
Names (exact): fish trafficlight bicycle cat robot sun cloud tree car bus crosswalk hydrant stairs boat crown sock
dog bone house mountain cactus umbrella pizza moon toaster ghost duck ball balloon rock
(crosswalk is a full square of road with stripes: it may fill 48..464 entirely.)

### Tile backgrounds (art/tiles/<bg>.svg): viewBox 0 0 512 512, full-bleed, no outline.
sky grass street water indoor night sand. Low contrast and calm, so icons pop. Ground band for grass/street at the
same height as the prototype (~72–75% down). Add subtle texture shapes (soft clouds, grass tufts, asphalt specks,
wave lines, wallpaper pattern, stars, sand ripples), drawn with the bg color ±6% lightness.

### Cat (art/cat/<frame>.svg): viewBox 0 0 256 256, facing RIGHT, feet on baseline y=232, body centered on x=128.
The cat is about 200 units wide (with tail) and 150–200 tall. Orange tabby, as in the prototype, with a bigger,
cuter head (about 40% of its height), stripes on the head and back, cream belly and muzzle, pink nose, white whiskers
drawn as thin ink lines, white glints in the eyes.
Frames: stand, stand_blink, walk_0, walk_1, walk_2, walk_3 (a 4-frame walk cycle: legs alternate, slight body bob,
tail sways), sit, sit_blink, loaf (tucked-in "bread loaf", eyes closed and content), hop (mid-air, stretched,
legs tucked), dash (long horizontal stretch, ears back, speed pose), fall (scared, fur puffed, paws up, eyes as circles).

### Robot friend (art/robot/<mood>.svg): viewBox 0 0 400 600, facing the viewer, tread bottom on y=572, centered x=200.
Same design as the prototype (screen-head with antenna and red bulb, square torso with an orange chest light, little
arms, tank treads), polished: rivets, panel seams, screen glare, cel shading. The face is drawn as glowing cyan
strokes on the dark screen (no filters; fake glow with a wider low-opacity cyan stroke underneath).
Moods: neutral, neutral_blink, happy, ecstatic (arms up, sparkle eyes ^^, open smile), sad, crying (tears streaming),
nervous (wavy mouth, sweat drop). Arms down for neutral/sad/crying/nervous, raised for happy/ecstatic.

### UI (art/ui/): logo.svg (the HUMANCHECK shield with an eye, viewBox 0 0 256 256, no text);
checkbox_empty.svg and checkbox_checked.svg (viewBox 0 0 256 256, a white rounded square with ink outline; the
check is a thick green #22b573 tick with a darker shade); runner_0.svg, runner_1.svg (viewBox 0 0 256 320: the
running-away checkbox creature, a checkbox with big googly eyes and two thin legs, two run frames), runner_checked.svg
(same creature, ticked and dizzy); fly.svg (viewBox 0 0 64 64, a tiny cartoon fly).

### Traffic scene (art/scene/): traffic_bg.svg (viewBox 0 0 512 512: sky gradient, a city skyline, sidewalk and road
with lane dashes, no traffic light); traffic_light.svg (viewBox 0 0 120 512: a tall traffic light, the 3-lamp head in
the top 0..200 and the pole down to 512; the red lamp is lit, the others are dark).

## Process (for every agent)
1. Write the SVGs.
2. Render them to PNG with headless Chromium (Playwright: require('/opt/node22/lib/node_modules/playwright'), Chromium is
   preinstalled) at 2 sizes: large (512) and small (64), into your scratch folder, and build ONE contact sheet image
   (an HTML page with a grid of the renders on a mid-grey background, screenshotted).
3. Look at the contact sheet with the Read tool. Fix anything broken, off-model, or unreadable at 64 px. One fix pass,
   then a final contact sheet look.
4. Validate each file parses as XML (e.g. `node -e` with a DOMParser in the page, or xmllint if present).
Report: the files written, and anything you weren't happy with.
