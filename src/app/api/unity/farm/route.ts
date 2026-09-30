import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveFarm } from "@/lib/game/farm-service";
import {
  adaptUnityFarmSave,
  adaptUnityInventory,
  adaptUnityFarmPull,
  type UnityFarmSaveDTO,
} from "@/lib/game/unity-adapter";
import { updateInventory } from "@/lib/game/wallet-service";

/**
 * Bridge: Unity client → UnityServer → farm-filch (this route).
 *
 * POST /api/unity/farm — push a Unity FarmSaveDTO save.
 *   Body: { "farmId": "<username>", "farm": FarmSaveDTO }
 *   Persists the FULL FarmSaveDTO in `Farm.unitySnapshot` (lossless round-trip)
 *   plus the adapted FarmSaveData (terrain/crops/...) for the web game.
 *
 * GET /api/unity/farm?farmId=x — pull a Unity FarmSaveDTO for login.
 *   Returns the stored `unitySnapshot` verbatim when present (Unity-authored);
 *   otherwise a best-effort FarmSaveDTO adapted from web FarmSaveData + Inventory.
 *   `hasUnitySnapshot` tells UnityServer whether the returned DTO is a real save.
 *
 * Auth: `x-bridge-token` header === BRIDGE_TOKEN (server-to-server, not Supabase).
 */
function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) return unauthorized();

  const url = new URL(req.url);
  const farmId = url.searchParams.get("farmId")?.trim().toLowerCase();
  if (!farmId) {
    return NextResponse.json({ ok: false, error: "farmId is required" }, { status: 400 });
  }

  try {
    const [user, farm] = await Promise.all([
      db.user.findUnique({ where: { id: farmId } }),
      db.farm.findUnique({ where: { ownerId: farmId } }),
    ]);
    if (!user || !farm) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // Full Unity snapshot wins (lossless round-trip from UnityServer pushes).
    const snap = farm.unitySnapshot as unknown;
    if (snap && typeof snap === "object" && (snap as { Profile?: unknown }).Profile) {
      return NextResponse.json({ ok: true, farm: snap, hasUnitySnapshot: true });
    }

    const inventory = await db.inventory.findMany({ where: { userId: farmId } });
    const dto = adaptUnityFarmPull(
      {
        ownerId: user.id,
        displayName: user.displayName,
        gold: user.gold,
        defenseXp: user.defenseXp,
        shieldUntil: farm.shieldUntil,
        terrain: farm.terrain as unknown as number[],
        crops: farm.crops as unknown as Record<string, unknown>,
      },
      inventory.map((i) => ({ itemId: i.itemId, qty: i.qty })),
    );
    return NextResponse.json({ ok: true, farm: dto, hasUnitySnapshot: false });
  } catch (err) {
    console.error("[unity-bridge] pull failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "pull failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) return unauthorized();

  let body: { farmId?: string; farm?: UnityFarmSaveDTO };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const farmId = body?.farmId?.trim().toLowerCase();
  const dto = body?.farm;
  if (!farmId || !dto || !dto.Profile?.PlayerId) {
    return NextResponse.json(
      { ok: false, error: "farmId and farm.Profile.PlayerId are required" },
      { status: 400 },
    );
  }
  // Reject mismatched ids (same rule as UnityServer's farmValidator).
  if (dto.Profile.PlayerId.trim().toLowerCase() !== farmId) {
    return NextResponse.json(
      { ok: false, error: "Profile.PlayerId does not match farmId" },
      { status: 400 },
    );
  }

  try {
    // Ensure a User + Farm row exists (race-tolerant: concurrent create-time push
    // and login push both call this — createMany skipDuplicates is idempotent).
    await db.user.createMany({
      data: [{ id: farmId, displayName: dto.Profile.PlayerName || farmId }],
      skipDuplicates: true,
    });
    await db.farm.createMany({
      data: [
        {
          ownerId: farmId,
          terrain: new Array(3600).fill(0),
          crops: {},
          objects: {},
          forage: {},
          shippingBoxes: {},
          gameMeta: {},
        },
      ],
      skipDuplicates: true,
    });

    // Cloud copies are ordered by UnityServer FarmVersion; a delayed or equal-version
    // write never replaces a newer copy. Versionless (legacy) pushes fall back to the
    // timestamp rule and never replace a versioned copy.
    const incomingVersion = Number.isSafeInteger(dto.Profile.FarmVersion) && dto.Profile.FarmVersion! > 0
      ? dto.Profile.FarmVersion!
      : 0;
    const incomingTimestamp = dto.Profile.LastSaveTimestamp ?? 0;
    const current = await db.farm.findUnique({ where: { ownerId: farmId }, select: { unitySnapshot: true } });
    const currentProfile = (current?.unitySnapshot as UnityFarmSaveDTO | null)?.Profile;
    const currentVersion = Number(currentProfile?.FarmVersion ?? 0);
    const currentTimestamp = Number(currentProfile?.LastSaveTimestamp ?? 0);
    const stale = incomingVersion > 0
      ? currentVersion >= incomingVersion
      : currentVersion > 0 || currentTimestamp > incomingTimestamp;
    if (stale) {
      return NextResponse.json({ ok: false, error: "STALE_UNITY_SNAPSHOT" }, { status: 409 });
    }

    const payload = adaptUnityFarmSave(dto);
    const version = await saveFarm(farmId, payload);

    const saved = incomingVersion > 0
      ? await db.$executeRaw`
          UPDATE "Farm" SET "unitySnapshot" = CAST(${JSON.stringify(dto)} AS jsonb)
          WHERE "ownerId" = ${farmId}
            AND COALESCE(("unitySnapshot"->'Profile'->>'FarmVersion')::bigint, 0) < ${incomingVersion}
        `
      : await db.$executeRaw`
          UPDATE "Farm" SET "unitySnapshot" = CAST(${JSON.stringify(dto)} AS jsonb)
          WHERE "ownerId" = ${farmId}
            AND ("unitySnapshot"->'Profile'->>'FarmVersion') IS NULL
            AND COALESCE(("unitySnapshot"->'Profile'->>'LastSaveTimestamp')::bigint, 0) <= ${incomingTimestamp}
        `;
    if (saved !== 1) {
      return NextResponse.json({ ok: false, error: "STALE_UNITY_SNAPSHOT" }, { status: 409 });
    }

    // Sync whitelisted inventory into the authoritative Inventory table.
    const migrated = [];
    for (const inv of adaptUnityInventory(dto)) {
      const r = await updateInventory(farmId, inv.itemId, inv.qty);
      migrated.push({ itemId: inv.itemId, qty: r.newQty });
    }

    return NextResponse.json({ ok: true, version, migratedInventory: migrated });
  } catch (err) {
    console.error("[unity-bridge] save failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "save failed" },
      { status: err instanceof Error && /locked: raid active/i.test(err.message) ? 409 : 500 },
    );
  }
}
