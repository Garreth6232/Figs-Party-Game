# Neon Hopper Rush

An original, polished, endless lane-arcade browser game inspired by the *feel* of quick-hop survival games while using fully original naming, visuals, and code.

## 1) Architecture and file structure

The project is intentionally lightweight and GitHub Pages-friendly (no build step required).

```text
.
├── index.html
├── styles/
│   └── main.css
├── js/
│   ├── main.js        # bootstrapping and loop
│   ├── game.js        # game state, generation, collisions, rendering
│   ├── input.js       # keyboard + touch + swipe controls
│   ├── audio.js       # tiny sfx engine + mute persistence
│   ├── ui.js          # overlay and HUD state
│   └── config.js      # tuning values + asset paths
├── assets/
│   ├── images/
│   │   ├── player-placeholder.svg
│   │   ├── vehicle-placeholder.svg
│   │   └── log-placeholder.svg
│   ├── audio/         # drop your own sound files here
│   └── data/
│       └── asset-manifest.json
└── .gitignore
```

## 2) Gameplay features included

- Endless forward lane progression with discrete movement (up/down/left/right)
- Multiple lane types: grass (safe), road, water/log lanes, rail lanes
- Increasing difficulty over score milestones
- Fair hitbox checks + near-miss bonus scoring
- Start screen, pause overlay, game-over overlay, fast restart loop
- Score + best score (saved in localStorage)
- Keyboard support (`WASD`, arrows, `P`, `Esc`)
- Mobile touch controls (on-screen d-pad + swipe on canvas)
- Polished juice: hop particles, squash/stretch, micro screen shake, UI hover states
- Mute toggle with persistent preference

## 3) Local run instructions

No install needed.

### Option A: open directly
Open `index.html` in your browser.

### Option B (recommended): local static server
From project root:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## 4) GitHub Pages deployment

Because this is static HTML/CSS/JS, deployment is simple:

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or your preferred branch), folder `/ (root)`
4. Save, wait for Pages to publish, then open your generated URL.

No build tooling, no backend, no secrets needed.

## 5) Asset swap guide (for your own custom art/audio)

### Image placeholders
Replace files in `assets/images/` or update paths in:
- `js/config.js` (`ASSET_PATHS.images`)
- `assets/data/asset-manifest.json`

### Sounds
Drop your files in `assets/audio/` and map paths in:
- `js/config.js` (`ASSET_PATHS.audio`)
- `assets/data/asset-manifest.json`

> Current implementation uses procedural synth beeps for instant compatibility. If you add real audio files, you can extend `js/audio.js` to load and play them while keeping the same keys (`hop`, `hit`, `score`, `ui`).

### Tuning and game feel
Edit `js/config.js` to quickly tune:
- movement cooldown
- lane weights
- camera smoothing
- screen shake and particle values
- difficulty ramp cadence

## 6) Recommended repo structure

This repo is already organized for long-term maintenance:
- **config/data first** (easy swapping)
- **logic separated from UI and input**
- **single entrypoint** (`js/main.js`)
- **zero build step** for maximum portability

## 7) Notes on originality

This is an original game implementation with original naming/theme/art placeholders and no reused proprietary assets, branding, maps, sounds, or code.

## 8) Three high-impact polish upgrades to ask for next

1. **Character + skin system**
   - Add unlockable characters with per-character movement VFX and sounds.
2. **Biome progression setpieces**
   - Transition visuals every N lanes (city, wetlands, neon rail district) with unique lane hazards.
3. **WebGL-quality post effects (still lightweight)**
   - Add bloom, chromatic kick on near-miss, and palette-shift combo mode while preserving mobile performance.
