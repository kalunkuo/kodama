import { TileClass } from '../config/constants';
import { WorldGrid } from './WorldGrid';

/**
 * Idea 2 (swarm-gated exploration): the Ramble's tilemap is almost entirely
 * walkable (lawn/woodland/path), so there are no maze-like chokepoints to
 * physically block — but the Lake is a *real* barrier. A connected-components
 * scan of the actual generated map (data/ramble_map.json) found two genuine
 * far-shore landmasses (216 and 134 tiles) that are disconnected from the
 * player's start point purely by water. Those become "pockets": areas you
 * can see but can't reach until enough of your swarm builds a bridge across
 * the narrowest water gap — found here via a real multi-source BFS over
 * water tiles, not a guess.
 */

const MIN_POCKET_SIZE = 20; // ignore stray 1-2 tile slivers from bbox edges
const MAX_WATER_BFS = 6000; // safety bound so a landlocked pocket can't hang the search
const AREA_NAMES = ['THE FAR SHORE', 'THE POINT', 'THE HOLLOW', 'THE THICKET'];

export interface Bridge {
  id: string;
  name: string;
  pathTiles: { x: number; y: number }[]; // water tiles to convert to a walkable crossing
  pocketTiles: { x: number; y: number }[]; // land unlocked once the bridge is built
  anchor: { x: number; y: number }; // world position for the build-site marker
  required: number; // swarm members needed to start construction
}

function idx(w: number, x: number, y: number): number {
  return y * w + x;
}

function floodFillWalkable(grid: WorldGrid, sx: number, sy: number, exclude?: Uint8Array): { mask: Uint8Array; tiles: { x: number; y: number }[] } {
  const mask = new Uint8Array(grid.width * grid.height);
  const tiles: { x: number; y: number }[] = [];
  if (!grid.isWalkable(sx, sy)) return { mask, tiles };
  const queue: number[] = [idx(grid.width, sx, sy)];
  mask[queue[0]] = 1;
  while (queue.length > 0) {
    const i = queue.pop()!;
    const x = i % grid.width;
    const y = (i - x) / grid.width;
    tiles.push({ x, y });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.isWalkable(nx, ny)) continue;
      const ni = idx(grid.width, nx, ny);
      if (mask[ni] || (exclude && exclude[ni])) continue;
      mask[ni] = 1;
      queue.push(ni);
    }
  }
  return { mask, tiles };
}

/** Multi-source BFS over water tiles from a pocket's shoreline to the mainland's shoreline. */
function findWaterBridge(grid: WorldGrid, mainlandMask: Uint8Array, pocketMask: Uint8Array): { x: number; y: number }[] | null {
  const w = grid.width;
  const visited = new Uint8Array(w * grid.height);
  const prev = new Int32Array(w * grid.height).fill(-1);
  const queue: number[] = [];

  const isMainlandAdjacent = (x: number, y: number): boolean =>
    (x + 1 < w && mainlandMask[idx(w, x + 1, y)] === 1) ||
    (x > 0 && mainlandMask[idx(w, x - 1, y)] === 1) ||
    (y + 1 < grid.height && mainlandMask[idx(w, x, y + 1)] === 1) ||
    (y > 0 && mainlandMask[idx(w, x, y - 1)] === 1);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < w; x++) {
      if (grid.classAt(x, y) !== 'water') continue;
      const isPocketAdjacent =
        (x + 1 < w && pocketMask[idx(w, x + 1, y)] === 1) ||
        (x > 0 && pocketMask[idx(w, x - 1, y)] === 1) ||
        (y + 1 < grid.height && pocketMask[idx(w, x, y + 1)] === 1) ||
        (y > 0 && pocketMask[idx(w, x, y - 1)] === 1);
      if (isPocketAdjacent) {
        const i = idx(w, x, y);
        visited[i] = 1;
        queue.push(i);
      }
    }
  }
  if (queue.length === 0) return null;

  let head = 0;
  let visitedCount = queue.length;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    if (isMainlandAdjacent(x, y)) {
      const path: { x: number; y: number }[] = [];
      let cur = i;
      while (cur !== -1) {
        const cx = cur % w;
        const cy = (cur - cx) / w;
        path.push({ x: cx, y: cy });
        cur = prev[cur];
      }
      return path;
    }
    if (visitedCount > MAX_WATER_BFS) return null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= grid.height) continue;
      if (grid.classAt(nx, ny) !== 'water') continue;
      const ni = idx(w, nx, ny);
      if (visited[ni]) continue;
      visited[ni] = 1;
      prev[ni] = i;
      visitedCount++;
      queue.push(ni);
    }
  }
  return null;
}

export function findPocketsAndBridges(grid: WorldGrid, base: { x: number; y: number }): Bridge[] {
  const { mask: mainlandMask } = floodFillWalkable(grid, base.x, base.y);
  const visited = new Uint8Array(mainlandMask); // reuse: anything already found is "seen"
  const bridges: Bridge[] = [];
  let nameIdx = 0;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const i = idx(grid.width, x, y);
      if (visited[i] || !grid.isWalkable(x, y)) continue;
      const { mask: pocketMask, tiles: pocketTiles } = floodFillWalkable(grid, x, y, visited);
      for (let k = 0; k < pocketMask.length; k++) if (pocketMask[k]) visited[k] = 1;
      if (pocketTiles.length < MIN_POCKET_SIZE) continue;

      const pathTiles = findWaterBridge(grid, mainlandMask, pocketMask);
      if (!pathTiles || pathTiles.length === 0) continue;

      const mid = pathTiles[Math.floor(pathTiles.length / 2)];
      bridges.push({
        id: `bridge_${bridges.length}`,
        name: AREA_NAMES[nameIdx++] ?? `AREA ${nameIdx}`,
        pathTiles,
        pocketTiles,
        anchor: grid.toWorld(mid.x, mid.y),
        required: Math.max(8, Math.min(24, Math.round(pathTiles.length * 2.2))),
      });
    }
  }

  bridges.sort((a, b) => a.pathTiles.length - b.pathTiles.length);
  return bridges;
}

/** Converts a bridge's water tiles into a walkable crossing and opens its pocket to spawning. */
export function buildBridge(grid: WorldGrid, bridge: Bridge, pathClass: TileClass = 'path'): void {
  for (const t of bridge.pathTiles) grid.setWalkableClass(t.x, t.y, pathClass);
  for (const t of bridge.pocketTiles) grid.setReachable(t.x, t.y, true);
}
