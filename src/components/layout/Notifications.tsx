"use client";

import { useUiStore } from "@/store/uiStore";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

// Status colours via --mf-* tokens. Each kind is differentiated by icon SHAPE + colour + the
// toast text (never colour alone), so the signal survives grayscale / reduced-motion.
const KIND_STYLE = {
  info: { icon: Info, color: "var(--mf-focus)" },
  success: { icon: CheckCircle2, color: "var(--mf-leaf)" },
  warn: { icon: AlertTriangle, color: "var(--mf-harvest)" },
  error: { icon: XCircle, color: "var(--mf-danger)" },
} as const;

export function Notifications() {
  const notifications = useUiStore((s) => s.notifications);
  const dismiss = useUiStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none absolute right-4 top-[11.5rem] z-[var(--z-toast)] flex w-72 flex-col gap-2"
      role="region"
      aria-label="Thông báo"
      aria-live="polite"
      aria-atomic="false"
    >
      {/* Cap 3 toast đồng thời: spam tool (cuốc 10 ô nhanh) sinh 10 toast phủ kín
          top-right HUD — trên mobile che gold/energy. Slice lấy toast mới nhất;
          toast cũ auto-dismiss 3.5s nên 3 là đủ ngưỡng đọc. */}
      {notifications.slice(-3).map((n) => {
        const s = KIND_STYLE[n.kind];
        const Icon = s.icon;
        return (
          <div
            key={n.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-2 rounded-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper-raised)] p-2.5 shadow-[3px_3px_0_rgba(0,0,0,0.25)] motion-reduce:animate-none"
            role="status"
            style={{ color: s.color }}
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px]"
              style={{ background: "color-mix(in srgb, currentColor 16%, var(--mf-paper))" }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="flex-1 text-sm font-medium text-[var(--mf-ink)]">{n.text}</p>
            <button
              onClick={() => dismiss(n.id)}
              className="text-[var(--mf-muted-ink)] hover:text-[var(--mf-ink)]"
              aria-label="Bỏ qua"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
