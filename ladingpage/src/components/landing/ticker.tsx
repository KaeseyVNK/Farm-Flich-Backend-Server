"use client";

import { CropIcon, SPRITE } from "./pixel-sprite";

const ITEMS: { icon: keyof typeof SPRITE; name: string; note: string }[] = [
  { icon: "carrot", name: "Cà rốt", note: "vụ sớm" },
  { icon: "corn", name: "Bắp", note: "vụ hè" },
  { icon: "tomato", name: "Cà chua", note: "vụ hè" },
  { icon: "pumpkin", name: "Bí ngô", note: "vụ thu" },
  { icon: "berry", name: "Dâu tây", note: "hiếm" },
  { icon: "egg", name: "Trứng gà", note: "mỗi ngày" },
  { icon: "milk", name: "Sữa bò", note: "mỗi ngày" },
  { icon: "fish", name: "Cá hồi", note: "sông" },
  { icon: "honey", name: "Mật ong", note: "rừng" },
  { icon: "wool", name: "Len cừu", note: "mỗi ngày" },
  { icon: "gem", name: "Ngọc", note: "hầm mỏ" },
  { icon: "mushroom", name: "Nấm", note: "rừng" },
  { icon: "sunflower", name: "Hướng dương", note: "biểu tượng" },
];

export function Ticker() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div
      className="relative z-10 overflow-hidden border-y-[3px] border-[#3e2f23] bg-[#3e2f23] py-3"
      aria-label="Vật phẩm sẽ có trong game"
    >
      <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap px-4">
        {doubled.map((item, i) => (
          <span
            key={`${item.name}-${i}`}
            className="flex items-center gap-2 font-display text-sm font-bold text-cream md:text-base"
          >
            <CropIcon name={item.icon} size={22} />
            {item.name}{" "}
            <span className="rounded bg-sun/15 px-1.5 py-0.5 font-mono text-xs font-extrabold text-sun">
              {item.note}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
