import { NextResponse } from "next/server";

const METHODS = new Set(["getLatestBlockhash", "getBlockHeight", "getBalance", "getAccountInfo", "getTokenAccountsByOwner", "getSignatureStatuses", "getTransaction", "getFeeForMessage", "getMinimumBalanceForRentExemption", "simulateTransaction", "sendTransaction"]);
// ponytail: per-process budget; multiple replicas also need a shared ingress limit.
let windowStart = 0;
let requests = 0;
let active = 0;
const LIMIT = 65536;

export async function POST(request: Request) {
  const upstream = process.env.SOLANA_RPC_UPSTREAM;
  if (!upstream) return NextResponse.json({ error: "Wallet RPC is not configured." }, { status: 503 });
  const origin = request.headers.get("origin");
  const publicOrigin = process.env.SOLANA_RPC_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== publicOrigin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const now = Date.now();
  if (now - windowStart >= 60000) { windowStart = now; requests = 0; }
  if (requests >= 60 || active >= 8) return NextResponse.json({ error: "Wallet RPC is busy. Please retry shortly." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((windowStart + 60000 - now) / 1000))) } });
  requests++;
  active++;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > LIMIT) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      const timeout = setTimeout(() => { void reader.cancel(); }, 15000);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > LIMIT) { await reader.cancel(); return NextResponse.json({ error: "Request too large." }, { status: 413 }); }
          chunks.push(value);
        }
      } finally { clearTimeout(timeout); reader.releaseLock(); }
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
    if (!body || Array.isArray(body) || body.jsonrpc !== "2.0" || !METHODS.has(body.method)) return NextResponse.json({ error: "RPC method not allowed." }, { status: 400 });
    const response = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" }, body: raw, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return NextResponse.json({ error: "Wallet RPC is temporarily unavailable." }, { status: response.status === 429 ? 429 : 502 });
    return new NextResponse(await response.text(), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Wallet RPC is temporarily unavailable." }, { status: 502 }); }
  finally { active--; }
}
