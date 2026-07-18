# Developing Ramble

Contributor-facing notes: setup, environment quirks, architecture, the data pipeline, and deployment. For the game design and milestone plan, see [docs/ramble-implementation-plan.md](docs/ramble-implementation-plan.md). For player-facing info (how to play, reset, debug params), see [README.md](README.md).

## Repository layout

```
kodama/
├── pipeline/        Python — fetches OSM + iNaturalist data, builds data/*.json (offline, run manually)
├── data/             Committed build artifacts. The game reads only these two files.
│   ├── ramble_map.json    Tiled-format tilemap (walkability + habitat layer)
│   └── species.json       15 species, spawn weights, dex content
├── game/             Vite + TypeScript + Phaser 4 app
│   └── src/
│       ├── main.ts
│       ├── scenes/       Boot → Preload → Park (world), UI (HUD overlay scene), Dex (field guide overlay)
│       ├── systems/      WorldGrid (A*), Swarm, Spawner, Capture, Location, Save, Audio
│       ├── entities/     Player, Creature, CarryObject
│       ├── config/       constants.ts (all tunables), species-sprites.ts
│       └── ui/kit.ts     Pixel-art UI kit: bitmap font, window-boxes, buttons
├── docs/             Design/implementation plan
└── .github/workflows/deploy.yml   GitHub Pages CI
```

**The contract:** pipeline and game only touch through `data/*.json`. You don't need to run the pipeline to work on the game — the JSON outputs are already committed.

## Local setup

```sh
cd game
npm install
npm run dev
```

Open the printed localhost URL. `npm run build` produces a static `dist/` (Vite + `tsc --noEmit`); `npm run preview` serves that build locally.

### Node 18 quirks

This project has been developed and CI-tested against **Node 18**. Two things exist solely to make the PWA build (`vite-plugin-pwa` → `workbox-build`) work on Node 18 instead of requiring Node 20+:

1. **`overrides` in `game/package.json`** pins `path-scurry`'s nested `lru-cache` to `^10`, because the version npm otherwise hoists needs `node:diagnostics_channel` APIs Node 18 doesn't have.
2. **`NODE_OPTIONS=--experimental-global-webcrypto`** is baked into the `build` script, because `workbox-build`'s dependency chain expects a global `crypto` that Node 18 only exposes behind that flag.

If you upgrade the toolchain to Node 20+, both of these can be removed — they're not needed for `npm run dev`, only for `npm run build`.

## Architecture

- **Scenes**: `Boot` → `Preload` (loads `data/*.json`, generates all sprite/UI textures procedurally, builds the pixel bitmap font) → `Park` (the game world; owns `WorldGrid`, `Player`, `Swarm`, `Spawner`, `Save`, `Location`, carry objects). `UI` and `Dex` run as separate overlay scenes launched on top, so HUD/dex input never fights world input.
- **No art assets.** Every sprite, tile, icon, and UI glyph is generated in code at boot (`Preload.ts`, `ui/kit.ts`) — there's nothing to license and nothing to load over the network beyond the two `data/*.json` files.
- **`constants.ts`** is the single source of truth for tunables: spawn timing, rarity multipliers, swarm cap, capture band widths, whistle/throw ranges, etc. Prefer changing a constant over hardcoding a new magic number.
- **`WorldGrid`** does triple duty per the design doc: render layer, walkability layer, and habitat layer (derives `water_edge` from tiles adjacent to `water`), plus a hand-rolled 8-directional A*.
- **`Spawner`** rolls species by real week-of-year (from the iNat histogram in `species.json`) × time-of-day × rarity × GPS zone multiplier × Caretaker Level gating/bonus (`Progression.ts`). `currentWeek()`/`currentPeriod()` read the real clock unless overridden by the `week`/`period` URL params (see README).
- **`Progression.ts`** is the leveling spine: XP thresholds, per-species unlock levels, swarm-cap-by-level, and the "well-fed" rarity/onsite-bypass bonus. Level is *derived* from `Save.data.xp` (`levelForXp()`) rather than stored separately, so there's one source of truth — never write a `level` field directly.
- **`Save`** is a single versioned `localStorage` blob (`ramble_save_v1`) — dex entries, roster, offerings, xp. Bump `version` in `Save.ts` if you change the shape (old saves are discarded rather than migrated).

## Debug tooling

- URL params `?week=`, `?period=`, `?zone=` — see README for the table. These are read directly from `window.location.search`, so they work identically on `localhost`, a preview build, or the deployed GitHub Pages site.
- `window.game` is exposed in `main.ts` for on-device/console debugging (Phaser scene tree, manual `scene.getScene('Park')` inspection, etc.) — handy with `eruda` on a phone or a remote devtools session.
- To drive the game deterministically from a script/automation harness (no real input events reaching Phaser), call `game.loop.step(performance.now())` in a loop rather than dispatching synthetic pointer events — Phaser 4's input manager does not respond to synthetic DOM `PointerEvent`s the way it does to real ones.

## Regenerating the data pipeline

You don't need to do this to work on the game. If you want to change the bbox, add species, or refresh iNaturalist histograms:

```sh
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python fetch_osm.py      # → pipeline/.cache/osm_raw.json (Overpass)
python fetch_inat.py     # → pipeline/.cache/inat_*.json (iNaturalist)
python build.py          # → data/ramble_map.json, data/species.json
```

`config.py` holds the bbox, grid resolution, tile size, and species cap. `build.py` also assembles OSM **relations** (not just ways) into polygons — needed because Central Park Lake is modeled as a multipolygon relation in OSM, not a simple way.

## Deployment

`.github/workflows/deploy.yml` builds `game/` on every push to `main` (Node 18, `npm ci`, `npm run build`) and publishes `game/dist` to GitHub Pages. Vite's `base` is `/kodama/` to match the project Pages path; override with `VITE_BASE` for a custom domain. See the README's Deployment section for one-time repo setup.

## Testing changes

There's no automated test suite yet — verification is manual/visual:

- `npx tsc --noEmit` (or `npm run build`, which includes it) for type safety.
- Run the dev server and exercise the actual flow you changed (movement, capture, dex, verbs) in a browser. The debug URL params make this fast — e.g. `?zone=ramble&period=day` to guarantee spawns without waiting on the real clock/GPS.
- Check `MAX_WILD`/`SPAWN_TICK_MS`/`ZONE_SPAWN_MULT` in `constants.ts` first if a change seems to affect "how often creatures appear" — that's almost always a tuning question, not a bug.
