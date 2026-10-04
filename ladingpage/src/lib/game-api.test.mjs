import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_GAME_API_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_GAME_URL = "http://localhost:9599/?lc=old&keep=1";
const { buildGameLaunchUrl } = await import("./game-api.ts");

test("launch uses the current client contract and strips the old lc alias", () => {
  const url = new URL(buildGameLaunchUrl("test_code", "http://localhost:3004"));
  assert.equal(url.searchParams.get("server"), "http://localhost:3000");
  assert.equal(url.searchParams.get("launchCode"), "test_code");
  assert.equal(url.searchParams.get("webLogin"), "http://localhost:3004/login");
  assert.equal(url.searchParams.get("keep"), "1");
  assert(!url.searchParams.has("lc"));
});

test("launch rejects unsupported return hosts and malformed codes", () => {
  assert.throws(() => buildGameLaunchUrl("test_code", "https://evil.example"));
  assert.throws(() => buildGameLaunchUrl("bad&code", "http://localhost:3004"));
  assert.throws(() => buildGameLaunchUrl("", "http://localhost:3004"));
});
