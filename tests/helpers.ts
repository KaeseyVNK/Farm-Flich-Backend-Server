import { db } from "@/lib/db";

/**
 * Clean toàn bộ bảng theo thứ tự FK (test isolation).
 * Test files chia sẻ 1 docker postgres — beforeEach clean all.
 */
export async function cleanDb(): Promise<void> {
  await db.trade.deleteMany();
  await db.listing.deleteMany();
  await db.giftLog.deleteMany();
  await db.farmLike.deleteMany();
  await db.visitLog.deleteMany();
  await db.friendship.deleteMany();
  await db.bounty.deleteMany();
  await db.reputation.deleteMany();
  await db.raidEvent.deleteMany();
  await db.raidLossDaily.deleteMany();
  await db.raidSession.deleteMany();
  await db.defenseConfig.deleteMany();
  await db.mask.deleteMany();
  await db.inventory.deleteMany();
  await db.farm.deleteMany();
  await db.user.deleteMany();
}

/** Docker mock of Supabase auth.uid(). Restore to NULL in afterEach. */
export async function setAuthUid(uid: string | null): Promise<void> {
  const lit = uid == null ? "NULL::text" : `'${uid.replace(/'/g, "''")}'::text`;
  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS auth`);
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT ${lit} $$;`,
  );
}
