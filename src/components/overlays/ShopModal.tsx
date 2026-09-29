"use client";

import { useUiStore } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useFarmStore } from "@/store/farmStore";
import { useProgressionStore } from "@/store/progressionStore";
import { seedUnlockLevel } from "@/lib/game/farm-catalog";
import { ordersForDay } from "@/lib/game/farm-orders";
import { FRY } from "@/lib/game/fish-catalog";
import { siloCapacity, siloUsed } from "@/lib/game/silo";
import { SHOP_SEEDS, SHOP_GOODS, CROPS, getItem } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { MOUNTS } from "@/lib/game/mounts/mount-catalog";
import { useMountStore } from "@/store/mountStore";
import { seedBuyPrice } from "@/lib/game/economy";
import { SEASON_THEME } from "@/lib/game/constants";
import { Coins, ShoppingCart, X, Sprout, Package, ClipboardList, Warehouse, CheckCircle2, Zap } from "lucide-react";
import { ItemArt } from "@/components/game-ui/item-art";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

/** Phase 5: Cất từ túi vào kho — gate cap trước khi trừ túi (không mất item). */
function depositItem(itemId: string, qty: number) {
  const inv = useInventoryStore.getState();
  const farm = useFarmStore.getState();
  const move = Math.min(inv.countItem(itemId), qty);
  if (move <= 0) return;
  if (!farm.addToSilo(itemId, move)) {
    useUiStore.getState().notify("Kho đầy — nâng cấp hoặc bán bớt", "warn");
    return;
  }
  inv.removeItem(itemId, move);
}

/** Phase 5: Rút từ kho về túi — phần túi không chứa nổi trả lại kho. */
function withdrawItem(itemId: string, qty: number) {
  const inv = useInventoryStore.getState();
  const farm = useFarmStore.getState();
  const take = farm.removeFromSilo(itemId, qty);
  if (take <= 0) return;
  const left = inv.addItem(itemId, take);
  if (left > 0) {
    farm.addToSilo(itemId, left);
    useUiStore.getState().notify(`Túi đầy — ${left} món ở lại kho`, "warn");
  }
}

export function ShopModal() {
  const show = useUiStore((s) => s.showShop);
  const setShow = useUiStore((s) => s.setShowShop);
  const gold = useGameStore((s) => s.gold);
  const season = useGameStore((s) => s.season);
  const day = useGameStore((s) => s.day);
  const invCount = useInventoryStore((s) => s.countItem);
  const level = useProgressionStore((s) => s.level);
  // Phase 5: kho nông sản + đơn hàng — subscribe để tab Kho/Đơn re-render.
  const silo = useFarmStore((s) => s.silo);
  // Mỗi đơn 1 lần/ngày — marker "Đã giao" + chặn nút Giao (filledOrders).
  const filledOrders = useFarmStore((s) => s.filledOrders);
  // W6: thú cưỡi đã mua — nút Mua ↔ Đã sở hữu.
  const mountsOwned = useMountStore((s) => s.owned);
  const [tab, setTab] = useState<"buy" | "sell" | "orders" | "silo" | "mounts">("buy");
  // Hook phải đứng trước early-return — React yêu cầu hook count ổn định mỗi render.
  const slots = useInventoryStore((s) => s.slots);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus trap a11y — tab không lọt ra sau overlay. Restore focus sau close.
  useFocusTrap(show, dialogRef);

  if (!show) return null;
  const theme = SEASON_THEME[season];

  // Phase 5: sellable = silo ∪ túi (crop/egg/milk sống trong kho). Gộp qty theo
  // itemId — sellItem trừ silo trước nên qty hiển thị = tổng 2 nguồn.
  const sellableMap = new Map<string, number>();
  for (const [itemId, qty] of Object.entries(silo)) {
    if (qty > 0) sellableMap.set(itemId, (sellableMap.get(itemId) ?? 0) + qty);
  }
  for (const s of slots) {
    if (s) sellableMap.set(s.itemId, (sellableMap.get(s.itemId) ?? 0) + s.qty);
  }
  const sellable = [...sellableMap.entries()]
    .map(([itemId, qty]) => ({ itemId, qty, def: getItem(itemId) }))
    .filter((s): s is typeof s & { def: NonNullable<typeof s.def> } => !!s.def)
    .filter((s) => s.def.sellPrice && s.def.sellPrice > 0);

  const orders = ordersForDay(day, level);
  const used = siloUsed(silo);
  const cap = siloCapacity(level);
  // Bag items có thể CẤT vào kho: nông sản (crop/food) — tool/seed ở lại túi.
  const depositable = slots
    .filter((s): s is { itemId: string; qty: number } => !!s)
    .map((s) => ({ ...s, def: getItem(s.itemId) }))
    .filter(
      (s): s is typeof s & { def: NonNullable<typeof s.def> } =>
        !!s.def && (s.def.type === "crop" || s.def.type === "food"),
    );

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Shop" className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="animate-pop-in flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-[#4a3119] bg-[#fffaf0] shadow-2xl">
        {/* Header */}
        <div className="wood-panel-flat flex items-center gap-3 px-4 py-3">
          <ShoppingCart className="h-6 w-6 text-[#fbf7ec]" />
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-[#fbf7ec] drop-shadow hud-text">
              Tidecrest General Store
            </h3>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#fbf7ec]/80">
              {theme.emoji} {theme.label} · Mở 9h sáng – 5h chiều
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border-2 border-[#4a3119] bg-[#fffaf0] px-3 py-1.5">
            <Coins className="h-5 w-5 text-[#e7b94e]" fill="#e7b94e" />
            <span className="font-mono text-sm font-bold text-[#3b2f23]">{gold}g</span>
          </div>
          <button
            onClick={() => setShow(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#4a3119] bg-[#efe2c4] text-[#5a4a36] hover:bg-[#fff7e2]"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b-2 border-[#d2bf96] bg-[#efe6d2] px-3 py-2">
          <button
            onClick={() => setTab("buy")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              tab === "buy" ? "bg-[#4e7d3a] text-[#fbf7ec]" : "text-[#5a4a36] hover:bg-[#fff7e2]"
            }`}
          >
            <Sprout className="h-4 w-4" /> Mua hạt giống
          </button>
          <button
            onClick={() => setTab("sell")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              tab === "sell" ? "bg-[#4e7d3a] text-[#fbf7ec]" : "text-[#5a4a36] hover:bg-[#fff7e2]"
            }`}
          >
            <Package className="h-4 w-4" /> Sell Goods
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              tab === "orders" ? "bg-[#4e7d3a] text-[#fbf7ec]" : "text-[#5a4a36] hover:bg-[#fff7e2]"
            }`}
          >
            <ClipboardList className="h-4 w-4" /> Đơn hàng
          </button>
          <button
            onClick={() => setTab("mounts")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              tab === "mounts" ? "bg-[#4e7d3a] text-[#fbf7ec]" : "text-[#5a4a36] hover:bg-[#fff7e2]"
            }`}
          >
            <Zap className="h-4 w-4" /> Thú cưỡi
          </button>
          <button
            onClick={() => setTab("silo")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              tab === "silo" ? "bg-[#4e7d3a] text-[#fbf7ec]" : "text-[#5a4a36] hover:bg-[#fff7e2]"
            }`}
          >
            <Warehouse className="h-4 w-4" /> Kho ({used}/{cap})
          </button>
        </div>

        {/* Body */}
        <div className="fancy-scroll flex-1 overflow-y-auto p-4">
          {tab === "buy" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SHOP_SEEDS.map((seedId) => {
                const def = getItem(seedId);
                if (!def || !def.growsInto) return null; // guard data drift (audit C3)
                const crop = CROPS[def.growsInto];
                if (!crop) return null;
                const inSeason = crop.seasons.includes(season);
                const owned = invCount(seedId);
                const seedCost = seedBuyPrice(seedId); // single source: economy.json (khớp giá buySeed)
                return (
                  <div
                    key={seedId}
                    className={`flex items-center gap-3 rounded-xl border-2 p-2.5 ${
                      inSeason ? "border-[#4e7d3a] bg-[#fffaf0]" : "border-[#d2bf96] bg-[#f3e8cf]/50"
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                      <ItemArt def={getItem(seedId)!} size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#3b2f23]">{crop.name}</p>
                      <p className="text-[11px] font-medium text-[#5a4a36]">
                        {crop.growthDays} ngày · bán {crop.sellPrice}g · có {owned}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-[#3b2f23]">
                        <Coins className="h-3.5 w-3.5 text-[#e7b94e]" />
                        {seedCost}g
                      </span>
                      {level < seedUnlockLevel(seedId) ? (
                        <span className="rounded-full bg-[#6b5b45] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                          Lv{seedUnlockLevel(seedId)}
                        </span>
                      ) : null}
                      <div className="flex items-center gap-1">
                        {[1, 5, 10].map((n) => (
                          <button
                            key={n}
                            disabled={
                              !inSeason || gold < seedCost * n || level < seedUnlockLevel(seedId)
                            }
                            onClick={() => gameActions.buySeed(seedId, n)}
                            className="min-h-[44px] rounded border border-[#4a3119] bg-[#4e7d3a] px-1.5 text-[10px] font-bold text-[#fbf7ec] hover:bg-[#5a8e44] disabled:opacity-40"
                          >
                            +{n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {SHOP_GOODS.map((itemId) => {
                const def = getItem(itemId);
                if (!def) return null;
                const cost = 10;
                const owned = invCount(itemId);
                return (
                  <div
                    key={itemId}
                    className="flex items-center gap-3 rounded-xl border-2 border-[#4e7d3a] bg-[#fffaf0] p-2.5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                      <ItemArt def={def} size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#3b2f23]">{def.name}</p>
                      <p className="text-[11px] font-medium text-[#5a4a36]">
                        Thức ăn thú · có {owned}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-[#3b2f23]">
                        <Coins className="h-3.5 w-3.5 text-[#e7b94e]" />
                        {cost}g
                      </span>
                      {level < seedUnlockLevel(itemId) ? (
                        <span className="rounded-full bg-[#6b5b45] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                          Lv{seedUnlockLevel(itemId)}
                        </span>
                      ) : null}
                      <button
                        disabled={gold < cost || level < seedUnlockLevel(itemId)}
                        onClick={() => gameActions.buyGood(itemId, 1)}
                        className="min-h-[44px] rounded border border-[#4a3119] bg-[#4e7d3a] px-2 text-[10px] font-bold text-[#fbf7ec] hover:bg-[#5a8e44] disabled:opacity-40"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* W1P5 — cá bột nuôi ao */}
              <p className="pt-1 text-xs font-extrabold uppercase text-[#5a4a36]">
                Cá bột — nuôi trong ao (về nông trại, đứng cạnh ao để thả)
              </p>
              {FRY.map((fry) => {
                const owned = invCount(fry.itemId);
                return (
                  <div
                    key={fry.itemId}
                    className="flex items-center gap-3 rounded-xl border-2 border-[#4e7d3a] bg-[#fffaf0] p-2.5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#cfe4ef]">
                      <ItemArt itemId={fry.itemId} size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#3b2f23]">{fry.name}</p>
                      <p className="text-[11px] font-medium text-[#5a4a36]">
                        Lớn sau {fry.growDays} ngày · có {owned}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-[#3b2f23]">
                        <Coins className="h-3.5 w-3.5 text-[#e7b94e]" />
                        {fry.price}g
                      </span>
                      <button
                        disabled={gold < fry.price}
                        onClick={() => gameActions.buyFry(fry.itemId)}
                        data-testid={`buy-fry-${fry.fishId}`}
                        className="min-h-[44px] rounded border border-[#4a3119] bg-[#4e7d3a] px-2 text-[10px] font-bold text-[#fbf7ec] hover:bg-[#5a8e44] disabled:opacity-40"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tab === "mounts" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="shop-mounts">
              {MOUNTS.map((m) => {
                const owned = mountsOwned.includes(m.id);
                const levelOk = level >= m.unlockLevel;
                const goldOk = gold >= m.price;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 rounded-xl border-2 p-2.5 ${
                      owned ? "border-[#4e7d3a] bg-[#eef7e6]" : "border-[#6b4a2b] bg-[#fffaf0]"
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4] text-2xl">
                      {m.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold text-[#3a2a17]">{m.name}</div>
                      <div className="text-[11px] text-[#6b5a42]">
                        Tốc ×{m.walkMult}/{m.runMult} · Cấp {m.unlockLevel}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-[#8a6d1a]">
                        <Coins className="h-3.5 w-3.5" /> {m.price}
                      </div>
                    </div>
                    {owned ? (
                      <span className="flex items-center gap-1 text-xs font-extrabold text-[#4e7d3a]">
                        <CheckCircle2 className="h-4 w-4" /> Đã có
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!levelOk || !goldOk}
                        onClick={() => gameActions.buyMount(m.id)}
                        className="bg-[#4e7d3a] hover:bg-[#3f6a2e]"
                      >
                        {!levelOk ? `Cấp ${m.unlockLevel}` : !goldOk ? "Thiếu vàng" : "Mua"}
                      </Button>
                    )}
                  </div>
                );
              })}
              <p className="col-span-full text-center text-[11px] text-[#6b5a42]">
                Mua xong nhấn <b>N</b> để lên/xuống · không cưỡi được trong nhà
              </p>
            </div>
          ) : tab === "sell" ? (
            <div className="space-y-2">
              {sellable.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-6 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-[#6b5b45]" />
                  <p className="text-sm font-medium text-[#5a4a36]">
                    Không có gì để bán. Hãy thu hoạch nông sản hoặc nhặt tài nguyên!
                  </p>
                </div>
              ) : (
                sellable.map(({ itemId, qty: have, def }) => (
                  <div
                    key={itemId}
                    className="flex items-center gap-3 rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2.5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                      <ItemArt def={def} size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#3b2f23]">{def.name}</p>
                      <p className="text-[11px] font-medium text-[#5a4a36]">
                        Có {have} · {def.sellPrice}g / món
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 5, have]
                        // Dedupe + lọc qty > have: trước đây have=1 → [1,5,1] render
                        // "×1" + "All"=×1 trùng qty. have<5 → ×5 disabled nhưng All=×have OK.
                        .filter((n, i, arr) => arr.indexOf(n) === i && n <= have)
                        .map((n, i, arr) => (
                          <button
                            key={i}
                            onClick={() => gameActions.sellItem(itemId, n)}
                            className="min-h-[44px] rounded border border-[#4a3119] bg-[#e7b94e] px-2 text-[11px] font-bold text-[#3b2f23] hover:bg-[#f0c964]"
                          >
                            {i === arr.length - 1 ? "All" : `×${n}`}
                          </button>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : tab === "orders" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#5a4a36]">
                Ngày {day} — {orders.filter((o) => filledOrders.includes(o.id)).length}/{orders.length}{" "}
                đơn đã giao · mỗi đơn 1 lần trong ngày, làm mới mỗi sáng.
              </p>
              {orders.map((order) => {
                const filled = filledOrders.includes(order.id);
                const canFill =
                  !filled &&
                  Object.entries(order.wants).every(
                    ([item, want]) => (silo[item] ?? 0) + invCount(item) >= want,
                  );
                return (
                  <div
                    key={order.id}
                    className={`flex items-center gap-3 rounded-xl border-2 p-2.5 ${
                      filled
                        ? "border-[#4e7d3a] bg-[#eef6e2]"
                        : "border-[#d2bf96] bg-[#fffaf0]"
                    }`}
                  >
                    {filled ? (
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-[#4e7d3a]" />
                    ) : (
                      <ClipboardList className="h-8 w-8 shrink-0 text-[#6b5b45]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-extrabold text-[#3b2f23] ${
                          filled ? "line-through opacity-70" : ""
                        }`}
                      >
                        {Object.entries(order.wants).map(([item, want]) => (
                          <span key={item} className="mr-2 inline-flex items-center gap-1">
                            <ItemArt itemId={item} size={16} />
                            {getItem(item)?.name ?? item} ×{want}
                          </span>
                        ))}
                      </p>
                      <p className="text-[11px] font-medium text-[#5a4a36]">
                        Có:{" "}
                        {Object.entries(order.wants)
                          .map(
                            ([item, want]) =>
                              `${(silo[item] ?? 0) + invCount(item)}/${want}`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-[#3b2f23]">
                        <Coins className="h-3.5 w-3.5 text-[#e7b94e]" />
                        {order.gold}g
                      </span>
                      {filled ? (
                        <span className="rounded border border-[#4e7d3a] bg-[#eef6e2] px-3 py-2 text-[11px] font-extrabold text-[#4e7d3a]">
                          Đã giao ✓
                        </span>
                      ) : (
                        <button
                          disabled={!canFill}
                          onClick={() => gameActions.tryFillOrder(order.id)}
                          className="min-h-[44px] rounded border border-[#4a3119] bg-[#4e7d3a] px-3 text-[11px] font-bold text-[#fbf7ec] hover:bg-[#5a8e44] disabled:opacity-40"
                        >
                          Giao
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#5a4a36]">
                Kho nông sản: {used}/{cap} · nâng cấp theo cấp nông trại
              </p>
              {Object.entries(silo).filter(([, qty]) => qty > 0).length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-6 text-center">
                  <Warehouse className="mx-auto mb-2 h-8 w-8 text-[#6b5b45]" />
                  <p className="text-sm font-medium text-[#5a4a36]">Kho trống — thu hoạch để lấp kho.</p>
                </div>
              ) : (
                Object.entries(silo)
                  .filter(([, qty]) => qty > 0)
                  .map(([itemId, qty]) => {
                    const def = getItem(itemId);
                    return (
                      <div
                        key={itemId}
                        className="flex items-center gap-3 rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2.5"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                          {def ? <ItemArt def={def} size={24} /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[#3b2f23]">
                            {def?.name ?? itemId}
                          </p>
                          <p className="text-[11px] font-medium text-[#5a4a36]">×{qty}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => withdrawItem(itemId, 1)}
                            className="min-h-[44px] rounded border border-[#4a3119] bg-[#e7b94e] px-2 text-[11px] font-bold text-[#3b2f23] hover:bg-[#f0c964]"
                          >
                            Rút 1
                          </button>
                          <button
                            onClick={() => withdrawItem(itemId, qty)}
                            className="min-h-[44px] rounded border border-[#4a3119] bg-[#e7b94e] px-2 text-[11px] font-bold text-[#3b2f23] hover:bg-[#f0c964]"
                          >
                            Rút hết
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
              {depositable.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-[#5a4a36]">
                    Trong túi — cất nông sản vào kho:
                  </p>
                  {depositable.map(({ itemId, qty, def }) => (
                    <div
                      key={itemId}
                      className="flex items-center gap-3 rounded-xl border-2 border-[#d2bf96] bg-[#f3e8cf]/60 p-2.5"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-[#6b4a2b] bg-[#efe2c4]">
                        <ItemArt def={def} size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-[#3b2f23]">{def.name}</p>
                        <p className="text-[11px] font-medium text-[#5a4a36]">×{qty}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => depositItem(itemId, 1)}
                          className="min-h-[44px] rounded border border-[#4a3119] bg-[#4e7d3a] px-2 text-[11px] font-bold text-[#fbf7ec] hover:bg-[#5a8e44]"
                        >
                          Cất 1
                        </button>
                        <button
                          onClick={() => depositItem(itemId, qty)}
                          className="min-h-[44px] rounded border border-[#4a3119] bg-[#4e7d3a] px-2 text-[11px] font-bold text-[#fbf7ec] hover:bg-[#5a8e44]"
                        >
                          Cất hết
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-[#d2bf96] bg-[#efe6d2] px-4 py-2.5 text-center text-[11px] font-medium text-[#5a4a36]">
          Mua hạt giống đúng mùa, trồng trên đất đã cuốc, tưới nước mỗi ngày, rồi thu hoạch &amp;
          bán để sinh lời!
        </div>
      </div>
    </div>
  );
}
