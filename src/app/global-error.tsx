"use client";

// Global error boundary (audit UI C3). Next App Router: bắt lỗi ngoài root layout
// (html/body throw). Phải render <html><body> riêng (không kế thừa layout.tsx).
import { useEffect } from "react";
import { captureException } from "@/lib/telemetry/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    captureException(error, { boundary: "global" });
  }, [error]);

  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#17181a] p-6 text-center text-[#e8d8b8]">
        <h2 className="text-xl text-[#e7b94e]">Lỗi nghiêm trọng</h2>
        <p className="max-w-md text-sm text-[#9a8a6e]">{error.message || "Unknown fatal error"}</p>
        <button
          onClick={reset}
          className="rounded border-2 border-[#4a3119] bg-[#e7b94e] px-4 py-2 text-sm font-bold text-[#4e3318]"
        >
          Tải lại
        </button>
      </body>
    </html>
  );
}
