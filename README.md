# I'm Not A Robot: Jamference AI Game Jam

Our entry for the Jamference AI Game Jam (theme "Cat and Robot", movement input only): a cat walks across CAPTCHA
tiles to help its robot friend pass the "human check".

- `not-a-robot/game/`: the jam game. `src/` is the code (one file per round type in `src/rounds/`), `build.js` builds
  one playable file at `dist/index.html`. Run `node build.js` inside the folder, then open `dist/index.html`.
  `DESIGN.md` explains the round types and difficulty; `API.md` documents the round hooks.
- `not-a-robot/art/`: art, including the new cat concepts in `cat-concepts-v2/`.
- `not-a-robot-unity/`: an earlier Unity attempt (not used).
- The other folders are the earlier prototype ideas.
- `make-itch-builds.sh` zips the prototypes into `itch-builds/` for upload to itch.io.
