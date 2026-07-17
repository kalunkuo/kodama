import { SAVE_KEY } from '../config/constants';

export interface DexEntry {
  caught_at: string; // ISO date
  onsite: boolean; // caught while zone === 'ramble' → "field-verified" badge
}

export interface SaveData {
  version: 1;
  dex: Record<string, DexEntry>;
  roster: string[]; // species ids of current swarm members
  offerings: number; // carry-objects delivered to base
  settings: { audio: boolean };
}

const EMPTY: SaveData = {
  version: 1,
  dex: {},
  roster: [],
  offerings: 0,
  settings: { audio: true },
};

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
      if (parsed.version !== 1) return structuredClone(EMPTY);
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
}
