"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useInventoryStore, INVENTORY_SLOT_COUNT } from "@/store/inventoryStore";
import { isGameplayBlocked } from "@/lib/game/ui-gate";
import { getItem } from "@/lib/game/data";
import { ItemArt } from "@/components/game-ui/item-art";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * useIsClient — chuẩn React idiom để render khác server/client không gây
 * hydration mismatch (thay cho setState-in-effect bị eslint react-hooks cấm).
 * Server render dùng getServerSnapshot → false (khớp server HTML). Client
 * hydrate xong, React tự re-render khi getSnapshot (true) khác server snapshot.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function keyLabelFor(i: number): string {
  if (i < 9) return String(i + 1);
  if (i === 9) return "0";
  if (i === 10) return "-";
  return "=";
}

function SortableSlot({ id, index }: { id: string; index: number }) {
  const slot = useInventoryStore((s) => s.slots[index]);
  const selectedSlot = useInventoryStore((s) => s.selectedSlot);
  const selectSlot = useInventoryStore((s) => s.selectSlot);
  const equippedTool = useInventoryStore((s) => s._equippedTool);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, data: { index } });

  // dnd-kit transform/transition/aria-describedby chỉ tồn tại sau mount.
  // `aria-describedby="DndDescribedBy-{n}"` dùng module counter → số khác giữa
  // SSR (614) và client hydration (0) → React hydration mismatch.
  // Render gate SSR: server HTML không có style/aria dnd; sau hydrate, React
  // tự re-render (useIsClient) gắn lại attributes/listeners — không mismatch.
  const isClient = useIsClient();

  const def = slot ? getItem(slot.itemId) : null;
  const isTool = def?.type === "tool";
  const selected = selectedSlot === index;
  const isEquipped = isTool && slot?.itemId === equippedTool;

  const style: React.CSSProperties = {
    transform: isClient ? CSS.Translate.toString(transform) : undefined,
    transition: isClient ? transition : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : selected ? 10 : 1,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          onClick={() => selectSlot(index)}
          className={`slot lift-on-hover relative flex h-14 w-14 touch-none select-none items-center justify-center rounded-[4px] ${
            selected ? "selected" : slot ? "" : "empty"
          } ${isOver ? "over-swap" : ""}`}
          aria-label={def ? def.name : `Empty slot ${index + 1}`}
          // attributes/listeners chứa aria-describedby (counter) + role/tabIndex
          // gây hydration mismatch → chỉ gắn sau hydrate (client-only).
          {...(isClient ? attributes : {})}
          {...(isClient ? listeners : {})}
          aria-pressed={selected}
        >
          {def ? (
            <ItemArt def={def} size={32} className="pointer-events-none" />
          ) : (
            <span className="pointer-events-none text-lg leading-none" aria-hidden />
          )}
          {slot && slot.qty > 1 && (
            <span className="hotbar-qty pointer-events-none absolute bottom-0.5 right-0.5">
              {slot.qty}
            </span>
          )}
          <span className="hotbar-key pointer-events-none absolute left-0.5 top-0.5">
            {keyLabelFor(index)}
          </span>
          {isEquipped && (
            <span className="hotbar-equipped pointer-events-none" aria-hidden />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="tip-card !rounded-[4px] !p-0">
        <div className="w-[200px] px-2.5 py-2">
          {def ? (
            <>
              <div className="flex items-center gap-2">
                <ItemArt def={def} size={18} />
                <span className="text-sm font-extrabold text-[var(--mf-ink)]">{def.name}</span>
                {slot && slot.qty > 1 && (
                  <span className="ml-auto rounded bg-[#efe2c4] px-1.5 py-0.5 text-[10px] font-bold text-[#3b2f23]">
                    ×{slot.qty}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a6238]">
                {def.type}
                {isTool ? ` · ${def.toolKind}` : ""}
              </p>
              {def.description && (
                <p className="mt-1 text-[11px] leading-snug text-[#5a4a36]">{def.description}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#3b2f23]">
                <span className="kbd">Slot {keyLabelFor(index)}</span>
                {def.sellPrice ? (
                  <span className="rounded bg-[#fff7e2] px-1.5 py-0.5 text-[#d99a2a]">
                    {def.sellPrice}g each
                  </span>
                ) : null}
                {def.energy ? (
                  <span className="rounded bg-[#e7f4e0] px-1.5 py-0.5 text-[#4e7d3a]">
                    +{def.energy} energy
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-[11px] font-medium text-[#6b5b45]">
              Empty slot · press{" "}
              <span className="kbd ml-0.5">{keyLabelFor(index)}</span> to keep
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function Hotbar() {
  const slots = useInventoryStore((s) => s.slots);
  const selectSlot = useInventoryStore((s) => s.selectSlot);
  const swapSlots = useInventoryStore((s) => s.swapSlots);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Keyboard hotkeys 1-9, 0, -, =
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Bỏ auto-repeat (hold phím → re-render chuỗi không cần thiết).
      if (e.repeat) return;
      // Gate overlay/raid: trước đây phím số vẫn selectSlot khi shop/dialogue/panel
      // mở → user gõ "5" trong Settings → equipped tool đổi silent. Raid full-screen
      // cũng phải chặn (phím số đổi slot xuyên raid). Dùng shared gate.
      if (isGameplayBlocked()) return;
      if (e.key >= "1" && e.key <= "9") {
        selectSlot(parseInt(e.key, 10) - 1);
      } else if (e.key === "0") {
        selectSlot(9);
      } else if (e.key === "-" || e.key === "_") {
        selectSlot(10);
      } else if (e.key === "=" || e.key === "+") {
        selectSlot(11);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectSlot]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = Array.from({ length: INVENTORY_SLOT_COUNT }, (_, i) => `slot-${i}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const fromIdx = Number(String(active.id).replace("slot-", ""));
    const toIdx = Number(String(over.id).replace("slot-", ""));
    if (Number.isNaN(fromIdx) || Number.isNaN(toIdx)) return;
    swapSlots(fromIdx, toIdx);
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* max-w + overflow-x-auto: 12 slot × 48px ≈ 660px tràn màn mobile 375px
          (trước đây -translate-x-1/2 ở wrapper đẩy quá mép trái, D-pad chồng lên).
          Scroll ngang khi cần thay vì vỡ layout. */}
      <div data-testid="hotbar" className="hotbar-tray pointer-events-auto flex max-w-[calc(100vw-7.5rem)] items-center gap-1.5 overflow-x-auto p-2 md:max-w-[min(44rem,calc(100vw-11rem))] [scrollbar-width:thin]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(Number(String(active.id).replace("slot-", "")))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
            {Array.from({ length: INVENTORY_SLOT_COUNT }).map((_, i) => (
              <SortableSlot key={`slot-${i}`} id={`slot-${i}`} index={i} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </TooltipProvider>
  );
}
