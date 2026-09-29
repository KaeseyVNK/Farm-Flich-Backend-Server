// Manifest audio file-based. Event thiếu file → engine fallback procedural (sfx.ts cũ).
// Nguồn + license của từng file: docs/audio-credits.md (chỉ CC0 / CC-BY).

export interface AudioEntry {
  event: string;
  file: string; // public path
  loop?: boolean;
  bus: "music" | "sfx" | "ambient";
  volume?: number; // 0..1 gain mặc định trước bus volume
}

export const AUDIO_MANIFEST: readonly AudioEntry[] = [
  // ---- sfx (one-shot) ----
  { event: "till", file: "/audio/sfx/till.ogg", bus: "sfx" },
  { event: "mine", file: "/audio/sfx/mine.ogg", bus: "sfx" },
  { event: "chop", file: "/audio/sfx/chop.ogg", bus: "sfx" },
  { event: "water", file: "/audio/sfx/water.ogg", bus: "sfx" },
  { event: "eat", file: "/audio/sfx/eat.ogg", bus: "sfx" },
  { event: "step", file: "/audio/sfx/step.ogg", bus: "sfx", volume: 0.4 },
  { event: "click", file: "/audio/sfx/click.ogg", bus: "sfx" },
  { event: "error", file: "/audio/sfx/error.ogg", bus: "sfx" },
  { event: "levelup", file: "/audio/sfx/levelup.ogg", bus: "sfx" },
  { event: "coin", file: "/audio/sfx/coin.ogg", bus: "sfx" },
  { event: "place", file: "/audio/sfx/place.ogg", bus: "sfx" },
  { event: "crickets", file: "/audio/sfx/crickets.ogg", bus: "sfx" },
  // ---- music (loop theo mùa) ----
  { event: "music-spring", file: "/audio/music/music-spring.ogg", bus: "music", loop: true },
  { event: "music-summer", file: "/audio/music/music-summer.ogg", bus: "music", loop: true },
  { event: "music-fall", file: "/audio/music/music-fall.ogg", bus: "music", loop: true },
  { event: "music-winter", file: "/audio/music/music-winter.ogg", bus: "music", loop: true },
  // ---- ambient (loop) ----
  { event: "amb-day-birds", file: "/audio/ambient/amb-day-birds.ogg", bus: "ambient", loop: true },
  { event: "amb-night-crickets", file: "/audio/ambient/amb-night-crickets.ogg", bus: "ambient", loop: true },
  { event: "amb-beach-waves", file: "/audio/ambient/amb-beach-waves.ogg", bus: "ambient", loop: true },
  { event: "amb-cave-drips", file: "/audio/ambient/amb-cave-drips.ogg", bus: "ambient", loop: true },
];

export function audioFileFor(event: string): string | undefined {
  return AUDIO_MANIFEST.find((e) => e.event === event)?.file;
}
