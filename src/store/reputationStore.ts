import { create } from "zustand";

/**
 * W7d-P1: Reputation 3 nhánh (§14) — farmer (ship/order), thief (raid), guard (phòng thủ).
 * Server-authoritative (RPC bump_reputation) — store là CACHE client cho hiệu ứng
 * (+5% giá bán farmer ≥ 50, mask tier 2 thief ≥ 50). Hydrate qua use-reputation-hydrate.
 */

interface ReputationStore {
  farmer: number;
  thief: number;
  guard: number;
  hydrated: boolean;
  setAll: (r: { farmer: number; thief: number; guard: number }) => void;
  reset: () => void;
}

export const useReputationStore = create<ReputationStore>((set) => ({
  farmer: 0,
  thief: 0,
  guard: 0,
  hydrated: false,
  setAll: ({ farmer, thief, guard }) => set({ farmer, thief, guard, hydrated: true }),
  reset: () => set({ farmer: 0, thief: 0, guard: 0, hydrated: false }),
}));
