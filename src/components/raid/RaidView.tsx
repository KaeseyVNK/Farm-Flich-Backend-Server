"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRaidStore, ALERT_TEXT, type RaidUiEvent } from "@/store/raidStore";
import { RaidWsClient } from "@/lib/raid/ws-client";
import { useInventoryStore } from "@/store/inventoryStore";
import { getItem } from "@/lib/game/data";
import { ItemArt } from "@/components/game-ui/item-art";
import { useUiStore } from "@/store/uiStore";
import { awardXp } from "@/store/progressionStore";
import { RaidCanvas } from "./RaidCanvas";
import { RaidHud, AlertBar } from "./RaidHud";
import type { RaidPuzzleKind } from "@/lib/raid/types";
import { PuzzleModal } from "./PuzzleModal";
import { Lobby } from "./Lobby";
import { RaidSummary } from "./RaidSummary";
import { LockdownBanner } from "./LockdownBanner";
import { TrapEffectOverlay, type TrapEffect } from "./TrapEffectOverlay";
import { RaidTouchControls } from "./RaidTouchControls";
import { X, Moon } from "lucide-react";

/** Dismissible banner for standalone server events (error / off-snapshot alert / puzzle result). */
function RaidEventBanner({ event, onDismiss }: { event: RaidUiEvent; onDismiss: () => void }) {
  const isError = event.kind === "error";
  const label =
    event.kind === "alert"
      ? `Cảnh báo (${event.level} · đô ${event.score})`
      : event.kind === "puzzle-result"
        ? event.ok ? "Mở khóa thành công!" : "Mở khóa thất bại"
        : `Lỗi ${event.code}`;
  const detail =
    event.kind === "error" ? event.message :
    event.kind === "alert" ? event.reason : "";
  const loot = event.kind === "puzzle-result" ? event.loot : undefined;
  return (
    <div
      className="absolute right-3 top-16 z-[7] max-w-xs rounded border-2 px-3 py-2 text-xs text-[#fbf7ec]"
      style={{
        background: isError ? "rgba(122,20,8,.95)" : "rgba(58,38,19,.95)",
        borderColor: isError ? "var(--alarm)" : "var(--coin)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <b>{label}</b>
        <button onClick={onDismiss} aria-label="Đóng thông báo" className="text-[#fbf7ec]/80 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {detail && <p className="opacity-90">{detail}</p>}
      {loot && loot.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {loot.map((l) => (
            <span key={l.itemId} className="inline-flex items-center gap-0.5">
              <ItemArt itemId={l.itemId} size={14} />
              ×{l.qty}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtTimer(deadlineMs?: number): string {
  if (!deadlineMs) return "—";
  const s = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** RaidView overlay — full-screen khi phase !== idle. Manage ws-client lifecycle + input. */
export function RaidView() {
  const phase = useRaidStore((s) => s.phase);
  const setLobby = useRaidStore((s) => s.setLobby);
  const reset = useRaidStore((s) => s.reset);
  const snapshot = useRaidStore((s) => s.snapshot);
  const endState = useRaidStore((s) => s.endState);
  const farmName = useRaidStore((s) => s.farmName);
  const lastEvent = useRaidStore((s) => s.lastEvent);
  const dismissEvent = useRaidStore((s) => s.dismissEvent);
  const clientRef = useRef<RaidWsClient | null>(null);
  const [trapEffect, setTrapEffect] = useState<TrapEffect | null>(null);
  // W7a-P1: Tab toggle toàn cảnh (overview) — chỉ phóng canvas, fog giữ nguyên.
  const [overview, setOverview] = useState(false);
  // W7b-P3: mồi dụ — picker item food/fish, client đếm 0-2 (server cap cùng).
  const [lureOpen, setLureOpen] = useState(false);
  const lureUsesRef = useRef(0);
  // W7d-P2: tools chợ đen — mỗi tool 1 lần/raid (client đếm hiển thị, server cap cùng).
  const [smokeUsed, setSmokeUsed] = useState(false);
  const [lockpickUsed, setLockpickUsed] = useState(false);
  const smokeUsedRef = useRef(false);
  const lockpickUsedRef = useRef(false);
  const [puzzle, setPuzzle] = useState<{
    chestId: string;
    kind: RaidPuzzleKind;
    seq?: number[];
    lo?: number;
    hi?: number;
    size?: number;
    shapes?: number[];
    rot?: number[];
    offsets?: number[];
    sizes?: number[];
    perm?: number[];
    deadlineMs?: number;
  } | null>(null);
  // Ref luôn giữ puzzle hiện tại để keydown handler đọc được mà không cần re-register listener.
  const puzzleRef = useRef(puzzle);
  useEffect(() => {
    puzzleRef.current = puzzle;
  }, [puzzle]);
  // Ref giữ snapshot để Space handler tìm nearest chest mà không re-register
  // listener mỗi tick (snapshot update 5Hz).
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // doneRef chống re-entry finishRaid: Escape spam / double-trigger (button +
  // Escape) trước khi React commit reset() → loot+XP award 2 lần. Ref reset khi
  // phase về idle (raid mới).
  const doneRef = useRef(false);
  useEffect(() => {
    if (phase === "idle") doneRef.current = false;
  }, [phase]);

  // Đóng WS khi phase về idle mà client vẫn sống (ngoài finishRaid path). Xảy ra
  // khi SettingsPanel "Reset Current Farm" gọi raidStore.reset() giữa raid — clientRef
  // giữ connection, RaidView return null (phase idle) nhưng socket không close →
  // leak + raider vẫn trộm mà owner không thấy. Close tại đây chặn leak.
  useEffect(() => {
    if (phase === "idle" && clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }
  }, [phase]);

  // Interact nearest unopened chest — tái dùng logic Space (RaidTouchControls prop).
  const interactNearestChest = useCallback(() => {
    const c = clientRef.current;
    const snap = snapshotRef.current;
    const you = snap?.you;
    const chests = snap?.chests.filter((ch) => !ch.open) ?? [];
    if (!c || !you || !chests.length) return;
    let nearest = chests[0];
    let bestD = Math.abs(nearest.x - you.x) + Math.abs(nearest.y - you.y);
    for (const ch of chests) {
      const d = Math.abs(ch.x - you.x) + Math.abs(ch.y - you.y);
      if (d < bestD) {
        bestD = d;
        nearest = ch;
      }
    }
    c.send({ t: "interact-chest", chestId: nearest.id });
  }, []);

  // Đóng raid và chốt kết quả (loot + XP). Dùng chung cho nút THOÁT (RaidHud) và Escape.
  const finishRaid = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const end = endState;
    if (end?.reason === "exit") {
      // Raid loot: addItem leftover (túi đầy) bị drop im lặng = mất loot vĩnh viễn
      // dù đã hoàn thành raid. Aggregate theo itemId để báo chính xác item nào
      // không chứa được (cùng item loot nhiều lần → tổng leftover). Trước đây
      // bỏ qua return → mất loot không cảnh báo.
      const lost: Record<string, number> = {};
      for (const loot of end.keptLoot) {
        const left = useInventoryStore.getState().addItem(loot.itemId, loot.qty);
        if (left > 0) lost[loot.itemId] = (lost[loot.itemId] ?? 0) + left;
      }
      const lostNames = Object.entries(lost)
        .map(([id, q]) => `${q} ${id}`)
        .join(", ");
      if (lostNames) {
        useUiStore.getState().notify(`Túi đầy — không nhận được: ${lostNames}`, "warn");
      }
      awardXp("raid");
    }
    clientRef.current?.close();
    clientRef.current = null;
    setOverview(false);
    dismissEvent();
    reset();
  }, [endState, reset, dismissEvent]);

  // Input WASD/space/E khi active + Escape đóng overlay theo thứ tự ưu tiên
  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      const c = clientRef.current;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        // Ưu tiên đóng từ trong ra: puzzle → loot cảnh báo → summary → lobby
        if (phase !== "active") {
          // lobby / summary / paused: Escape = thoát raid luôn (audit H3)
          finishRaid();
          return;
        }
        if (puzzleRef.current) {
          setPuzzle(null);
          return;
        }
        if (endState) {
          finishRaid();
          return;
        }
        c?.send({ t: "exit" });
        return;
      }
      if (k === "tab") {
        e.preventDefault(); // Tab mặc định focus-shift — raid nuốt
        setOverview((o) => !o);
        return;
      }
      if (!c || phase !== "active") return;
      if (k === "w") c.send({ t: "move", dx: 0, dy: -1 });
      else if (k === "s") c.send({ t: "move", dx: 0, dy: 1 });
      else if (k === "a") c.send({ t: "move", dx: -1, dy: 0 });
      else if (k === "d") c.send({ t: "move", dx: 1, dy: 0 });
      else if (k === "e") c.send({ t: "exit" });
      else if (k === " ") {
        e.preventDefault();
        // Tìm chest chưa mở gần nhất theo khoảng cách Manhattan đến raider.
        // Trước đây hardcode chestId "chest-wood-1" → multi-chest map chỉ mở 1.
        const snap = snapshotRef.current;
        const you = snap?.you;
        const chests = snap?.chests.filter((ch) => !ch.open) ?? [];
        if (you && chests.length) {
          let nearest = chests[0];
          let bestD = Math.abs(nearest.x - you.x) + Math.abs(nearest.y - you.y);
          for (const ch of chests) {
            const d = Math.abs(ch.x - you.x) + Math.abs(ch.y - you.y);
            if (d < bestD) {
              bestD = d;
              nearest = ch;
            }
          }
          c.send({ t: "interact-chest", chestId: nearest.id });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, endState, finishRaid]);

  // Cleanup khi unmount
  useEffect(() => () => clientRef.current?.close(), []);

  const handleJoin = (farmId: string, mapId: string, farmDisplayName?: string) => {
    setLobby(farmDisplayName ?? farmId);
    const c = new RaidWsClient(
      farmId,
      (ps) =>
        setPuzzle({
          chestId: ps.chestId,
          kind: ps.kind,
          seq: ps.seq,
          lo: ps.lo,
          hi: ps.hi,
          size: ps.size,
          shapes: ps.shapes,
          rot: ps.rot,
          offsets: ps.offsets,
          sizes: ps.sizes,
          perm: ps.perm,
          deadlineMs: ps.deadlineMs,
        }),
      (te) => setTrapEffect({ kind: te.kind, ts: Date.now() }),
      mapId,
      // W7d-P2: lockpick +2s — cập nhật deadline puzzle đang mở (đếm ngược chạy lại).
      (de) =>
        setPuzzle((pz) =>
          pz && pz.chestId === de.chestId ? { ...pz, deadlineMs: de.deadlineMs } : pz,
        ),
    );
    c.connect();
    clientRef.current = c;
  };

  if (phase === "idle") return null;
  if (phase === "lobby") return <Lobby onJoin={handleJoin} onClose={reset} />;

  return (
    <div className="fixed inset-0 z-[60] bg-[#17181a]">
      <RaidHud
        farmName={farmName}
        loot={endState?.keptLoot.reduce((s, l) => s + l.qty, 0) ?? 0}
        timer={snapshot?.exitDeadlineMs ? fmtTimer(snapshot.exitDeadlineMs) : "—"}
        alert={snapshot?.alert.level ?? "stealth"}
        onExit={() => clientRef.current?.send({ t: "exit" })}
      />
      <div className="p-3">
        <RaidCanvas overview={overview} />
      </div>
      <LockdownBanner />
      {/* Phase 7 blood-moon raid FX — overlay đỏ + indicator. Server-driven
          (snapshot.bloodMoon từ room, không client tự set). */}
      {snapshot?.bloodMoon && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 bg-[#5a0a0a]/25 mix-blend-multiply" />
          <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-[#d94848]/60 bg-[#3a0a0a]/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#ff9a9a] shadow-lg">
            <Moon className="h-3.5 w-3.5" /> Blood Moon — dog mạnh hơn
          </div>
        </>
      )}
      {/* W7b-P3: mồi dụ — dog thường bị hút 6s (maan miễn nhiễm). Tối đa 2/raid. */}
      {phase === "active" && !puzzle && !endState && lureUsesRef.current < 2 && (
        <div className="absolute bottom-16 left-3 z-[8]">
          {lureOpen ? (
            <div className="fancy-scroll max-h-64 w-52 overflow-y-auto rounded-xl border-2 border-[#4a3119] bg-[#fffaf0] p-2" data-testid="lure-picker">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-[#3b2f23]">
                Mồi dụ ({2 - lureUsesRef.current} còn)
                <button onClick={() => setLureOpen(false)} aria-label="Đóng mồi" className="text-[#3b2f23]/70"><X className="h-3.5 w-3.5" /></button>
              </div>
              {useInventoryStore.getState().slots
                .filter((sl): sl is { itemId: string; qty: number } => {
                  if (!sl) return false;
                  // food gồm cả cá (data.ts) + toy chợ đen W7d-P2 (giữ chó 10s).
                  return getItem(sl.itemId)?.type === "food" || sl.itemId === "tool_toy";
                })
                .map((sl) => (
                  <button
                    key={sl.itemId}
                    onClick={() => {
                      clientRef.current?.send({ t: "use-item", itemId: sl.itemId });
                      useInventoryStore.getState().removeItem(sl.itemId, 1);
                      lureUsesRef.current++;
                      setLureOpen(false);
                    }}
                    className="mb-1 flex w-full items-center justify-between rounded border border-[#c9b68c] bg-[#f6ecd6] px-2 py-1 text-left text-xs text-[#3b2f23] hover:bg-[#efe2c4]"
                  >
                    <span className="inline-flex items-center gap-1">
                      <ItemArt itemId={sl.itemId} size={16} />
                      {getItem(sl.itemId)?.name ?? sl.itemId}
                    </span>
                    <span className="opacity-60">×{sl.qty}</span>
                  </button>
                ))}
              <p className="mt-1 text-[10px] text-[#3b2f23]/60">Chó ăn 6s ·toy 10s · giống Mãn không bị dụ</p>
            </div>
          ) : (
            <button
              onClick={() => setLureOpen(true)}
              data-testid="lure-button"
              className="rounded-full border-2 border-[#4a3119] bg-[#e8a13c] px-3 py-1.5 text-xs font-extrabold text-[#3b2f23] shadow"
            >
              🍖 Mồi ({2 - lureUsesRef.current})
            </button>
          )}
        </div>
      )}
      {/* W7d-P2: smoke chợ đen — mọi chó đứng hình 3s, 1 lần/raid. */}
      {phase === "active" && !puzzle && !endState && !smokeUsed && (
        <button
          onClick={() => {
            if (smokeUsedRef.current) return;
            if (!useInventoryStore.getState().removeItem("tool_smoke", 1)) return;
            clientRef.current?.send({ t: "use-tool", toolId: "smoke" });
            smokeUsedRef.current = true;
            setSmokeUsed(true);
          }}
          data-testid="smoke-button"
          className="absolute bottom-16 left-28 z-[8] rounded-full border-2 border-[#4a3119] bg-[#7a8b99] px-3 py-1.5 text-xs font-extrabold text-[#fbf7ec] shadow"
        >
          💨 Smoke
        </button>
      )}
      <TrapEffectOverlay effect={trapEffect} />
      {/* Raid mobile touch controls — chỉ active phase, disabled khi puzzle/end/modal.
          Overlay z-[55] thấp hơn modal/puzzle (z-[7]..z-[70]) để không cướp input. */}
      {phase === "active" && (
        <RaidTouchControls
          send={(m) => clientRef.current?.send(m)}
          onInteract={interactNearestChest}
          disabled={!!puzzle || !!endState}
        />
      )}
      {snapshot && (
        <AlertBar level={snapshot.alert.level} text={ALERT_TEXT[snapshot.alert.level]} />
      )}
      {lastEvent && (
        <RaidEventBanner event={lastEvent} onDismiss={dismissEvent} />
      )}
      {puzzle && (
        <PuzzleModal
          kind={puzzle.kind}
          seq={puzzle.seq}
          lo={puzzle.lo}
          hi={puzzle.hi}
          size={puzzle.size}
          shapes={puzzle.shapes}
          rot={puzzle.rot}
          offsets={puzzle.offsets}
          sizes={puzzle.sizes}
          perm={puzzle.perm}
          deadlineMs={puzzle.deadlineMs}
          hasLockpick={!lockpickUsedRef.current && useInventoryStore.getState().countItem("tool_lockpick") > 0}
          onUseLockpick={() => {
            if (lockpickUsedRef.current) return;
            if (!useInventoryStore.getState().removeItem("tool_lockpick", 1)) return;
            clientRef.current?.send({ t: "use-tool", toolId: "lockpick", chestId: puzzle.chestId });
            lockpickUsedRef.current = true;
            setLockpickUsed(true);
          }}
          onSubmit={(a) => {
            clientRef.current?.send({ t: "puzzle-input", chestId: puzzle.chestId, attempt: a });
            setPuzzle(null);
          }}
          onCancel={() => setPuzzle(null)}
        />
      )}
      {phase === "ended" && endState && (
        <RaidSummary
          end={endState}
          onDone={finishRaid}
        />
      )}
    </div>
  );
}
