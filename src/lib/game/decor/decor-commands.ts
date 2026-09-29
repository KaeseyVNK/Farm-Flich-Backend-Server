// W3P4 — lệnh DecorMode dùng chung cho scene (phím) + DecorOverlay (nút).
// Đọc decorModeStore + farmStore, gọi store action, đẩy event SM, sfx/notify.
import { MAP_COLS } from "@/lib/game/constants";
import { getZone } from "@/lib/game/zones";
import { isFarmScenerySolid } from "@/lib/game/farm-scenery-layout";
import { isZoneScenerySolid } from "@/lib/game/scenery";
import { useFarmStore } from "@/store/farmStore";
import { useDecorModeStore } from "@/store/decorModeStore";
import { useUiStore } from "@/store/uiStore";
import { useWorldStore } from "@/store/worldStore";
import { playSfx } from "@/lib/game/sfx";
import { getGameBridge } from "@/lib/game/bridge";
import { decorById } from "@/lib/game/decor/decor-catalog";
import { useTutorialStore } from "@/store/tutorialStore";
import {
  canPlaceDecor,
  decorAt,
  type PlacementProbe,
} from "@/lib/game/decor/decor-placement";

/** Tile người chơi đang đứng (bridge scene); undefined khi scene chưa mount. */
function playerAt(): { x: number; y: number } | undefined {
  return getGameBridge().getPlayerTile?.();
}

/** Probe theo zone hiện tại — nguồn duy nhất cho highlight + placeDecor parity. */
export function buildPlacementProbe(zone: "farm" | "house"): PlacementProbe {
  const s = useFarmStore.getState();
  const layout = getZone(zone);
  return {
    zone,
    cols: layout.cols,
    rows: layout.rows,
    terrainAt: (x, y) =>
      zone === "farm" ? s.getTile(x, y) : (layout.terrain[y * layout.cols + x] ?? 0),
    solidAt: (x, y) =>
      zone === "farm"
        ? isFarmScenerySolid(x, y) || s.isSolid(x, y)
        : isZoneScenerySolid("house", x, y),
    cropAt: (x, y) => zone === "farm" && !!s.crops[y * MAP_COLS + x],
    warps: layout.warps.map((w) => ({ x: w.x, y: w.y })),
    decor: s.placedDecor.filter((d) => d.zone === zone),
    playerAt: playerAt(),
  };
}

function curZone(): "farm" | "house" {
  return useWorldStore.getState().zone === "house" ? "house" : "farm";
}

/** Vị trí con trỏ có đặt được item đang cầm không (highlight xanh/đỏ). */
export function canPlaceAtCursor(): boolean {
  const m = useDecorModeStore.getState();
  if (!m.active || !m.defId) return false;
  const def = decorById(m.defId);
  if (!def || def.zone !== curZone()) return false;
  return canPlaceDecor(def, m.cursorTx, m.cursorTy, m.rot, buildPlacementProbe(def.zone)).ok;
}

/** Space — đặt item đang cầm tại con trỏ. */
export function decorPlaceAtCursor(): void {
  const m = useDecorModeStore.getState();
  const ui = useUiStore.getState();
  if (!m.active || !m.defId) return;
  const def = decorById(m.defId);
  if (!def) return;
  if (def.zone !== curZone()) {
    ui.notify(def.zone === "house" ? "Vào trong nhà để đặt món này" : "Ra ngoài trời để đặt món này", "warn");
    return;
  }
  const farm = useFarmStore.getState();
  if ((farm.decorOwned[m.defId] ?? 0) <= 0) {
    ui.notify("Hết decor trong kho", "warn");
    playSfx("error");
    return;
  }
  const ok = farm.placeDecor(m.defId, m.cursorTx, m.cursorTy, m.rot, playerAt());
  if (!ok) {
    ui.notify("Không đặt được ở đây", "warn");
    playSfx("error");
    return;
  }
  playSfx("place");
  useTutorialStore.getState().tickDecor();
  const remaining = useFarmStore.getState().decorOwned[m.defId] ?? 0;
  useDecorModeStore.getState().dispatch({ type: "place-ok", remaining });
  ui.notify(`Đã đặt ${def.name}`, "success");
}

/** X — nhặt decor dưới con trỏ (chế độ chỉnh sửa hoặc đang cầm cũng được). */
export function decorPickAtCursor(): void {
  const m = useDecorModeStore.getState();
  const ui = useUiStore.getState();
  if (!m.active) return;
  const zone = curZone();
  const target = decorAt(useFarmStore.getState().placedDecor, zone, m.cursorTx, m.cursorTy);
  if (!target) {
    ui.notify("Không có decor ở đây", "info");
    return;
  }
  const def = decorById(target.defId);
  if (useFarmStore.getState().removeDecor(target.uid)) {
    useDecorModeStore.getState().dispatch({ type: "removed" });
    playSfx("place");
    ui.notify(`Đã cất ${def?.name ?? target.defId}`, "success");
  }
}

/** R — xoay: ưu tiên decor dưới con trỏ (chỉnh sửa); không thì item đang cầm. */
export function decorRotateAtCursor(): void {
  const m = useDecorModeStore.getState();
  const ui = useUiStore.getState();
  if (!m.active) return;
  const zone = curZone();
  const target = decorAt(useFarmStore.getState().placedDecor, zone, m.cursorTx, m.cursorTy);
  if (target) {
    if (useFarmStore.getState().rotateDecor(target.uid, playerAt())) {
      playSfx("click");
      return;
    }
    ui.notify("Không xoay được ở đây", "warn");
    return;
  }
  if (m.defId) {
    const def = decorById(m.defId);
    if (def && !def.rotatable) {
      ui.notify("Món này không xoay được", "info");
      return;
    }
  }
  useDecorModeStore.getState().dispatch({ type: "rotate" });
}

/** Cập nhật target uid theo con trỏ (scene gọi mỗi khi cursor di chuyển). */
export function decorSyncTarget(): void {
  const m = useDecorModeStore.getState();
  if (!m.active) return;
  const zone = curZone();
  const target = decorAt(useFarmStore.getState().placedDecor, zone, m.cursorTx, m.cursorTy);
  const uid = target?.uid ?? null;
  if (m.uid !== uid) useDecorModeStore.getState().dispatch({ type: "target", uid });
}
