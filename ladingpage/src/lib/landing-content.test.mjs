import assert from "node:assert/strict";
import test from "node:test";

async function loadLandingContent() {
  try {
    return await import("./landing-content.ts");
  } catch (error) {
    assert.fail(
      `The approved Farm & Filch content model is not implemented: ${String(error)}`,
    );
  }
}

test("navigation only points to sections rendered by the landing page", async () => {
  const { NAV_ITEMS, SECTION_IDS } = await loadLandingContent();
  const targets = NAV_ITEMS.map(({ href }) => href.replace(/^#/, ""));

  assert.deepEqual(targets, SECTION_IDS);
  assert.equal(new Set(targets).size, targets.length);
});

test("public landing content keeps the game free of Web3 positioning", async () => {
  const content = await loadLandingContent();
  const serialized = JSON.stringify(content);

  assert.doesNotMatch(serialized, /web3|crypto|nft|token/i);
  assert.equal(content.EXTERNAL_LINKS.play, "https://farmfilch.com/game/");
});

test("the core loop contains the four approved gameplay pillars", async () => {
  const { GAMEPLAY_PILLARS } = await loadLandingContent();

  assert.deepEqual(
    GAMEPLAY_PILLARS.map(({ id }) => id),
    ["farm", "sell", "filch", "protect"],
  );
});
