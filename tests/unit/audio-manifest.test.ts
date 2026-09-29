import { describe, it, expect } from "vitest";
import { AUDIO_MANIFEST, audioFileFor } from "@/lib/game/audio/audio-manifest";

describe("AUDIO_MANIFEST", () => {
  it("manifest không rỗng", () => {
    expect(AUDIO_MANIFEST.length).toBeGreaterThan(0);
  });

  it("mọi entry có bus + file hợp lệ", () => {
    for (const e of AUDIO_MANIFEST) {
      expect(e.bus, e.event).toMatch(/^(music|sfx|ambient)$/);
      expect(e.file, e.event).toMatch(/^\/audio\/(sfx|music|ambient)\/[a-z0-9-]+\.(ogg|mp3|wav)$/);
    }
  });

  it("loop chỉ dành cho music/ambient", () => {
    for (const e of AUDIO_MANIFEST) {
      if (e.loop) expect(["music", "ambient"]).toContain(e.bus);
      if (e.volume !== undefined) {
        expect(e.volume, e.event).toBeGreaterThanOrEqual(0);
        expect(e.volume, e.event).toBeLessThanOrEqual(1);
      }
    }
  });

  it("audioFileFor tìm thấy event đã khai báo", () => {
    const first = AUDIO_MANIFEST[0];
    expect(audioFileFor(first.event)).toBe(first.file);
    expect(audioFileFor("nonexistent-event")).toBeUndefined();
  });

  it("mọi file trong manifest tồn tại thật trên disk", async () => {
    const { readdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    for (const e of AUDIO_MANIFEST) {
      const rel = e.file.replace(/^\/audio\//, "");
      const dir = join(process.cwd(), "public", "audio", rel.split("/")[0]);
      const files = await readdir(dir);
      expect(files, e.event).toContain(rel.split("/")[1]);
    }
  });

  it("không có file mồ côi — mọi file trong public/audio đều có entry manifest", async () => {
    const { readdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const manifested = new Set(AUDIO_MANIFEST.map((e) => e.file.replace(/^\/audio\//, "")));
    for (const bus of ["sfx", "music", "ambient"] as const) {
      const files = await readdir(join(process.cwd(), "public", "audio", bus));
      for (const f of files) {
        expect(manifested.has(`${bus}/${f}`), `${bus}/${f}`).toBe(true);
      }
    }
  });
});
