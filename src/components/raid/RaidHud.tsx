"use client";

import type { AlertLevel } from "@/lib/raid/types";
import { VenetianMask, Coins, Clock, DoorOpen, Moon, TriangleAlert, Siren } from "lucide-react";

/**
 * Raid HUD — markup theo wireframe docs/wireframes/raid-view.html.
 * Structure phase 3; dữ liệu + handler nối ở phase 5 (raidStore).
 * Alert 3 cấp (Stealth/Caution/Alarm) đổi MÀU + TỐC ĐỘ pulse, KHÔNG blur.
 * Cue phi-motion: icon + màu (red-team #22 — prefers-reduced-motion không mất thông tin alert).
 */

const ALERT_LABEL: Record<AlertLevel, string> = {
  stealth: "Stealth",
  caution: "Thận trọng",
  alarm: "Báo động",
};

const ALERT_BORDER: Record<AlertLevel, string> = {
  stealth: "var(--teal)",
  caution: "var(--accent)",
  alarm: "var(--alarm)",
};

export function RaidHud(props: {
  farmName: string;
  loot: number;
  timer: string;
  alert: AlertLevel;
  onExit: () => void;
}) {
  const { farmName, loot, timer, alert, onExit } = props;
  return (
    <header
      className="flex items-center gap-3 border-b-2 px-4 py-2.5"
      style={{
        background: "linear-gradient(180deg, rgba(58,42,24,.88), rgba(42,30,16,.85))",
        borderBottomColor: "rgba(231,185,78,.45)",
        borderColor: ALERT_BORDER[alert],
      }}
    >
      <div className="f-display mr-auto flex items-center gap-1.5 text-sm text-[#fbf7ec]" style={{ letterSpacing: ".05em" }}>
        <VenetianMask className="h-4 w-4" style={{ color: "var(--coin)" }} />
        <span style={{ color: "var(--coin)" }}>ĐỘT NHẬP</span> — FARM “{farmName}”
      </div>

      {/* Loot */}
      <div className="flex items-center gap-1.5 rounded border-2 border-[#4a3119] bg-[#fffaf0] px-2.5 py-1.5 text-[#3b2f23]">
        <Coins className="h-4 w-4" style={{ color: "var(--gold)" }} />
        <span className="text-xs opacity-70">LOOT</span>
        <b className="f-num" style={{ color: "var(--gold)" }}>{loot}</b>
      </div>

      {/* Timer */}
      <div
        className="flex items-center gap-1.5 rounded border-2 px-2.5 py-1.5 text-[#fbf7ec]"
        style={{
          background: "rgba(58,38,19,.9)",
          borderColor: ALERT_BORDER[alert],
        }}
      >
        <Clock className="h-4 w-4" style={{ color: "var(--coin)" }} />
        <span className="text-xs opacity-70">THOÁT</span>
        <b className="f-num">{timer}</b>
      </div>

      <AlertSegments level={alert} />

      <button
        onClick={onExit}
        className="f-display rounded border-2 px-3 py-1.5 text-sm text-white"
        style={{ background: "var(--night-deep)", borderColor: "var(--alarm)" }}
      >
        <DoorOpen className="h-4 w-4" /> THOÁT
      </button>
    </header>
  );
}

/** 3 segment alert indicator + label (icon+color cue — red-team #22). */
function AlertSegments({ level }: { level: AlertLevel }) {
  const on = { stealth: 1, caution: 2, alarm: 3 }[level];
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-2.5 w-8 rounded-sm border-2 border-[#4a3119]"
          style={
            i <= on
              ? { background: ALERT_BORDER[level], borderColor: ALERT_BORDER[level] }
              : { background: "rgba(255,255,255,.08)" }
          }
        />
      ))}
      <b style={{ color: ALERT_BORDER[level] }}>{ALERT_LABEL[level]}</b>
    </div>
  );
}

/** Center-top alert banner (3 cấp pulse — KHÔNG blur, giữ crisp pixel). */
export function AlertBar(props: { level: AlertLevel; text: string }) {
  const Icon = { stealth: Moon, caution: TriangleAlert, alarm: Siren }[props.level];
  return (
    <div
      className="absolute left-1/2 top-3 z-[6] flex -translate-x-1/2 items-center gap-2 rounded border-2 px-4 py-2.5 text-sm text-white"
      style={{
        background: "var(--night-deep)",
        borderColor: ALERT_BORDER[props.level],
        boxShadow: "0 4px 16px rgba(0,0,0,.5)",
      }}
    >
      <Icon className="h-4 w-4" />
      <span>{props.text}</span>
    </div>
  );
}
