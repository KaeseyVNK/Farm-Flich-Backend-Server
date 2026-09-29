import { cn } from "@/lib/utils";

type PixelSpriteProps = {
  map: string[];
  colors: Record<string, string>;
  size?: number;
  className?: string;
  title?: string;
};

export function PixelSprite({
  map,
  colors,
  size = 28,
  className,
  title,
}: PixelSpriteProps) {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      className={cn("shrink-0", className)}
      shapeRendering="crispEdges"
      aria-hidden={!title}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {map.map((row, y) =>
        Array.from(row).map((cell, x) => {
          const fill = colors[cell];
          if (!fill || cell === "." || cell === "0") return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}

const INK = {
  ".": "transparent",
  k: "#3e2f23",
  w: "#fffdf5",
  y: "#ffc93c",
  Y: "#f5a300",
  g: "#58a942",
  G: "#2f7d33",
  s: "#a1795a",
  S: "#6d4c33",
  o: "#ef8354",
  r: "#e25c4a",
  R: "#b33b2e",
  c: "#4db6ac",
  b: "#6b8fc2",
  p: "#9575cd",
  n: "#f4c7a1",
  N: "#d59a78",
};

export const SPRITE = {
  sunflower: [
    "....yyyy....",
    "...yYkYYy...",
    "..yYkkkYYy..",
    ".yYkkkkkkYy.",
    ".yYkkYkkkYy.",
    "..yYkkkYYy..",
    "...yYkYYy...",
    "....yyyy....",
    ".....GG.....",
    ".....Gg.....",
    "....gGG.....",
    ".....GG.....",
  ],
  carrot: [
    ".....GG.....",
    "....GgG.....",
    ".....GG.....",
    "....oooo....",
    "...oYoYo....",
    "...oYooo....",
    "....oYoo....",
    "....ooo.....",
    ".....oo.....",
    ".....o......",
  ],
  corn: [
    "...GG.GG....",
    "....GgG.....",
    "....yyyy....",
    "...yYkYYy...",
    "...yYkYYy...",
    "...yYkYYy...",
    "....yyyy....",
    ".....GG.....",
  ],
  tomato: [
    ".....GG.....",
    "....GkkG....",
    "...rrRrrr...",
    "..rRrrrRrr..",
    "..rrrrRrrr..",
    "...rrRrrr...",
    "....rrrr....",
  ],
  pumpkin: [
    ".....GG.....",
    "...ooYooo...",
    "..oYoYoYoo..",
    "..oYooooYo..",
    "..ooooYooo..",
    "...oooooo...",
  ],
  berry: [
    ".....GG.....",
    "....Gkk.....",
    "...rRrRr....",
    "..rRwrRwr...",
    "..rRrRrRr...",
    "...rRrRr....",
  ],
  egg: [
    "....www.....",
    "...wkwkw....",
    "...wkkkw....",
    "...wwwww....",
    "....www.....",
  ],
  milk: [
    "...wwwww....",
    "..wkkkkkkw..",
    "..wkwwwkkw..",
    "..wkkkkkkw..",
    "...wwwww....",
    "....sss.....",
  ],
  fish: [
    "..bbc.......",
    ".bkwbbc.....",
    "bbkwkbbbG...",
    ".bkwbbc.....",
    "..bbc.......",
  ],
  honey: [
    "....YYYY....",
    "...YkkkY....",
    "...YkYkY....",
    "...YYYYY....",
    "....YYY.....",
  ],
  wool: [
    "...wwwww....",
    "..wkwkwkw...",
    "..wwwwwww...",
    "...wkwkw....",
    "....www.....",
  ],
  gem: [
    ".....b......",
    "....bwb.....",
    "...bkwkb....",
    "....bwb.....",
    ".....b......",
  ],
  mushroom: [
    "...rrRrrr...",
    "..rwrRrwRr..",
    "...rrrrr....",
    ".....ww.....",
    ".....ww.....",
  ],
  cloud: [
    "....www.....",
    "..wwwwwww...",
    ".wwwwwwwww..",
    "wwwwwwwwwww.",
  ],
} as const;

export function CropIcon({
  name,
  size = 22,
  title,
}: {
  name: keyof typeof SPRITE;
  size?: number;
  title?: string;
}) {
  return (
    <PixelSprite map={[...SPRITE[name]]} colors={INK} size={size} title={title} />
  );
}

const FARMER = [
  "......kkkk......",
  ".....kYYYYYk....",
  "....kYYkkkYYk...",
  "....kYYYYYYYk...",
  ".....knNnnNk....",
  ".....k.nn.k.....",
  ".....knnnnnk....",
  "......knnNk.....",
  ".....kkkkkk.....",
  "....kbwwwwbk....",
  "...kbwwkkwwbk...",
  "...kbwwwwwwbk...",
  "....kbbbbbbk....",
  ".....kbbbbk.....",
  ".....ks..sk.....",
  ".....kS..Sk.....",
  "....kkk..kkk....",
];

const KNIGHT = [
  "......kkkk......",
  ".....kwwwwwk....",
  "....kwkkkkkkw...",
  "....kwkwwwkkw...",
  ".....kwwwwwk....",
  ".....k.nn.k.....",
  ".....knnnnnk....",
  "......knnNk.....",
  ".....kkkkkk.....",
  "....kwwwwwwk....",
  "...kwwkkkkwwk...",
  "...kwwYYYYYYk...",
  "....kwwwwwwk....",
  ".....kwwwwk.....",
  ".....ks..sk.....",
  ".....kS..Sk.....",
  "....kkk..kkk....",
];

const MAGE = [
  ".......kk.......",
  "......kppk......",
  ".....kppppk.....",
  "....kppkkppk....",
  "....kppppppk....",
  ".....knNnnNk....",
  ".....k.nn.k.....",
  ".....knnnnnk....",
  "......knnNk.....",
  ".....kkkkkk.....",
  "....kppppppk....",
  "...kppYYYYYYk...",
  "...kppppppppk...",
  "....kppppppk....",
  ".....kppppk.....",
  ".....ks..sk.....",
  "....kkk..kkk....",
];

const FISHER = [
  "......kkkk......",
  ".....kccccck....",
  "....kcckkkcck...",
  "....kccccccck...",
  ".....knNnnNk....",
  ".....k.nn.k.....",
  ".....knnnnnk....",
  "......knnNk.....",
  ".....kkkkkk.....",
  "....kcwwwwck....",
  "...kcwwkkwwck...",
  "...kcwcccccck...",
  "....kcccccck....",
  ".....kbbb.k.g...",
  ".....ks..sk.G...",
  ".....kS..Sk.....",
  "....kkk..kkk....",
];

export const CHARACTERS = {
  farmer: { map: FARMER, label: "Nông dân" },
  knight: { map: KNIGHT, label: "Hiệp sĩ" },
  mage: { map: MAGE, label: "Pháp sư" },
  fisher: { map: FISHER, label: "Ngư dân" },
} as const;

export type CharacterId = keyof typeof CHARACTERS;

export const HAIR_TONES = {
  brown: { Y: "#6d4c33", k: "#3e2f23" },
  black: { Y: "#2b2118", k: "#1a140f" },
  blonde: { Y: "#ffc93c", k: "#c98a12" },
  auburn: { Y: "#c45c26", k: "#8a3514" },
} as const;

export type HairId = keyof typeof HAIR_TONES;

export function PixelCharacter({
  id,
  hair = "brown",
  size = 160,
  className,
}: {
  id: CharacterId;
  hair?: HairId;
  size?: number;
  className?: string;
}) {
  const tone = HAIR_TONES[hair];
  const colors = { ...INK };
  if (id === "farmer") {
    colors.Y = tone.Y;
    colors.y = tone.Y;
  }
  return (
    <PixelSprite
      map={[...CHARACTERS[id].map]}
      colors={colors}
      size={size}
      className={className}
      title={CHARACTERS[id].label}
    />
  );
}
