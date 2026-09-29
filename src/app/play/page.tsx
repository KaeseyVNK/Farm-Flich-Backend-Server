import { redirect } from "next/navigation";

/**
 * Entry anonymous → game (Masked Farm).
 * Audit H2: route `/play` từng thiếu. Chốt mapping: `/` là entry game chính
 * (render GameLayout + useAnonAuth signInAnonymously), `/play` là alias rõ ràng
 * redirect về `/` — proxy không cần biết `/play`, tránh 2 entry mơ hồ.
 */
export default function PlayPage() {
  redirect("/");
}
