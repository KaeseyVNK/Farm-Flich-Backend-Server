"use client";

import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUiStore } from "@/store/uiStore";
import { useProgressionStore } from "@/store/progressionStore";
import { seedUnlockLevel } from "@/lib/game/farm-catalog";
import { CROPS, getItem } from "@/lib/game/data";
import { gameActions, SHOP_SEEDS } from "@/lib/game/actions";
import { seedBuyPrice } from "@/lib/game/economy";
import { SEASON_THEME } from "@/lib/game/constants";
import { Coins, Sprout, TrendingUp, Lock, ShoppingCart } from "lucide-react";
import { ItemArt } from "@/components/game-ui/item-art";
import { Button } from "@/components/ui/button";

export function SeedsPanel() {
  const season = useGameStore((s) => s.season);
  const gold = useGameStore((s) => s.gold);
  const level = useProgressionStore((s) => s.level);
  // Subscribe slots — trước đây inv() snapshot tại render, không subscribe → panel
  // mở lại hiện "Có: N" stale (plant/buy không trigger re-render SeedsPanel).
  const slots = useInventoryStore((s) => s.slots);
  const inv = useInventoryStore.getState;
  const uiNotify = useUiStore.getState;
  const theme = SEASON_THEME[season];
  void slots; // re-render trigger — countItem đọc qua inv() tại render

  const ownedSeeds = SHOP_SEEDS.map((id) => ({ id, def: getItem(id)!, count: inv().countItem(id) }));

  return (
    <div className="flex flex-col gap-4">
      {/* Season banner */}
      <div
        className="flex items-center gap-3 rounded-xl border-2 border-[#4a3119] p-3"
        style={{ background: `linear-gradient(135deg, ${theme.sky}, #fffaf0)` }}
      >
        <span className="text-4xl">{theme.emoji}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a6238]">
            Mùa hiện tại
          </p>
          <p className="text-lg font-extrabold text-[#3b2f23]">{theme.label}</p>
          <p className="text-xs font-medium text-[#5a4a36]">
            Chỉ hạt giống đúng mùa mới mọc được. Trồng trước khi muộn!
          </p>
        </div>
      </div>

      {/* Buy seeds */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <ShoppingCart className="h-4 w-4" /> Tidecrest General Store
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {SHOP_SEEDS.map((seedId) => {
            const def = getItem(seedId)!;
            const crop = CROPS[def.growsInto!];
            const seedCost = seedBuyPrice(seedId); // single source: economy.json (khớp giá buySeed thực tế)
            const inSeason = crop?.seasons.includes(season);
            const owned = inv().countItem(seedId);
            return (
              <div
                key={seedId}
                className={`flex items-center gap-3 rounded-xl border-2 p-2.5 transition ${
                  inSeason
                    ? "border-[#4e7d3a] bg-[#fffaf0]"
                    : "border-[#d2bf96] bg-[#f3e8cf]/50"
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                  <ItemArt def={def} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-extrabold text-[#3b2f23]">{crop.name}</p>
                    {level < seedUnlockLevel(seedId) ? (
                      <span className="rounded-full bg-[#6b5b45] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                        Lv{seedUnlockLevel(seedId)}
                      </span>
                    ) : inSeason ? (
                      <span className="rounded-full bg-[#4e7d3a] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                        Đúng mùa
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded-full bg-[#6b5b45] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                        <Lock className="h-2.5 w-2.5" /> Trái mùa
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#5a4a36]">
                    Mọc trong {crop.growthDays} ngày · Bán được{" "}
                    <span className="font-bold text-[#e7b94e]">{crop.sellPrice}g</span>
                  </p>
                  <p className="text-[11px] font-medium text-[#6b5b45]">
                    Có: <span className="font-bold text-[#3b2f23]">{owned}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1 text-xs font-bold text-[#3b2f23]">
                    <Coins className="h-3.5 w-3.5 text-[#e7b94e]" />
                    {seedCost}g
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      disabled={!inSeason || gold < seedCost || level < seedUnlockLevel(seedId)}
                      onClick={() => gameActions.buySeed(seedId, 1)}
                      className="h-7 border-2 border-[#4a3119] bg-[#4e7d3a] px-2 text-[11px] text-[#fbf7ec] hover:bg-[#5a8e44]"
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      disabled={!inSeason || gold < seedCost * 5 || level < seedUnlockLevel(seedId)}
                      onClick={() => gameActions.buySeed(seedId, 5)}
                      className="h-7 border-2 border-[#4a3119] bg-[#e7b94e] px-2 text-[11px] text-[#3b2f23] hover:bg-[#f0c964]"
                    >
                      +5
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Profitability guide */}
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <TrendingUp className="h-4 w-4" /> Lợi nhuận cây trồng (mùa này)
        </h3>
        <div className="space-y-1.5">
          {SHOP_SEEDS
            .map((id) => {
              const def = getItem(id)!;
              const crop = CROPS[def.growsInto!];
              const profit = crop.sellPrice - seedBuyPrice(id); // lãi thực sau chi phí hạt giống
              const perDay = Math.round(profit / crop.growthDays);
              return { id, crop, def, profit, perDay, inSeason: crop.seasons.includes(season) };
            })
            .filter((r) => r.inSeason)
            .sort((a, b) => b.perDay - a.perDay)
            .map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg bg-[#efe6d2] px-2.5 py-1.5"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-[#3b2f23]">
                  <ItemArt def={r.def} size={18} />
                  {r.crop.name}
                </span>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-[#5a4a36]">{r.crop.growthDays}d</span>
                  <span className={r.profit >= 0 ? "text-[#4e7d3a]" : "text-[#c0452f]"}>
                    {r.profit >= 0 ? "+" : ""}
                    {r.profit}g / vụ
                  </span>
                  <span className="rounded bg-[#4e7d3a] px-1.5 py-0.5 font-bold text-[#fbf7ec]">
                    ~{r.perDay}g/ngày
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-lg bg-[#efe6d2] p-2.5 text-[11px] leading-relaxed text-[#5a4a36]">
        <Sprout className="mr-1 inline h-3.5 w-3.5" />
        Để trồng: trang bị hạt giống trong hotbar, rồi nhấn{" "}
        <kbd className="rounded bg-[#d8c69e] px-1 font-bold">Space</kbd> /{" "}
        <kbd className="rounded bg-[#d8c69e] px-1 font-bold">E</kbd> khi đứng cạnh đất đã cuốc.
        Dùng Cuốc (Hoe) trên bãi cỏ trước.
      </div>
    </div>
  );
}
