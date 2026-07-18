import { SAVE_KEY } from '../config/constants';
import { levelForXp } from './Progression';

export interface DexEntry {
  caught_at: string; // ISO date
  onsite: boolean; // caught while zone === 'ramble' → "field-verified" badge
}

export interface SaveData {
  version: 2;
  dex: Record<string, DexEntry>;
  roster: string[]; // species ids of current swarm members
  offerings: number; // carry-objects delivered to base
  xp: number; // Caretaker Level is always derived from this (single source of truth)
  settings: { audio: boolean };
}

const EMPTY: SaveData = {
  version: 2,
  dex: {},
  roster: [],
  offerings: 0,
  xp: 0,
  settings: { audio: true },
};

export interface XpGrantResult {
  leveledUp: boolean;
  newLevel: number;
}

/** localStorage persistence (plan §7): dex + roster is a few KB, versioned key. */
export class Save {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(EMPTY);
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== 2) return structuredClone(EMPTY);
      return { ...structuredClone(EMPTY), ...parsed };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // storage full/unavailable — the session still plays, it just won't persist
    }
  }

  /** True if this species has never been recorded — call before recordCatch(). */
  isNewSpecies(speciesId: string): boolean {
    return !this.data.dex[speciesId];
  }

  recordCatch(speciesId: string, onsite: boolean): void {
    if (!this.data.dex[speciesId]) {
      this.data.dex[speciesId] = { caught_at: new Date().toISOString(), onsite };
    } else if (onsite && !this.data.dex[speciesId].onsite) {
      this.data.dex[speciesId].onsite = true; // upgrade to field-verified
    }
    this.persist();
  }

  setRoster(speciesIds: string[]): void {
    this.data.roster = speciesIds;
    this.persist();
  }

  addXp(amount: number): XpGrantResult {
    const oldLevel = levelForXp(this.data.xp);
    this.data.xp += amount;
    const newLevel = levelForXp(this.data.xp);
    this.persist();
    return { leveledUp: newLevel > oldLevel, newLevel };
  }
}
