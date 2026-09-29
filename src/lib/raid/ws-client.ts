"use client";

import { useRaidStore } from "@/store/raidStore";
import type { ClientMsg, ServerMsg } from "@/lib/raid/types";

/**
 * RaidWsClient — connect raid-server WS. Cookie JWT auto-send (cross-origin audit M6).
 * onmessage → raidStore. Drop giữa raid → reconnect 1 lần, fail → stuck-grace
 * chốt timeout local. Server authoritative — client gửi intent, KHÔNG simulate.
 */
export class RaidWsClient {
  private ws: WebSocket | null = null;
  private stuckTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  /** Review N1: reconnect chỉ thử ĐÚNG 1 lần mỗi client lifecycle. */
  private reconnectTried = false;
  /** Grace chờ raid-end sau khi WS drop. Quá khung này + vẫn active → client tự
   *  chốt timeout (server đã finalize nhưng client WS đã đóng → không nhận được). */
  private static readonly STUCK_GRACE_MS = 8_000;

  constructor(
    private farmId: string,
    private onPuzzleStart?: (s: Extract<ServerMsg, { t: "puzzle-start" }>) => void,
    private onTrapSprung?: (e: Extract<ServerMsg, { t: "trap-sprung" }>) => void,
    private mapId: string = "farm",
    private onDeadlineExt?: (e: Extract<ServerMsg, { t: "deadline-ext" }>) => void,
  ) {}

  connect(): void {
    const base = process.env.NEXT_PUBLIC_RAID_WS_URL ?? "ws://localhost:3002/raid";
    // maskId KHÔNG gửi — server-resolved từ Mask equipped (anti-spoof, audit F4.5).
    const url = `${base}?farmId=${encodeURIComponent(this.farmId)}&mapId=${encodeURIComponent(this.mapId)}`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      try {
        this.handle(JSON.parse(e.data) as ServerMsg);
      } catch {
        /* swallow malformed */
      }
    };
    this.ws.onclose = () => {
      if (this.closed) return;
      // Review N1: reconnect branch cũ unreachable (2 guard complement nhau) —
      // mọi drop rơi vào fabricated-timeout dù server còn room. Contract mới:
      // active raid + chưa endState → thử reconnect ĐÚNG 1 lần ngay (server giữ
      // room trong grace 5s + reconnect path tồn tại); reconnect cũng fail →
      // chờ STUCK_GRACE_MS rồi chốt timeout local.
      const st = useRaidStore.getState();
      if (!this.reconnectTried && st.phase === "active" && !st.endState) {
        this.reconnectTried = true;
        this.connect();
        return;
      }
      if (st.phase === "active" && !st.endState) {
        this.stuckTimer = setTimeout(() => {
          const cur = useRaidStore.getState();
          if (!this.closed && cur.phase === "active" && !cur.endState) {
            cur.setEnd({ reason: "timeout", keptLoot: [], maskDurabilityLoss: 0 });
          }
        }, RaidWsClient.STUCK_GRACE_MS);
      }
    };
  }

  send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private handle(msg: ServerMsg): void {
    // Review N2: socket đã close chủ động (finishRaid) — snapshot/raid-end muộn
    // trong flight không được resurrect raid overlay đã reset.
    if (this.closed) return;
    const store = useRaidStore.getState();
    switch (msg.t) {
      case "snapshot":
        store.applySnapshot(msg.snap);
        break;
      case "alert-level":
        // Standalone alert (not bundled in a snapshot) — surface as presentation state.
        // Phase 5: previously ignored; now a typed UI event so walk/alert/level changes that
        // arrive off-snapshot are readable. Never overrides snapshot.alert.
        store.pushEvent({
          kind: "alert", level: msg.level, score: msg.score, reason: msg.reason, receivedAt: Date.now(),
        });
        break;
      case "puzzle-start":
        this.onPuzzleStart?.(msg);
        break;
      case "puzzle-result":
        // Server-confirmed puzzle outcome — presented, never applied to inventory here.
        store.pushEvent({
          kind: "puzzle-result", chestId: msg.chestId, ok: msg.ok,
          loot: msg.loot, receivedAt: Date.now(),
        });
        break;
      case "trap-sprung":
        this.onTrapSprung?.(msg);
        break;
      case "deadline-ext":
        // W7d-P2: lockpick +2s — cập nhật đếm ngược puzzle đang mở.
        this.onDeadlineExt?.(msg);
        break;
      case "lockdown":
        store.setLockdown(msg.gateCloseTick);
        break;
      case "raid-end":
        store.setEnd({
          reason: msg.reason,
          keptLoot: msg.keptLoot,
          maskDurabilityLoss: msg.maskDurabilityLoss,
        });
        break;
      case "error":
        // Phase 5: readable + dismissible instead of console-only. Join/interact rejection
        // must not be hidden or treated as success.
        store.pushEvent({
          kind: "error", code: msg.code, message: msg.msg, receivedAt: Date.now(),
        });
        break;
      default:
        break;
    }
  }

  close(): void {
    this.closed = true;
    // Review N2: detach handlers TRƯỚC close — WS close là async, snapshot 5Hz
    // đang in-flight dispatch vào handle() sau reset() → applySnapshot guard chỉ
    // chặn "ended" không chặn "idle" → zombie raid overlay.
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.stuckTimer) clearTimeout(this.stuckTimer);
  }
}
