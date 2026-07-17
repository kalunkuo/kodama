// Species are drawn as generic base sprites + a per-species tint (plan §9).
// Base textures are generated procedurally in Preload — no asset pack yet;
// swapping in a real CC0 pack later touches Preload + this file, zero game code.

export interface SpeciesSprite {
  base: string;
  tint: string;
}

export interface SpeciesDef {
  id: string;
  common_name: string;
  taxon_id: number;
  habitat_tags: string[];
  spawn_weight_by_week: number[];
  time_of_day: string[];
  rarity: 'common' | 'uncommon' | 'rare';
  onsite_only: boolean;
  sprite: SpeciesSprite;
  dex_blurb: string;
}

// Every base referenced by data/species.json. Preload generates one texture per key.
export const BASE_SPRITES = [
  'bird_small',
  'bird_medium',
  'bird_large',
  'rodent_small',
  'rodent_medium',
  'turtle_small',
] as const;

export function tintOf(def: SpeciesDef): number {
  return parseInt(def.sprite.tint.replace('#', ''), 16);
}
