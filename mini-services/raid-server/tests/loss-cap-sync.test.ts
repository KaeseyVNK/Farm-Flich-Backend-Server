import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PER_RAID_CAP_PCT, PER_DAY_CAP_PCT } from "../src/loss-cap.js";

/**
 * Loss-cap DRIFT guard — server bản (loss-cap.ts) vs client bản
 * (src/lib/raid/loss-cap.ts) phải GIỐNG NHAU. Hai bản duplicate độc lập
 * (red-team #19 drift pattern). Nếu sửa 1 bản quên bản kia → client UI hiển
 * thị steal cap khác server enforce (UI bảo trộm được 10% nhưng server cho
 * nhiều hơn/ít hơn). Đọc source text client để so sánh literal.
 */
const CLIENT_FILE = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "src",
  "lib",
  "raid",
  "loss-cap.ts",
);

describe("loss-cap server/client sync (anti-drift)", () => {
  it("PER_RAID_CAP_PCT khớp client (0.10)", () => {
    const client = readFileSync(CLIENT_FILE, "utf8");
    expect(client).toContain("PER_RAID_CAP_PCT = 0.10");
    expect(PER_RAID_CAP_PCT).toBe(0.1);
  });

  it("PER_DAY_CAP_PCT khớp client (0.25)", () => {
    const client = readFileSync(CLIENT_FILE, "utf8");
    expect(client).toContain("PER_DAY_CAP_PCT = 0.25");
    expect(PER_DAY_CAP_PCT).toBe(0.25);
  });

  it("computeStealableNow logic khớp client (input → output bằng nhau)", () => {
    const clientSrc = readFileSync(CLIENT_FILE, "utf8");
    // Client computeStealableNow phải giống server: min(perRaid, perDayRemaining).
    expect(clientSrc).toContain("Math.min(perRaid, perDayRemaining)");
    expect(clientSrc).toContain("Math.floor(poolSize * perRaidPct)");
  });
});
