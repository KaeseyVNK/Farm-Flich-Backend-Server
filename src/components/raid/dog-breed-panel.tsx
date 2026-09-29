"use client";

import { useEffect, useState } from "react";
import { DOG_BREEDS } from "@/lib/raid/dog-catalog";
import { MAP_COLS, MAP_ROWS } from "@/lib/raid/constants";
import { saveDogAction, loadDogAction } from "@/app/actions/defense";
import { useGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

/**
 * W7b-P2 — Giống chó + waypoint chủ (§10.1). Render trong DefenseUpgradePanel
 * tab "Chó". Mua giống = trừ vàng local (cloud gold sync post-MVP) + upsert
 * DefenseConfig slot 10. Waypoint: click 2-6 ô trên grid 30×22 (patrol chủ —
 * server gen AI thay khi thiếu).
 */

interface Pt {
  x: number;
  y: number;
}

export function DogBreedPanel() {
  const gold = useGameStore((s) => s.gold);
  const [dog, setDog] = useState<{ breed: string; tile: number; level: number; patrol?: Pt[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [patrol, setPatrol] = useState<Pt[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void loadDogAction()
      .then((d) => {
        setDog(d);
        if (d?.patrol) setPatrol(d.patrol);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeBreed = dog?.breed;

  /** Lưu breed+patrol — trả false khi payload hỏng HOẶC DB lỗi (caller hoàn vàng). */
  const persist = async (breed: string, pts: Pt[]): Promise<boolean> => {
    if (pts.length > 0 && pts.length < 2) {
      setMsg("Waypoint cần 2-6 điểm (hoặc bỏ trống để AI tự chọn)");
      return false;
    }
    const tile = pts.length ? pts[0].y * MAP_COLS + pts[0].x : dog?.tile ?? 15 * MAP_ROWS + 10;
    const payload = { breed, tile, level: dog?.level ?? 1, patrol: pts.length >= 2 ? pts : undefined };
    const res = await saveDogAction(payload);
    if (res.ok) {
      setDog(payload);
      setMsg("Đã lưu ✓");
      return true;
    }
    setMsg(res.error ?? "lỗi");
    return false;
  };

  const buy = async (breedId: string, price: number) => {
    if (gold < price) {
      setMsg("Không đủ vàng");
      return;
    }
    if (!useGameStore.getState().spendGold(price)) {
      setMsg("Không đủ vàng");
      return;
    }
    // review W7 #12: persist fail → hoàn vàng (trước đây mất vàng khi DB lỗi).
    const ok = await persist(breedId, patrol);
    if (!ok) {
      useGameStore.getState().addGold(price);
      setMsg("Lưu thất bại — đã hoàn vàng");
      return;
    }
    useUiStore.getState().notify(`Đã mua ${DOG_BREEDS.find((b) => b.id === breedId)?.name}!`, "success");
  };

  const toggleCell = (x: number, y: number) => {
    setPatrol((pts) => {
      const hit = pts.findIndex((p) => p.x === x && p.y === y);
      if (hit >= 0) return pts.filter((_, i) => i !== hit);
      if (pts.length >= 6) return pts; // cap 6
      return [...pts, { x, y }];
    });
  };

  if (loading) return <p className="text-xs opacity-60">Đang tải cấu hình chó…</p>;

  return (
    <div className="mt-3 space-y-3" data-testid="dog-breed-panel">
      {/* Giống */}
      <div className="grid grid-cols-1 gap-1.5">
        {DOG_BREEDS.map((b) => {
          const owned = activeBreed === b.id;
          return (
            <div
              key={b.id}
              className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                owned ? "border-[#4e7d3a] bg-[#eef7e6]" : "border-[#6b4a2b] bg-[#fffaf0]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <b>{b.name}</b>{" "}
                <span className="opacity-70">
                  {b.hearingAdd ? `hơi +${b.hearingAdd} ` : ""}
                  {b.speedMul !== 1 ? `nhanh ×${b.speedMul} ` : ""}
                  {b.alertSeeBonus ? "nhạy " : ""}
                  {b.lureImmune ? "chống mồi " : ""}
                  {b.squeeze ? "luồn khe " : ""}
                </span>
                <div className="opacity-70">{b.price}g</div>
              </div>
              {owned ? (
                <span className="font-bold text-[#4e7d3a]">Đang dùng</span>
              ) : (
                <button
                  onClick={() => void buy(b.id, b.price)}
                  disabled={gold < b.price}
                  className="rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-2 py-1 font-bold text-[#fbf7ec] disabled:opacity-40"
                >
                  Mua
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Waypoint editor — grid 30×22 */}
      {activeBreed && (
        <div>
          <p className="mb-1 text-xs font-bold">
            Waypoint tuần tra (2-6 ô, theo thứ tự click — {patrol.length}/6)
          </p>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${MAP_COLS}, 1fr)` }}
            data-testid="dog-waypoint-grid"
          >
            {Array.from({ length: MAP_COLS * MAP_ROWS }, (_, i) => {
              const x = i % MAP_COLS;
              const y = Math.floor(i / MAP_COLS);
              const idx = patrol.findIndex((p) => p.x === x && p.y === y);
              return (
                <button
                  key={i}
                  onClick={() => toggleCell(x, y)}
                  aria-label={`ô ${x},${y}`}
                  className={`aspect-square rounded-sm ${
                    idx >= 0 ? "bg-[#4e7d3a]" : "bg-[#d8c9a3] hover:bg-[#c4b28a]"
                  }`}
                >
                  {idx >= 0 ? <span className="text-[7px] font-bold text-white">{idx + 1}</span> : ""}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => activeBreed && void persist(activeBreed, patrol)}
            className="mt-1.5 rounded border-2 border-[#4a3119] bg-[#b8860b] px-3 py-1 text-xs font-bold text-white"
          >
            Lưu waypoint
          </button>
        </div>
      )}
      {msg && <p className="text-[11px] text-[var(--alarm)]">{msg}</p>}
    </div>
  );
}
