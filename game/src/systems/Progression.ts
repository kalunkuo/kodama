/**
 * The Caretaker Level spine: offerings + catches earn XP, XP raises your
 * level, and level pays out on every axis at once — swarm cap, which
 * species can spawn, and a "well-fed Ramble" rarity bonus that eventually
 * draws even the onsite-only dusk raccoon off-site. One loop: herd -> feed
 * the cache -> grow -> catch rarer things -> feed the cache.
 */

// cumulative XP required to BE at level (index+1) — LEVEL_XP_THRESHOLDS[0] is level 1's floor (0)
export const LEVEL_XP_THRESHOLDS = [0, 60, 150, 300, 520, 820];
export const MAX_LEVEL = LEVEL_XP_THRESHOLDS.length;

// swarm cap unlocked at each level, topping out at the global max
export const SWARM_CAP_BY_LEVEL = [15, 24, 33, 42, 51, 60];

// XP rewards
export const XP_FIRST_CATCH: Record<string, number> = { common: 15, uncommon: 35, rare: 90 };
export const XP_RECATCH = 4;
export const XP_OFFERING = 18;
export const XP_BRIDGE = 60; // finishing a bridge is a bigger, rarer payoff than one acorn

// species -> minimum Caretaker Level before it's eligible to spawn at all.
// Mirrors the plan's curated tiers: commons -> woodland uncommons -> water
// uncommons -> rares -> the dusk raccoon.
export const SPECIES_UNLOCK_LEVEL: Record<string, number> = {
  eastern_gray_squirrel: 1,
  american_robin: 1,
  house_sparrow: 1,
  rock_pigeon: 1,
  mourning_dove: 1,
  northern_cardinal: 2,
  blue_jay: 2,
  gray_catbird: 2,
  downy_woodpecker: 2,
  pond_slider: 3,
  mallard: 3,
  canada_goose: 3,
  black_and_white_warbler: 4,
  red_tailed_hawk: 4,
  common_raccoon: 5,
};

// at this level, "onsite_only" species (the raccoon) become spawnable
// anywhere — a well-fed Ramble's reputation travels.
export const WELL_FED_OFFSITE_LEVEL = 6;

// each level past 1 nudges uncommon/rare spawn weight up (commons are
// already at full frequency, so the bonus only applies above common).
export const RARITY_LEVEL_BONUS_PER_LEVEL = 0.18;
export const RARITY_LEVEL_BONUS_MAX = 2.0;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export interface XpProgress {
  level: number;
  current: number; // xp earned within the current level
  span: number; // xp needed to complete the current level (0 if maxed)
  maxed: boolean;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const base = LEVEL_XP_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_XP_THRESHOLDS[level];
  if (nextThreshold === undefined) {
    return { level, current: 0, span: 0, maxed: true };
  }
  return { level, current: xp - base, span: nextThreshold - base, maxed: false };
}

export function swarmCapForLevel(level: number): number {
  const idx = clamp(level - 1, 0, SWARM_CAP_BY_LEVEL.length - 1);
  return SWARM_CAP_BY_LEVEL[idx];
}

export function isSpeciesUnlocked(speciesId: string, level: number): boolean {
  return (SPECIES_UNLOCK_LEVEL[speciesId] ?? 1) <= level;
}

export function rarityLevelBonus(rarity: string, level: number): number {
  if (rarity === 'common') return 1;
  return Math.min(RARITY_LEVEL_BONUS_MAX, 1 + (level - 1) * RARITY_LEVEL_BONUS_PER_LEVEL);
}

// tiny local clamp — avoids importing all of Phaser.Math here
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
