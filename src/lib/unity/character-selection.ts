export type CharacterSelection = {
  gender: "male" | "female";
  skinIndex: number;
  clothesId: string;
  eyesId: string;
  hairId: string;
  accId: string;
};

const colors = ["Black", "Blue", "Brown", "Green"];
const hairColors = ["Black", "Blonde", "Brown", "Ginger"];
const hairStylesByGender = {
  male: ["Josh", "Sebastian", "Standard"],
  female: ["Fawn", "Iridessa", "Lyria", "Silvermist", "Standard"],
} as const;
const accessories = new Set([
  "", "Beret", "Chicken", "Cook", "Cow", "Deer", "Farm", "Frog", "Leprechaun",
  "pirate eye patch", "Pirate", "Santa hat", "Wizard",
  ...hairColors.map(color => `Beard/${color}`),
  ...["Blue", "Green", "Pink", "Purple", "Red"].map(color => `Butterfly/${color}`),
  ...[1, 2, 3, 4].map(index => `Elf/${index}`),
]);
const clothes = new Set(["Blue", "Green", "Pink", "Purple", "Red"].map(color => `Farm/${color}`));
const hairByGender = {
  male: new Set(hairStylesByGender.male.flatMap(style => hairColors.map(color => `${style}/${color}`))),
  female: new Set(hairStylesByGender.female.flatMap(style => hairColors.map(color => `${style}/${color}`))),
};
const allHair = new Set([...hairByGender.male, ...hairByGender.female]);

function parseCharacter(value: unknown, allowExistingHairMismatch: boolean): CharacterSelection | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.gender !== "male" && v.gender !== "female") return null;
  if (!Number.isInteger(v.skinIndex) || Number(v.skinIndex) < 1 || Number(v.skinIndex) > 4) return null;
  if (typeof v.clothesId !== "string" || !clothes.has(v.clothesId)) return null;
  if (typeof v.eyesId !== "string" || !colors.some(color => v.eyesId === `${v.gender === "male" ? "Male" : "Female"}/${color}`)) return null;
  if (typeof v.hairId !== "string" || (!hairByGender[v.gender].has(v.hairId) && !(allowExistingHairMismatch && allHair.has(v.hairId)))) return null;
  if (typeof v.accId !== "string" || !accessories.has(v.accId)) return null;
  return {
    gender: v.gender, skinIndex: Number(v.skinIndex), clothesId: v.clothesId,
    eyesId: v.eyesId, hairId: v.hairId, accId: v.accId,
  };
}

export function parseCharacterSelection(value: unknown): CharacterSelection | null {
  return parseCharacter(value, false);
}

export function storedCharacter(gender: string | null, appearance: unknown): CharacterSelection | null {
  if (!gender || !appearance || typeof appearance !== "object") return null;
  return parseCharacter({ ...(appearance as object), gender }, true);
}
