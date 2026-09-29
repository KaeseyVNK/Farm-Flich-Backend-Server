"use client";

// DecorPanel — W3P5: kho decor đã mua (Đặt vào mode sắp đặt) + shop mua theo zone.
// "Đặt" vào decor mode tại tile người chơi (bridge.getPlayerTile); placement thật
// validate ở farm-scene/WASD cursor + canPlaceDecor — panel chỉ chọn item.

import { useState } from "react";
import { useFarmStore } from "@/store/farmStore";
import { useWorldStore } from "@/store/worldStore";
import { useProgressionStore } from "@/store/progressionStore";
import { useUiStore } from "@/store/uiStore";
import { useDecorModeStore } from "@/store/decorModeStore";
import { decorById, decorFor, DECOR } from "@/lib/game/decor/decor-catalog";
import { gameActions } from "@/lib/game/actions";
import { getGameBridge } from "@/lib/game/bridge";
import { DecorArt } from "@/components/game-ui/decor-art";
import { Button } from "@/components/ui/button";
import { Lamp, Lock, ShoppingBag, Warehouse } from "lucide-react";

type Tab = "owned" | "shop";

export function DecorPanel() {
  const [tab, setTab] = useState<Tab>("owned");
  const decorOwned = useFarmStore((s) => s.decorOwned);
  const zone = useWorldStore((s) => s.zone);
  const level = useProgressionStore((s) => s.level);
  const notify = useUiStore((s) => s.notify);
  const closePanel = useUiStore((s) => s.closePanel);

  // Zone panel hỗ trợ sắp đặt: farm items đặt được ở farm, house items ở nhà.
  const zoneKey = zone === "house" ? "house" : "farm";
  const ownedDefs = DECOR.filter((d) => (decorOwned[d.id] ?? 0) > 0);
  const shopDefs = decorFor(zoneKey, level);

  const startPlace = (defId: string) => {
    const def = decorById(defId);
    if (!def) return;
    if (zone !== def.zone) {
      notify(def.zone === "house" ? "Vật này đặt trong nhà" : "Vật này đặt ngoài trời", "warn");
      return;
    }
    const tile = getGameBridge().getPlayerTile?.() ?? { x: 9, y: 22 };
    useDecorModeStore.getState().dispatch({ type: "enter", defId, tx: tile.x, ty: tile.y });
    closePanel();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "owned" ? "default" : "secondary"}
          onClick={() => setTab("owned")}
          className="flex-1 gap-1.5"
          data-testid="decor-tab-owned"
        >
          <Warehouse className="h-4 w-4" /> Kho ({ownedDefs.length})
        </Button>
        <Button
          size="sm"
          variant={tab === "shop" ? "default" : "secondary"}
          onClick={() => setTab("shop")}
          className="flex-1 gap-1.5"
          data-testid="decor-tab-shop"
        >
          <ShoppingBag className="h-4 w-4" /> Mua
        </Button>
      </div>

      {tab === "owned" ? (
        ownedDefs.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-4 text-center text-xs font-medium text-[#5a4a36]">
            Chưa có đồ trang trí nào — sang tab <b>Mua</b> để chọn món đầu tiên.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5" data-testid="decor-owned-list">
            {ownedDefs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-xl border-2 border-[#4e7d3a] bg-[#fffaf0] p-2.5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                  <DecorArt def={d} size={36} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-[#3b2f23]">
                    {d.name}
                    <span className="ml-1.5 text-[#6b5b45]">×{decorOwned[d.id]}</span>
                  </h4>
                  <p className="text-[11px] font-medium text-[#5a4a36]">
                    {d.zone === "house" ? "Trong nhà" : "Ngoài trời"} · {d.w}×{d.h}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => startPlace(d.id)}
                  className="btn-shine h-9 gap-1.5 border-2 border-[#4a3119] bg-[#e7b94e] text-[#3b2f23] hover:bg-[#f0c964]"
                  data-testid={`decor-place-${d.id}`}
                >
                  <Lamp className="h-4 w-4" /> Đặt
                </Button>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2.5" data-testid="decor-shop-list">
          {shopDefs.map((d) => {
            const locked = d.unlockLevel > level;
            return (
              <div
                key={d.id}
                className={`flex items-center gap-3 rounded-xl border-2 p-2.5 ${
                  locked ? "border-[#d2bf96] bg-[#f3e8cf]/60" : "border-[#d2bf96] bg-[#fffaf0]"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                  <DecorArt def={d} size={36} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-[#3b2f23]">{d.name}</h4>
                  <p className="text-[11px] font-medium text-[#5a4a36]">
                    {d.zone === "house" ? "Trong nhà" : "Ngoài trời"} · {d.w}×{d.h} ·{" "}
                    {d.tier === "fancy" ? "Cao cấp" : d.tier === "nice" ? "Đẹp" : "Cơ bản"}
                  </p>
                </div>
                {locked ? (
                  <span className="flex items-center gap-1 rounded-full bg-[#6b5b45] px-2 py-1 text-[10px] font-bold uppercase text-[#fbf7ec]">
                    <Lock className="h-3 w-3" /> Cấp {d.unlockLevel}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => gameActions.buyDecor(d.id)}
                    className="btn-shine h-9 gap-1.5 border-2 border-[#4a3119] bg-[#e7b94e] text-[#3b2f23] hover:bg-[#f0c964]"
                    data-testid={`decor-buy-${d.id}`}
                  >
                    {d.price}g
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg bg-[#efe6d2] p-2.5 text-[11px] leading-relaxed text-[#5a4a36]">
        Sau khi bấm <b>Đặt</b>: di chuyển con trỏ bằng <kbd className="rounded bg-[#d8c69e] px-1 font-bold">WASD</kbd>,
        xoay <kbd className="rounded bg-[#d8c69e] px-1 font-bold">R</kbd>, lật{" "}
        <kbd className="rounded bg-[#d8c69e] px-1 font-bold">F</kbd>, đặt{" "}
        <kbd className="rounded bg-[#d8c69e] px-1 font-bold">Space</kbd>, nhặt{" "}
        <kbd className="rounded bg-[#d8c69e] px-1 font-bold">X</kbd>.
      </div>
    </div>
  );
}
