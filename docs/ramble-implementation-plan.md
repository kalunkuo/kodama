# Ramble — Implementation Plan

A Pikmin/Pokémon-style creature-herding and collection game set in real parks, starting with the Ramble in Central Park. Browser-based, mobile-first, built on real ecological data.

**Status:** planning complete, ready for M0.
**Last updated:** 2026-07-16

---

## 1. Design pillars

1. **Real place, real data.** The map is generated from OpenStreetMap geometry. The creatures, their habitats, and their seasonality come from iNaturalist observations recorded in the actual park. The game does not invent nature; it renders it.
2. **The calendar is the content.** Spawns are driven by the real-world date. Warblers appear the first week of May and leave. Raccoons show at dusk. Seasonal scarcity is the retention hook, and it's free — Olmsted and the Atlantic Flyway did the design work.
3. **Three verbs, one swarm.** Whistle, throw, carry. The Pikmin kernel and nothing else until it's fun.
4. **A link, not an install.** Ships as a PWA. Anyone opens it from a URL on their phone in under 5 seconds.

## 2. Locked decisions

| Question | Decision | Consequence |
|---|---|---|
| Platform | Mobile browser (PWA), portrait | Phaser 4 + TypeScript, not Godot/Unity. Capacitor wrap later if app stores ever matter. |
| Location | **Hybrid** — playable anywhere; GPS grants on-site bonuses | Geofence zones only. No AR, no position-in-world mapping, no anti-spoofing. |
| Art | **Free asset packs (CC0 only)**, reskin later | Species → sprite+tint mapping table. Pack tile size dictates the grid constant. |
| Intent | Fun; ship if it gets there | CC0-only assets, attribution screen, licensing checked early not late. |
| Scope (v1) | **The Ramble only** (~36 acres), 15 species cap | Densest, most-observed section of the park. Kill/commit gate at M2. |

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Engine | **Phaser 4** (v4.x, stable since Apr 2026) | Ground-up WebGL renderer rebuild with major mobile perf gains; native Tiled JSON tilemap loading; ~1 MB core vs Godot's 30 MB+ WASM export. |
| Language | TypeScript | Home turf; Claude Code fluency. |
| Build | Vite + `vite-plugin-pwa` | Instant HMR; manifest + service worker for offline play. |
| Pathfinding | `easystarjs` (or hand-rolled A*, ~80 lines) | Grid A* over the tilemap walkability layer. |
| Pipeline | Python 3.11+ (`requests`, `shapely`, `pyproj` optional) | Offline, runs on laptop, outputs committed JSON. |
| Hosting | Cloudflare Pages (or Vercel) | Static site, HTTPS by default (required for Geolocation API), deploy per push. |
| Persistence | `localStorage` | Dex + roster is a few KB. Skip IndexedDB. |
| Device debug | `vite --host` + `eruda` | On-device console; iOS Safari bugs are invisible otherwise. |

## 4. Repository architecture

```
ramble/
├── pipeline/                  # Python, runs offline on laptop
│   ├── config.py              # bbox, grid size, species cap, tile classes
│   ├── fetch_osm.py           # Overpass → raw geojson
│   ├── fetch_inat.py          # species counts + weekly histograms
│   ├── fetch_ebird.py         # optional refinement (check ToS before shipping)
│   └── build.py               # geojson + species → data/*.json
├── data/                      # committed build artifacts (game reads only these)
│   ├── ramble_map.json        # Tiled-format tilemap
│   └── species.json           # spawn tables + dex content
├── game/
│   ├── src/
│   │   ├── main.ts
│   │   ├── scenes/            # Boot, Preload, Park, UI, Dex
│   │   ├── systems/           # Swarm, Spawner, Capture, Location, Save
│   │   ├── entities/          # Player, Creature, CarryObject
│   │   └── config/            # constants, species-sprite mapping
│   ├── public/                # atlas, tiles, audio, manifest icons
│   └── vite.config.ts
└── README.md
```

**The contract:** pipeline and game only touch through `data/*.json`. Expanding to Prospect Park or a national park is a bbox change and a re-run, not new code. (NPS has its own API + NPSpecies database when that day comes.)

## 5. Phase 1 — Data pipeline

### 5.1 Map (OpenStreetMap → Tiled JSON)

**Bbox (tune by eye before anything else):** `sw 40.7755,-73.9725 / ne 40.7795,-73.9665` — roughly the Lake's north shore up to the 79th St transverse. This is the one interactive step; you know the Ramble's edges better than the rectangle does.

Overpass QL starting point:

```
[out:json][timeout:60];
(
  way["highway"~"path|footway|steps"](40.7755,-73.9725,40.7795,-73.9665);
  way["natural"="water"](40.7755,-73.9725,40.7795,-73.9665);
  way["natural"="wood"](40.7755,-73.9725,40.7795,-73.9665);
  way["landuse"="grass"](40.7755,-73.9725,40.7795,-73.9665);
  way["leisure"~"park|garden"](40.7755,-73.9725,40.7795,-73.9665);
  way["bridge"="yes"](40.7755,-73.9725,40.7795,-73.9665);
  way["barrier"~"fence|wall"](40.7755,-73.9725,40.7795,-73.9665);
);
out geom;
```

`build.py` steps:
1. Project WGS84 → local meters. Equirectangular approximation is fine at 400 m scale (`x = (lon−lon₀)·cos(lat₀)·111320`, `y = (lat−lat₀)·110540`).
2. Rasterize polygons/polylines with `shapely` onto a grid at **~1.5 m/tile** (final tile size in px comes from the chosen asset pack — almost certainly 16 px).
3. Assign tile classes with a priority order (water > rock > path > woodland > lawn > boundary). One grid serves three jobs: **render layer, walkability layer, habitat layer.**
4. Export **Tiled JSON format** — Phaser loads it natively, zero custom loader.

### 5.2 Species (iNaturalist, no API key)

```
GET https://api.inaturalist.org/v1/observations/species_counts
    ?nelat=40.7795&nelng=-73.9665&swlat=40.7755&swlng=-73.9725
    &quality_grade=research&per_page=50

GET https://api.inaturalist.org/v1/observations/histogram
    ?taxon_id={id}&nelat=...&quality_grade=research
    &date_field=observed&interval=week_of_year
```

Curate down to **15 species** for the slice:
- 4–5 ubiquitous (gray squirrel, American robin, house sparrow, rock pigeon)
- 6–8 mid-tier / habitat-flavored (red-eared slider near water tiles, northern cardinal in woodland, mallard, blue jay)
- 2–3 seasonal or condition-gated rares (a May warbler; **raccoon at dusk, on-site only** — see §8)

### 5.3 `species.json` schema (the schema *is* the game design)

```json
{
  "id": "black_crowned_night_heron",
  "common_name": "Black-crowned Night Heron",
  "taxon_id": 4956,
  "habitat_tags": ["water", "water_edge"],
  "spawn_weight_by_week": [0, 0, "...52 values from iNat histogram..."],
  "time_of_day": ["dusk", "night"],
  "rarity": "rare",
  "onsite_only": false,
  "sprite": { "base": "bird_medium", "tint": "#4a5d6e" },
  "dex_blurb": "Hunches at the Lake's edge at dusk. The Ramble hosts a small colony."
}
```

Client spawn logic reduces to: current real week × habitat tag of candidate tile × weight → roll.

### 5.4 eBird (optional)
Free API key; refines bird weekly frequency if iNat is thin. **eBird's terms are more restrictive about redistribution — verify before shipping anything eBird-derived.** If it's friction, iNat alone covers the Ramble's birds fine.

## 6. Phase 2 — Core loop

**Scenes:** `Boot → Preload → Park`, with a parallel `UI` scene on top (keeps HUD out of the world camera) and `Dex` as an overlay.

**Movement — tap-to-move, not virtual joystick.** Joysticks on mobile web feel mushy and eat screen. Tap → A* over walkability grid → player follows path; camera lerps.

**Swarm — steering, not physics.**
- Each creature: *seek* an offset slot behind the leader + *separation* from neighbors via a spatial hash (cell size ≈ 2 tiles).
- Cap **~40 agents**; object-pool all creatures and effects.
- Tune order: slot spacing → separation radius → max speed/turn rate. **If the swarm doesn't feel alive, stop and tune. Nothing else matters until this does.**

**The three verbs:**
| Verb | Input | Behavior |
|---|---|---|
| Whistle | press-hold | Expanding recall radius; creatures inside break task and return to swarm |
| Throw | tap target within range | Arc tween; on land, auto-assign to nearest task/creature-interaction in small radius |
| Carry | implicit | Object declares `required: N`; N creatures attach, A* back to base along grid; progress bar |

## 7. Phase 3 — Creature systems

**Spawner.** Ticks every ~20 s. Picks candidate tiles by habitat tag, rolls against `species.json` using **real `Date`** (week of year + local hour for `time_of_day` gating). Despawn timers. Max concurrent wild creatures ~8.

**Capture.** One mechanic, data-scaled: approach a wild creature → shrinking-ring tap-timing minigame. Rarity narrows the hit band. Miss → creature flees a few tiles; second miss → despawn.

**Dex.** Silhouette-until-caught. Each entry shows the species' real 52-week seasonality as a sparkline — "only findable in May" is the content. Caught-location badge (§8). Blurbs from `dex_blurb`.

**Persistence.** `localStorage`: dex entries `{id, caught_at, onsite}`, current roster, settings. Versioned save key for painless schema migration.

## 8. GPS hybrid layer (M5)

Geofence, not geometry — canopy GPS drift is 10–30 m, so never map real position into the game world.

```ts
// systems/Location.ts — ~60 lines total
navigator.geolocation.watchPosition(cb, err, { enableHighAccuracy: false });
// point-in-polygon → zone: 'ramble' | 'central_park' | 'offsite'
// emit zone changes; one consumer: the Spawner
```

**On-site bonuses (cheap, real-feeling):**
- 2–3× spawn rate in-zone
- 1–2 `onsite_only` species (the dusk raccoon — a story people tell)
- "Field-verified" badge on dex entries caught in-zone

**Constraints:**
- Geolocation requires HTTPS (Cloudflare Pages provides) and a permission prompt — request from an explicit **"Enable park mode"** button, never on load. iOS Safari punishes unprompted permission asks.
- Offline PWA caching is **required**, not optional: Ramble cell signal is genuinely bad. The game is static assets; the service worker covers it.
- No anti-spoofing. Someone faking GPS on a hobby game is free QA.

## 9. Art & assets

**License filter: CC0 only.** No attribution tracking per asset, no "free for non-commercial" landmines at ship time.

| Source | Notes |
|---|---|
| Kenney.nl | Everything CC0, enormous, internally consistent. Start here for tiles + UI. |
| OpenGameArt (CC0 filter on) | Animal sprite sheets exist; skip CC-BY unless deliberately accepted. |
| itch.io free packs | Best pixel quality, but free ≠ CC0 — read every license before it enters the repo. |

**Species → sprite mapping.** No pack has a black-crowned night heron. Table maps each species to `{base_sprite, tint}`: generic small bird tinted cardinal-red vs catbird-gray; generic rodent tinted squirrel vs chipmunk. At 16 px a palette swap does most of the work of a new species. Sprites are referenced **only** through this table → swapping the whole pack later touches one file and zero game code.

**Grid constant.** The chosen pack's tile size (almost certainly 16 px) is locked into `pipeline/config.py` before `build.py` is written.

## 10. Mobile / PWA hardening (M4)

- `vite-plugin-pwa`: manifest (portrait, standalone), precache all assets → full offline play, add-to-home-screen.
- `viewport-fit=cover` + safe-area insets; portrait handling on resize.
- `touch-action: none` on canvas (kills scroll/zoom); pointer events only.
- Audio unlocked on first pointer event (iOS requirement). Phaser audio or Howler.
- Texture atlas via free-tex-packer; target 60 fps on a mid iPhone; pool everything; no per-frame allocation in swarm update.
- Test on the actual phone from day one: `vite --host` over local wifi + `eruda`.

## 11. Shipping checklist

- [ ] **OSM attribution — license requirement, not courtesy:** "Map data © OpenStreetMap contributors" on credits screen.
- [ ] iNaturalist attribution line + link. If dex ever shows observation photos: check each photo's license field (many are CC-BY-NC — fine for a free game, per-photo credit required).
- [ ] eBird ToS verified, or eBird dropped.
- [ ] All assets confirmed CC0 (keep a `CREDITS.md` anyway).
- [ ] Name + domain; Cloudflare Pages wired from commit one so every push is a shareable URL.
- [ ] Optional later: Capacitor wrap for app stores.

## 12. Milestones

| # | Scope | Effort | Acceptance |
|---|---|---|---|
| **M0** | Vite+TS+Phaser 4 scaffold, deployed | 1 evening | Blank scene opens from a URL on your phone |
| **M1** | Pipeline → map | 1 weekend | The Ramble renders as a tilemap with Kenney tiles; paths/water/wood visibly correct vs reality |
| **M2** | Movement + swarm | 1 weekend | Tap-to-move works; 40 creatures follow, part around obstacles. **KILL/COMMIT GATE: is herding fun?** |
| **M3** | Spawner + capture + dex | 1 weekend | Species appear per real date/habitat; capture ring; dex persists |
| **M4** | Verbs + PWA polish | 1 weekend | Whistle/throw/carry complete; installs to home screen; plays offline; sound |
| **M5** | GPS + ship | few evenings | Park mode button, zone bonuses, on-site species, credits screen, public URL |

GPS lands second-to-last deliberately: most demo-able, least load-bearing, and "2× spawns" means nothing until the spawner exists.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Swarm doesn't feel good | It's the M2 gate; steering params exposed as debug sliders; budget a full evening for pure tuning |
| iOS Safari quirks (audio, PWA, geoloc) | Test on-device from M0; eruda; audio-unlock pattern; permission via explicit button |
| Scope creep on species | Hard cap 15; schema makes adding later trivial, so cutting now costs nothing |
| Asset-pack visual mismatch | One pack family for tiles, one for creatures; tint table absorbs species variety; accept jank, reskin later |
| Perf with swarm + tilemap on mid phones | Spatial hash, pooling, no per-frame alloc; Phaser 4's renderer rebuild helps; profile at M2 |
| Calendar collision (Polyphon Jul 31, CHI Sep 10) | Weekend-granular milestones; M2 gate gives a clean pause point with nothing half-built |

## 14. Expansion paths (post-ship, explicitly out of scope for v1)

- **More parks:** bbox change + pipeline re-run. Prospect Park → any NYC park → national parks via NPS API + NPSpecies.
- **Terrain depth:** keep 2D sprites, extrude NYC DEM into a mesh, billboard creatures — real topography without becoming a 3D artist. (This is where Meshy re-enters, for static set dressing only: benches, lamp posts, Bethesda fountain. Never creatures.)
- **Live data:** recent iNat observations seeding "hot spots" ("someone saw a night heron here yesterday").

## 15. API quick reference

```
# Overpass
POST https://overpass-api.de/api/interpreter   (query in §5.1)

# iNaturalist (no key)
GET https://api.inaturalist.org/v1/observations/species_counts?nelat=&nelng=&swlat=&swlng=&quality_grade=research
GET https://api.inaturalist.org/v1/observations/histogram?taxon_id=&interval=week_of_year&date_field=observed

# eBird (free key: ebird.org/api/keygen — verify ToS)
GET https://api.ebird.org/v2/data/obs/geo/recent?lat=&lng=&dist=1
```
