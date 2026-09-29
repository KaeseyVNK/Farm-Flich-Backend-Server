"use client";

import { useState } from "react";
import { Sprout } from "lucide-react";
import { giftCodeForDate } from "@/lib/waitlist";
import { cn } from "@/lib/utils";

export function WaitlistForm({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, giftCode: giftCodeForDate() }),
      });
      const data = (await res.json()) as { error?: string; giftCode?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Không gửi được. Thử lại nhé.");
        return;
      }
      setStatus("ok");
      setMessage(
        data.giftCode
          ? `Đã lưu chỗ. Mã mở sớm của bạn: ${data.giftCode}`
          : "Đã lưu chỗ. Chúng tôi sẽ gửi thư khi mở cửa.",
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Mạng lỗi. Thử lại sau.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex w-full flex-col gap-2",
        compact ? "max-w-md" : "max-w-lg",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={compact ? "waitlist-email-sm" : "waitlist-email"}>
          Email
        </label>
        <input
          id={compact ? "waitlist-email-sm" : "waitlist-email"}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email của bạn"
          aria-invalid={status === "error"}
          className="pixel-border-sm h-12 min-w-0 flex-1 rounded-md bg-white px-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="pixel-border pixel-shadow-hover inline-flex h-12 items-center justify-center gap-2 rounded-md bg-sun px-5 font-display text-base font-extrabold text-[#5a4300] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <Sprout className="size-4" aria-hidden />
          {status === "loading" ? "Đang lưu…" : "Giữ chỗ sớm"}
        </button>
      </div>
      <p
        className={cn(
          "min-h-5 text-sm font-bold",
          status === "ok" && "text-grass-dark",
          status === "error" && "text-destructive",
          status === "idle" && "text-foreground/70",
        )}
        role="status"
        aria-live="polite"
      >
        {message ||
          (compact
            ? "Miễn phí. Không spam."
            : "Chúng tôi chỉ gửi thư khi mở playtest — không bán email.")}
      </p>
    </form>
  );
}
