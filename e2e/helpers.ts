import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Shared E2E helpers.
 *
 * Game state được đọc qua window.__gameTest (test bridge gắn khi NEXT_PUBLIC_E2E=1).
 * Screenshot được lưu vào test-results/screenshots để gắn vào report.
 */

export const SHOT_DIR = "test-results/screenshots";

/** Đọc snapshot state game qua bridge (chờ bridge mount). */
export async function readGameState(page: Page) {
  await page.waitForFunction(() => {
    const w = window as unknown as { __gameTest?: unknown };
    return !!w.__gameTest;
  }, undefined, { timeout: 20_000 });
  return page.evaluate(() => {
    const api = (window as unknown as {
      __gameTest: {
        state: {
          game: () => Record<string, unknown>;
          inv: () => { slots: ({ itemId: string; qty: number } | null)[]; selectedSlot: number };
          farm: () => {
            terrain: number[];
            crops: Record<number, { cropId: string; stage: number; watered: boolean; dead: boolean }>;
            objects: Record<number, { type: string }>;
            silo: Record<string, number>;
            placedDecor: { uid: string; defId: string; zone: string; tx: number; ty: number; rot: number }[];
            decorOwned: Record<string, number>;
          };
        };
      };
    }).__gameTest;
    return {
      game: api.state.game(),
      inv: api.state.inv(),
      farm: api.state.farm(),
    };
  });
}

/** Đọc progression state (story bridge getter đã RETIRE ở W9P3 — còn xp). */
export async function readStoryProgression(page: Page) {
  await page.waitForFunction(() => {
    const w = window as unknown as { __gameTest?: unknown };
    return !!w.__gameTest;
  }, undefined, { timeout: 20_000 });
  return page.evaluate(() => {
    const api = (window as unknown as {
      __gameTest: {
        state: {
          progression: () => Record<string, unknown>;
        };
      };
    }).__gameTest;
    return {
      progression: api.state.progression(),
    };
  });
}

/** Chờ một điều kiện trên game state (poll bridge). */
export async function waitForGameState(
  page: Page,
  predicate: string,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    (pred) => {
      const api = (window as unknown as {
        __gameTest?: {
          state: {
            game: () => Record<string, unknown>;
            inv: () => { slots: ({ itemId: string; qty: number } | null)[]; selectedSlot: number };
            farm: () => Record<string, unknown>;
          };
        };
      }).__gameTest;
      if (!api) return false;
      return new Function("g", "i", "f", `return ${pred}`)(
        api.state.game(),
        api.state.inv(),
        api.state.farm(),
      );
    },
    predicate,
    { timeout },
  );
}

/** Chờ StartScreen hiện rồi click "New" cho slot, trả về page state. */
export async function startNewGame(page: Page) {
  // Review e2e-fix: Playwright mặc định Accept-Language: en-US → server render
  // " Friends" thay vì "Bạn bè" (i18n fallback header). Ghim cookie locale=vi
  // cho MỌI spec — assertions vi-text deterministic.
  await page.context().addCookies([{ name: "hh-locale", value: "vi", domain: "localhost", path: "/" }]);
  await page.goto("/");
  // StartScreen mount + saves list load. Redesign checkpoint: heading/slot button
  // đã đổi (vi "Ô lưu game" / "Mới Slot 1", en "Save slots" / "New Slot 1") —
  // match theo aria-label "... Slot 1" để robust với cả 2 locale.
  const newSlot1 = page.getByRole("button", { name: /slot 1$/i });
  await newSlot1.waitFor({ state: "visible", timeout: 20_000 });
  // Slot 1 new game button
  await newSlot1.click();
  // Bridge mount + screen fade
  await page.waitForFunction(() => {
    const w = window as unknown as { __gameTest?: unknown };
    return !!w.__gameTest;
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(400);
}

/** Screenshot helper — lưu có tên rõ ràng để gắn vào report. */
export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
}

// ---------------------------------------------------------------- visual baseline (phase 1)
//
// Deterministic readiness for visual-regression captures (verification-and-rollout-matrix
// §Deterministic fixture contract). A screenshot must NEVER be the only readiness signal:
// every capture waits for a real semantic/canvas ready marker first, then a short settle.

/**
 * Emulate prefers-reduced-motion so optional animation never produces a pixel diff. Must be
 * set BEFORE the page paints the captured surface. Call once per page context.
 */
export async function enableReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
}

/**
 * Wait for the Phaser canvas + FarmScene to be active (canvas boot complete). Pairs with
 * startNewGame: after the bridge mounts, the scene still needs one tick to register the
 * canvas. This is the deterministic canvas-ready marker — not a blind timeout.
 */
export async function waitForFarmCanvasReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        __game?: { scene?: { keys?: Record<string, unknown> } };
      };
      const game = w.__game;
      if (!game?.scene?.keys) return false;
      const farm = game.scene.keys["FarmScene"];
      // FarmScene present + canvas element exists.
      const canvas = document.querySelector("canvas");
      return !!farm && !!canvas;
    },
    undefined,
    { timeout },
  );
  // Short settle for the first paint after the ready marker (not a readiness substitute).
  await page.waitForTimeout(400);
}

/**
 * Deterministic Day-1 farm setup for visual captures: reduced motion + new game + canvas
 * ready + store hydration confirmed via the test bridge. Returns once the farm-day surface
 * is stable and ready to screenshot.
 */
export async function setupDay1FarmForCapture(page: Page): Promise<void> {
  await enableReducedMotion(page);
  await startNewGame(page);
  // Store hydration: bridge exposes inv/farm with real slot data.
  await waitForGameState(page, "i.slots.length > 0 && Object.keys(f).length > 0");
  await waitForFarmCanvasReady(page);
}

// ---------------------------------------------------------------- auth

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Base64url encode (chuẩn Supabase storage key). */
function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/** Tạo user e2e qua admin API (service role) → trả về session. */
export async function e2eSession(): Promise<{
  accessToken: string;
  refreshToken: string;
  uid: string;
}> {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com`;
  const password = "E2e-test-123!";
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName: "e2e-user" },
  });
  if (createErr) throw createErr;

  const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error("no session");
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    uid: session.user!.id,
  };
}

/** Cookie auth-token chuẩn @supabase/ssr — prefix `base64-` + base64url JSON. */
export function authCookie(accessToken: string, refreshToken: string) {
  const ref = (SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
  const uid = extractUid(accessToken);
  const value =
    "base64-" +
    b64url(
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: {
          app_metadata: { provider: "email" },
          aud: "authenticated",
          confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          id: uid,
          role: "authenticated",
          updated_at: new Date().toISOString(),
        },
      }),
    );
  return { name: `sb-${ref}-auth-token`, value, domain: "localhost", path: "/" };
}

function extractUid(accessToken: string): string {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
    );
    return String(payload.sub ?? "e2e-uid");
  } catch {
    return "e2e-uid";
  }
}

// ---------------------------------------------------------------- raid seed

/** Tạo map terrain 660 tiles (30×22) — chủ yếu grass, có đường. */
export function makeTerrain(): number[] {
  const terrain = new Array(660).fill(0); // GRASS
  // Đường giữa (PATH=2) hàng 10
  for (let x = 0; x < 30; x++) terrain[10 * 30 + x] = 2;
  return terrain;
}

/**
 * Seed một farm mục tiêu cho raid E2E (service role):
 * - User row (owner) nếu chưa có
 * - Farm row (shield expired, dailyRaidCount 0)
 * Trả về farmId.
 */
export async function seedRaidTargetFarm(): Promise<{ ownerId: string; farmId: string }> {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `raid-owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com`;
  const password = "E2e-test-123!";
  const { data: user, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName: "raid-owner" },
  });
  if (createErr) throw createErr;
  const ownerId = user!.user!.id;

  // User row (trigger handle_new_user tạo khi auth create — nhưng chờ sync; upsert thủ công an toàn).
  await admin.from("User").upsert(
    { id: ownerId, displayName: "raid-owner", gold: 0 },
    { onConflict: "id" },
  );

  // Farm — shield expired, dailyRaidCount 0, terrain đủ 660.
  const { data: farm, error: fErr } = await admin
    .from("Farm")
    .insert({
      id: crypto.randomUUID(),
      ownerId,
      terrain: makeTerrain(),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      gameMeta: {},
      version: 0,
      updatedAt: new Date().toISOString(),
      shieldUntil: new Date(Date.now() - 60_000).toISOString(), // expired
      dailyRaidCount: 0,
      dailyRaidResetAt: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (fErr) throw fErr;
  return { ownerId, farmId: farm!.id };
}

/**
 * Seed mask equipped cho user (thief) — service role insert/upsert Mask.
 * Trả về maskId.
 */
export async function seedMaskForUser(
  userId: string,
  maskId = "rogue",
  durability = 10,
): Promise<string> {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Đảm bảo User row tồn tại (trigger async).
  await admin.from("User").upsert(
    { id: userId, displayName: "e2e-thief", gold: 1000 },
    { onConflict: "id" },
  );
  const { error } = await admin.from("Mask").upsert(
    { id: crypto.randomUUID(), userId, maskId, durability, equipped: true },
    { onConflict: "userId,maskId" },
  );
  if (error) throw error;
  return maskId;
}

/** Cookie `sb-access-token` — raid-server WS auth (JWT token raw). */
export function accessTokenCookie(accessToken: string) {
  return { name: "sb-access-token", value: accessToken, domain: "localhost", path: "/" };
}

/**
 * Cleanup dữ liệu E2E raid/replay (service role) — tránh lobby tích lũy farm
 * làm chậm presence check (mỗi farm 2.5s timeout). Xóa theo pattern owner displayName
 * mà test đặt: 'raid-owner', 'replay-owner', 'replay-thief', 'e2e-*'.
 */
export async function cleanupRaidTestData(): Promise<void> {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lấy các farm của e2e owners (displayName có prefix test)
  const { data: owners } = await admin
    .from("User")
    .select("id")
    .or("displayName.like.raid-%,displayName.like.replay-%,displayName.like.e2e-%");
  const ownerIds = (owners ?? []).map((o: { id: string }) => o.id);
  if (ownerIds.length === 0) return;

  // Xóa theo thứ tự: RaidSession (RESTRICT trên farm), Farm, Mask.
  // KHÔNG xóa User (có thể bị FK RESTRICT khác — Inventory/Listing/GiftLog); để lại.
  for (const oid of ownerIds) {
    const { data: farms } = await admin.from("Farm").select("id").eq("ownerId", oid);
    const farmIds = (farms ?? []).map((f: { id: string }) => f.id);
    for (const fid of farmIds) {
      // Xóa RaidSession (RESTRICT trên farm) — events cascade
      await admin.from("RaidSession").delete().eq("farmId", fid);
    }
    await admin.from("Farm").delete().eq("ownerId", oid);
    await admin.from("Mask").delete().eq("userId", oid);
  }
}

// ---------------------------------------------------------------- replay seed

/**
 * Seed một RaidSession resolved + RaidEvents cho replay E2E.
 * Viewer = user truyền vào (được set làm thiefId — authz cho phép thief xem).
 * Trả về sessionId + viewerSession.
 */
export async function seedReplaySession(viewer: {
  uid: string;
}): Promise<{
  sessionId: string;
  ownerId: string;
}> {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Owner user riêng (không phải viewer)
  const ownerEmail = `replay-owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@gmail.com`;
  const { data: ownerData, error: ownerErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: "E2e-test-123!",
    email_confirm: true,
    user_metadata: { displayName: "replay-owner" },
  });
  if (ownerErr) throw ownerErr;
  const ownerId = ownerData!.user!.id;
  await admin.from("User").upsert(
    { id: ownerId, displayName: "replay-owner", gold: 0 },
    { onConflict: "id" },
  );
  await admin.from("User").upsert(
    { id: viewer.uid, displayName: "replay-thief", gold: 0 },
    { onConflict: "id" },
  );

  // Farm row (owner) — cung cấp id + updatedAt (Supabase REST không tự sinh)
  const { data: farm, error: fErr } = await admin
    .from("Farm")
    .insert({
      id: crypto.randomUUID(),
      ownerId,
      terrain: makeTerrain(),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      gameMeta: {},
      version: 0,
      updatedAt: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (fErr) throw fErr;

  // RaidSession resolved — viewer là thief (cung cấp id)
  const { data: session, error: sErr } = await admin
    .from("RaidSession")
    .insert({
      id: crypto.randomUUID(),
      farmId: farm!.id,
      ownerId,
      thiefId: viewer.uid,
      status: "resolved",
      mapId: "farm",
      thiefMaskId: "rogue",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      resultJson: { reason: "exit", keptLoot: [] },
    })
    .select("id")
    .single();
  if (sErr) throw sErr;

  // RaidEvents (timeline) — cung cấp id
  const events = [
    { tick: 1, seq: 0, type: "move", actorId: viewer.uid, payload: { dx: 1, dy: 0 } },
    { tick: 2, seq: 0, type: "move", actorId: viewer.uid, payload: { dx: 0, dy: 1 } },
    { tick: 10, seq: 0, type: "chestOpen", actorId: viewer.uid, payload: { chestId: "chest-wood-1", loot: { itemId: "wood", qty: 3 } } },
    { tick: 20, seq: 0, type: "exit", actorId: viewer.uid, payload: {} },
  ].map((e) => ({ ...e, id: crypto.randomUUID() }));
  const { error: evErr } = await admin
    .from("RaidEvent")
    .insert(events.map((e) => ({ ...e, sessionId: session!.id })));
  if (evErr) throw evErr;

  return { sessionId: session!.id, ownerId };
}

/**
 * Tạo user mới (email/password) + trả về full session qua sign-in.
 * Dùng chung cho replay viewer.
 */
export async function e2eUserWithSession(name: string): Promise<{
  uid: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}> {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `e2e-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@gmail.com`;
  const password = "E2e-test-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName: name },
  });
  if (error) throw error;
  const uid = data!.user!.id;
  await admin.from("User").upsert(
    { id: uid, displayName: name, gold: 0 },
    { onConflict: "id" },
  );

  const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: s, error: sErr } = await sb.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return {
    uid,
    email,
    accessToken: s!.session!.access_token,
    refreshToken: s!.session!.refresh_token,
  };
}
