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
│   ├── input.js       # keyboard + touch + swipe controls
│   ├── audio.js       # tiny sfx engine + mute persistence
│   ├── ui.js          # overlay and HUD state helpers
│   └── config.js      # tuning values + asset paths + state constants
├── assets/
│   ├── images/
│   │   ├── player-forward.svg
│   │   ├── player-left.svg
│   │   ├── player-right.svg
│   │   ├── player-back.svg
│   │   ├── vehicle-placeholder.svg
│   │   └── log-placeholder.svg
│   ├── audio/
│   └── data/
│       └── asset-manifest.json
└── .gitignore
```

## Gameplay highlights

- Clean state machine (`menu`, `playing`, `paused`, `game_over`)
- Start/pause/game-over overlays with proper show/hide behavior
- Four-way directional player sprites (forward/left/right/back)
- Portland-themed lane rendering (bike lanes, MAX tracks, rainy sidewalks, props)
- Near-miss scoring, particles, camera smoothing, touch + keyboard controls
- Fully static-site compatible (works from `index.html` or GitHub Pages)

## Run locally

Open `index.html` directly, or:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Asset replacement

Swap sprites by editing `ASSET_PATHS.images.playerSprites` in `js/config.js`.

```js
playerSprites = {
  forward: '...',
  left: '...',
  right: '...',
  back: '...'
};
```

Keep paths relative so GitHub Pages remains compatible.
