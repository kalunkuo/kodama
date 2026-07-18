# kodama

## Ramble

A Pikmin/Pokémon-style creature-herding browser game set in Central Park's Ramble. Built on Phaser 4 + TypeScript + Vite.

**Play it:** https://kalunkuo.github.io/kodama/

**Status:** M0–M5 complete — playable v1. Real OSM tilemap of the Ramble (paths, woodland, lawns, the Lake), tap-to-move with A*, a 40-creature steering swarm, a real-calendar spawner driven by iNaturalist week-of-year histograms, shrinking-ring capture, a field-guide dex with seasonality sparklines, whistle/throw/carry verbs, localStorage persistence, GPS park mode with on-site spawn bonuses (dusk raccoon is Ramble-only), and offline-capable PWA build.

## How to play

- **Tap the ground** to walk there.
- **Tap a wild creature** to approach and start the capture ring — tap again when the shrinking ring lands inside the green band.
- **Hold** anywhere to whistle: creatures in the expanding radius break off whatever they're doing and return to your swarm.
- **Tap an acorn** to throw the nearest swarm member at it; once enough creatures are attached it carries itself back to the base flag.
- **📖 Dex** shows every species as a grid — tap a cell for details, including season-by-week charts for species you haven't caught yet (so you know when/where to look).
- **📍 Park mode** turns on GPS. Standing in the actual Ramble boosts spawn rates and unlocks on-site-only species (a dusk raccoon).

Spawns follow the real calendar and time of day — a species with a spring peak will be rare in fall, and dusk/night species won't appear at noon.

### Caretaker Level

Catching a species for the first time and delivering acorns to the base flag both earn XP, shown as a bar under the swarm counter. Leveling up pays out on every axis at once:

- **Swarm cap** grows (15 → 24 → 33 → 42 → 51 → 60).
- **New species tiers unlock** — commons first, then woodland birds, then water birds, then the rares, then the dusk raccoon.
- A well-fed Ramble's reputation eventually travels: at max level, the onsite-only raccoon can turn up anywhere, not just in-park.

See `game/src/systems/Progression.ts` for the exact thresholds and unlock tiers.

### Bridges and far-shore areas

The Lake genuinely separates two small landmasses from the mainland in the fetched map data — no artificial gating, that's real geometry. A wooden marker at the water's narrowest crossing to each shows how many swarm members are needed; tap it while a follower is in throw range to send them to build, same as an acorn. Once enough are attached, construction channels for a few seconds and the crossing opens for good — new ground to explore, and new spawns become possible there.

### Capture tension

The shrinking-ring minigame reacts to how you play it:

- **Rushing a bird** (moving fast, up close) raises its alertness, which narrows the hit band — a calm approach is easier than a mad dash.
- **Consecutive catches** build a streak that widens the band back, rewarding a hot hand.
- **On a miss**, water species (mallard, pond slider, goose) dive away; woodland species (cardinal, jay, catbird, woodpecker) sometimes freeze in place instead of fleeing — no re-chase needed, but the retry is still a real attempt.

### Resetting your save

Progress (dex, swarm roster, offerings) lives in your browser's `localStorage` under the key `ramble_save_v1`. To reset:

```js
localStorage.removeItem('ramble_save_v1');
location.reload();
```
Paste that in the browser DevTools console (or as `javascript:localStorage.clear();location.reload()` in the address bar). To also clear the offline PWA cache, use your browser's "clear site data" for the page.

### Debug URL params

Useful for testing without waiting on the real calendar or GPS — works on any deployment, including the live GitHub Pages site:

| Param | Values | Effect |
|---|---|---|
| `week` | `0`–`51` | Force the spawner's week-of-year (overrides the real date) |
| `period` | `dawn` \| `day` \| `dusk` \| `night` | Force the time-of-day gate |
| `zone` | `ramble` \| `central_park` | Force GPS zone without enabling real location (also flips onsite-only gating and the dex's field-verified badge) |

Example: `https://kalunkuo.github.io/kodama/?zone=ramble&period=day`

## For contributors

See [DEVELOPING.md](DEVELOPING.md) for local setup, environment quirks (Node 18 build flags), architecture, the data pipeline, and deployment mechanics. The original design doc is [docs/ramble-implementation-plan.md](docs/ramble-implementation-plan.md).

All art and audio are procedurally generated (no assets to license). Attribution: see [CREDITS.md](CREDITS.md).

## Deployment

Every push to `main` builds and publishes the game to **GitHub Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

One-time setup (repo **Settings → Pages → Build and deployment → Source: GitHub Actions**).
Note: GitHub Pages on a **private** repo needs a paid plan — if this repo is
private and not on one, make it public or deploy elsewhere.

The Vite `base` is `/kodama/` for the project Pages path. For a custom domain
(served at the root) build with `VITE_BASE=/ npm run build`.
