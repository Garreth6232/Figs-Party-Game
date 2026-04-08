# Fig Game

A polished, endless arcade lane-dodger browser game with a Portland-inspired rainy city theme.

## Architecture and file structure

```text
.
├── index.html
├── styles/
│   └── main.css
├── js/
│   ├── main.js        # bootstrapping and main loop lifecycle
│   ├── game.js        # state machine, lanes, hazards, collisions, rendering
│   ├── input.js       # keyboard + touch + swipe + super jump controls
│   ├── audio.js       # tiny sfx engine + mute persistence
│   ├── ui.js          # overlay + HUD + toast + leaderboard presentation
│   ├── leaderboard.js # leaderboard persistence + ranking helpers
│   └── config.js      # tuning values + asset manifest + state constants
├── assets/
│   ├── player/
│   ├── vehicles/
│   ├── hazards/
│   ├── collectibles/
│   ├── environment/
│   ├── ui/
│   ├── audio/
│   └── data/
│       └── asset-manifest.json
└── .gitignore
```

## Gameplay highlights

- Safe starting zone so every run begins on non-lethal grass rows
- Crossable river lanes with moving floating platforms (logs/rafts/kayaks)
- Water is lethal only when the player is not standing on a platform
- Coin collectibles with HUD tracking and charge-to-use super jump economy
- Super jump (20 lanes) on `J`, `Space`, or touch `SUPER` button
- MAX train, road traffic, near-miss scoring, particles, rain, touch + keyboard controls
- Arcade-style top-10 leaderboard with 3-letter initials entry and local persistence
- Fully static-site compatible (works from `index.html` or GitHub Pages)

## Run locally

Open `index.html` directly, or:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Asset replacement guide

All asset keys are centrally defined in:

- `js/config.js` (`ASSET_MANIFEST` used by runtime)
- `assets/data/asset-manifest.json` (human-editable mirror)

Replace files in these folders with your own art/audio while keeping names or updating both manifests:

- `/assets/player` → `figForward` (png), `figLeft` (png), `figRight` (png), `figBack`
- `/assets/vehicles` → `car1` (png), `car2`, `car3`, `bike1`, `scooter1`, `maxTrain` (png)
- `/assets/hazards` → `log1`, `raft1`, `kayak1`
- `/assets/collectibles` → `coin` (png)
- `/assets/environment` → `riverTile`, `roadTile`, `sidewalkTile`, `bridgeTile`, `tree1`, `foodCart1`
- `/assets/ui` → UI-only indicators (example: `superJumpReady`)
- `/assets/audio` → optional audio files

Keep paths relative (no absolute URLs) so GitHub Pages deployment remains compatible.
