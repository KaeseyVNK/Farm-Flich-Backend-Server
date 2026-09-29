import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ASSET_MANIFEST } from "../../src/lib/game/assets/asset-manifest";

// Asset manifest vs copy-script manifest phải sync (single source check).
// Script re-declares list (TS-import-in-mjs friction) → test này guard drift.
describe("copy-assets manifest sync", () => {
  it("script MANIFEST === TS ASSET_MANIFEST (key/src/dest)", async () => {
    const scriptPath = join(process.cwd(), "scripts", "copy-assets.mjs");
    const src = await readFile(scriptPath, "utf8");
    // Parse tuples [key, src, dest] từ script.
    const re = /\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]/g;
    const scriptEntries: [string, string, string][] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) scriptEntries.push([m[1], m[2], m[3]]);

    const tsEntries = ASSET_MANIFEST.map((e) => [e.key, e.src, e.dest] as [string, string, string]);
    expect(scriptEntries).toEqual(tsEntries);
  });

  it("asset subset đã copy → public/assets/farm-rpg/ tồn tại (chỉ check khi pack local)", async () => {
    // Skip trong CI không có pack. Local dev chạy copy-assets.mjs trước.
    const stat = await readFile(join(process.cwd(), "public", "assets", "farm-rpg", "tiles", "grass-spring.png")).then(
      () => true,
      () => false,
    );
    expect(stat).toBe(true);
  });
});
