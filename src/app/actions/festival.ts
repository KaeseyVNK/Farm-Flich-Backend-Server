"use server";

import { createClient } from "@/lib/supabase/server";
import {
  scoreFriendContestRows,
  type FestivalFriendRow,
} from "@/lib/game/festival/festival-friend-contest";

export type { FestivalFriendRow };

/** Contest leaderboard: bản thân + ≤10 bạn (likes hôm nay + placedDecor farm). */
export async function festivalFriendContestAction(): Promise<FestivalFriendRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.rpc("festival_friend_contest");
  if (error || data == null) return [];
  const rows = Array.isArray(data) ? data : [];
  return scoreFriendContestRows(rows);
}
