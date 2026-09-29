import { describe, it, expect } from "vitest";
import { mapRaidEntity, type RaidDisplayKind } from "../../src/components/raid/raid-display-mapper";

// Phase 5 — shared raid/replay display mapper (phase-05 §Live/replay display mapper contract).
// Pins exhaustive entity kind mapping to a semantic non-emoji spec. The mapper accepts ONLY
// documented entity kinds (raider/dog/chest states) — never a raw asset URL, farm save id or
// hidden trap field. Replay and live raid render through the same mapper so they can't diverge.

describe("mapRaidEntity (exhaustive, non-emoji)", () => {
  it("maps every supported kind to a visual spec with accessible name", () => {
    const kinds: RaidDisplayKind[] = ["raider", "dog", "chest-closed", "chest-open"];
    for (const kind of kinds) {
      const spec = mapRaidEntity(kind);
      expect(spec).toBeDefined();
      expect(spec.pivot).toBeDefined();
      expect(typeof spec.accessibleName).toBe("string");
      expect(spec.accessibleName.length).toBeGreaterThan(0);
    }
  });

  it("returns intentional pixel fallback (primitive), never an emoji", () => {
    for (const kind of ["raider", "dog", "chest-closed", "chest-open"] as const) {
      const spec = mapRaidEntity(kind);
      // No OS emoji anywhere in the mapping.
      expect(JSON.stringify(spec)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
    }
  });

  it("distinguishes open vs closed chest", () => {
    expect(mapRaidEntity("chest-open").accessibleName).toContain("mở");
    expect(mapRaidEntity("chest-closed").accessibleName).toContain("đóng");
    // Distinct colors/specs so a closed/open chest is visually separable.
    expect(JSON.stringify(mapRaidEntity("chest-open"))).not.toBe(
      JSON.stringify(mapRaidEntity("chest-closed")),
    );
  });

  it("rejects an unknown kind at the type level (no server/private lookup)", () => {
    // @ts-expect-error — trap/secret entity kinds are NOT part of the mapper contract.
    mapRaidEntity("trap-bear");
  });
});