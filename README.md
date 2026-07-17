# kodama

## Ramble

A Pikmin/Pokémon-style creature-herding browser game set in Central Park's Ramble. Built on Phaser 4 + TypeScript + Vite.

**Status:** M0–M5 complete — playable v1. Real OSM tilemap of the Ramble (paths, woodland, lawns, the Lake), tap-to-move with A*, a 40-creature steering swarm, a real-calendar spawner driven by iNaturalist week-of-year histograms, shrinking-ring capture, a field-guide dex with seasonality sparklines, whistle/throw/carry verbs, localStorage persistence, GPS park mode with on-site spawn bonuses (dusk raccoon is Ramble-only), and offline-capable PWA build.

See `game/` for the app. Run `npm install && npm run dev` inside `game/` to start the dev server (`npm run build` needs Node 18+; on Node 18 the build script auto-enables `--experimental-global-webcrypto`).

Debug URL params for testing seasonality without waiting for the calendar: `?week=18&period=dusk&zone=ramble`.

All art and audio are procedurally generated (no assets to license). Attribution: see [CREDITS.md](CREDITS.md).

## Deployment

Every push to `main` builds and publishes the game to **GitHub Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The live URL is
`https://kalunkuo.github.io/kodama/`.

One-time setup (repo **Settings → Pages → Build and deployment → Source: GitHub Actions**).
Note: GitHub Pages on a **private** repo needs a paid plan — if this repo is
private and not on one, make it public or deploy elsewhere.

The Vite `base` is `/kodama/` for the project Pages path. For a custom domain
(served at the root) build with `VITE_BASE=/ npm run build`.

