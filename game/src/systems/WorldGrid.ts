import { TILE_CLASSES, TILE_SIZE, TILE_WALKABLE, TileClass } from '../config/constants';

export interface TiledMap {
  width: number;
  height: number;
  layers: { name: string; data: number[] }[];
}

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
}

/** One grid, three jobs: render layer, walkability layer, habitat layer (plan §5.1). */
export class WorldGrid {
  readonly width: number;
  readonly height: number;
  readonly classes: Uint8Array; // index into TILE_CLASSES
  readonly walkable: Uint8Array;
  readonly habitatTiles = new Map<string, { x: number; y: number }[]>();

  constructor(map: TiledMap) {
    this.width = map.width;
    this.height = map.height;
    const data = map.layers[0].data;
    this.classes = new Uint8Array(this.width * this.height);
    this.walkable = new Uint8Array(this.width * this.height);
    for (let i = 0; i < data.length; i++) {
      const classIdx = data[i] - 1; // gid is 1-based
      this.classes[i] = classIdx;
      this.walkable[i] = TILE_WALKABLE[TILE_CLASSES[classIdx]] ? 1 : 0;
    }
    this.buildHabitatIndex();
  }

  private buildHabitatIndex(): void {
    for (const cls of TILE_CLASSES) this.habitatTiles.set(cls, []);
    this.habitatTiles.set('water_edge', []);
    const reachableWater: { x: number; y: number }[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cls = this.classAt(x, y);
        this.habitatTiles.get(cls)!.push({ x, y });
        if (cls === 'water') {
          if (this.hasNeighbor(x, y, (nx, ny) => this.isWalkable(nx, ny))) {
            reachableWater.push({ x, y });
          }
        } else if (this.isWalkable(x, y)) {
          // water_edge isn't painted by the pipeline — derive it: any walkable
          // tile touching water. Mallards, sliders and raccoons live here.
          if (this.hasNeighbor(x, y, (nx, ny) => this.classAt(nx, ny) === 'water')) {
            this.habitatTiles.get('water_edge')!.push({ x, y });
          }
        }
      }
    }
    // Only water tiles the player can stand next to are spawn candidates.
    this.habitatTiles.set('water', reachableWater);
  }

  private hasNeighbor(x: number, y: number, pred: (nx: number, ny: number) => boolean): boolean {
    return (
      pred(x + 1, y) || pred(x - 1, y) || pred(x, y + 1) || pred(x, y - 1)
    );
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  classAt(x: number, y: number): TileClass {
    if (!this.inBounds(x, y)) return 'boundary';
    return TILE_CLASSES[this.classes[y * this.width + x]];
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.walkable[y * this.width + x] === 1;
  }

  isWalkableWorld(wx: number, wy: number): boolean {
    return this.isWalkable(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE));
  }

  toWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
  }

  toTile(wx: number, wy: number): { x: number; y: number } {
    return { x: Math.floor(wx / TILE_SIZE), y: Math.floor(wy / TILE_SIZE) };
  }

  /** Spiral out from (tx,ty) to the nearest walkable tile. */
  nearestWalkable(tx: number, ty: number, maxR = 24): { x: number; y: number } | null {
    if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.isWalkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
        }
      }
    }
    return null;
  }

  /**
   * A* over the walkability grid (plan §3: hand-rolled, ~80 lines).
   * 8-directional with corner-cut prevention; returns world-space waypoints.
   */
  findPath(sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
    if (!this.isWalkable(gx, gy) || !this.isWalkable(sx, sy)) return null;
    if (sx === gx && sy === gy) return [];

    const open: Node[] = [{ x: sx, y: sy, g: 0, f: 0, parent: null }];
    const gScore = new Map<number, number>();
    gScore.set(sy * this.width + sx, 0);
    const closed = new Set<number>();
    const octile = (x: number, y: number) => {
      const dx = Math.abs(x - gx);
      const dy = Math.abs(y - gy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const DIRS = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    let iterations = 0;
    while (open.length > 0 && iterations++ < 20000) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
      const cur = open.splice(best, 1)[0];
      const curKey = cur.y * this.width + cur.x;
      if (closed.has(curKey)) continue;
      closed.add(curKey);

      if (cur.x === gx && cur.y === gy) {
        const path: { x: number; y: number }[] = [];
        let n: Node | null = cur;
        while (n && n.parent) {
          path.push(this.toWorld(n.x, n.y));
          n = n.parent;
        }
        return path.reverse();
      }

      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!this.isWalkable(nx, ny)) continue;
        // no diagonal squeeze through blocked corners
        if (dx !== 0 && dy !== 0 && (!this.isWalkable(cur.x + dx, cur.y) || !this.isWalkable(cur.x, cur.y + dy))) {
          continue;
        }
        const key = ny * this.width + nx;
        if (closed.has(key)) continue;
        const g = cur.g + (dx !== 0 && dy !== 0 ? 1.414 : 1);
        const prev = gScore.get(key);
        if (prev !== undefined && prev <= g) continue;
        gScore.set(key, g);
        open.push({ x: nx, y: ny, g, f: g + octile(nx, ny), parent: cur });
      }
    }
    return null;
  }
}
