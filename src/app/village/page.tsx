"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Home, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendVillageChatAction } from "@/app/actions/village-chat";
import { useVillagePresence, chatRateLimit, type VillagePlayer } from "@/lib/social/village-presence";

interface ChatMsg {
  id: string;
  userId: string;
  msg: string;
}

// Mask → màu primitive (không emoji identity, tinh thần raid-display-mapper phase 5).
// Fallback xám trung tính — không borrowing semantics mask nào.
const MASK_COLOR: Record<string, string> = {
  rogue: "#7c5cbf", // mystic violet
  phantom: "#9bb8d6", // pale ghost blue
  bandit: "#c9a227", // áo khoác gold-brown
  scout: "#4e7d3a", // stealth green
};
const MASK_COLOR_FALLBACK = "#8a8a8a";
const maskColor = (id: string) => MASK_COLOR[id] ?? MASK_COLOR_FALLBACK;

export default function VillagePage() {
  const { players, self, move } = useVillagePresence({ x: 20, y: 15 });
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const chatHistory = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // sendingRef chống double-send: send() là async, có khoảng trống giữa trim-check
  // và setInput("") sau await. Enter 2 lần nhanh (hoặc double-click) → 2 send() chạy
  // chồng → 2 tin nhắn giống hệt. Lock trong khi pending.
  const sendingRef = useRef(false);

  // WASD
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Không move khi đang gõ trong input chat — trước đây keydown bubble lên
      // window → gõ "w" trong chat di chuyển avatar luôn.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "w") move(0, -1);
      else if (k === "s") move(0, 1);
      else if (k === "a") move(-1, 0);
      else if (k === "d") move(1, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // Chat realtime subscribe
  useEffect(() => {
    const supabase = createClient();
    // loadedRef gate: realtime INSERT callback có thể fire TRƯỚC khi load()
    // SELECT resolve (commit visible) → callback append row vào []-initial →
    // load() resolve sau → setChat(data.reverse()) REPLACE toàn array → row vừa
    // nhận bị drop. Gate: buffer row cho đến khi load xong, merge không replace.
    const seenIds = new Set<string>();
    let pending: ChatMsg[] = [];
    let loaded = false;
    const load = async () => {
      const { data } = await supabase
        .from("VillageChat")
        .select("id, userId, msg")
        .order("createdAt", { ascending: false })
        .limit(50);
      const rows = ((data ?? []) as ChatMsg[]).reverse();
      for (const r of rows) seenIds.add(r.id);
      setChat([...rows, ...pending]);
      loaded = true;
    };
    load();
    const channel = supabase
      .channel("village-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "VillageChat" },
        (payload) => {
          const row = payload.new as ChatMsg;
          if (!row?.id || seenIds.has(row.id)) return; // dedup
          seenIds.add(row.id);
          if (!loaded) {
            pending = [...pending, row].slice(-50);
            return;
          }
          setChat((c) => [...c.slice(-49), row]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Render canvas — entity là colored primitive (không emoji), self nổi viền trắng.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#5a8e44";
    ctx.fillRect(0, 0, c.width, c.height);
    const tile = 16;
    const drawAvatar = (x: number, y: number, color: string, isSelf: boolean) => {
      const cx = x * tile + tile / 2;
      const cy = y * tile + tile / 2;
      // body: rect tròn
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(cx - 5, cy - 3, 10, 9, 4);
      ctx.fill();
      // head: circle
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      if (isSelf) {
        ctx.strokeStyle = "#fffaf0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    drawAvatar(self.x, self.y, maskColor(self.maskId), true);
    Object.values(players).forEach((p: VillagePlayer) => {
      if (p.userId === self.userId) return;
      drawAvatar(p.x, p.y, maskColor(p.maskId), false);
    });
  }, [self, players]);

  const send = async () => {
    if (sendingRef.current) return;
    const msg = input.trim();
    if (!msg || !self.userId) return;
    const now = Date.now();
    if (!chatRateLimit(chatHistory.current, now)) {
      setErr("Gửi quá nhanh — thử lại sau giây lát.");
      return;
    }
    sendingRef.current = true;
    chatHistory.current.push(now);
    const res = await sendVillageChatAction(msg);
    sendingRef.current = false;
    if (!res.ok) {
      setErr(res.error ?? "lỗi");
      chatHistory.current.pop();
      return;
    }
    setInput("");
    setErr("");
  };

  return (
    <main className="f-body flex min-h-screen flex-col bg-[#3b2f23] text-[#fffaf0] md:flex-row">
      {/* Aside trái (Online) — ẩn trên mobile, flex-row trên md+. Trước đây w-48 cứng
          + aside phải w-64 → 192+256=448px đã vượt mobile 375px → vỡ ngang. */}
      <aside className="hidden border-r border-black/30 bg-[#2a2118] p-2 md:block md:w-48">
        <h2 className="f-display mb-2 flex items-center gap-1.5 text-sm text-[var(--mystic)]">
          <UsersRound aria-hidden className="h-4 w-4" /> Online
        </h2>
        <ul className="space-y-1 text-xs">
          {Object.values(players).map((p) => (
            <li key={p.userId} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: maskColor(p.maskId) }} />
              {p.displayName}
            </li>
          ))}
          {Object.keys(players).length === 0 && <li className="opacity-50">Chỉ mình...</li>}
        </ul>
      </aside>
      <div className="flex-1 p-4">
        <h1 className="f-display mb-2 flex items-center gap-2 text-xl text-[var(--mystic)]">
          <Home aria-hidden className="h-5 w-5" /> Làng
        </h1>
        <p className="mb-2 text-xs opacity-70">WASD để di chuyển</p>
        {/* Canvas responsive — trước đây width={640} cứng → mobile 375px tràn ngang.
            w-full + max-w + aspect ratio scale xuống, canvas internal res giữ 640×480. */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full max-w-[640px] rounded border-2 border-black/40"
          style={{ aspectRatio: "640 / 480" }}
        />
      </div>
      <aside className="flex w-full flex-col border-t border-black/30 bg-[#2a2118] p-2 md:w-64 md:border-l md:border-t-0">
        <h2 className="f-display mb-2 flex items-center gap-1.5 text-sm text-[var(--mystic)]">
          <MessageSquare aria-hidden className="h-4 w-4" /> Chat
        </h2>
        <div className="f-body mb-2 max-h-[40vh] flex-1 overflow-y-auto text-xs md:max-h-none">
          {chat.map((m) => (
            <p key={m.id} className="mb-1">
              <span className="font-bold text-[var(--mystic)]">{m.userId.slice(0, 6)}:</span> {m.msg}
            </p>
          ))}
        </div>
        {err && <p className="mb-1 text-[10px] text-[var(--alarm)]">{err}</p>}
        <div className="flex gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="f-body flex-1 rounded bg-black/30 px-2 py-1 text-xs text-white"
            placeholder="nhập..."
          />
          <button onClick={send} className="rounded bg-[var(--mystic)] px-2 text-xs">Gửi</button>
        </div>
      </aside>
    </main>
  );
}
