import assert from "node:assert/strict";
import { parseCharacterSelection, parseLegacyCharacter } from "../src/lib/unity/character-selection.ts";

const male = { gender: "male", skinIndex: 1, clothesId: "Farm/Blue", eyesId: "Male/Brown", hairId: "Standard/Brown", accId: "" };
assert.deepEqual(parseCharacterSelection(male), male);
assert.equal(parseCharacterSelection({ ...male, gender: "female" }), null);
assert.equal(parseCharacterSelection({ ...male, skinIndex: 0 }), null);
assert.equal(parseCharacterSelection({ ...male, hairId: "Missing/Brown" }), null);
assert.equal(parseCharacterSelection({ ...male, accId: "../Wizard" }), null);
assert.equal(parseCharacterSelection({ ...male, eyesId: "Female/Blue" }), null);
assert.equal(parseCharacterSelection({ ...male, hairId: "Fawn/Brown" }), null);
assert.deepEqual(parseLegacyCharacter({ ...male, hairId: "Fawn/Brown" }), { ...male, hairId: "Fawn/Brown" });
assert.equal(parseLegacyCharacter({ ...male, eyesId: "Female/Blue" }), null);
console.log("Character selection validation passed.");
