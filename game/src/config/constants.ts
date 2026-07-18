export const TILE_SIZE = 16;

// Movement
export const PLAYER_SPEED = 110; // px/s
export const CREATURE_MAX_SPEED = 140; // px/s — must outrun the player to catch up
export const CREATURE_ACCEL = 420;
export const SEPARATION_RADIUS = 12; // px
export const SEPARATION_FORCE = 260;
export const SPATIAL_HASH_CELL = 32; // ≈ 2 tiles (plan §6)

// Swarm — SWARM_CAP_MAX is the absolute ceiling (level 6, see Progression.ts);
// the *effective* cap grows with Caretaker Level via Swarm.setCap().
export const SWARM_CAP_MAX = 60;
export const SWARM_ANCHOR_TRAIL = 16; // px behind the player
export const SLOT_BASE_RADIUS = 10;
export const SLOT_RADIUS_STEP = 2.4;
export const SLOT_GOLDEN_ANGLE = 2.39996;

// Verbs
export const WHISTLE_HOLD_MS = 280; // hold this long before a press becomes a whistle
export const WHISTLE_MAX_RADIUS = 160; // px
export const WHISTLE_GROW_RATE = 130; // px/s
export const THROW_RANGE = 96; // px
export const THROW_DURATION_MS = 450;
export const THROW_ARC_HEIGHT = 28; // px

// Spawner (plan §7)
export const SPAWN_TICK_MS = 10_000;
export const MAX_WILD = 20;
export const SPAWN_NEAR_TILES = 42; // prefer tiles within this radius of the player
export const DESPAWN_MS_MIN = 75_000;
export const DESPAWN_MS_MAX = 140_000;
export const RARITY_SPAWN_MULT: Record<string, number> = {
  common: 1.0,
  uncommon: 0.45,
  rare: 0.16,
};
export const ZONE_SPAWN_MULT: Record<string, number> = {
  ramble: 3,
  central_park: 2,
  offsite: 1,
};

// Capture (plan §7): shrinking ring, rarity narrows the hit band.
// Tuned so the reaction window (band_width / RING_START * RING_MS) gives
// common ~1.2s, uncommon ~0.75s, rare ~0.4s — forgiving but rarity still bites.
export const CAPTURE_RANGE = 34; // px — how close the player must be to start
export const CAPTURE_RING_START = 110; // px radius on the UI overlay
export const CAPTURE_RING_MS = 2200; // shrink duration
export const CAPTURE_BAND: Record<string, { inner: number; outer: number }> = {
  common: { inner: 18, outer: 78 },
  uncommon: { inner: 24, outer: 62 },
  rare: { inner: 30, outer: 50 },
};
export const DISTRACT_BAND_BONUS = 16; // a thrown creature widens the band once

// Capture tension (idea 3): a rushed approach narrows the band, a catch
// streak widens it back. Same minigame, but how you play changes the odds.
export const ALERT_RADIUS = 70; // px — player movement inside this spooks the target
export const ALERT_RISE_PER_S = 0.9; // 0->1 in ~1.1s of being rushed at close range
export const ALERT_DECAY_PER_S = 0.6; // per second once the player backs off
export const ALERT_BAND_PENALTY = 16; // px shaved off the band at full alertness
export const STREAK_BAND_BONUS = 3; // px added per consecutive catch
export const STREAK_CAP = 5; // streak stops paying out past this many in a row
export const FREEZE_CHANCE = 0.45; // woodland species: chance to freeze instead of flee on a miss
export const FREEZE_MS = 1800;

// Tile classes, indexed by the gid painted in data/ramble_map.json
export const TILE_CLASSES = ['lawn', 'water', 'woodland', 'path', 'boundary', 'rock'] as const;
export type TileClass = (typeof TILE_CLASSES)[number];
export const TILE_WALKABLE: Record<TileClass, boolean> = {
  lawn: true,
  water: false,
  woodland: true,
  path: true,
  boundary: false,
  rock: false,
};
export const TILE_COLORS: Record<TileClass, number> = {
  lawn: 0x5a7c3f,
  water: 0x3f6d8e,
  woodland: 0x3e5c33,
  path: 0xb9a878,
  boundary: 0x6e6a5e,
  rock: 0x8a8578,
};

// Ambient light per real time-of-day period (plan §2: the calendar is the content).
// Screen-space overlay tint {color, alpha}; day is clear.
export const TIME_TINT: Record<string, { color: number; alpha: number }> = {
  dawn: { color: 0xffcf9e, alpha: 0.14 },
  day: { color: 0xffffff, alpha: 0.0 },
  dusk: { color: 0xff7a3c, alpha: 0.24 },
  night: { color: 0x0a1445, alpha: 0.46 },
};

export const SAVE_KEY = 'ramble_save_v1';
