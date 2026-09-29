"use client";

import { useState } from "react";
import { spendDefenseXpAction } from "@/app/actions/defense";
import { DogBreedPanel } from "./dog-breed-panel";
import {
  DEFENSE_MAX_LEVEL,
  DEFENSE_LABEL,
  upgradeCost,
  type DefenseTarget,
} from "@/lib/game/defense-xp-config";

/**
 * DefenseUpgradePanel (owner, phase 3). 3 tab dog/fence/trap, level 1-3.
 * Spend Defense XP qua RPC spend_defense_xp (atomic, server cost check).
 */
const TARGETS: DefenseTarget[] = ["dog", "fence", "trap"];

export function DefenseUpgradePanel({ xp }: { xp: number }) {
  const [tab, setTab] = useState<DefenseTarget>("dog");
  const [slot] = useState(0); // MVP: 1 config/target, slot 0
  const [msg, setMsg] = useState("");

  const onUpgrade = async (level: number) => {
    const res = await spendDefenseXpAction(tab, slot, level);
    setMsg(res.ok ? `Nâng cấp ${DEFENSE_LABEL[tab]} L${level} ✓` : res.error ?? "lỗi");
  };

  return (
    <div className="f-body rounded-xl border-2 border-[#4a3119] bg-[#fffaf0] p-3 text-[#3b2f23]">
      <h3 className="f-display mb-2 text-lg text-[var(--mystic)]">Nâng cấp phòng thủ · XP {xp}</h3>
      <div className="mb-3 flex gap-1">
        {TARGETS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setMsg("");
            }}
            className={`rounded border px-2 py-1 text-xs font-bold ${
              tab === t ? "border-[var(--mystic)] bg-[var(--mystic)] text-white" : "border-[#4a3119] bg-[#efe2c4]"
            }`}
          >
            {DEFENSE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((lvl) => (
          <button
            key={lvl}
            onClick={() => onUpgrade(lvl)}
            disabled={xp < upgradeCost(lvl)}
            className="flex-1 rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-2 py-1.5 text-xs font-bold text-[#fbf7ec] disabled:opacity-40"
          >
            L{lvl} ({upgradeCost(lvl)} XP)
          </button>
        ))}
      </div>
      {tab === "dog" && <DogBreedPanel />}
      {msg && <p className="mt-2 text-xs text-[var(--alarm)]">{msg}</p>}
      <p className="mt-1 text-[10px] opacity-60">Tối đa L{DEFENSE_MAX_LEVEL}. Chó: +tầm nhìn/thính giác · bẫy: +độ bền.</p>
    </div>
  );
}
