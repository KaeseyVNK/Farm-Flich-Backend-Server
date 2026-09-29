import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreFriendContestRows } from "../../src/lib/game/festival/festival-friend-contest";

const MIG = readFileSync(
  join(process.cwd(), "prisma/migrations/20260820095000_festival_friend_contest/migration.sql"),
  "utf8",
);
const PANEL = readFileSync(join(process.cwd(), "src/components/panels/FestivalPanel.tsx"), "utf8");
const BOARD = readFileSync(
  join(process.cwd(), "src/components/panels/festival-friend-board.tsx"),
  "utf8",
);
const ACTION = readFileSync(join(process.cwd(), "src/app/actions/festival.ts"), "utf8");

const BANNED = ["gold", "gameMeta", "shippingBoxes", "configSnapshot"];

describe("festival_friend_contest RPC contract", () => {
  it("SECURITY DEFINER, auth.uid required, GRANT authenticated only", () => {
    expect(MIG.includes("CREATE OR REPLACE FUNCTION festival_friend_contest()")).toBe(true);
    expect(MIG.includes("SECURITY DEFINER")).toBe(true);
    expect(MIG.includes("festival_friend_contest: not authenticated")).toBe(true);
    expect(MIG.includes("GRANT EXECUTE ON FUNCTION festival_friend_contest() TO authenticated")).toBe(
      true,
    );
    expect(MIG.includes("REVOKE ALL ON FUNCTION festival_friend_contest() FROM anon")).toBe(true);
  });

  it("returns userId, displayName, likes, placedDecor; banned farm keys absent", () => {
    const fn = MIG.slice(MIG.indexOf("CREATE OR REPLACE FUNCTION festival_friend_contest()"));
    const body = fn.slice(0, fn.indexOf("REVOKE ALL ON FUNCTION festival_friend_contest()"));
    expect(body.includes('"userId"')).toBe(true);
    expect(body.includes('"displayName"')).toBe(true);
    expect(body.includes("AS likes")).toBe(true);
    expect(body.includes('"placedDecor"')).toBe(true);
    expect(body.includes("LIMIT 10")).toBe(true);
    for (const k of BANNED) {
      expect(body.includes(k)).toBe(false);
    }
  });

  it("strips placedDecor to defId + zone (no full farm JSONB dump)", () => {
    expect(MIG.includes("jsonb_build_object('defId'")).toBe(true);
    expect(MIG.includes("'zone'")).toBe(true);
  });
});

describe("scoreFriendContestRows", () => {
  it("scores farm decor + likes, ignores house and unknown ids, ranks high first", () => {
    const rows = scoreFriendContestRows([
      {
        userId: "b",
        displayName: "Bee",
        likes: 0,
        placedDecor: [{ defId: "fence_wood", zone: "farm" }],
      },
      {
        userId: "a",
        displayName: "Ann",
        likes: 2,
        placedDecor: [
          { defId: "fence_wood", zone: "farm" },
          { defId: "ghost", zone: "farm" },
          { defId: "fence_wood", zone: "house" },
        ],
      },
      { userId: "skip-me" },
    ]);
    // Ann: 2 (basic) + 2 likes×3 = 8; Bee: 2. skip-me likes 0 placed none = 0.
    expect(rows.map((r) => r.userId)).toEqual(["a", "b", "skip-me"]);
    expect(rows[0]).toMatchObject({ displayName: "Ann", likes: 2, score: 8 });
    expect(rows[1]).toMatchObject({ displayName: "Bee", likes: 0, score: 2 });
    expect(rows[2].score).toBe(0);
  });

  it("drops rows without userId", () => {
    expect(scoreFriendContestRows([{ displayName: "x", likes: 9 }])).toEqual([]);
  });
});

describe("festival contest wiring", () => {
  it("panel loads contest action and renders fest-leaderboard", () => {
    expect(PANEL.includes("festivalFriendContestAction")).toBe(true);
    expect(PANEL.includes("FestivalFriendBoard")).toBe(true);
    expect(BOARD.includes('data-testid="fest-leaderboard"')).toBe(true);
    expect(ACTION.includes('supabase.rpc("festival_friend_contest")')).toBe(true);
  });
});

