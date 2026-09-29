/**
 * Finalize phase-1 error — tách khỏi finalize.ts để test import KHÔNG kéo theo
 * module side-effect (supabase createClient cần env). Trước đây finalize-logic
 * test import `FinalizePhase1Error` từ finalize.ts → evaluate supabase client →
 * `supabaseUrl is required` khi chạy test không có env.
 */
export class FinalizePhase1Error extends Error {
  constructor(cause: unknown) {
    super(`finalize_raid RPC failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "FinalizePhase1Error";
  }
}
