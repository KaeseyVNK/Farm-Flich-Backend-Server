"use client";

import type { DecorDef } from "@/lib/game/decor/decor-catalog";
import { GameIcon } from "./game-icon";
import { SheetThumb } from "./sheet-thumb";

export function DecorArt({
  def,
  size,
  className,
}: {
  def: DecorDef;
  size: number;
  className?: string;
}) {
  if (!def.manifestKey) {
    return <GameIcon id="feature-decor" size={size} decorative className={className} />;
  }
  return (
    <SheetThumb assetKey={def.manifestKey} frame={def.frame} size={size} className={className} />
  );
}
