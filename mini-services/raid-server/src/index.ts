import { RaidRoom } from "./room.js";
import {
  TICK_MS,
  SNAPSHOT_EVERY_N_TICKS,
  GRACE_ABORT_MS,
  SNAPSHOT_FLUSH_EVERY_TICKS,
  FINALIZE_RETRY_MAX,
  STALE_SESSION_MS,
  WATCHDOG_INTERVAL_MS,
} from "./constants.js";
import { getUserFromCookie } from "./auth.js";
import { tryJoin } from "./join.js";
import { ReplayLogger } from "./replay.js";
import { replayConfigFromSession, type RaidConfigSnapshot } from "./replay-config.js";
import { supabase } from "./supabase.js";
import { finalizeRaid, FinalizePhase1Error } from "./finalize.js";
import { genMemorySeq, validateMemory } from "./puzzle.js";
import { genTimingWindow, validateTiming } from "./puzzle-timing.js";
import { genSequence, validateSequence } from "./puzzle-sequence.js";
import { LIVE_RAID_CHESTS } from "./live-chests.js";
import { chestPuzzleKind } from "./chest-puzzle-kind.js";
import { applyToolUse } from "./raid-tools.js";
import { genCircuit, validateCircuit } from "./puzzle-circuit.js";
import { genLockRotate, validateLockRotate } from "./puzzle-lock-rotate.js";
import { genJigsaw, validateJigsaw } from "./puzzle-jigsaw.js";
import { rollLootSeeded } from "./loot-tables.js";
import { triggerLockdown, shouldTriggerAutoLockdown, type OwnerPresence } from "./lockdown.js";
import { subscribeOwnerPresence } from "./lockdown-presence.js";
import { replayEvents } from "./replay-headless.js";
import { validateClientMsg } from "./validate-msg.js";
import type { ClientMsg, ServerMsg } from "./protocol.js";

/** WS upgrade data — userId từ verified cookie (KHÔNG tin client). */
interface WsData {
  userId: string;
  farmId: string;
  maskId: string;
  mapId: string;
}

interface RoomState {
  room: RaidRoom;
  replay: ReplayLogger;
  sessionId: string;
  ownerId: string;
  thiefId: string;
  maskId: string;
  mapId: string;
  farmId: string;
  /** Phase 7 blood-moon — persist cho replay re-sim biome override. */
  bloodMoon: boolean;
  /** W7d-P2: tools chợ đen đã dùng (mỗi tool 1 lần/raid). */
  toolUses: Set<string>;
  finalizing?: boolean;
  /** Retry counter finalize_raid RPC. Force-resolve DB khi vượt FINALIZE_RETRY_MAX. */
  finalizeRetryCount?: number;
  /** Loot loop đã chạy xong ít nhất 1 lần → retry KHÔNG re-run loot (chặn item dup). */
  lootApplied?: boolean;
  unsubPresence?: () => void;
  presenceDebounce?: ReturnType<typeof setTimeout>;
  /** Puzzle deadline wall-clock per chest (enforce server-side — phase 2 F2.3). */
  puzzleDeadlines: Map<string, number>;
  /** Alt-F4 grace (red-team #10): ws close → set disconnectedAt, sau GRACE_ABORT_MS → abort. */
  disconnectedAt?: number;
  abortTimer?: ReturnType<typeof setTimeout>;
  /** WS hiện tại đang giữ raid (để reconnect không double-subscribe). */
  activeWs?: { data: WsData; send: (s: string) => void; subscribe: (ch: string) => void; close: () => void; readyState: number };
}

// farmId → room (single-process multi-room — red-team #6: workers = YAGNI)
const rooms = new Map<string, RoomState>();

function send(ws: { send: (s: string) => void }, msg: ServerMsg) {
  ws.send(JSON.stringify(msg));
}

/** Shared lockdown trigger (manual POST + auto presence). Idempotent guard. */
function triggerRoomLockdown(state: RoomState) {
  if (state.room.lockdown) return; // idempotent (F9.4)
  state.room.lockdown = true;
  const { gateCloseTick } = triggerLockdown(state.room.tickN);
  state.room.gateCloseTick = gateCloseTick;
  state.room.alert.bump(50); // chủ về → alarm ngay
  state.replay.log(state.room.tickN, "lockdown", state.ownerId);
  server.publish(
    "room:" + state.farmId,
    JSON.stringify({ t: "lockdown", gateCloseTick } satisfies ServerMsg),
  );
}

/**
 * Force-resolve session stuck active trong DB khi retry finalize hết cap. Bump
 * status → resolved + ghi resultJson forceResolved để audit trail. WHERE
 * status='active' → idempotent (không double-resolve). Xóa presence sub + timers.
 */
async function forceResolveStuck(state: RoomState, reason: string): Promise<void> {
  await supabase
    .from("RaidSession")
    .update({
      status: "resolved",
      endedAt: new Date().toISOString(),
      resultJson: { reason, forceResolved: true, keptLoot: [] },
    })
    .eq("id", state.sessionId)
    .eq("status", "active");
  if (state.unsubPresence) state.unsubPresence();
  if (state.presenceDebounce) clearTimeout(state.presenceDebounce);
  if (state.abortTimer) clearTimeout(state.abortTimer);
}

/**
 * Watchdog: poll session active > STALE_SESSION_MS → force-resolve. Backstop khi
 * process crash giữa finalize (room lost khỏi memory nhưng session DB kẹt active
 * → partial unique idx RaidSession_single_active_per_farm chặn farm vĩnh viễn).
 * Poll nhẹ (1 query/60s), không scan room Map (orphan session = không có room).
 */
async function reapStaleSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SESSION_MS).toISOString();
  const { data: stale, error } = await supabase
    .from("RaidSession")
    .select("id, farmId")
    .eq("status", "active")
    .lt("startedAt", cutoff);
  if (error || !stale || stale.length === 0) return;
  for (const s of stale as { id: string; farmId: string }[]) {
    // Skip nếu room còn trong memory (raid thực sự đang chạy, không phải orphan).
    if (rooms.has(s.farmId)) continue;
    console.error(`[watchdog] force-resolve stale session ${s.id} (active > ${STALE_SESSION_MS}ms)`);
    await supabase
      .from("RaidSession")
      .update({
        status: "resolved",
        endedAt: new Date().toISOString(),
        resultJson: { reason: "watchdog_stale", forceResolved: true, keptLoot: [] },
      })
      .eq("id", s.id)
      .eq("status", "active");
  }
}

const server = Bun.serve<WsData>({
  port: Number(process.env.RAID_PORT ?? 3002),
  fetch: async (req, server) => {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return new Response("ok"); // red-team #20

    // Lockdown: owner quay về farm → trigger. Cookie auth (chỉ owner farm).
    if (url.pathname === "/lockdown" && req.method === "POST") {
      const userId = await getUserFromCookie(req.headers.get("cookie"));
      if (!userId) return new Response("unauthorized", { status: 401 });
      const farmId = url.searchParams.get("farmId");
      if (!farmId) return new Response("missing farmId", { status: 400 });
      const state = rooms.get(farmId);
      if (!state || state.ownerId !== userId) return new Response("no active raid", { status: 404 });
      triggerRoomLockdown(state);
      return new Response("ok");
    }

    // Replay (phase 9 F9.7/F9.8): owner-only. Load RaidEvent[] → re-sim → SnapshotMsg[].
    if (url.pathname === "/replay" && req.method === "GET") {
      const userId = await getUserFromCookie(req.headers.get("cookie"));
      if (!userId) return new Response("unauthorized", { status: 401 });
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return new Response("missing sessionId", { status: 400 });
      const { data: session } = await supabase
        .from("RaidSession")
        .select("ownerId, farmId, mapId, thiefMaskId, bloodMoon, guardBonus, configSnapshot")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session) return new Response("not found", { status: 404 });
      if ((session as { ownerId: string }).ownerId !== userId) return new Response("forbidden", { status: 403 });
      const sess = session as { farmId: string; mapId?: string; thiefMaskId?: string; bloodMoon?: boolean; guardBonus?: boolean; configSnapshot?: RaidConfigSnapshot | null };
      const { data: farmRow } = await supabase
        .from("Farm")
        .select("terrain")
        .eq("id", sess.farmId)
        .maybeSingle();
      const { data: rows } = await supabase
        .from("RaidEvent")
        .select("tick, seq, type, actorId, payload")
        .eq("sessionId", sessionId)
        .order("tick", { ascending: true })
        .order("seq", { ascending: true })
        .limit(25_000); // review Low: replay cap 20000 events — hard bound memory/body
      const events = (rows ?? []) as { tick: number; seq: number; type: string; actorId: string; payload: Record<string, unknown> }[];
      // W7 audit-fix: config từ snapshot persist lúc START (sanitize trong helper) —
      // session cũ NULL → fallback default cũ. W7d-P1: guardBonus re-sim vision +1 tile.
      const snaps = replayEvents({
        config: replayConfigFromSession(
          sess,
          (farmRow as { terrain: number[] })?.terrain,
          sessionId,
        ),
        events,
      });
      return new Response(JSON.stringify({ snaps }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/raid") {
      // red-team #3: auth QUA COOKIE. F4.5: maskId SERVER-RESOLVED (KHÔNG từ URL query — anti-spoof).
      const userId = await getUserFromCookie(req.headers.get("cookie"));
      if (!userId) return new Response("unauthorized", { status: 401 });
      const farmId = url.searchParams.get("farmId");
      const mapId = url.searchParams.get("mapId") ?? "farm"; // phase 7 biome
      if (!farmId) return new Response("missing farmId", { status: 400 });
      // Alt-F4 reconnect (red-team #10): room đang active + cùng thief + trong grace window → cho phép.
      const existing = rooms.get(farmId);
      if (existing && existing.thiefId === userId && existing.disconnectedAt) {
        const inGrace = Date.now() - existing.disconnectedAt < GRACE_ABORT_MS;
        // Cho reconnect khi: trong grace + raid chưa ended, HOẶC raid đã ended/finalizing
        // (poll raid-end — trước đây chặn → "raid busy" 409 dead-end đến khi room reaped).
        if (inGrace || existing.room.ended || existing.finalizing) {
          if (server.upgrade(req, { data: { userId, farmId, maskId: "", mapId } })) return;
          return new Response("upgrade failed", { status: 500 });
        }
      }
      if (rooms.has(farmId)) return new Response("raid busy", { status: 409 }); // 1 raider/farm
      // maskId resolve ở tryJoin (query Mask equipped) → ws.data sau join.
      if (server.upgrade(req, { data: { userId, farmId, maskId: "", mapId } })) return;
      return new Response("upgrade failed", { status: 500 });
    }
    return new Response("not found", { status: 404 });
  },
  websocket: {
    open: async (ws) => {
      const { userId, farmId, mapId } = ws.data;
      // Alt-F4 reconnect (red-team #10): room đang active + cùng thief + trong grace window
      // → reuse room cũ (dog KHÔNG reset), gắn ws mới.
      const existingReconnect = rooms.get(farmId);
      if (existingReconnect && existingReconnect.thiefId === userId && existingReconnect.disconnectedAt) {
        const inGrace = Date.now() - existingReconnect.disconnectedAt < GRACE_ABORT_MS;
        // Reconnect khi: trong grace (tiếp tục raid) HOẶC raid đã ended/finalizing
        // (poll raid-end snapshot — chặn 409 dead-end khi room chờ finalize retry/reap).
        if (inGrace || existingReconnect.room.ended || existingReconnect.finalizing) {
          existingReconnect.disconnectedAt = undefined;
          if (existingReconnect.abortTimer) clearTimeout(existingReconnect.abortTimer);
          existingReconnect.abortTimer = undefined;
          existingReconnect.activeWs = ws;
          ws.subscribe("room:" + farmId);
          send(ws, { t: "snapshot", snap: existingReconnect.room.snapshot() });
          send(ws, { t: "alert-level", level: existingReconnect.room.alert.level, score: existingReconnect.room.alert.score, reason: "reconnect" });
          return;
        }
      }
      // Atomic join (DB gate). maskId SERVER-RESOLVED từ Mask equipped (F4.5 anti-spoof).
      const j = await tryJoin({ farmId, thiefId: userId, maskId: "", mapId });
      if (!j.ok || !j.sessionId || !j.maskId) {
        send(ws, { t: "error", code: j.reason ?? "unknown", msg: "join rejected" });
        ws.close();
        return;
      }
      const maskId = j.maskId; // server-resolved, KHÔNG tin client
      // Load farm read-only
      const { data: farm } = await supabase
        .from("Farm")
        .select("terrain")
        .eq("id", farmId)
        .maybeSingle();
      if (!farm) {
        send(ws, { t: "error", code: "farm_missing", msg: "farm not found" });
        ws.close();
        return;
      }
      // Load DefenseConfig (phase 1 trap + phase 3 dog/fence level).
      const { data: defRows } = await supabase
        .from("DefenseConfig")
        .select("slot, type, payload")
        .eq("userId", j.ownerId!);
      const defs = (defRows ?? []) as { slot: number; type: string; payload: Record<string, unknown> }[];
      const traps = defs
        .filter((r) => r.type === "trap")
        .map((r) => ({
          id: `trap-${r.slot}`,
          kind: (r.payload?.kind ?? "spike") as "bear" | "spike" | "alarm",
          tile: Number(r.payload?.tile ?? 0),
          durability: Number(r.payload?.durability ?? 3),
          level: (Number(r.payload?.level ?? 1)) as 1 | 2 | 3,
        }));
      // Dog level = max level trong dog configs (phase 3).
      const dogLevels = defs.filter((r) => r.type === "dog").map((r) => Number(r.payload?.level ?? 1));
      const dogLevel = dogLevels.length ? Math.max(...dogLevels) : 1;
      // W7b: dogs từ DefenseConfig payload {breed, tile, patrol} — không có config
      // nào thì giữ MVP 1 dog giữa. Patrol chủ validate 2-6 điểm trong bounds.
      const dogDefs = defs.filter((r) => r.type === "dog");
      // Review: strip _i ngay khi map — trước đây union với fallback [{x,y}] khiến
      // `dogs.map(({ _i, ...d }) => d)` không compile (_i không tồn trên nhánh else).
      const dogs: { x: number; y: number; breed: string; patrol?: { x: number; y: number }[] }[] = dogDefs.length
        ? dogDefs.map((r, i) => {
            const tile = Number(r.payload?.tile ?? 15 * 22 + 10);
            const rawPatrol = Array.isArray(r.payload?.patrol) ? (r.payload!.patrol as { x: number; y: number }[]) : [];
            const patrol = rawPatrol.filter(
              (pt) => Number.isInteger(pt.x) && pt.x >= 0 && pt.x < 30 && Number.isInteger(pt.y) && pt.y >= 0 && pt.y < 22,
            );
            const d = {
              x: Math.max(0, Math.min(29, tile % 30)),
              y: Math.max(0, Math.min(21, Math.floor(tile / 30))),
              breed: typeof r.payload?.breed === "string" ? r.payload.breed : "retriever",
              patrol: patrol.length >= 2 && patrol.length <= 6 ? patrol : undefined,
            };
            void i;
            return d;
          })
        : [{ x: 15, y: 10, breed: "retriever" }];
      const trapLevels = defs.filter((r) => r.type === "trap").map((r) => Number(r.payload?.level ?? 1));
      const trapLevel = trapLevels.length ? Math.max(...trapLevels) : 1;
      const room = new RaidRoom({
        terrain: farm.terrain as number[],
        enterTile: { x: 1, y: 1 },
        dogs,
        chests: LIVE_RAID_CHESTS,
        seed: j.sessionId,
        traps,
        dogLevel,
        trapLevel,
        maskId,
        mapId,
        bloodMoon: j.bloodMoon,
        guardBonus: j.guardBonus,
      });
      // W7 audit-fix (debt replay): persist DefenseConfig build lúc START vào
      // RaidSession.configSnapshot → /replay re-sim tick-exact (dogs breed/patrol,
      // traps, levels). Persist lỗi → log; /replay fallback default cho session NULL.
      const configSnapshot: RaidConfigSnapshot = {
        enterTile: { x: 1, y: 1 },
        dogs,
        chests: LIVE_RAID_CHESTS,
        traps,
        dogLevel,
        trapLevel,
      };
      const { error: snapErr } = await supabase
        .from("RaidSession")
        .update({ configSnapshot })
        .eq("id", j.sessionId);
      if (snapErr) console.error("[raid] config snapshot persist error", snapErr.message);

      const replay = new ReplayLogger();
      const state: RoomState = {
        room,
        replay,
        sessionId: j.sessionId,
        ownerId: j.ownerId!,
        thiefId: userId,
        maskId,
        mapId,
        farmId,
        bloodMoon: j.bloodMoon ?? false,
        puzzleDeadlines: new Map(),
        toolUses: new Set(),
      };
      rooms.set(farmId, state);
      state.activeWs = ws;
      // Review H3b: ws đóng trong async gap (tryJoin + farm/DefenseConfig load
      // ~5 query) — close handler thấy rooms.get undefined → return, disconnectedAt
      // không bao giờ set → reconnect rơi 409 vĩnh viễn. Sau rooms.set: ws đã
      // dead → tự set disconnectedAt + schedule abort grace.
      if (ws.readyState === 3 /* CLOSED */) {
        state.disconnectedAt = Date.now();
        state.abortTimer = setTimeout(() => {
          const cur = rooms.get(farmId);
          if (!cur || cur.room.ended || cur.finalizing) return;
          if (cur.disconnectedAt == null) return; // đã reconnect
          cur.room.ended = { reason: "timeout" };
        }, GRACE_ABORT_MS);
      }
      // Phase 9 F9.2: owner presence auto-detect → lockdown. Grace 2s debounce.
      let lastPresence: OwnerPresence = "offline";
      state.unsubPresence = subscribeOwnerPresence(supabase, j.ownerId!, (next) => {
        if (state.presenceDebounce) clearTimeout(state.presenceDebounce);
        state.presenceDebounce = setTimeout(() => {
          const cur = rooms.get(farmId);
          if (!cur || cur.room.ended) {
            lastPresence = next;
            return;
          }
          if (
            shouldTriggerAutoLockdown({
              prev: lastPresence,
              next,
              sessionActive: true,
              lockdown: cur.room.lockdown,
            })
          ) {
            triggerRoomLockdown(cur);
          }
          lastPresence = next;
        }, 2000);
      });
      ws.subscribe("room:" + farmId);
      send(ws, { t: "snapshot", snap: room.snapshot() });
    },
    message: (ws, raw) => {
      const { userId, farmId } = ws.data;
      const state = rooms.get(farmId);
      if (!state) return;
      // Review H2: bind ws → session. WS cũ từ raid TRƯỚC cùng farm (server không
      // close khi finalize xong) resolve state MỚI qua rooms.get — inject move/
      // puzzle/loot vào raid của raider khác. Chỉ thief của room hiện tại được gửi.
      if (state.thiefId !== userId) return;
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString()) as ClientMsg;
      } catch {
        return;
      }
      // Review C7: runtime validate qua pure helper (validate-msg.ts) — type
      // -1|0|1 chỉ compile-time; integer dx=10 pass destination-only solid check
      // → wall-clip teleport. chestId rác chặn deadline-Map growth + lockpick burn.
      const validChestIds = state.room.chests.map((c) => c.id);
      const validated = validateClientMsg(msg, validChestIds);
      if (!validated) {
        send(ws, { t: "error", code: "bad_msg", msg: "message bị từ chối" });
        return;
      }
      // Raid đã ended/finalizing → drop MỌI input. Trước đây move/interact-chest/
      // puzzle-input vẫn được xử lý sau khi room.ended: raider bị caught vẫn move,
      // puzzle-input solve mở chest muộn → openChest push lootTemp TRONG LÚC
      // finalizeRaid đang đọc reference đó → ghost loot commit (thief lấy loot
      // sau khi bị bắt, DB ghi thừa). exit đã có guard riêng (chặn overwrite
      // ended) — gate chung ở đây phủ nốt các case còn lại.
      if (state.room.ended || state.finalizing) return;
      switch (msg.t) {
        case "move":
          state.room.applyMove(msg.dx, msg.dy);
          state.replay.log(state.room.tickN, "move", userId, { dx: msg.dx, dy: msg.dy });
          break;
        case "use-item": {
          // W7b-P3: mồi dụ — đặt tại tile thief đang đứng (server-authoritative cap 2).
          const used = state.room.useItem(msg.itemId, state.room.raider.x, state.room.raider.y);
          if (used) {
            // Review W7 #4: log cả x,y — replay applyEvent re-apply cần vị trí mồi.
            state.replay.log(state.room.tickN, "useItem", userId, {
              itemId: msg.itemId,
              x: state.room.raider.x,
              y: state.room.raider.y,
            });
          } else {
            send(ws, { t: "error", code: "item_use_cap", msg: "chỉ đặt được 2 mồi mỗi raid" });
          }
          break;
        }
        case "exit":
          // Chỉ accept exit khi room chưa ended (caught/timeout). Trước đây exit msg
          // (gửi ngay trước khi tick N set ended=caught) overwrite → raider giữ loot dù bị bắt.
          if (!state.room.ended && !state.finalizing) {
            state.room.ended = { reason: "exit" };
            state.replay.log(state.room.tickN, "exit", userId);
          }
          break;
        case "interact-chest": {
          const chest = state.room.chests.find((c) => c.id === msg.chestId);
          const chestKind = chest?.kind ?? "wood"; // wood|iron|safe
          // W7c: mỗi chest random 1 trong 2 puzzle cùng mức (deterministic sessionId+chestId).
          const pk = chestPuzzleKind(chestKind, state.sessionId, msg.chestId);
          // Deadline theo tier (plan W7c): wood 8s / iron 12s / safe 25s.
          const deadline = Date.now() + (chestKind === "safe" ? 25000 : chestKind === "iron" ? 12000 : 8000);
          // Lưu deadline server-side để enforce (phase 2 F2.3) — anti cheat solve sau deadline.
          // Review W7 #6: chỉ GHI lần đầu — re-interact không reset timer (chặn
          // retry vô hạn đánh bại deadline; fail/thử lại vẫn ép window gốc).
          if (!state.puzzleDeadlines.has(msg.chestId)) {
            state.puzzleDeadlines.set(msg.chestId, deadline);
          }
          const puzzleSeed = state.sessionId + ":" + msg.chestId;
          if (pk === "memory") {
            const seq = state.room.getOrGenPuzzle(msg.chestId, state.sessionId, (s) => genMemorySeq(s));
            send(ws, { t: "puzzle-start", chestId: msg.chestId, kind: pk, seq, deadlineMs: deadline });
          } else if (pk === "timing") {
            const w = genTimingWindow(state.sessionId, msg.chestId);
            send(ws, { t: "puzzle-start", chestId: msg.chestId, kind: pk, deadlineMs: deadline, lo: w.lo, hi: w.hi, size: w.size });
          } else if (pk === "circuit") {
            const pz = genCircuit(puzzleSeed);
            send(ws, { t: "puzzle-start", chestId: msg.chestId, kind: pk, deadlineMs: deadline, shapes: pz.shapes, rot: pz.startRot });
          } else if (pk === "lock-rotate") {
            const pz = genLockRotate(puzzleSeed);
            send(ws, { t: "puzzle-start", chestId: msg.chestId, kind: pk, deadlineMs: deadline, offsets: pz.offsets, sizes: pz.sizes });
          } else if (pk === "jigsaw") {
            const perm = genJigsaw(puzzleSeed);
            send(ws, { t: "puzzle-start", chestId: msg.chestId, kind: pk, deadlineMs: deadline, perm });
          } else {
            const seq = genSequence(state.sessionId, msg.chestId);
            send(ws, { t: "puzzle-start", chestId: msg.chestId, kind: pk, seq, deadlineMs: deadline });
          }
          break;
        }
        case "use-tool": {
          // W7d-P2: lockpick (+2s deadline) / smoke (stagger chó 3s) — chợ đen.
          const res = applyToolUse(state.room, state.toolUses, state.puzzleDeadlines, msg.toolId, msg.chestId);
          if (res.ok) {
            state.replay.log(state.room.tickN, "useTool", userId, { toolId: msg.toolId });
            if (res.deadlineMs != null && msg.chestId) {
              send(ws, { t: "deadline-ext", chestId: msg.chestId, deadlineMs: res.deadlineMs });
            }
          } else {
            send(ws, { t: "error", code: res.error ?? "tool_fail", msg: "tool không dùng được" });
          }
          break;
        }
        case "puzzle-input": {
          const chest = state.room.chests.find((c) => c.id === msg.chestId);
          const chestKind = chest?.kind ?? "wood";
          const pk = chestPuzzleKind(chestKind, state.sessionId, msg.chestId);
          // Enforce deadline server-side (phase 2) — submit sau deadline → fail.
          // Review W7 #5: CHƯA interact-chest (dl == null) → fail luôn — 3 puzzle
          // W7c có nghiệm hằng số ([0,0,0]/rot-0/identity), không require interact
          // nghĩa là script submit ngay từ đầu raid = mở rương 0 giây.
          const dl = state.puzzleDeadlines.get(msg.chestId);
          if (dl == null) {
            state.replay.log(state.room.tickN, "puzzleFail", userId, { chestId: msg.chestId, reason: "no_puzzle_open" });
            send(ws, { t: "puzzle-result", chestId: msg.chestId, ok: false });
            break;
          }
          if (Date.now() > dl) {
            state.replay.log(state.room.tickN, "puzzleFail", userId, { chestId: msg.chestId, reason: "timeout" });
            send(ws, { t: "puzzle-result", chestId: msg.chestId, ok: false });
            break;
          }
          let ok = false;
          if (pk === "memory") {
            const seq = state.room.getOrGenPuzzle(msg.chestId, state.sessionId, (s) => genMemorySeq(s));
            ok = validateMemory(seq, msg.attempt);
          } else if (pk === "timing") {
            const w = genTimingWindow(state.sessionId, msg.chestId);
            ok = msg.attempt.length === 1 && validateTiming(w, msg.attempt[0]);
          } else if (pk === "circuit") {
            const pz = genCircuit(state.sessionId + ":" + msg.chestId);
            ok = validateCircuit(msg.attempt, pz.shapes);
          } else if (pk === "lock-rotate") {
            ok = validateLockRotate(msg.attempt);
          } else if (pk === "jigsaw") {
            ok = validateJigsaw(msg.attempt);
          } else {
            const seq = genSequence(state.sessionId, msg.chestId);
            ok = validateSequence(seq, msg.attempt);
          }
          if (ok) {
            const loot = rollLootSeeded(chestKind, state.sessionId, msg.chestId);
            // Phase 7 blood-moon: loot ×2 (lootMul=2). Áp sau roll → deterministic
            // (chỉ nhân hằng số) + replay-consistent (replay dùng event payload đã
            // ×2 persist, không re-roll). Server-authoritative — không client spoof.
            if (state.room.bloodMoon) loot.qty *= 2;
            // Review W7 #9: openChest false (rương đã mở/đã lấy) → KHÔNG báo ok kèm
            // loot ảo (client banner hiển thị đồ không được cấp).
            if (!state.room.openChest(msg.chestId, loot)) {
              state.replay.log(state.room.tickN, "puzzleFail", userId, { chestId: msg.chestId, reason: "chest_already_open" });
              send(ws, { t: "puzzle-result", chestId: msg.chestId, ok: false });
              break;
            }
            state.replay.log(state.room.tickN, "chestOpen", userId, { chestId: msg.chestId, loot });
            send(ws, { t: "puzzle-result", chestId: msg.chestId, ok: true, loot: [loot] });
          } else {
            state.replay.log(state.room.tickN, "puzzleFail", userId, { chestId: msg.chestId });
            send(ws, { t: "puzzle-result", chestId: msg.chestId, ok: false });
          }
          break;
        }
        default:
          break;
      }
    },
    close: (ws) => {
      // red-team #10: alt-F4 → grace 5s. Disconnect < GRACE_ABORT_MS → reconnect session cũ
      // (dog không reset). Sau grace mà không reconnect → abort (forfeit loot).
      const { farmId } = ws.data;
      const state = rooms.get(farmId);
      if (!state) return;
      // Reconnect đang dùng room này → chỉ unlink ws cũ, không abort.
      if (state.activeWs && state.activeWs !== ws) return;
      // room.ended/finalizing: KHÔNG schedule abort (raid đã kết thúc hoặc đang
      // finalize). Nhưng vẫn set disconnectedAt để /raid upgrade cho phép reconnect
      // poll raid-end — trước đây early-return → disconnectedAt không set → reconnect
      // rơi vào "raid busy" 409 mãi mãi cho đến khi room reaped (retry cap/watchdog).
      if (state.room.ended || state.finalizing) {
        state.disconnectedAt = Date.now();
        return;
      }
      state.disconnectedAt = Date.now();
      // Schedule abort sau grace.
      if (state.abortTimer) clearTimeout(state.abortTimer);
      state.abortTimer = setTimeout(() => {
        const cur = rooms.get(farmId);
        if (!cur || cur.room.ended || cur.finalizing) return;
        if (cur.disconnectedAt == null) return; // đã reconnect
        cur.room.ended = { reason: "timeout" };
      }, GRACE_ABORT_MS);
    },
  },
});

// Tick loop 10 Hz — advance tất cả room, snapshot 5 Hz, finalize khi ended.
let prevTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = now - prevTick;
  prevTick = now;
  for (const [farmId, state] of rooms) {
    state.room.tick(dt);
    state.replay.log(state.room.tickN, "tick", "system", { score: state.room.alert.score });
    // Flush trap spring events (phase 1) — emit trap-sprung + log replay.
    for (const ev of state.room.pendingTrapEvents) {
      const trapMsg: ServerMsg = { t: "trap-sprung", tile: ev.tile, kind: ev.kind, damage: ev.damage };
      server.publish("room:" + farmId, JSON.stringify(trapMsg));
      state.replay.log(state.room.tickN, "trapSprung", "system", ev);
    }
    state.room.pendingTrapEvents.length = 0;
    if (state.room.tickN % SNAPSHOT_EVERY_N_TICKS === 0) {
      server.publish("room:" + farmId, JSON.stringify({ t: "snapshot", snap: state.room.snapshot() } satisfies ServerMsg));
    }
    // In-flight snapshot flush Postgres mỗi 5s (red-team #10) — chống mất replay khi crash.
    if (state.room.tickN % SNAPSHOT_FLUSH_EVERY_TICKS === 0 && !state.finalizing) {
      // Review M: .catch — supabase-js v2 trả error object (không reject) nhưng
      // refactor tương lai introduce throw = unhandled rejection giết process.
      state.replay.flushIncremental(state.sessionId).catch(() => {});
    }
    if (state.room.ended && !state.finalizing) {
      state.finalizing = true;
      const reason = state.room.ended.reason;
      const replayEvents = state.replay.peek();
      state.replay.log(state.room.tickN, reason, "system");
      // Async finalize (DB transaction) — không block tick loop.
      void finalizeRaid({
        sessionId: state.sessionId,
        farmId,
        ownerId: state.ownerId,
        thiefId: state.thiefId,
        reason,
        lootTemp: state.room.lootTemp,
        replayEvents,
        lootCapBonus: state.room.maskEffect.lootCapBonus,
        lootAlreadyApplied: state.lootApplied,
      })
        .then((res) => {
          const endMsg: ServerMsg = {
            t: "raid-end",
            reason,
            keptLoot: res.keptLoot,
            maskDurabilityLoss: 1,
          };
          server.publish("room:" + farmId, JSON.stringify(endMsg));
          return state.replay.flush(state.sessionId);
        })
        .then(() => rooms.delete(farmId))
        .catch((e) => {
          // Finalize fail. Phân biệt 2 phase qua instanceof (KHÔNG string prefix):
          // - FinalizePhase1Error (BƯỚC 1 finalize_raid RPC fail): session chưa
          //   resolved, loot CHƯA chạy → KHÔNG set lootApplied (retry loot bình
          //   thường). Set flag = retry skip loot = thief mất toàn bộ loot.
          // - Error khác (BƯỚC 2 loot loop fail): loot đã chạy partial → set
          //   lootApplied chặn retry re-run (item dup). Item còn lại lost,
          //   recoverable — dup nghiêm trọng hơn lost.
          console.error("[finalize] failed — retry, KHÔNG xóa room:", e);
          if (!(e instanceof FinalizePhase1Error)) state.lootApplied = true;
          state.finalizeRetryCount = (state.finalizeRetryCount ?? 0) + 1;
          if (state.finalizeRetryCount >= FINALIZE_RETRY_MAX) {
            console.error(
              `[finalize] retry cap ${FINALIZE_RETRY_MAX} vượt — force-resolve session ${state.sessionId}`,
            );
            // finally delete room kể cả khi forceResolveStuck throw (DB down) —
            // trước đây .then() skip khi throw → room stuck finalizing=true trong
            // memory → watchdog skip (rooms.has) → farm unraidable đến restart.
            void forceResolveStuck(state, reason)
              .catch((fe) => console.error("[finalize] forceResolveStuck failed:", fe))
              .finally(() => rooms.delete(farmId));
            return;
          }
          state.finalizing = false;
        });
      // Cleanup presence subscription khi finalize (room sắp xóa).
      if (state.unsubPresence) state.unsubPresence();
      if (state.presenceDebounce) clearTimeout(state.presenceDebounce);
      if (state.abortTimer) clearTimeout(state.abortTimer);
    }
  }
}, TICK_MS);

// Watchdog: dọn session active orphan (> STALE_SESSION_MS, không có room trong memory).
setInterval(() => {
  void reapStaleSessions();
}, WATCHDOG_INTERVAL_MS);

console.log(`raid-server on :${process.env.RAID_PORT ?? 3002} (tick ${TICK_MS}ms)`);
