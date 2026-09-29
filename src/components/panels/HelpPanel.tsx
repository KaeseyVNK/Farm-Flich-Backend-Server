"use client";

import { Keyboard, MousePointerClick, Gamepad2, Lightbulb } from "lucide-react";

const CONTROLS: { keys: string; action: string }[] = [
  { keys: "W A S D / ↑ ↓ ← →", action: "Move your character" },
  { keys: "Space / E", action: "Dùng công cụ / tương tác / thu hoạch" },
  { keys: "1 – 0, -, =", action: "Chọn ô hotbar" },
  { keys: "Q", action: "Chuyển công cụ kế tiếp (trong túi)" },
  { keys: "Tab", action: "Di chuyển focus (bảng/modal) — không đổi công cụ" },
  { keys: "B", action: "Ngủ (kết thúc ngày)" },
  { keys: "I", action: "Bật/tắt Túi đồ" },
  { keys: "P", action: "Bật/tắt Hạt giống & Cửa hàng" },
  { keys: "C", action: "Bật/tắt Chế tạo" },
  { keys: "M", action: "Bật/tắt Bản đồ" },
  { keys: "R", action: "Bật/tắt Quan hệ" },
  { keys: "L", action: "Bật/tắt Lịch & Nhiệm vụ" },
  { keys: "H", action: "Bật/tắt Trợ giúp này" },
  { keys: "Esc", action: "Đóng bảng / hội thoại" },
];

const TIPS: string[] = [
  "Cuốc cỏ bằng Cuốc (Hoe), gieo hạt, và tưới nước mỗi ngày. Cây chỉ lớn khi được tưới!",
  "Cây chết khi đổi mùa nếu không thể mọc trong mùa mới — thu hoạch trước khi hết mùa.",
  "Chặt cây (Rìu) lấy gỗ, đập đá (Cuốc chim) lấy đá, cắt cỏ cao (Liềm) lấy sợi.",
  "Máy tưới tự tưới các ô kế bên mỗi sáng — chế tạo vài cái để tiết thời gian!",
  "Nói chuyện với dân làng mỗi ngày và tặng quà họ thích để tăng trái tim.",
  "Năng lượng sẽ cạn! Ăn đồ ăn hoặc ngủ để hồi phục. Ngất lúc 2 giờ sáng tốn vàng.",
  "Bán nông sản & tài nguyên qua bảng Túi đồ để lấy vàng.",
  "Vật phẩm hoang dã xuất hiện quanh bản đồ — nhặt để được đồ miễn phí, bán hoặc tặng.",
];

export function HelpPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <Keyboard className="h-4 w-4" /> Điều khiển
        </h3>
        <div className="space-y-1.5">
          {CONTROLS.map((c) => (
            <div
              key={c.keys}
              className="flex items-center justify-between gap-2 rounded-lg bg-[#efe6d2] px-2.5 py-1.5"
            >
              <kbd className="rounded border border-[#6b4a2b] bg-[#d8c69e] px-1.5 py-0.5 text-[11px] font-bold text-[#3b2f23]">
                {c.keys}
              </kbd>
              <span className="text-[11px] font-semibold text-[#5a4a36]">{c.action}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <MousePointerClick className="h-4 w-4" /> Chuột
        </h3>
        <p className="text-[11px] font-medium text-[#5a4a36]">
          Bấm icon trên thanh chức năng (trái) để mở bảng. Bấm ô túi đồ để chọn &amp; trang bị công
          cụ. Bấm bản đồ để dịch chuyển nhanh. Rê chuột lên vật phẩm để xem tooltip.
        </p>
      </div>

      <div className="rounded-xl border-2 border-[#4e7d3a] bg-[#e7f4e0] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#4e7d3a]">
          <Lightbulb className="h-4 w-4" /> Mẹo hay
        </h3>
        <ul className="space-y-1.5">
          {TIPS.map((t, i) => (
            <li key={i} className="flex gap-2 text-[11px] font-medium text-[#3b2f23]">
              <span className="text-[#4e7d3a]">▹</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <Gamepad2 className="h-4 w-4" /> Vòng lặp nông trại
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {[" Cuốc cỏ", " Gieo hạt", " Tưới mỗi ngày", " Thu hoạch", " Bán lấy vàng", " Lặp lại"].map(
            (step, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="rounded-md border border-[#6b4a2b] bg-[#efe2c4] px-2 py-1 text-[#3b2f23]">
                  {i + 1}.{step}
                </span>
                {i < 5 && <span className="text-[#8a6238]">→</span>}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
