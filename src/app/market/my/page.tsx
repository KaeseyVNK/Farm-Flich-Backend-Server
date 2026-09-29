"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { myListingsAction, cancelListingAction } from "@/app/actions/marketplace";
import { ItemArt } from "@/components/game-ui/item-art";
import { getItem } from "@/lib/game/data";

interface MyRow {
  id: string;
  itemId: string;
  qty: number;
  priceUnit: number;
  status: string;
  expiresAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Đang bán",
  sold: "Đã bán",
  cancelled: "Đã hủy",
  expired: "Hết hạn",
};

/** Notice phân biệt ok/error — success không hiện màu alarm (IA phase 5). */
interface Notice {
  ok: boolean;
  text: string;
}
const FAIL = (err?: string) => ({ ok: false, text: err ?? "Không thực hiện được — thử lại." });

export default function MyMarketPage() {
  const [rows, setRows] = useState<MyRow[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  // busy: chặn duplicate submit khi server action đang pending (phase 5 plan §9).
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = () => myListingsAction().then(setRows);
  useEffect(() => {
    refresh();
  }, []);

  const onCancel = async (id: string) => {
    if (cancelling) return;
    setCancelling(id);
    const res = await cancelListingAction(id);
    setCancelling(null);
    setNotice(res.ok ? { ok: true, text: "Đã hủy và hoàn item." } : FAIL(res.error));
    if (res.ok) refresh();
  };

  return (
    <main className="f-body min-h-screen bg-[#fffaf0] p-6 text-[#3b2f23]">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/market" className="rounded border border-[#4a3119] px-2 py-1 text-sm">
          ← Chợ
        </Link>
        <h1 className="f-display text-3xl text-[var(--mystic)]">Tin đăng của tôi</h1>
      </div>
      {notice && (
        <p className={`mb-3 text-sm ${notice.ok ? "text-[#4e7d3a]" : "text-[var(--alarm)]"}`}>{notice.text}</p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const canCancel = r.status === "active";
          return (
            <div key={r.id} className="flex items-center justify-between rounded border-2 border-[#4a3119] bg-[#efe2c4] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <ItemArt itemId={r.itemId} size={24} />
                <div>
                  <p className="text-sm font-bold">
                    {getItem(r.itemId)?.name ?? r.itemId} ×{r.qty}
                  </p>
                  <p className="text-xs opacity-70">
                    {r.priceUnit}g/ea · {STATUS_LABEL[r.status] ?? r.status}
                  </p>
                  {r.status === "active" && (
                    <p className="text-xs opacity-50">Hết hạn: {new Date(r.expiresAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              {canCancel && (
                <button
                  onClick={() => onCancel(r.id)}
                  disabled={cancelling !== null}
                  className="rounded border border-[#c0452f] bg-[#fffaf0] px-2 py-0.5 text-xs font-bold text-[#c0452f] disabled:opacity-50"
                >
                  Hủy
                </button>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm opacity-60">Chưa có tin đăng.</p>}
      </div>
    </main>
  );
}
