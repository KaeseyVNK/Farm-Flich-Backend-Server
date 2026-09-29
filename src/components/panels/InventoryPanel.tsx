"use client";

import { useState } from "react";
import { useInventoryStore, INVENTORY_SLOT_COUNT } from "@/store/inventoryStore";
import { getItem } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { useUiStore } from "@/store/uiStore";
import { Coins, Package, Wrench, Leaf, Apple, Mountain, X, Info } from "lucide-react";
import { ItemArt } from "@/components/game-ui/item-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_LABEL: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  all: { label: "Tất cả", icon: Package, color: "#8a6238" },
  tool: { label: "Công cụ", icon: Wrench, color: "#6fa8dc" },
  seed: { label: "Hạt giống", icon: Leaf, color: "#4e7d3a" },
  crop: { label: "Nông sản", icon: Leaf, color: "#7cc36b" },
  resource: { label: "Tài nguyên", icon: Mountain, color: "#9b6b3a" },
  forage: { label: "Hoang dã", icon: Leaf, color: "#c98a3a" },
  food: { label: "Đồ ăn", icon: Apple, color: "#c0452f" },
};

export function InventoryPanel() {
  const slots = useInventoryStore((s) => s.slots);
  const selectSlot = useInventoryStore((s) => s.selectSlot);
  const selectedSlot = useInventoryStore((s) => s.selectedSlot);
  const [filter, setFilter] = useState<string>("all");
  const [sellQty, setSellQty] = useState("1");
  const [detail, setDetail] = useState<string | null>(null);

  const totalItems = slots.filter(Boolean).reduce((sum, s) => sum + (s?.qty ?? 0), 0);
  const usedSlots = slots.filter(Boolean).length;

  const filteredIndices = slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      if (!s) return false;
      if (filter === "all") return true;
      return getItem(s.itemId)?.type === filter;
    });

  const detailDef = detail ? getItem(detail) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header summary */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Slots used" value={`${usedSlots}/${INVENTORY_SLOT_COUNT}`} />
        <Stat label="Vật phẩm" value={`${totalItems}`} />
        <Stat
          label="Sức chứa"
          value={`${Math.round((usedSlots / INVENTORY_SLOT_COUNT) * 100)}%`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CATEGORY_LABEL).map(([key, def]) => {
          const Icon = def.icon;
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition ${
                active
                  ? "border-[#e7b94e] bg-[#fffaf0]"
                  : "border-[#d2bf96] bg-[#efe6d2] hover:bg-[#fff7e2]"
              }`}
              style={{ color: active ? def.color : "#5a4a36" }}
            >
              <Icon className="h-3.5 w-3.5" />
              {def.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {filteredIndices.length === 0 && (
          <div className="col-span-full rounded-lg border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-6 text-center text-sm font-medium text-[#6b5b45]">
            Không có vật phẩm trong danh mục này
          </div>
        )}
        {filteredIndices.map(({ s, i }) => {
          const def = s ? getItem(s.itemId) : null;
          const selected = selectedSlot === i;
          return (
            <button
              key={i}
              onClick={() => {
                selectSlot(i);
                setDetail(s?.itemId ?? null);
              }}
              className={`slot group relative flex aspect-square items-center justify-center rounded-lg ${
                selected ? "selected" : ""
              }`}
              title={def ? `${def.name} ×${s?.qty}` : `Slot ${i + 1}`}
            >
              {def ? (
                <ItemArt def={def} size={28} className="transition group-hover:scale-110" />
              ) : null}
              {s && s.qty > 1 && (
                <span className="absolute bottom-0.5 right-1 rounded px-1 text-[11px] font-bold text-[#3b2f23] hud-text">
                  {s.qty}
                </span>
              )}
              {def?.type === "tool" && (
                <span className="absolute left-1 top-0.5 text-[8px] font-bold uppercase text-[#6fa8dc]">
                  {CATEGORY_LABEL.tool.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail + sell */}
      {detailDef ? (
        <div className="animate-pop-in rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
              <ItemArt def={detailDef} size={30} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#3b2f23]">{detailDef.name}</h3>
                <button onClick={() => setDetail(null)} className="text-[#6b5b45] hover:text-[#3b2f23]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6238]">
                {CATEGORY_LABEL[detailDef.type]?.label ?? detailDef.type}
              </p>
              {detailDef.description && (
                <p className="mt-1 text-xs text-[#5a4a36]">{detailDef.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#3b2f23]">
                {detailDef.sellPrice ? (
                  <span className="flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-[#e7b94e]" />
                    {detailDef.sellPrice}g / món
                  </span>
                ) : (
                  <span className="text-[#6b5b45]">Không bán được</span>
                )}
                {detailDef.energy ? (
                  <span className="flex items-center gap-1 text-[#4e7d3a]">
                    +{detailDef.energy} năng lượng
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Sell */}
          {detailDef.sellPrice ? (
            <div className="mt-3 flex items-center gap-2 border-t border-[#d2bf96] pt-3">
              <Select value={sellQty} onValueChange={setSellQty}>
                <SelectTrigger className="h-9 w-24 border-[#d2bf96] bg-[#fffaf0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">×1</SelectItem>
                  <SelectItem value="5">×5</SelectItem>
                  <SelectItem value="10">×10</SelectItem>
                  <SelectItem value="99">All</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={sellQty}
                onChange={(e) => setSellQty(e.target.value || "1")}
                className="h-9 w-20 border-[#d2bf96] bg-[#fffaf0]"
              />
              <Button
                onClick={() => {
                  const q = parseInt(sellQty, 10) || 1;
                  const have = useInventoryStore.getState().countItem(detailDef.id);
                  const sell = Math.min(q, have);
                  if (sell <= 0) return;
                  gameActions.sellItem(detailDef.id, sell);
                  if (useInventoryStore.getState().countItem(detailDef.id) <= 0) setDetail(null);
                }}
                className="btn-shine h-9 flex-1 gap-1.5 border-2 border-[#4a3119] bg-[#e7b94e] text-[#3b2f23] hover:bg-[#f0c964]"
              >
                <Coins className="h-4 w-4" />
                Sell
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 border-t border-[#d2bf96] pt-3 text-xs font-medium text-[#6b5b45]">
              <Info className="h-3.5 w-3.5" />
              Món đồ này không bán được — giữ lại để chế tạo hoặc tặng quà.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-4 text-center text-xs font-medium text-[#6b5b45]">
          Chọn một món đồ để xem chi tiết, bán hoặc trang bị.
        </div>
      )}

      <p className="rounded-lg bg-[#efe6d2] p-2 text-[11px] leading-relaxed text-[#5a4a36]">
        Mẹo: Nhấn <kbd className="rounded bg-[#d8c69e] px-1 font-bold">1</kbd>–
        <kbd className="rounded bg-[#d8c69e] px-1 font-bold">0</kbd> để chọn nhanh ô hotbar.
        Công cụ tự động trang bị khi được chọn.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border-2 border-[#d2bf96] bg-[#fffaf0] px-2 py-1.5 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8a6238]">{label}</div>
      <div className="text-sm font-extrabold text-[#3b2f23]">{value}</div>
    </div>
  );
}
