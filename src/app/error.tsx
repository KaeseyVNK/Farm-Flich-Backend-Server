"use client";

// Root error boundary. Bắt render throw ở bất kỳ route nào,
// hiển thị fallback thân thiện thay white screen. Reset giữ lại client state.
import { useEffect } from "react";
import { captureException } from "@/lib/telemetry/sentry";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Review M: wire captureException — trước đây console-only, telemetry chết.
    console.error("[error-boundary]", error);
    captureException(error, { boundary: "root" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#17181a] p-6 text-center text-[#e8d8b8]">
      <h2 className="f-display text-xl text-[#e7b94e]">Đã xảy ra lỗi</h2>
      <p className="max-w-md text-sm text-[#9a8a6e]">
        Trò chơi gặp lỗi không mong muốn. Tiến trình của bạn đã được lưu tự động.
      </p>
      <pre className="max-w-md overflow-auto rounded bg-black/40 p-2 text-left text-xs text-[#c9a76b]">
        {error.message || "Lỗi không xác định"}
      </pre>
      <button
        onClick={reset}
        className="rounded border-2 border-[#4a3119] bg-[#e7b94e] px-4 py-2 text-sm font-bold text-[#4e3318] hover:brightness-110"
      >
        Thử lại
      </button>
      <button
        // Hard navigation sau lỗi fatal — cần reset toàn bộ app (không phải SPA soft nav).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        onClick={() => window.location.assign("/")}
        className="text-xs text-[#7a6a4e] underline hover:text-[#e7b94e]"
      >
        Về trang chủ
      </button>
    </div>
  );
}
