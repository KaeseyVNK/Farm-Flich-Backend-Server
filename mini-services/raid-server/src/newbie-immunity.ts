/**
 * §13 newbie immunity: farm created within 3 days (server clock) cannot be raided.
 * Uses Farm.createdAt — never owner JSON. Missing/invalid timestamp fail-closed (protect).
 */
const NEWBIE_MS = 3 * 24 * 60 * 60 * 1000;

export function isFarmNewbieProtected(
  createdAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (createdAt == null || createdAt === "") return true;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
  if (!Number.isFinite(t)) return true;
  return nowMs - t < NEWBIE_MS;
}
