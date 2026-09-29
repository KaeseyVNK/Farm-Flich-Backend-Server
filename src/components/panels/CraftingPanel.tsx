"use client";

import { useInventoryStore } from "@/store/inventoryStore";
import { useUiStore } from "@/store/uiStore";
import { RECIPES, getItem } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { Hammer, Check, X, Package } from "lucide-react";
import { ItemArt } from "@/components/game-ui/item-art";
import { Button } from "@/components/ui/button";

export function CraftingPanel() {
  const inv = useInventoryStore.getState;
  const trigger = useUiStore((s) => s.notify);
  // re-render when inventory changes
  const version = useInventoryStore((s) => s.slots);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <Hammer className="h-4 w-4" /> Crafting Bench
        </h3>
        <p className="text-xs font-medium text-[#5a4a36]">
          Biến nguyên liệu thô thành công cụ và hàng hóa hữu ích. Gom gỗ bằng cách chặt cây, đá bằng
          cách đập đá, và xơ sợi bằng cách cắt cỏ cao với lưỡi hái.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {RECIPES.map((recipe) => {
          const resultDef = getItem(recipe.result)!;
          const canCraft = recipe.ingredients.every(
            (ing) => inv().countItem(ing.item) >= ing.qty,
          );
          return (
            <div
              key={recipe.id}
              className={`rounded-xl border-2 p-3 transition ${
                canCraft
                  ? "border-[#4e7d3a] bg-[#fffaf0]"
                  : "border-[#d2bf96] bg-[#f3e8cf]/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                  <ItemArt def={resultDef} size={30} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-[#3b2f23]">
                      {resultDef.name} ×{recipe.resultQty}
                    </h4>
                    {canCraft ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-[#4e7d3a] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                        <Check className="h-2.5 w-2.5" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded-full bg-[#6b5b45] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                        <X className="h-2.5 w-2.5" /> Missing
                      </span>
                    )}
                  </div>
                  {resultDef.description && (
                    <p className="mt-0.5 text-[11px] text-[#5a4a36]">{resultDef.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recipe.ingredients.map((ing) => {
                      const have = inv().countItem(ing.item);
                      const ok = have >= ing.qty;
                      const ingDef = getItem(ing.item);
                      return (
                        <span
                          key={ing.item}
                          className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${
                            ok
                              ? "border-[#4e7d3a] bg-[#e7f4e0] text-[#4e7d3a]"
                              : "border-[#c0452f] bg-[#fbe4df] text-[#c0452f]"
                          }`}
                        >
                          {ingDef && <ItemArt def={ingDef} size={14} />}
                          {ingDef?.name} {have}/{ing.qty}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!canCraft}
                  onClick={() => gameActions.craft(recipe.id)}
                  className="btn-shine h-9 gap-1.5 border-2 border-[#4a3119] bg-[#e7b94e] text-[#3b2f23] hover:bg-[#f0c964] disabled:opacity-50"
                >
                  <Hammer className="h-4 w-4" />
                  Craft
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-[#efe6d2] p-2.5 text-[11px] leading-relaxed text-[#5a4a36]">
        <Package className="mr-1 inline h-3.5 w-3.5" />
        Vật phẩm chế tạo xuất hiện trong túi đồ. Đặt hàng rào &amp; máy tưới bằng cách chọn chúng và
        nhấn <kbd className="rounded bg-[#d8c69e] px-1 font-bold">Space</kbd> trên cỏ.
      </div>
    </div>
  );
}
