import "./setup-env";
import { PrismaClient } from "@prisma/client";

// Mock auth.uid() for docker postgres. Supabase has schema `auth`; plain
// postgres does not — RPC guards throw "schema auth does not exist".
// NULL uid → `NULL <> p_user` is NULL → guard does not fire (service-role).
const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS auth`);
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;`,
  );
} catch {
  // Unit suite without docker — ignore.
}
await db.$disconnect();
