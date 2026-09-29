// Loaded first from tests/setup.ts so Prisma never picks up .env Supabase URL.
const LOCAL_TEST_DB = "postgresql://postgres:test@localhost:5433/hgpp";
process.env.DATABASE_URL = LOCAL_TEST_DB;
process.env.DIRECT_URL = LOCAL_TEST_DB;
