"use client";

import { useEffect, useState } from "react";
import { CropIcon } from "./pixel-sprite";
import { formatTimeLeft, giftCodeForDate, msUntilEndOfLocalDay } from "@/lib/waitlist";

export function GiftCode() {
  const [code, setCode] = useState(giftCodeForDate);
  const [left, setLeft] = useState(() => formatTimeLeft(msUntilEndOfLocalDay()));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const update = () => {
      setCode(giftCodeForDate());
      setLeft(formatTimeLeft(msUntilEndOfLocalDay()));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="pixel-border-sm inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md bg-[#3e2f23] px-4 py-2 text-sm font-bold text-cream focus-visible:ring-2 focus-visible:ring-sun"
      aria-label={`Mã mở sớm hôm nay ${code}. Bấm để sao chép.`}
    >
      <CropIcon name="sunflower" size={18} />
      <span>
        Mã mở sớm hôm nay:{" "}
        <span className="font-mono font-extrabold tracking-wider text-sun">
          {code ?? "…"}
        </span>
      </span>
      {left && <span className="text-cream/70">({left})</span>}
      <span className="text-sun">{copied ? "Đã chép" : "Chép"}</span>
    </button>
  );
}
