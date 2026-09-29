import { T, MAP_COLS } from "@/lib/game/constants";
import { useFarmStore } from "@/store/farmStore";

export function setFallow(x: number, y: number): void {
  const terrain = [...useFarmStore.getState().terrain];
  terrain[y * MAP_COLS + x] = T.FALLOW;
  useFarmStore.getState().hydrate({ terrain } as never);
}
