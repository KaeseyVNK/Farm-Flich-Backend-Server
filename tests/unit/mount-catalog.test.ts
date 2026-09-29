// Wave 6 P1 — mount catalog pure tests (giá/level/mult/gates/sheet sync).
import { describe, expect, it } from "vitest";
import { MOUNTS, mountById, canMount } from "@/lib/game/mounts/mount-catalog";
import { ASSET_MANIFEST } from "@/lib/game/assets/asset-manifest";

describe("mount catalog", () => {
  it("2 mount: bicycle rẻ lv2, ngựa đắt lv4 (W9P4 tune: 800→1500, 2500→6000)", () => {
    const bike = mountById("bicycle")!;
    const horse = mountById("horse")!;
    expect(bike.price).toBe(1500);
    expect(bike.unlockLevel).toBe(2);
    expect(horse.price).toBe(6000);
    expect(horse.unlockLevel).toBe(4);
    expect(bike.price).toBeLessThan(horse.price);
  });

  it("ngựa nhanh hơn xe, cả hai nhanh hơn đi bộ (mult > 1)", () => {
    for (const m of MOUNTS) {
      expect(m.walkMult).toBeGreaterThan(1);
      expect(m.runMult).toBeGreaterThan(1);
      expect(m.runMult).toBeLessThan(2); // §11 vibe: nhanh vừa, không "teleport feel"
    }
    const horse = mountById("horse")!;
    const bike = mountById("bicycle")!;
    expect(horse.walkMult).toBeGreaterThan(bike.walkMult);
    expect(horse.runMult).toBeGreaterThan(bike.runMult);
  });

  it("canMount: đủ điều kiện → ok", () => {
    expect(canMount("horse", 4, "farm", false, false)).toEqual({ ok: true });
    expect(canMount("bicycle", 5, "deepforest", false, false)).toEqual({ ok: true });
  });

  it("canMount refute theo thứ tự unknown → level → zone → tool → fishing", () => {
    expect(canMount("moto", 9, "farm", false, false)).toEqual({ ok: false, reason: "unknown" });
    expect(canMount("horse", 3, "farm", false, false)).toEqual({ ok: false, reason: "level" });
    expect(canMount("horse", 9, "house", false, false)).toEqual({ ok: false, reason: "zone" });
    expect(canMount("horse", 9, "farm", true, false)).toEqual({ ok: false, reason: "tool" });
    expect(canMount("horse", 9, "farm", false, true)).toEqual({ ok: false, reason: "fishing" });
    // level thấp + house → level thắng (check trước zone)
    expect(canMount("horse", 1, "house", false, false)).toEqual({ ok: false, reason: "level" });
  });

  it("sheets + frame meta khớp PIL probe (Horse 32×48 6f, Bicycle 32×32 4f)", () => {
    const keys = new Set(ASSET_MANIFEST.map((a) => a.key));
    for (const m of MOUNTS) {
      for (const k of Object.values(m.sheets)) expect(keys.has(k)).toBe(true);
    }
    const horse = mountById("horse")!;
    expect(horse.frameH).toBe(48);
    expect(horse.framesPerDir).toBe(6);
    const bike = mountById("bicycle")!;
    expect(bike.frameH).toBe(32);
    expect(bike.framesPerDir).toBe(4);
  });
});
