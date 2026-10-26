import * as THREE from "three";
import type { SpacingAxis } from "./spacing";

export interface ArrangeItem { id: string; box: THREE.Box3 }

/** With two objects, leave the first selected fixed.
 * With 3+ objects, the largest XY footprint is most likely the base. */
export function chooseFixed(items: readonly ArrangeItem[]): string | null {
  if (!items.length) return null;
  if (items.length === 2) return items[0].id;
  return [...items].sort((a, b) => {
    const area = (x: ArrangeItem) => Math.max(0, x.box.max.x - x.box.min.x)
      * Math.max(0, x.box.max.y - x.box.min.y);
    return area(b) - area(a);
  })[0].id;
}

/** Guess whether users arranged the moving items left/right or front/back.
 * This is only a UI default; they can always choose the other direction. */
export function chooseAxis(items: readonly ArrangeItem[], referenceId: string): SpacingAxis {
  const ref = items.find(x => x.id === referenceId);
  const others = items.filter(x => x.id !== referenceId);
  if (!ref || !others.length) return 0;
  const center = (b: THREE.Box3) => b.getCenter(new THREE.Vector3());
  if (others.length === 1) {
    const a = center(ref.box), b = center(others[0].box);
    return Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? 1 : 0;
  }
  const c = others.map(x => center(x.box));
  const spanX = Math.max(...c.map(v => v.x)) - Math.min(...c.map(v => v.x));
  const spanY = Math.max(...c.map(v => v.y)) - Math.min(...c.map(v => v.y));
  return spanY > spanX ? 1 : 0;
}
