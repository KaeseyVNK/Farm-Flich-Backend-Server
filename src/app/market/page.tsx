"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { browseAction, buyAction, listItemAction } from "@/app/actions/marketplace";
import { ItemArt } from "@/components/game-ui/item-art";
import { getItem } from "@/lib/game/data";

interface Row {
  id: string;
  sellerId: string;
  itemId: string;
  qty: number;
  priceUnit: number;
}

/** Notice phân biệt ok/error — success không hiện màu alarm (IA phase 5). */
interface Notice {
  ok: boolean;
  text: string;
}
const FAIL = (err?: string) => ({ ok: false, text: err ?? "Không thực hiện được — thử lại." });

export default function MarketPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [listForm, setListForm] = useState({ itemId: "wood", qty: 1, priceUnit: 5 });
  const [buyTarget, setBuyTarget] = useState<Row | null>(null);
  const [buyQty, setBuyQty] = useState(1);
  // busy: chặn duplicate submit khi server action đang pending (phase 5 plan §9).
  const [buying, setBuying] = useState(false);

  const refresh = () => browseAction().then(setRows);
  useEffect(() => {
    refresh();
  }, []);

  const onList = async () => {
    const res = await listItemAction(listForm.itemId, listForm.qty, listForm.priceUnit);
    setNotice(res.ok ? { ok: true, text: "Đã đăng bán." } : FAIL(res.error));
    if (res.ok) refresh();
  };
  const onBuy = async () => {
    if (!buyTarget || buying) return;
    setBuying(true);
    const res = await buyAction(buyTarget.id, buyQty);
    setBuying(false);
    setNotice(res.ok ? { ok: true, text: `Đã mua ${buyQty} ${buyTarget.itemId}.` } : FAIL(res.error));
    setBuyTarget(null);
    if (res.ok) refresh();
  };

  return (
    <main className="f-body min-h-screen bg-[#fffaf0] p-6 text-[#3b2f23]">
      <h1 className="f-display mb-4 flex items-center gap-2 text-3xl text-[var(--mystic)]">
        <Store aria-hidden className="h-7 w-7" /> Chợ
      </h1>
      <Link href="/market/my" className="mb-4 inline-block text-sm underline opacity-70">
        Tin đăng của tôi →
      </Link>
      {notice && (
        <p className={`mb-3 text-sm ${notice.ok ? "text-[#4e7d3a]" : "text-[var(--alarm)]"}`}>{notice.text}</p>
      )}

      <div className="mb-6 rounded-xl border-2 border-[#4a3119] bg-[#efe2c4] p-3">
        <h2 className="f-display mb-2 text-lg text-[#4e7d3a]">Đăng bán</h2>
        <div className="flex flex-wrap gap-2">
          <input value={listForm.itemId} onChange={(e) => setListForm({ ...listForm, itemId: e.target.value })} placeholder="item" className="rounded border border-[#4a3119] bg-white px-2 py-1 text-sm w-24" />
          <input type="number" value={listForm.qty} onChange={(e) => setListForm({ ...listForm, qty: +e.target.value })} className="rounded border border-[#4a3119] bg-white px-2 py-1 text-sm w-20" />
          <input type="number" value={listForm.priceUnit} onChange={(e) => setListForm({ ...listForm, priceUnit: +e.target.value })} className="rounded border border-[#4a3119] bg-white px-2 py-1 text-sm w-24" />
          <button onClick={onList} className="rounded border-2 border-[#4a3119] bg-[var(--mystic)] px-3 py-1 text-sm font-bold text-white">Đăng</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded border-2 border-[#4a3119] bg-[#efe2c4] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <ItemArt itemId={r.itemId} size={24} />
              <div>
                <p className="text-sm font-bold">{getItem(r.itemId)?.name ?? r.itemId} ×{r.qty}</p>
                <p className="text-xs opacity-70">{r.priceUnit}g/ea · seller {r.sellerId.slice(0, 6)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setBuyTarget(r);
                setBuyQty(1);
              }}
              className="rounded border border-[#4a3119] bg-[#4e7d3a] px-2 py-0.5 text-xs font-bold text-[#fbf7ec]"
            >
              Mua
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm opacity-60">Chưa có listing.</p>}
      </div>

      {buyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-72 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
            <h3 className="f-display mb-2 inline-flex items-center justify-center gap-1 text-sm text-[#4e7d3a]">
              Mua {getItem(buyTarget.itemId)?.name ?? buyTarget.itemId}
            </h3>
            <p className="mb-2 text-xs">Có sẵn {buyTarget.qty} · {buyTarget.priceUnit}g/ea</p>
            <input type="number" min={1} max={buyTarget.qty} value={buyQty} onChange={(e) => setBuyQty(+e.target.value)} className="mb-2 w-full rounded border border-[#4a3119] px-2 py-1 text-sm" />
            <p className="mb-2 text-xs font-bold">Tổng: {buyQty * buyTarget.priceUnit}g</p>
            <div className="flex gap-2">
              <button onClick={onBuy} disabled={buying} className="flex-1 rounded border-2 border-[#4a3119] bg-[#4e7d3a] py-1 text-sm font-bold text-[#fbf7ec] disabled:opacity-50">Mua</button>
              <button onClick={() => setBuyTarget(null)} className="rounded border-2 border-[#c0452f] px-3 py-1 text-sm text-[#c0452f]">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
