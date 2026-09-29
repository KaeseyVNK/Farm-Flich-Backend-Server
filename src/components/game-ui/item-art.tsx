"use client";

import { resolveItemSprite } from "@/lib/game/assets/icon-manifest";
import { getItem, type ItemDef } from "@/lib/game/data";
import { GameIcon } from "./game-icon";
import { itemIconId } from "./item-icon";
import { SheetThumb } from "./sheet-thumb";

export function ItemArt({
  def,
  itemId,
  size,
  className,
}: {
  def?: ItemDef | null;
  itemId?: string;
  size: number;
  className?: string;
}) {
  const resolved = def ?? (itemId ? getItem(itemId) : undefined);
  if (!resolved) return null;
  const sprite = resolveItemSprite(resolved.id);
  if (sprite) {
    return (
      <SheetThumb assetKey={sprite.key} frame={sprite.frame} size={size} className={className} />
    );
  }
  return <GameIcon id={itemIconId(resolved)} size={size} decorative className={className} />;
}
