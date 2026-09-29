# Masked Farm — Tài liệu API server

Tài liệu này mô tả **toàn bộ bề mặt API** mà client hoặc dịch vụ khác được phép dùng: raid-server (HTTP + WebSocket), Next.js (Route Handler + Server Actions), Postgres RPC (Supabase), và kênh Realtime.

Nguồn sự thật trong code:

| Lớp | File gốc |
|---|---|
| Protocol WS | `mini-services/raid-server/src/protocol.ts` |
| HTTP + WS runtime | `mini-services/raid-server/src/index.ts` |
| Validate client message | `mini-services/raid-server/src/validate-msg.ts` |
| Join gate | `mini-services/raid-server/src/join.ts` |
| Auth cookie | `mini-services/raid-server/src/auth.ts` |
| Server Actions | `src/app/actions/*.ts` |
| RPC SQL | `prisma/migrations/*.sql` |
| Client WS | `src/lib/raid/ws-client.ts` |

---

## 1. Tổng quan kiến trúc

```
Browser
  │  cookie session (@supabase/ssr)
  ├─► Next.js :3000
  │     • Server Actions (farm, mask, market, friends, …)
  │     • GET /auth/callback
  │     • GET /api/cron/marketplace-expire
  │
  ├─► raid-server bun :3001
  │     • GET  /healthz
  │     • GET  /raid?farmId=…           (upgrade WebSocket)
  │     • POST /lockdown?farmId=…
  │     • GET  /replay?sessionId=…
  │     • WS   JSON { t: "…" }  10 Hz tick / 5 Hz snapshot
  │
  └─► Supabase
        • Auth + Realtime presence
        • Postgres RPC security-definer (một phần client-callable)
        • raid-server gọi RPC bằng service_role (server-only)
```

**Nguyên tắc authority**

| Dữ liệu | Ai được ghi |
|---|---|
| Inventory raid-loot | **Server** (`steal_with_loss_cap` + `add_inventory`) |
| Gold gameplay (kiếm trong farm) | **Local-first** (Zustand). Cloud `User.gold` chỉ là sink (bounty/craft/market) |
| Farm JSONB (terrain/crops/objects/…) | Client qua `saveFarmAction`, trừ khi raid đang `active` |
| Mask durability, shield, daily raid cap | **Server** (`finalize_raid`) |
| Snapshot raid, loot roll, puzzle, trap | **raid-server** — client chỉ gửi intent |

---

## 2. Base URL và biến môi trường

| Biến | Mặc định local | Dùng cho |
|---|---|---|
| `NEXT_PUBLIC_RAID_WS_URL` | `ws://localhost:3001/raid` | Browser mở WebSocket |
| `NEXT_PUBLIC_RAID_HTTP_URL` | `http://localhost:3001` | Browser `POST /lockdown`; Next.js `GET /replay` |
| `RAID_PORT` | `3001` | raid-server listen |
| `RAID_HTTP_URL` | `http://localhost:3001` | Server Action replay (server-side fetch) |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Auth + Realtime + PostgREST |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | — | Client + Next.js SSR |
| `SUPABASE_URL` | — | raid-server |
| `SUPABASE_PUBLIC_KEY` | — | raid-server verify JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | — | raid-server + Prisma service role — **không** prefix `NEXT_PUBLIC_` |
| `CRON_SECRET` | optional | Guard cron marketplace |

Chạy cả hai process:

```bash
npm run dev:all
# web :3000 + raid-server :3001
```

---

## 3. Xác thực

### 3.1 Next.js / Server Actions / Supabase

Session do `@supabase/ssr` giữ trong cookie chunked kiểu `sb-<project-ref>-auth-token`. Mọi Server Action lấy `user.id` từ `supabase.auth.getUser()` — **không** nhận `userId` từ client.

OAuth Google:

```
GET /auth/callback?code=<pkce>&next=/
```

- Đổi `code` → session.
- `next` chỉ chấp nhận path tương đối bắt đầu `/`, không `//`, không `@`.
- Thành công: redirect `/login?migrate=1` (nếu `next` là `/`) để hydrate + migrate local→cloud.
- Lỗi: `/login?error=auth`.

### 3.2 raid-server

Mọi HTTP/WS của raid-server đọc cookie **`sb-access-token`** (JWT raw), rồi `supabase.auth.getUser(token)`.

- **Không** tin JWT trong payload message.
- **Không** tin `userId` / `maskId` client gửi.
- Browser localhost gửi cookie tới cả `:3000` và `:3001`. App production phải set thêm cookie `sb-access-token` (cùng domain) nếu cookie SSR không dùng tên này — e2e set cả hai.

Gửi cookie:

```
Cookie: sb-access-token=<access_token>
```

WS: cookie đi kèm handshake (browser tự gửi). Không nhúng JWT trong JSON.

### 3.3 RPC Postgres

Hầu hết RPC client-callable kiểm `auth.uid()::text = p_user`. RPC **server-only** (`finalize_raid`, `steal_with_loss_cap` thực thi từ raid-server, `bump_reputation` REVOKE authenticated) từ chối caller có `auth.uid()` hoặc không GRANT cho `authenticated`.

---

## 4. raid-server — HTTP

Base: `http://localhost:3001` (hoặc `NEXT_PUBLIC_RAID_HTTP_URL`).

### 4.1 `GET /healthz`

Không auth.

| | |
|---|---|
| Response | `200` body `ok` (text/plain) |

```bash
curl -s http://localhost:3001/healthz
# ok
```

### 4.2 `GET /raid?farmId=&mapId=` — nâng cấp WebSocket

Auth: cookie `sb-access-token`.

| Query | Bắt buộc | Mô tả |
|---|---|---|
| `farmId` | có | UUID farm nạn nhân |
| `mapId` | không | biome, mặc định `"farm"` |

`maskId` **không** lấy từ URL. Server resolve từ `Mask` `equipped=true` lúc join.

| Status | Ý nghĩa |
|---|---|
| `101` | Upgrade WS thành công |
| `400` | Thiếu `farmId` |
| `401` | Không cookie / JWT invalid |
| `409` | Farm đang có raid (`raid busy`) — trừ reconnect trong grace |
| `500` | Upgrade thất bại |

**Reconnect (Alt-F4):** nếu room còn trong memory, cùng `thiefId`, và (`now - disconnectedAt < 5000ms` **hoặc** raid đã `ended`/`finalizing`) → upgrade lại, **không** tạo session mới, chó không reset.

Nếu farm đã có room của người khác → `409`.

Sau khi upgrade, join DB chạy trong `websocket.open` (xem §5).

```javascript
const ws = new WebSocket(
  `ws://localhost:3001/raid?farmId=${farmId}&mapId=farm`,
);
// Browser tự đính cookie. Node cần header Cookie.
```

Node (không browser):

```bash
# Handshake thủ công cần header Upgrade; khuyến nghị dùng thư viện ws:
# new WebSocket(url, { headers: { Cookie: "sb-access-token=..." } })
```

### 4.3 `POST /lockdown?farmId=`

Chủ farm quay về khi đang bị raid. Idempotent.

Auth: cookie, **phải là `ownerId` của room đang chạy**.

| Status | Body |
|---|---|
| `200` | `ok` |
| `400` | `missing farmId` |
| `401` | `unauthorized` |
| `404` | `no active raid` (không có room, hoặc không phải owner) |

Hiệu ứng: `lockdown=true`, `gateCloseTick = tickN + 200` (20s @ 10Hz), alert +50, broadcast `{ t: "lockdown", gateCloseTick }`.

Auto-lockdown cũng xảy ra khi presence owner `away|offline` → `playing` (debounce 2s) — không cần gọi HTTP.

```bash
curl -X POST \
  -H "Cookie: sb-access-token=$TOKEN" \
  "http://localhost:3001/lockdown?farmId=$FARM_ID"
```

Browser (credentials):

```javascript
await fetch(
  `${process.env.NEXT_PUBLIC_RAID_HTTP_URL}/lockdown?farmId=${farmId}`,
  { method: "POST", credentials: "include" },
);
```

### 4.4 `GET /replay?sessionId=`

Auth: cookie. **Chỉ owner** farm của session (thief bị `403`).

| Status | Body |
|---|---|
| `200` | `{ "snaps": SnapshotMsg[] }` |
| `400` | `missing sessionId` |
| `401` | `unauthorized` |
| `403` | `forbidden` |
| `404` | `not found` |

Load tối đa **25_000** `RaidEvent`, re-sim headless. Session cũ không có `configSnapshot` fallback default.

App Next.js không gọi endpoint này trực tiếp từ browser: `loadReplayAction` fetch server-side và **forward cookie**. Owner nhận `snaps`; thief chỉ nhận timeline events.

```bash
curl -s \
  -H "Cookie: sb-access-token=$TOKEN" \
  "http://localhost:3001/replay?sessionId=$SESSION_ID"
```

### 4.5 Path khác

`404` `not found`.

---

## 5. raid-server — WebSocket protocol

Sau `101`, mọi frame là JSON UTF-8, discriminated union theo field `t`.

**Không gửi** `{ t: "join" }` trên WS. Type này còn trong `protocol.ts` nhưng `validateClientMsg` **reject**. Join = handshake `/raid` + `tryJoin` trong `open`.

### 5.1 Vòng đời một raid

```
GET /raid?farmId=…          → 101
open()
  tryJoin (DB gates)
  fail  → { t:"error", code } + close
  ok    → rooms.set + { t:"snapshot" }
message loop (intent)
tick 10Hz, snapshot 5Hz
ended (exit|caught|timeout)
  finalize_raid RPC + loot
  { t:"raid-end", … }
  room xóa
close
  grace 5s → reconnect được
  hết grace → ended timeout (forfeit loot)
```

### 5.2 Join gates (`tryJoin`)

Thứ tự. Fail → `{ t: "error", code: <reason>, msg: "join rejected" }` rồi đóng socket.

| `code` | Điều kiện |
|---|---|
| `rate_limited` | > 5 lần join / 30s / user (in-memory) |
| `farm_not_found` | Farm không tồn tại |
| `own_farm` | Tự raid farm mình |
| `shield_active` | `Farm.shieldUntil > now` |
| `daily_cap` | `dailyRaidCount` đạt 3 trong cửa sổ 24h |
| `farm_newbie` | Farm `createdAt` trong 3 ngày (thiếu timestamp = protect) |
| `owner_playing` | Presence `farm-status:<ownerId>` = `playing` |
| `no_mask` | Không có mask equipped hoặc `durability <= 0` |
| `raid_busy_or_error` | INSERT `RaidSession` fail (đã có active, unique index) |
| `farm_missing` | Farm biến mất sau join (hiếm) |

Mask **server-resolved** từ row `equipped=true`. Blood-moon: `hash(ownerId + YYYYMMDD_UTC) % 7 === 0` (~1/7 ngày). Guard bonus: `Reputation.guard >= 50` → dog vision +1 tile.

### 5.3 Client → Server

Mọi message phải parse JSON. Invalid → `{ t: "error", code: "bad_msg", msg: "message bị từ chối" }`. Raid đã `ended`/`finalizing` → **drop toàn bộ input** (không báo). Chỉ `thiefId` của room được gửi.

#### `move`

```json
{ "t": "move", "dx": 0, "dy": -1 }
```

| Field | Type | Rule |
|---|---|---|
| `dx`, `dy` | integer | ∈ {-1, 0, 1} |

Di chuyển 1 tile / message theo hướng. Tile solid (`WATER`, `TREE`, `ROCK`, `FENCE`, `FLOWER_BUSH`) chặn. Map 30×22, tọa độ tile (không pixel).

#### `interact-chest`

```json
{ "t": "interact-chest", "chestId": "chest-wood-1" }
```

`chestId` phải thuộc room. Lần đầu mở puzzle: ghi deadline, gửi `puzzle-start`. **Re-interact không reset timer.**

Rương cố định:

| id | Tile | Loại | Deadline | Puzzle (1 trong 2, deterministic) |
|---|---|---|---|---|
| `chest-wood-1` | (20,10) | wood | 8s | `memory` \| `circuit` |
| `chest-iron-1` | (8,10) | iron | 12s | `timing` \| `lock-rotate` |
| `chest-safe-1` | (24,16) | safe | 25s | `sequence` \| `jigsaw` |

Kind chọn bằng `hash(sessionId + ":" + chestId)`, client không chọn được.

#### `puzzle-input`

```json
{ "t": "puzzle-input", "chestId": "chest-wood-1", "attempt": [0, 2, 1] }
```

| Field | Rule |
|---|---|
| `chestId` | Rương thật |
| `attempt` | Mảng integer, length ≤ 64 |

Phải `interact-chest` trước. Submit khi chưa mở puzzle → fail (`no_puzzle_open`). Sau deadline → fail. Đúng + rương chưa mở → roll loot (blood-moon ×2 qty) + `puzzle-result` ok. Rương đã mở → fail.

**Format `attempt` theo kind:**

| Kind | `attempt` | Thắng khi |
|---|---|---|
| `memory` | 3 số ∈ [0,3] | Khớp `seq` server gửi |
| `circuit` | 16 số rotation 0–3 (lưới 4×4 row-major) | BFS nối (0,0)→(3,3) |
| `timing` | `[idx]` một số | `lo ≤ idx ≤ hi` |
| `lock-rotate` | 3 số (vòng size 4/6/8) | Mỗi vòng `offset % size === 0` |
| `sequence` | 4 số ∈ [0,3] | Khớp `seq` |
| `jigsaw` | 16 số perm | Identity `[0,1,…,15]` |

#### `use-item` — mồi dụ chó

```json
{ "t": "use-item", "itemId": "tool_toy" }
```

| Field | Rule |
|---|---|
| `itemId` | string, 1–40 ký tự |

Server đặt mồi tại **tile thief đang đứng**. Tối đa **2 mồi / raid**. Fail → `{ t:"error", code:"item_use_cap" }`. Chó không `lureImmune` (giống Mãn miễn) ăn mồi gần nhất: `tool_toy` bận 100 tick (10s), item khác 60 tick (6s). Mồi xuất hiện trong snapshot `placedItems` (công khai).

#### `use-tool` — chợ đen, 1 lần / tool / raid

```json
{ "t": "use-tool", "toolId": "lockpick", "chestId": "chest-iron-1" }
{ "t": "use-tool", "toolId": "smoke" }
```

| `toolId` | Cần `chestId` | Hiệu ứng |
|---|---|---|
| `lockpick` | có, puzzle đang mở | Deadline +2000ms → `deadline-ext` |
| `smoke` | không | Mọi chó stagger 30 tick (3s) |

Lỗi: `tool_unknown` \| `tool_used` \| `tool_no_chest` \| `tool_no_puzzle` → `{ t:"error", code, msg:"tool không dùng được" }`.

#### `exit`

```json
{ "t": "exit" }
```

Kết thúc raid với `reason: "exit"` **chỉ khi chưa ended**. Exit sau caught bị bỏ — không overwrite để giữ loot.

### 5.4 Server → Client

#### `snapshot` — 5 Hz (`tickN % 2 === 0`) + 1 lần lúc open/reconnect

```json
{
  "t": "snapshot",
  "snap": {
    "tick": 42,
    "you": { "id": "raider", "x": 1, "y": 1, "dx": 0, "dy": 0, "facing": "down" },
    "dogs": [{ "id": "dog-0", "x": 15, "y": 10, "dx": 0, "dy": -1, "facing": "up" }],
    "chests": [
      { "id": "chest-wood-1", "x": 20, "y": 10, "open": false }
    ],
    "alert": { "level": "stealth", "score": 0 },
    "lockdown": false,
    "mapBiome": "farm",
    "exitDeadlineMs": 0,
    "bloodMoon": false,
    "placedItems": []
  }
}
```

**Không** chứa trap. Trap chỉ lộ khi `trap-sprung`. `dx,dy` phục vụ interpolation client.

Alert:

| `level` | `score` |
|---|---|
| `stealth` | < 25 |
| `caution` | 25–59 (cảnh báo 60, alarm 80) |
| `alarm` | ≥ 80 |

Decay 5/s sau 4s không kích.

#### `alert-level`

```json
{ "t": "alert-level", "level": "caution", "score": 30, "reason": "reconnect" }
```

Gửi lúc reconnect. Không ghi đè `snapshot.alert`.

#### `puzzle-start`

```json
{
  "t": "puzzle-start",
  "chestId": "chest-wood-1",
  "kind": "memory",
  "seq": [0, 2, 1],
  "deadlineMs": 1720000008000
}
```

`deadlineMs` = epoch ms. Field tùy kind:

| Kind | Extra fields |
|---|---|
| `memory` | `seq: number[]` |
| `timing` | `lo`, `hi`, `size` (bar 10, window 3) |
| `sequence` | `seq` |
| `circuit` | `shapes: number[16]`, `rot: number[16]` (start rotation) |
| `lock-rotate` | `offsets: number[3]`, `sizes: [4,6,8]` |
| `jigsaw` | `perm: number[16]` |

#### `puzzle-result`

```json
{
  "t": "puzzle-result",
  "chestId": "chest-wood-1",
  "ok": true,
  "loot": [{ "itemId": "wood", "qty": 4 }]
}
```

Fail: `ok: false`, không `loot`. Loot **tạm** trên server (`lootTemp`); chỉ commit DB nếu `exit` thành công và qua loss-cap.

Bảng loot (server-only, weighted):

| Chest | Item (weight) | qty |
|---|---|---|
| wood | wood 60, stone 30, coin_pouch 10 | 3–6 / 1–3 / 1–2 |
| iron | iron 50, gold_ore 30, gem 20 | 2–5 / 1–3 / 1–2 |
| safe | gold_bar 40, gem 35, ket_ruby 25 | 1–3 / 2–4 / 1 |

`ket_*` **không** bị steal lúc finalize (0% steal). Blood-moon nhân `qty × 2`.

#### `trap-sprung`

```json
{ "t": "trap-sprung", "tile": 140, "kind": "spike", "damage": 20 }
```

| `kind` | Effect | `damage` (= alert bump) |
|---|---|---|
| `bear` | Raider slow 20 tick (skip 50% move) | 0 |
| `spike` | Alert +20, durability −1 | 20 |
| `alarm` | Alert +40, durability −1 | 40 |

Trap ẩn đến khi dẫm. Cap 6 / farm. Durability hết → xóa.

#### `lockdown`

```json
{ "t": "lockdown", "gateCloseTick": 520 }
```

Cổng đóng khi `tickN >= gateCloseTick`. Chó chase ×1.4.

#### `deadline-ext`

```json
{ "t": "deadline-ext", "chestId": "chest-iron-1", "deadlineMs": 1720000010000 }
```

Sau lockpick thành công.

#### `raid-end`

```json
{
  "t": "raid-end",
  "reason": "exit",
  "keptLoot": [{ "itemId": "wood", "qty": 1 }],
  "maskDurabilityLoss": 1
}
```

| `reason` | Loot giữ | Reputation |
|---|---|---|
| `exit` | Có, sau loss-cap 10%/raid 25%/ngày (bandit +10% / bandit2 +11.5%) | thief +3 |
| `caught` | `keptLoot: []` (3 bite cùng tile chó) | thief −2, owner guard +2 |
| `timeout` | `[]` (idle 21000 tick ≈ 35 phút, hoặc disconnect hết grace 5s) | thief −1, owner guard +1 |

Mask durability luôn −1 khi finalize thành công. Shield farm sau raid: **2 giờ**.

#### `error`

```json
{ "t": "error", "code": "bad_msg", "msg": "message bị từ chối" }
```

Xem bảng join + `bad_msg` / `item_use_cap` / tool codes.

### 5.5 Tick, disconnect, finalize

| Hằng | Giá trị |
|---|---|
| Tick | 10 Hz (100ms) |
| Snapshot | 5 Hz |
| Replay flush Postgres | mỗi 50 tick (5s) |
| Disconnect grace | 5s |
| Client stuck-grace (WS drop) | 8s rồi tự `timeout` local |
| Max raid | 21_000 tick |
| Finalize retry | 5 lần rồi force-resolve empty loot |
| Watchdog stale session | active > 40 phút, không còn room → force-resolve |

Chỉ `exit` chạy vòng loot: mỗi item `steal_with_loss_cap` (lock Inventory + RaidLossDaily) rồi `add_inventory` cho thief.

### 5.6 Ví dụ client tối thiểu

```javascript
const ws = new WebSocket(`ws://localhost:3001/raid?farmId=${farmId}&mapId=farm`);

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.t) {
    case "snapshot": /* render msg.snap */ break;
    case "puzzle-start": /* hiện UI, lưu deadlineMs */ break;
    case "puzzle-result": /* banner loot */ break;
    case "trap-sprung": /* FX */ break;
    case "lockdown": /* đếm gateCloseTick */ break;
    case "raid-end": /* đóng overlay, hiện keptLoot */ break;
    case "error": /* toast msg.code */ break;
  }
};

function send(obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

send({ t: "move", dx: 1, dy: 0 });
send({ t: "interact-chest", chestId: "chest-wood-1" });
send({ t: "puzzle-input", chestId: "chest-wood-1", attempt: [0, 2, 1] });
send({ t: "use-tool", toolId: "smoke" });
send({ t: "exit" });
```

Trong app, dùng `RaidWsClient` (`src/lib/raid/ws-client.ts`) — reconnect đúng 1 lần, không simulate vật lý phía client.

---

## 6. Next.js — HTTP routes

Base: origin web (`http://localhost:3000`).

### 6.1 `GET /api`

```json
{ "message": "Hello, world!" }
```

Không auth. Placeholder.

### 6.2 `GET /api/cron/marketplace-expire`

Job hết hạn listing + refund inventory (`expire_listing`, mặc định 100 dòng / lần).

Nếu `CRON_SECRET` set:

```
Authorization: Bearer <CRON_SECRET>
```

| Status | Body |
|---|---|
| `200` | `{ ok: true, expired: number }` |
| `401` | `{ error: "unauthorized" }` |

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/marketplace-expire
```

### 6.3 `GET /auth/callback`

Xem §3.1.

---

## 7. Next.js — Server Actions

Đây là API mutation chính của web. Gọi từ Client Component:

```ts
"use client";
import { saveFarmAction } from "@/app/actions/farm";

const { version } = await saveFarmAction(data);
```

Next.js serialize thành `POST` nội bộ (header `Next-Action`). **Không** thiết kế như REST công khai; luôn gọi qua import action. Mọi action (trừ vài read public) yêu cầu session — thiếu thì `throw "unauthorized: chưa đăng nhập"` hoặc `{ ok: false, error: "unauthorized" }`.

Quy ước trả về mutation: `{ ok: boolean, error?: string }`. Lỗi RPC đã sanitize (`safeRpcError`) — không leak SQL.

### 7.1 Farm — `src/app/actions/farm.ts`

#### `saveFarmAction(data: FarmSaveData): Promise<{ version: number }>`

Ghi JSONB farm. **Reject** nếu có `RaidSession` status=`active` (`farm locked: raid active`) — transaction `FOR UPDATE`.

```ts
interface FarmSaveData {
  terrain: number[];          // length phải 660 (30×22)
  crops: Record<string, unknown>;
  objects: Record<string, unknown>;
  forage: Record<string, unknown>;
  shippingBoxes: Record<string, unknown>;
  gameMeta: Record<string, unknown>; // PHI-GOLD — không nhét gold
  placedDecor?: unknown[];    // cap 200, defId whitelist catalog
  pondFish?: unknown[];
}
```

Gold **không** được save qua đây. `placedDecor` lọc `defId` lạ, cắt 200.

#### `loadFarmAction()`

Trả row `Farm` của user (Prisma), hoặc `null`.

#### `migrateFarmAction(local: LocalSave | null): Promise<boolean>`

Migrate local→cloud **một lần**, idempotent.

### 7.2 Wallet (read-only) — `src/app/actions/wallet.ts`

Không có mutation gold/inventory qua action (đã xóa vì mint exploit).

| Action | Trả | Ghi chú |
|---|---|---|
| `fetchGold()` | `number` | Cloud sink. Chưa auth / lỗi → **`-1`** (fail-open UX; RPC vẫn chặn) |
| `fetchInventoryQty(itemId)` | `number` | |

Trước sink (craft/bounty): `fetchGold()` kiểm đủ vàng cloud → RPC → client trừ local.

### 7.3 Mask — `src/app/actions/mask.ts`

#### `craftMaskAction(maskId)`

RPC `craft_mask`. Recipe từ catalog:

| maskId | gold | ingredients | durability |
|---|---|---|---|
| `rogue` | 100 | wood×10 | 10 |
| `phantom` | 200 | fiber×10, sap×3 | 10 |
| `bandit` | 200 | stone×12 | 10 |
| `scout` | 150 | wood×5, fiber×8 | 10 |

Đã sở hữu → không trừ (idempotent). `p_user` phải = `auth.uid()`.

#### `equipMaskAction(maskId)`

Phải đang sở hữu. RPC `equip_mask` — đúng 1 mask `equipped=true` trong 1 tx.

#### `loadMasksAction()`

`{ maskId, durability, equipped }[]`

#### `buyBlackMaskAction(maskId)`

Tier 2: `rogue2` 1200g, `phantom2` 1000g, `bandit2`, `scout2` (durability 20). Cần **thief reputation ≥ 50**. Gọi `craft_mask` với `ingredients {}`.

### 7.4 Defense — `src/app/actions/defense.ts`

#### `upsertTrapAction(slot, payload)`

| Field | Rule |
|---|---|
| `slot` | integer 0–5 |
| `payload.kind` | `bear` \| `spike` \| `alarm` |
| `payload.tile` | 0 … 659 |
| `payload.durability` | 1–5 (mặc định 3) |
| `payload.level` | 1 \| 2 \| 3 |

RPC `upsert_trap`, cap **6 trap**.

#### `deleteTrapAction(slot)` — slot 0–5.

#### `listTrapsAction()` → `{ slot, kind, tile, durability, level }[]`

#### `spendDefenseXpAction(target, slot, level)`

| | |
|---|---|
| `target` | `dog` \| `fence` \| `trap` |
| `level` | 1–3, phải **cao hơn** level hiện tại |
| Cost | `level * 50` Defense XP |

RPC `spend_defense_xp`.

#### `saveDogAction(payload)`

Slot cố định **10**, type `dog`.

```ts
{
  breed: "retriever" | "hound" | "shepherd" | "corgi" | "maan",
  tile: number,           // 0..659
  level: 1 | 2 | 3,
  patrol?: { x: number; y: number }[]  // 2–6 điểm, x∈[0,30), y∈[0,22)
}
```

#### `loadDogAction()` → payload hoặc `null` (room fallback 1 retriever giữa map).

### 7.5 Marketplace — `src/app/actions/marketplace.ts`

Giá listing phải trong band **±60%** giá NPC:

| itemId | NPC | floor | ceiling |
|---|---|---|---|
| wood | 5 | 2 | 8 |
| stone | 8 | 4 | 13 |
| iron | 15 | 6 | 24 |
| cloth | 12 | 5 | 20 |
| gem | 50 | 20 | 80 |
| gold_ore | 30 | 12 | 48 |
| parsnip | 35 | 14 | 56 |
| potato | 80 | 32 | 128 |
| tomato | 60 | 24 | 96 |
| khác | 10 | 4 | 16 |

Cap **20** listing active / user. TTL **7 ngày**. Mua phí **5%** gold sink (`floor(total/20)`). Không tự mua.

| Action | Args | RPC / query |
|---|---|---|
| `listItemAction(itemId, qty, priceUnit)` | qty > 0, item tồn tại catalog | `create_listing` |
| `buyAction(listingId, qty)` | qty > 0 | `marketplace_buy` |
| `cancelListingAction(listingId)` | refund inventory | `cancel_listing` |
| `browseAction(itemId?)` | public, sort `priceUnit` asc | table `Listing` |
| `myListingsAction()` | 50 mới nhất của mình | table `Listing` |

### 7.6 Friends & visit — `src/app/actions/friends.ts`

Cặp bạn canonical `userAId < userBId`.

| Action | Chi tiết |
|---|---|
| `sendRequestAction(toId)` | Upsert `pending`. Không tự kết. Không regress `accepted` → pending |
| `acceptRequestAction(friendId)` | Chỉ **receiver** (`initiatorId ≠ self`), status pending |
| `declineRequestAction(friendId)` | Xóa row Friendship |
| `listFriendsAction()` | `{ id, displayName }[]` qua view `user_public` |
| `giftItemAction(toId, itemId, qty)` | RPC `gift_item`. Cap 5 gift / cặp / ngày. Chặn prefix `tool_`, `quest_`, `ket_`, `gold` |
| `visitFriendAction(friendId)` | Rate 10/phút. RPC `visit_friend_farm`. Chỉ keys an toàn: terrain, crops, objects, forage, placedDecor, pondFish — **không** Inventory/gold/energy |
| `likeFarmAction(farmOwnerId)` | 1 like / user / farm / ngày UTC, friend-only |
| `sendStickerAction(farmOwnerId, stickerId)` | Rate 10/phút. Sticker: `heart, star, laugh, gift, flower, sun, moon, fish, cat, dog, party, thumb` |
| `writeGuestbookAction(farmOwnerId, message)` | ≤200 ký tự sanitize, 3 tin/phút |
| `getVisitSocialAction(farmOwnerId)` | likes, likedByMe, guestbook 10 |
| `listVisitorsAction()` | Chủ farm, poll 30s: likes, visits, sticker tally, guestbook |

### 7.7 Bounty — `src/app/actions/bounty.ts`

Gold cloud trừ **ngay** khi treo (không escrow).

| Action | Rule |
|---|---|
| `topThievesAction()` | RPC `top_thieves_7d` — public |
| `loadBountiesAction()` | 50 bounty `active`, sort gold desc |
| `placeBountyAction(thiefId, gold)` | gold integer **50–5000**, không tự treo, không trùng active cùng thief |
| `cancelBountyAction(bountyId)` | Hoàn đủ gold |
| `revengeTargetsAction()` | Display-only: thief đã `winner=thief` trên farm mình trong 7 ngày |

Khi thief **caught**, `finalize_raid` gọi `payout_bounties_on_catch` (server-only) — chủ bounty nhận vàng.

### 7.8 Reputation — `src/app/actions/reputation.ts`

| Action | |
|---|---|
| `getReputationAction()` | `{ farmer, thief, guard }` — thiếu row → 0/0/0 |
| `bumpFarmerAction(delta)` | RPC `bump_farmer_reputation`, clamp delta 1–5. Fire-and-forget (offline không chặn chơi) |

Thief/guard **chỉ** bump trong `finalize_raid`. Threshold 50:

- farmer ≥ 50 → +5% giá bán (client perk)
- thief ≥ 50 → mở mask tier 2
- guard ≥ 50 → dog vision +1 (raid-server)

### 7.9 Replay — `src/app/actions/replay.ts`

```ts
loadReplayAction(sessionId):
  | { events: ReplayEventDto[]; reason: string | null; snaps?: RaidSnapshot[] }
  | { error: "unauthorized" | "not_found" | "forbidden" }
```

Chỉ owner hoặc thief. Owner thêm `snaps` từ raid-server `/replay` (forward cookie). Raid-server offline → timeline-only.

`ReplayEventDto`: `{ tick, seq, type, actorId }` (`type`: move, chestOpen, puzzleFail, useItem, useTool, trapSprung, lockdown, exit, tick, …).

### 7.10 Village chat — `src/app/actions/village-chat.ts`

`sendVillageChatAction(msg)`: trim, 1–500 ký tự, rate **10 tin/phút** (DB `check_rate_window`). Insert `VillageChat`.

### 7.11 Festival — `src/app/actions/festival.ts`

`festivalFriendContestAction()`: RPC `festival_friend_contest` — bản thân + ≤10 bạn, likes hôm nay UTC + `placedDecor`. Scoring decor phía client. Chưa auth → `[]`.

---

## 8. Postgres RPC (Supabase `/rest/v1/rpc/<name>`)

Gọi từ browser chỉ khi GRANT `authenticated` **và** có auth guard. App **nên** đi qua Server Actions, không POST PostgREST trực tiếp — trừ read public.

Base: `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/<fn>`

```
Authorization: Bearer <access_token>
apikey: <publishable_key>
Content-Type: application/json
```

### 8.1 Client-callable (authenticated)

| RPC | Args | Trả | Guard |
|---|---|---|---|
| `craft_mask` | `p_user, p_mask, p_gold_cost, p_durability_cap, p_ingredients` | void | uid = p_user |
| `equip_mask` | `p_user, p_mask` | void | uid = p_user |
| `spend_defense_xp` | `p_user, p_target, p_slot, p_level` | void | uid; level 1–3; cost level×50 |
| `upsert_trap` | `p_user, p_slot, p_payload` | void | uid; cap 6 |
| `create_listing` | `p_seller, p_item, p_qty, p_price, p_expires` | listing id | uid; price band; cap 20 |
| `marketplace_buy` | `p_buyer, p_listing, p_qty` | void | uid; fee 5%; không self-buy |
| `cancel_listing` | `p_listing, p_user` | void | uid = seller |
| `gift_item` | `p_from, p_to, p_item, p_qty` | void | uid = from; friends; 5/ngày |
| `place_bounty` | `p_owner, p_thief, p_gold` | bounty id | uid; 50–5000 |
| `cancel_bounty` | `p_owner, p_bounty_id` | void | uid |
| `top_thieves_7d` | — | jsonb array | public authenticated |
| `list_raidable_farms` | — | rows | uid not null; exclude self; shield hết; limit 20 |
| `visit_friend_farm` | `p_owner` | jsonb farm an toàn | friends accepted |
| `festival_friend_contest` | — | jsonb | uid |
| `bump_farmer_reputation` | `p_user, p_delta` | void | farmer only, clamp |

`list_raidable_farms` **không** kiểm presence — lobby client subscribe `farm-status:<ownerId>` để lọc `playing`. Join WS mới authoritative.

Ví dụ:

```bash
curl -s "$SUPABASE_URL/rest/v1/rpc/list_raidable_farms" \
  -H "Authorization: Bearer $ACCESS" \
  -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Trả:

```json
[
  {
    "id": "farm_…",
    "ownerId": "uuid",
    "shieldUntil": null,
    "dailyRaidCount": 0,
    "displayName": "Ada"
  }
]
```

### 8.2 Server-only — **cấm** gọi từ client

| RPC | Caller | Lý do |
|---|---|---|
| `finalize_raid` | raid-server service_role | `auth.uid() IS NOT NULL` → RAISE `finalize_raid: server-only` |
| `steal_with_loss_cap` | raid-server | Trừ inventory nạn nhân + cap 10%/25% |
| `add_inventory` / `deduct_inventory` | RPC khác + service_role | `anon` đã REVOKE. `authenticated` vẫn GRANT — **không** gọi trực tiếp (IDOR mint). App không export action |
| `bump_reputation` | chỉ `finalize_raid` | REVOKE authenticated/anon |
| `expire_listing` | cron Server Action / Prisma | Sweep + refund |
| `payout_bounties_on_catch` | trong `finalize_raid` | |

`finalize_raid` args (tham khảo, không gọi):

```
p_session, p_farm, p_owner, p_thief, p_mask,
p_shield_until, p_defense_xp, p_reason, p_result jsonb,
p_daily_cap, p_defense_xp_daily_cap (default 100)
```

Idempotent: `UPDATE … WHERE status='active'`; 0 row → exception.

---

## 9. Supabase Realtime (không phải REST, bắt buộc cho raid)

Client tạo channel sau khi login (`src/lib/supabase/client.ts`).

| Channel | Loại | Payload | Ai dùng |
|---|---|---|---|
| `farm-status:<ownerId>` | Presence, key = ownerId | `{ ownerId, status: "playing"\|"away"\|"offline", ts }` | Owner heartbeat 30s; lobby + raid-server join/lockdown |
| `owner-raid:<userId>` | postgres_changes INSERT `RaidSession` filter `ownerId=eq.<id>` | row mới | Toast + `POST /lockdown` nếu đang chơi farm |
| `village:default` | Presence | online village | `src/lib/social/village-presence.ts` |
| `village-chat` | postgres / broadcast chat | tin nhắn | `/village` |

Presence **hint**, không phải gate DB. Heartbeat 30s, coi offline ~60s.

Track status:

```javascript
const ch = supabase.channel(`farm-status:${ownerId}`, {
  config: { presence: { key: ownerId } },
});
await ch.subscribe();
await ch.track({ ownerId, status: "playing", ts: Date.now() });
```

---

## 10. Hằng số vận hành (raid)

| Tên | Giá trị |
|---|---|
| Map | 30 × 22 = 660 tiles, tile 48px (render only) |
| Entry raider | (1,1) |
| Daily raid / farm | 3 / 24h |
| Shield after raid | 2h |
| Shield newbie farm | 3 ngày immunity join (`farm_newbie`) + shield 24h concept |
| Max bites → caught | 3 |
| Lockdown close | 200 tick = 20s |
| Join rate | 5 / 30s / user |
| Gift | 5 / cặp / ngày |
| Listing | 20 active, TTL 7 ngày, fee 5% |
| Trap | 6, slot 0–5 |
| Dog config slot | 10 |
| Decor save cap | 200 |
| Chat | 500 ký tự, 10/phút |
| Guestbook | 200 ký tự, 3/phút |
| Visit | 10/phút |
| Defense XP daily grant | 100 |
| Bounty | 50–5000 gold |

Mask effects (server `mask-effects.ts`):

| maskId | speed | alert decay | loot cap | dog vision |
|---|---|---|---|---|
| rogue | ×1.2 | ×1 | +0 | ×1 |
| phantom | ×1 | ×1.5 | +0 | ×1 |
| bandit | ×1 | ×1 | +10% | ×1 |
| scout | ×1 | ×1 | +0 | ×0.75 |
| rogue2 | ×1.38 | ×1 | +0 | ×1 |
| phantom2 | ×1 | ×1.725 | +0 | ×1 |
| bandit2 | ×1 | ×1 | +11.5% | ×1 |
| scout2 | ×1 | ×1 | +0 | ×0.8625 |

---

## 11. Mã lỗi gom

### HTTP raid-server

`400 missing farmId/sessionId` · `401 unauthorized` · `403 forbidden` · `404` · `409 raid busy` · `500 upgrade failed`

### WS `error.code`

`rate_limited` · `farm_not_found` · `own_farm` · `shield_active` · `daily_cap` · `farm_newbie` · `owner_playing` · `no_mask` · `raid_busy_or_error` · `farm_missing` · `bad_msg` · `item_use_cap` · `tool_unknown` · `tool_used` · `tool_no_chest` · `tool_no_puzzle` · `tool_fail`

### Server Action / RPC (string `error`)

Ví dụ: `recipe không tồn tại`, `mask không tồn tại`, `slot trap 0-5`, `price ngoài band ±60% NPC`, `cap 20 listing`, `item không gift được`, `rate-limited: quá 10 tin/phút`, `Cần 50 danh tiếng Trộm…`, `farm locked: raid active`.

RPC Postgres `ERRCODE`: `insufficient_privilege`, `check_violation`, `foreign_key_violation`.

---

## 12. Luồng tích hợp khuyến nghị

1. Login OAuth → cookie SSR (+ set `sb-access-token` nếu gọi raid-server).
2. `loadFarmAction` / `migrateFarmAction`.
3. `craftMaskAction` + `equipMaskAction` trước khi raid.
4. `list_raidable_farms` + đọc presence → chọn farm `away|offline`, shield hết.
5. `new RaidWsClient(farmId).connect()`.
6. Gửi `move` / `interact-chest` / `puzzle-input` / `use-item` / `use-tool`.
7. `exit` để giữ loot (sau loss-cap) hoặc bị `caught`/`timeout`.
8. Owner: `useFarmStatus("playing")` chặn join; `useOwnerRaidNotify` → `POST /lockdown`.
9. `loadReplayAction(sessionId)` sau raid.

---

## 13. Những gì không phải API công khai

- Không POST `changeGold` / mint inventory.
- Không gửi JWT trong JSON WS.
- Không gửi `maskId` trên URL `/raid`.
- Không tin snapshot client; trap không có trong snapshot.
- Không gọi `finalize_raid` / `steal_with_loss_cap` từ browser.
- `GET /api` không liên quan gameplay.
- Edge Functions: **không dùng** (banned trong README).

Cập nhật tài liệu này khi đổi `protocol.ts`, `index.ts` fetch paths, hoặc GRANT/REVOKE RPC.
