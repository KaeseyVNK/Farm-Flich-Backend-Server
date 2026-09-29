import { describe, expect, it } from "vitest";
import {
  FARM_HOUSE,
  FARM_BARN,
  FARM_COOP,
  FARM_BARNYARD_GATE,
  FARM_PLOTS,
  FARM_WELL,
  FARM_TREES,
  ORCHARD_TREES,
  FARM_LAKE,
  FARM_POND,
  FARM_POND_SHORE,
  FARM_LAKE_SHORE,
  FARM_BRIDGE_NORTH,
  FARM_BRIDGE_SOUTH,
  isFarmScenerySolid,
  isFarmPondTile,
  isFarmLakeTile,
} from "@/lib/game/farm-scenery-layout";
import { FARM_ZONE } from "@/lib/game/zones/farm";
import { T } from "@/lib/game/constants";

const COLS = 60;
const ROWS = 60;

function terrainAt(x: number, y: number): number {
  return FARM_ZONE.terrain[y * COLS + x];
}

function reachablePaved(): Set<string> {
  const spawn = FARM_ZONE.spawn;
  const startKey = `${spawn.x},${spawn.y}`;
  const seen = new Set<string>([startKey]);
  const queue: Array<[number, number]> = [[spawn.x, spawn.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (terrainAt(nx, ny) !== T.PATH) continue;
      if (isFarmScenerySolid(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe("farm scenery collision ('Trại Sữa & Trái Cây Đồi Xanh')", () => {
  it("blocks the farmhouse walls, keeps the front yard walkable", () => {
    expect(isFarmScenerySolid(FARM_HOUSE.tx + 3, FARM_HOUSE.ty + FARM_HOUSE.rows - 1)).toBe(true);
    expect(isFarmScenerySolid(12, 12)).toBe(false);
  });

  it("blocks the stone well", () => {
    expect(isFarmScenerySolid(FARM_WELL.tx, FARM_WELL.ty)).toBe(true);
    expect(isFarmScenerySolid(6, 10)).toBe(true);
  });

  it("blocks pond and lake water, but bridges are walkable", () => {
    expect(isFarmPondTile(9, 23)).toBe(true);
    expect(isFarmScenerySolid(9, 23)).toBe(true);
    expect(isFarmLakeTile(34, 16)).toBe(true);
    expect(isFarmScenerySolid(34, 16)).toBe(true);

    expect(isFarmScenerySolid(FARM_BRIDGE_NORTH.tx, FARM_BRIDGE_NORTH.ty)).toBe(false);
    expect(isFarmScenerySolid(FARM_BRIDGE_SOUTH.tx, FARM_BRIDGE_SOUTH.ty)).toBe(false);
  });

  it("barnyard: barn + coop walls solid, gate open", () => {
    expect(isFarmScenerySolid(FARM_BARN.tx + 2, FARM_BARN.ty + FARM_BARN.rows - 1)).toBe(true);
    expect(isFarmScenerySolid(FARM_COOP.tx + 2, FARM_COOP.ty + FARM_COOP.rows - 1)).toBe(true);
    expect(isFarmScenerySolid(FARM_BARNYARD_GATE.tx0, FARM_BARNYARD_GATE.ty)).toBe(false);
    expect(isFarmScenerySolid(FARM_BARNYARD_GATE.tx1, FARM_BARNYARD_GATE.ty)).toBe(false);
  });

  it("orchard rows solid at trunk tiles", () => {
    expect(isFarmScenerySolid(26, 33)).toBe(true);
    expect(isFarmScenerySolid(30, 37)).toBe(true);
  });

  it("craft-corner: anvil solid, churn/jammaker walkable", () => {
    expect(isFarmScenerySolid(14, 12)).toBe(true);
    expect(isFarmScenerySolid(15, 13)).toBe(false);
    expect(isFarmScenerySolid(16, 13)).toBe(false);
  });
});

describe("farm layout logic", () => {
  it("spawn is PATH on the front stone courtyard", () => {
    const spawn = FARM_ZONE.spawn;
    expect(terrainAt(spawn.x, spawn.y)).toBe(T.PATH);
    expect(isFarmScenerySolid(spawn.x, spawn.y)).toBe(false);
  });

  it("paved routes connect spawn to north bridge, east road, and south orchard", () => {
    const reach = reachablePaved();
    expect(reach.has(`${FARM_BRIDGE_NORTH.tx},${FARM_BRIDGE_NORTH.ty}`)).toBe(true);
    expect(reach.has("51,0")).toBe(true);
    expect(reach.has("26,34")).toBe(true);
  });

  it("all interactive FARM_PLOTS are FALLOW terrain", () => {
    for (const plot of FARM_PLOTS) {
      expect(terrainAt(plot.tx, plot.ty)).toBe(T.FALLOW);
    }
  });

  it("ancient stone shrine and greenhouse are present in scenery", () => {
    expect(FARM_ZONE.terrain[53 * COLS + 5]).toBe(T.GRASS);
    expect(isFarmScenerySolid(55, 18)).toBe(true);
  });

  it("trees never overlap water or stone path", () => {
    for (const tree of FARM_TREES) {
      const t = terrainAt(tree.tx, tree.ty);
      expect(t).not.toBe(T.PATH);
      expect(t).not.toBe(T.WATER);
    }
  });

  it("pond and lake shores sit next to water", () => {
    expect(isFarmPondTile(FARM_POND_SHORE.x, FARM_POND_SHORE.y)).toBe(false);
    expect(isFarmLakeTile(FARM_LAKE_SHORE.x, FARM_LAKE_SHORE.y)).toBe(false);
    expect(FARM_POND.cols).toBeGreaterThan(3);
    expect(FARM_LAKE.cols).toBeGreaterThan(8);
    expect(ORCHARD_TREES.length).toBe(12);
  });
});
