import { maxUprightBoxRadius } from "./boxEdges";
import { formatPicks, parsePicks, parseSinks } from "./rounding";

/** Stored box edge IDs 8-11 are the four upright edges (along Z).
 * Do not renumber: previous saved AD5X designs rely on existing IDs. */
export const UPRIGHT_BOX_EDGES = ["8", "9", "10", "11"] as const;

/** Keep horizontal rounds and hole-rim picks intact, never mutate input. */
export function withRoundedBoxCorners(
  params: Record<string, number | string>,
  radius: number,
): string {
  const d=(key:string) => typeof params[key]==="number" ? Number(params[key]) : 20;
  const max = maxUprightBoxRadius(d("w"),d("d"));
  if (!Number.isFinite(radius) || radius < 0 || (radius > 0 && radius < 0.05)) {
    throw new Error("Radius must be zero to remove, or at least 0.05 mm.");
  }
  if (radius > max) {
    throw new Error("Radius exceeds this box's safe maximum of "+max.toFixed(2)+" mm.");
  }
  const picks=parsePicks("box",params);
  const sinks=parseSinks(params);
  for (const id of UPRIGHT_BOX_EDGES) {
    if (radius===0) picks.delete(id);
    else picks.set(id,radius);
    sinks.delete(id);
  }
  return formatPicks(picks,sinks);
}
