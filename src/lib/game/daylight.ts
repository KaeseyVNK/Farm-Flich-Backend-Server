import { DAY_END_HOUR, DAY_START_HOUR } from "./constants";

/** Remaining daylight 0–100. Morning is full; forced-sleep (2 AM) is empty. */
export function daylightRemainingPct(minutes: number): number {
  const start = DAY_START_HOUR * 60;
  const span = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const used = Math.min(span, Math.max(0, minutes - start));
  return Math.round(((span - used) / span) * 100);
}
