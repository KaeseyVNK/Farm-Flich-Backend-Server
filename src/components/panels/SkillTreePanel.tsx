"use client";

import { useState } from "react";
import { Sprout, Swords, Heart } from "lucide-react";
import { useProgressionStore } from "@/store/progressionStore";
import { PERKS, meetsPrerequisite, isPerkWired, type TreeId } from "@/lib/game/progression/perks";
import { useUiStore } from "@/store/uiStore";
import { MAX_LEVEL } from "@/store/progressionStore";

const TREE_META: Record<TreeId, { label: string; icon: React.ReactNode; color: string }> = {
  farming: { label: "Trồng trọt", icon: <Sprout className="h-4 w-4" />, color: "#4e7d3a" },
  combat: { label: "Chiến đấu", icon: <Swords className="h-4 w-4" />, color: "#b03a2e" },
  social: { label: "Xã hội", icon: <Heart className="h-4 w-4" />, color: "#d97706" },
};

/** Skill tree panel — spend skill points vào 3 tree (phase 6). */
export function SkillTreePanel() {
  const level = useProgressionStore((s) => s.level);
  const skillPoints = useProgressionStore((s) => s.skillPoints);
  const perkAllocations = useProgressionStore((s) => s.perkAllocations);
  const allocatePerk = useProgressionStore((s) => s.allocatePerk);
  const notify = useUiStore((s) => s.notify);
  const [tree, setTree] = useState<TreeId>("farming");

  const alloc = perkAllocations[tree];
  const meta = TREE_META[tree];
  const pointsLeft = skillPoints;

  const handleAllocate = (treeId: TreeId) => {
    const ok = allocatePerk(treeId);
    if (!ok) notify("Không có điểm kỹ năng — kiếm XP để lên cấp!", "warn");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header: level + skill points */}
      <div className="rounded-xl border-2 border-[#4a3119] bg-[#fff7e2] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#7a6a52]">Cấp</p>
            <p className="font-pixel text-2xl font-extrabold text-[#3b2f23]">
              {level}
              <span className="text-sm text-[#7a6a52]"> / {MAX_LEVEL}</span>
            </p>
          </div>
          <div className="rounded-lg bg-[#4e7d3a] px-3 py-1.5 text-right">
            <p className="text-xs font-bold text-[#fbf7ec]/80">Điểm kỹ năng</p>
            <p className={`font-pixel text-xl font-extrabold ${pointsLeft > 0 ? "text-[#fff7e2]" : "text-[#fbf7ec]/40"}`}>
              {pointsLeft}
            </p>
          </div>
        </div>
        {pointsLeft > 0 && (
          <p className="mt-2 text-center text-[11px] font-semibold text-[#4e7d3a] animate-pop-in">
            Bạn có {pointsLeft} điểm kỹ năng để dùng!
          </p>
        )}
      </div>

      {/* Tree tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border-2 border-[#4a3119] bg-[#efe2c4] p-1">
        {(Object.keys(TREE_META) as TreeId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTree(t)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
              tree === t
                ? "text-[#fbf7ec]"
                : "text-[#5a4a36] hover:bg-[#fff7e2]"
            }`}
            style={tree === t ? { background: TREE_META[t].color } : undefined}
            aria-pressed={tree === t}
          >
            {TREE_META[t].icon}
            <span className="hidden sm:inline">{TREE_META[t].label}</span>
          </button>
        ))}
      </div>

      {/* Perk list for active tree */}
      <div className="flex flex-col gap-1.5">
        {PERKS[tree].map((perk) => {
          const unlocked = alloc >= perk.rank;
          const current = alloc === perk.rank; // perk vừa unlock — highlight
          const prereqMet = meetsPrerequisite(perkAllocations, tree, perk.rank);
          return (
            <div
              key={perk.id}
              className={`flex items-center gap-2 rounded-lg border-2 p-2 transition ${
                current
                  ? "border-[#e7b94e] bg-[#fdf3d9]"
                  : unlocked
                    ? "border-[#4e7d3a] bg-[#f0f7e8]"
                    : "border-[#d2bf96] bg-[#efe6d2]/60"
              }`}
            >
              {/* Rank number */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 font-pixel text-sm font-bold ${
                  current
                    ? "border-[#e7b94e] bg-[#e7b94e] text-[#3b2f23]"
                    : unlocked
                      ? "border-[#4e7d3a] bg-[#4e7d3a] text-[#fbf7ec]"
                      : "border-[#c8b48c] bg-[#e5d7b8] text-[#6b5b45]"
                }`}
                aria-hidden
              >
                {perk.rank}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-extrabold ${current || unlocked ? "text-[#2e5a22]" : "text-[#3b2f23]"}`}>
                  {perk.name}
                  {current && <span className="ml-1 text-[10px] font-bold uppercase text-[#b8860b]">● mới</span>}
                </p>
                <p className="line-clamp-2 text-[11px] leading-snug text-[#6b5b45]">{perk.desc}</p>
                {!isPerkWired(perk.id) && (
                  <span
                    className="mt-0.5 inline-block rounded bg-[#c8b48c] px-1 py-px text-[9px] font-bold uppercase text-[#6b5b45]"
                    title="Effect chưa kích hoạt — sẽ có khi cập nhật sau"
                  >
                    Sắp ra mắt
                  </span>
                )}
              </div>
              {unlocked ? (
                <span className="shrink-0 text-xs font-bold text-[#4e7d3a]" aria-label="Đã mở khóa">
                  Đã mở
                </span>
              ) : pointsLeft > 0 && prereqMet ? (
                <button
                  onClick={() => handleAllocate(tree)}
                  className="lift-on-hover shrink-0 rounded-lg border-2 border-[#4a3119] bg-[#e7b94e] px-2.5 py-1 text-xs font-extrabold text-[#3b2f23] hover:bg-[#f0c964]"
                >
                  Mở khóa
                </button>
              ) : (
                <span
                  className="shrink-0 text-[10px] font-semibold text-[#6b5b45]"
                  title={!prereqMet ? "Mở khóa kỹ năng trước đã" : "Kiếm điểm kỹ năng bằng cách lên cấp"}
                >
                  {!prereqMet ? "Trước" : "+ XP"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-[#6b5b45]">
        Kiếm XP bằng trồng trọt, tặng quà, nhiệm vụ &amp; đột nhập → lên cấp → dùng điểm kỹ năng ở đây.
      </p>
    </div>
  );
}
