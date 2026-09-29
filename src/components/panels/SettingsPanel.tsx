"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/store/uiStore";
import {
  saveGame,
  loadGame,
  listSaves,
  deleteSave,
  SAVE_SCHEMA_VERSION,
  type SaveSlot,
  type SaveMeta,
} from "@/lib/game/save";
import { collectSaveData, gameActions } from "@/lib/game/actions";
import { initialiseFreshFarm } from "@/lib/game/new-farm-state";
import { playSfx, resumeAudio } from "@/lib/game/sfx";
import {
  loadRebinding,
  remapKeyboard,
  resetRebinding,
  saveRebinding,
  type RebindingConfig,
} from "@/lib/game/input/rebinding";
import { InputAction } from "@/lib/game/input/action-map";
import { Save, FolderOpen, Trash2, RotateCcw, HardDriveDownload, Loader2, Volume2, VolumeX, Music, Zap, Wind, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const SLOT_LABELS: Record<SaveSlot, string> = {
  slot1: "Slot 1",
  slot2: "Slot 2",
  slot3: "Slot 3",
};

/** Action → hiển thị + thứ tự. Chỉ remap các action gameplay chính. */
const REMAPPABLE: { action: InputAction; label: string }[] = [
  { action: InputAction.MoveUp, label: "Di chuyển lên" },
  { action: InputAction.MoveDown, label: "Di chuyển xuống" },
  { action: InputAction.MoveLeft, label: "Di chuyển trái" },
  { action: InputAction.MoveRight, label: "Di chuyển phải" },
  { action: InputAction.Interact, label: "Tương tác / Dùng công cụ" },
  { action: InputAction.Menu, label: "Menu" },
  { action: InputAction.Pause, label: "Tạm dừng" },
];

export function SettingsPanel() {
  const notify = useUiStore((s) => s.notify);
  const activeSlot = useUiStore((s) => s.activeSlot);
  const setActiveSlot = useUiStore((s) => s.setActiveSlot);
  const autosave = useUiStore((s) => s.autosave);
  const setAutosave = useUiStore((s) => s.setAutosave);
  const lastSavedAt = useUiStore((s) => s.lastSavedAt);
  const setLastSavedAt = useUiStore((s) => s.setLastSavedAt);
  const sfxVolume = useUiStore((s) => s.sfxVolume);
  const setSfxVolume = useUiStore((s) => s.setSfxVolume);
  const musicVolume = useUiStore((s) => s.musicVolume);
  const setMusicVolume = useUiStore((s) => s.setMusicVolume);
  const ambientVolume = useUiStore((s) => s.ambientVolume);
  const setAmbientVolume = useUiStore((s) => s.setAmbientVolume);
  const muted = useUiStore((s) => s.muted);
  const setMuted = useUiStore((s) => s.setMuted);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Phase 8 rebinding — config + action đang chờ capture key.
  const [rebind, setRebind] = useState<RebindingConfig>(() => loadRebinding());
  const [capturing, setCapturing] = useState<InputAction | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => { if (active) setLoading(true); })
      .then(() => listSaves())
      .then((list) => { if (active) setSaves(list); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const refreshSaves = async () => {
    setLoading(true);
    try {
      const list = await listSaves();
      setSaves(list);
    } finally {
      setLoading(false);
    }
  };

  const doSave = async (slot: SaveSlot) => {
    setBusy(true);
    try {
      const data = collectSaveData();
      const ok = await saveGame(slot, data);
      if (ok) {
        // Manual save cũng cập nhật "Last saved" chip (M3 — trước đây chỉ autosave).
        setLastSavedAt(Date.now());
        notify(`Đã lưu vào ${SLOT_LABELS[slot]}`, "success");
        await refreshSaves();
      } else {
        notify("Lưu thất bại", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const doLoad = async (slot: SaveSlot) => {
    setBusy(true);
    try {
      const data = await loadGame(slot);
      if (!data) {
        notify("Không có save trong slot này", "warn");
        return;
      }
      setActiveSlot(slot);
      gameActions.applySaveData(data);
      notify(`Đã tải ${SLOT_LABELS[slot]}`, "success");
    } catch {
      notify("Dữ liệu save bị hỏng, không thể tải.", "error");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (slot: SaveSlot) => {
    setBusy(true);
    try {
      await deleteSave(slot);
      notify(`Đã xóa ${SLOT_LABELS[slot]}`, "info");
      await refreshSaves();
    } finally {
      setBusy(false);
    }
  };

  const doReset = () => {
    initialiseFreshFarm({ mode: "reset" });
    notify("Nông trại đã reset (chưa lưu)", "info");
  };

  // Phase 8: capture next keypress → remap action đang chờ.
  // capture: true + stopPropagation — listener này chạy TRƯỚC GameLayout (bubble
  // phase). Trước đây cả 2 nghe Escape khi đang rebinding: SettingsPanel hủy
  // capture (đúng), nhưng GameLayout cũng fire → closePanel() → Settings panel
  // đóng bất ngờ. stopPropagation chặn GameLayout nhận key khi rebinding.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Escape = hủy capture (không gán Escape vào action vô tình).
      if (e.code === "Escape") {
        setCapturing(null);
        return;
      }
      const next = remapKeyboard(rebind, e.code, capturing);
      setRebind(next);
      saveRebinding(next);
      setCapturing(null);
      playSfx("click");
    };
    window.addEventListener("keydown", onKey, { once: true, capture: true });
    // capture flag phải khớp addEventListener — trước đây thiếu → removeEventListener
    // no-op → keydown listener leak mỗi lần capture toggle (handler stack, last-wins).
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [capturing, rebind]);

  const doResetRebind = () => {
    const d = resetRebinding();
    setRebind(d);
    notify("Phím đã reset về mặc định (áp dụng lần vào game sau)", "info");
  };

  /** Tìm code gắn cho action (hiển thị key hiện tại). */
  const codeFor = (action: InputAction): string => {
    const entry = Object.entries(rebind.keyboard).find(([, a]) => a === action);
    if (!entry) return "—";
    return entry[0].replace(/^Key|^Arrow/, (m) => (m === "Arrow" ? "" : ""));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <HardDriveDownload className="h-4 w-4" /> Lưu & Tải
        </h3>
        <p className="text-xs font-medium text-[#5a4a36]">
          Tiến trình lưu trong trình duyệt (IndexedDB). Chọn slot để lưu, tải, hoặc xóa.
        </p>
        {lastSavedAt && (
          <p className="mt-1 text-[11px] font-semibold text-[#4e7d3a]">
            Lần tự lưu cuối: {new Date(lastSavedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Autosave toggle */}
      <div className="flex items-center justify-between rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <div>
          <p className="text-sm font-extrabold text-[#3b2f23]">Tự động lưu</p>
          <p className="text-[11px] font-medium text-[#6b5b45]">
            Lưu buổi sáng & sau khi đổi túi đồ (debounce 2s)
          </p>
        </div>
        <Switch checked={autosave} onCheckedChange={setAutosave} aria-label="Bật/tắt tự động lưu" />
      </div>

      {/* Audio settings */}
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#8a6238]">
            <Volume2 className="h-4 w-4" /> Âm thanh
          </h3>
          <button
            onClick={() => {
              resumeAudio();
              setMuted(!muted);
            }}
            className={`flex items-center gap-1 rounded-lg border-2 px-2 py-1 text-[11px] font-bold transition ${
              muted
                ? "border-[#c0452f] bg-[#fbe4df] text-[#c0452f]"
                : "border-[#4e7d3a] bg-[#e7f4e0] text-[#4e7d3a]"
            }`}
            aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? "Tắt" : "Bật"}
          </button>
        </div>
        {/* SFX volume */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5a4a36]">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Hiệu ứng âm thanh
            </span>
            <span className="font-mono">{Math.round(sfxVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sfxVolume}
            onChange={(e) => {
              resumeAudio();
              setSfxVolume(parseFloat(e.target.value));
            }}
            onMouseUp={() => playSfx("click")}
            onTouchEnd={() => playSfx("click")}
            className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#d8c69e] accent-[#4e7d3a]"
            aria-label="Âm lượng hiệu ứng"
          />
        </div>
        {/* Music volume */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5a4a36]">
            <span className="flex items-center gap-1">
              <Music className="h-3 w-3" /> Nhạc nền
            </span>
            <span className="font-mono">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#d8c69e] accent-[#4e7d3a]"
            aria-label="Âm lượng nhạc"
          />
        </div>
        {/* Ambient volume */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5a4a36]">
            <span className="flex items-center gap-1">
              <Wind className="h-3 w-3" /> Âm thanh môi trường
            </span>
            <span className="font-mono">{Math.round(ambientVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={ambientVolume}
            onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
            className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#d8c69e] accent-[#4e7d3a]"
            aria-label="Âm lượng âm thanh môi trường"
          />
        </div>
        {/* Credit bắt buộc CC-BY 3.0 (docs/audio-credits.md — Required credits) */}
        <p className="mt-3 text-[10px] leading-relaxed text-[#8a7a60]">
          "Fantasy Sound Effects Library" by Little Robot Sound Factory
          (littlerobotsoundfactory.com) — licensed under CC-BY 3.0
          (creativecommons.org/licenses/by/3.0).
        </p>
      </div>

      {/* Phím tắt (phase 8 rebinding) */}
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#8a6238]">
            <Keyboard className="h-4 w-4" /> Phím tắt
          </h3>
          <button
            onClick={doResetRebind}
            className="rounded-lg border-2 border-[#c0452f] px-2 py-1 text-[11px] font-bold text-[#c0452f] hover:bg-[#fbe4df]"
          >
            Reset
          </button>
        </div>
        <p className="mb-2 text-[11px] font-medium text-[#6b5b45]">
          Bấm một phím, rồi nhấn phím mới. Áp dụng lần vào game sau.
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {REMAPPABLE.map(({ action, label }) => {
            const isCap = capturing === action;
            return (
              <div
                key={action}
                className="flex items-center justify-between rounded-lg border-2 border-[#d2bf96] bg-[#fff7e2] px-2.5 py-1.5"
              >
                <span className="text-[11px] font-bold text-[#3b2f23]">{label}</span>
                <button
                  onClick={() => setCapturing(isCap ? null : action)}
                  className={`min-w-[3rem] rounded border-2 px-2 py-0.5 text-[11px] font-bold transition ${
                    isCap
                      ? "animate-pulse border-[#e7b94e] bg-[#e7b94e] text-[#3b2f23]"
                      : "border-[#4a3119] bg-[#efe2c4] text-[#3b2f23] hover:bg-[#fff7e2]"
                  }`}
                  aria-label={`Đổi phím ${label}`}
                >
                  {isCap ? "Nhấn…" : codeFor(action)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save slots */}
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#8a6238]">
          Save Slots
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-4 text-[#6b5b45]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải…
          </div>
        ) : (
          <div className="space-y-2">
            {saves.map((s) => {
              const isActive = s.slot === activeSlot;
              return (
                <div
                  key={s.slot}
                  className={`rounded-lg border-2 p-2.5 transition ${
                    isActive
                      ? "border-[#e7b94e] bg-[#fff7e2]"
                      : "border-[#d2bf96] bg-[#fffaf0]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveSlot(s.slot)}
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        isActive ? "border-[#4e7d3a] bg-[#4e7d3a]" : "border-[#6b4a2b] bg-[#d8c69e]"
                      }`}
                      aria-label={`Chọn ${SLOT_LABELS[s.slot]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#3b2f23]">
                        {SLOT_LABELS[s.slot]}
                        {isActive && (
                          <span className="ml-1.5 rounded bg-[#4e7d3a] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fbf7ec]">
                            Đang dùng
                          </span>
                        )}
                      </p>
                      {s.exists && s.preview ? (
                        <p className="text-[11px] font-medium text-[#5a4a36]">
                          {s.preview.season} Ngày {s.preview.day}, Năm {s.preview.year} ·{" "}
                          {s.preview.gold}g
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-[#6b5b45]">Trống</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => doSave(s.slot)}
                      disabled={busy}
                      className="h-7 flex-1 gap-1 border-2 border-[#4a3119] bg-[#4e7d3a] px-2 text-[11px] text-[#fbf7ec] hover:bg-[#5a8e44] disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> Save
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => doLoad(s.slot)}
                      disabled={busy || !s.exists}
                      className="h-7 flex-1 gap-1 border-2 border-[#4a3119] bg-[#e7b94e] px-2 text-[11px] text-[#3b2f23] hover:bg-[#f0c964] disabled:opacity-50"
                    >
                      <FolderOpen className="h-3 w-3" /> Load
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => doDelete(s.slot)}
                      disabled={busy || !s.exists}
                      variant="outline"
                      className="h-7 gap-1 border-2 border-[#c0452f] px-2 text-[11px] text-[#c0452f] hover:bg-[#fbe4df] disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Button
        onClick={doReset}
        className="h-10 gap-2 border-2 border-[#4a3119] bg-[#efe2c4] text-[#3b2f23] hover:bg-[#fff7e2]"
      >
        <RotateCcw className="h-4 w-4" />
        Reset Current Farm (Unsaved)
      </Button>

      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3 text-[11px] leading-relaxed text-[#5a4a36]">
        <p className="font-bold text-[#8a6238]">Về bản build này</p>
        <p className="mt-1">
          Mô phỏng nông trại lấy cảm hứng Stardew Valley, xây bằng Next.js, HTML5 Canvas, Tailwind
          CSS, và Zustand. Save có phiên bản (v{SAVE_SCHEMA_VERSION}) với tự động nâng cấp từ định
          dạng cũ.
        </p>
      </div>
    </div>
  );
}
