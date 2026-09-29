// Shared raid/replay display mapper (phase-05 §Live/replay display mapper contract).
//
// One visual source for live raid canvas + replay canvas, so the two cannot drift. Accepts
// ONLY documented display kinds derived from a server-allowed RaidSnapshot — never a raw
// asset URL, farm save id or hidden trap field. Returns approved manifest art when available
// or an intentional non-emoji pixel primitive fallback (solid disc/square/crate) + accessible
// name. Colors mirror the live RaidCanvas so replay looks like the raid it reconstructs.
export type RaidDisplayKind = "raider" | "dog" | "chest-closed" | "chest-open" | "lure";

export interface RaidDisplaySpec {
  /** Approved manifest asset key (empty until art sheets are approved). */
  assetKey?: string | undefined;
  /** Intentional temporary fallback shape. */
  primitive: "disc" | "square" | "crate";
  /** Fallback fill color (hex). */
  color: string;
  /** Fallback stroke color. */
  stroke: string;
  pivot: { x: number; y: number };
  accessibleName: string;
}

const SPECS: Record<RaidDisplayKind, Omit<RaidDisplaySpec, "pivot">> = {
  raider: {
    primitive: "disc",
    color: "#7c5cbf",
    stroke: "#3b2a5e",
    accessibleName: "Kẻ trộm (raider)",
  },
  dog: {
    primitive: "square",
    color: "#2f2a26",
    stroke: "#15110d",
    accessibleName: "Chó canh gác",
  },
  "chest-closed": {
    primitive: "crate",
    color: "#8b5a2b",
    stroke: "#5a3418",
    accessibleName: "Rương đóng",
  },
  lure: {
    primitive: "disc",
    color: "#e8a13c",
    stroke: "#8a5a14",
    accessibleName: "Mồi dụ",
  },
  "chest-open": {
    primitive: "crate",
    color: "#e7b94e",
    stroke: "#8a5a14",
    accessibleName: "Rương đã mở",
  },
};

/** Resolve a display kind to its visual spec. No server/private data is reachable here. */
export function mapRaidEntity(kind: RaidDisplayKind): RaidDisplaySpec {
  const base = SPECS[kind];
  return { ...base, pivot: { x: 0.5, y: 0.9 } } as RaidDisplaySpec;
}