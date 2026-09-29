import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room.js";
import { MAX_RAID_TICKS } from "../src/constants.js";
import { validateClientMsg, isValidMoveVector } from "../src/validate-msg.js";
import type { ClientMsg } from "../src/protocol.js";

const ROOM_OPTS = {
  terrain: new Array(660).fill(0),
  enterTile: { x: 1, y: 1 },
  dogs: [{ x: 15, y: 10 }],
  chests: [{ id: "chest-wood-1", x: 20, y: 10 }],
  seed: "test-seed",
};

describe("MAX_RAID_TICKS (review H3 — hard cap thời lượng raid)", () => {
  it("tick dưới cap → chưa ended", () => {
    const room = new RaidRoom(ROOM_OPTS);
    for (let i = 0; i < MAX_RAID_TICKS - 1; i++) room.tick(100);
    expect(room.ended).toBeNull();
  });

  it("tick đạt cap → timeout (farm không kẹt active với idle raider)", () => {
    const room = new RaidRoom(ROOM_OPTS);
    // Tick vượt xa cap — room phải tự kết thúc ĐÚNG tại cap.
    let guard = 0;
    while (room.ended === null && guard < MAX_RAID_TICKS + 100) {
      room.tick(100);
      guard++;
    }
    expect(room.ended).toEqual({ reason: "timeout" });
    expect(room.tickN).toBeLessThanOrEqual(MAX_RAID_TICKS + 1);
  });
});

describe("validateClientMsg (review C7 — runtime message validation)", () => {
  const CHESTS = ["chest-wood-1", "chest-iron-2"];

  it("move integer trong [-1,1] → pass", () => {
    const msg = { t: "move", dx: 1, dy: -1 } as ClientMsg;
    expect(validateClientMsg(msg, CHESTS)).toEqual(msg);
  });

  it("move dx=1e9 (wall-clip teleport) → null", () => {
    expect(validateClientMsg({ t: "move", dx: 1e9 as -1, dy: 0 }, CHESTS)).toBeNull();
  });

  it("move fractional dx=0.5 → null", () => {
    expect(validateClientMsg({ t: "move", dx: 0.5 as -1, dy: 0 }, CHESTS)).toBeNull();
  });

  it("move NaN/string → null", () => {
    expect(validateClientMsg({ t: "move", dx: Number.NaN as -1, dy: 0 }, CHESTS)).toBeNull();
    expect(validateClientMsg({ t: "move", dx: "1" as unknown as -1, dy: 0 }, CHESTS)).toBeNull();
  });

  it("interact-chest id lạ → null (chặn deadline-Map growth)", () => {
    expect(validateClientMsg({ t: "interact-chest", chestId: "junk" }, CHESTS)).toBeNull();
    expect(validateClientMsg({ t: "interact-chest", chestId: "chest-iron-2" }, CHESTS)).not.toBeNull();
  });

  it("use-tool chestId lạ → null; smoke (không chestId) → pass", () => {
    expect(validateClientMsg({ t: "use-tool", toolId: "lockpick", chestId: "junk" }, CHESTS)).toBeNull();
    expect(validateClientMsg({ t: "use-tool", toolId: "smoke" }, CHESTS)).not.toBeNull();
  });

  it("puzzle-input attempt quá dài / non-integer → null", () => {
    const long = { t: "puzzle-input", chestId: "chest-wood-1", attempt: new Array(65).fill(0) } as ClientMsg;
    expect(validateClientMsg(long, CHESTS)).toBeNull();
    const bad = { t: "puzzle-input", chestId: "chest-wood-1", attempt: [0.5] } as ClientMsg;
    expect(validateClientMsg(bad, CHESTS)).toBeNull();
    const ok = { t: "puzzle-input", chestId: "chest-wood-1", attempt: [0, 1, 2] } as ClientMsg;
    expect(validateClientMsg(ok, CHESTS)).not.toBeNull();
  });

  it("isValidMoveVector boundary values", () => {
    expect(isValidMoveVector(-1, 1)).toBe(true);
    expect(isValidMoveVector(0, 0)).toBe(true);
    expect(isValidMoveVector(2, 0)).toBe(false);
    expect(isValidMoveVector(0, -2)).toBe(false);
    expect(isValidMoveVector(1.5, 0)).toBe(false);
  });
});
