export type SpiritElement = 'forest' | 'water' | 'mountain' | 'wind' | 'earth';
export type SpiritRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SpiritType {
  id: string;
  name: string;
  element: SpiritElement;
  rarity: SpiritRarity;
  energyValue: number;
  color: number;
  description: string;
  glowColor: string;
}

export const SPIRIT_TYPES: SpiritType[] = [
  {
    id: 'forest_sprite',
    name: 'Forest Sprite',
    element: 'forest',
    rarity: 'common',
    energyValue: 10,
    color: 0x22c55e,
    description: 'A playful sprite that dances among the leaves.',
    glowColor: '#22c55e',
  },
  {
    id: 'river_wisp',
    name: 'River Wisp',
    element: 'water',
    rarity: 'rare',
    energyValue: 25,
    color: 0x38bdf8,
    description: 'A shimmering wisp born from flowing waters.',
    glowColor: '#38bdf8',
  },
  {
    id: 'stone_guardian',
    name: 'Stone Guardian',
    element: 'mountain',
    rarity: 'epic',
    energyValue: 50,
    color: 0x78716c,
    description: 'An ancient protector of mountain paths.',
    glowColor: '#a8a29e',
  },
  {
    id: 'wind_sylph',
    name: 'Wind Sylph',
    element: 'wind',
    rarity: 'rare',
    energyValue: 20,
    color: 0x93c5fd,
    description: 'A graceful spirit that rides the breeze.',
    glowColor: '#bae6fd',
  },
  {
    id: 'mossling',
    name: 'Mossling',
    element: 'earth',
    rarity: 'common',
    energyValue: 8,
    color: 0x65a30d,
    description: 'A tiny earth spirit covered in soft moss.',
    glowColor: '#84cc16',
  },
  {
    id: 'glowcap_spirit',
    name: 'Glowcap Spirit',
    element: 'forest',
    rarity: 'legendary',
    energyValue: 100,
    color: 0xfbbf24,
    description: 'A rare luminous spirit found only in ancient groves.',
    glowColor: '#fbbf24',
  },
];

export function getRandomSpiritType(): SpiritType {
  const rand = Math.random();
  let rarity: SpiritRarity;
  if (rand < 0.6) {
    rarity = 'common';
  } else if (rand < 0.85) {
    rarity = 'rare';
  } else if (rand < 0.97) {
    rarity = 'epic';
  } else {
    rarity = 'legendary';
  }
  const spirits = SPIRIT_TYPES.filter(s => s.rarity === rarity);
  // Fallback to all spirits if a rarity tier has no entries
  const pool = spirits.length > 0 ? spirits : SPIRIT_TYPES;
  return pool[Math.floor(Math.random() * pool.length)];
}
