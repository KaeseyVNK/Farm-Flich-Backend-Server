"use client";

import { useEffect } from "react";
import { useReputationStore } from "@/store/reputationStore";
import { getReputationAction } from "@/app/actions/reputation";

/**
 * useReputationHydrate (W7d-P1) — kéo reputation server về cache client khi
 * GameLayout mount (1 lần). Cần session (anon OK) — chưa auth thì bỏ qua,
 * hiệu ứng rep = 0 (không bonus). Fire-and-forget, không block render.
 */
export function useReputationHydrate() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rep = await getReputationAction();
        if (!cancelled) useReputationStore.getState().setAll(rep);
      } catch {
        // chưa auth / offline — giữ default 0
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
