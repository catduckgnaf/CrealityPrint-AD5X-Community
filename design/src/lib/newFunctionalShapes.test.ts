import { describe, it, expect } from "vitest";
import { buildGeometry, makeShape } from "./primitives";
import { validateProject } from "./projectFile";
import type { PrimitiveKind } from "../types/scene";

const NEW_KINDS: PrimitiveKind[] = [
  "slot", "hex-pocket", "countersink", "rounded-box", "l-bracket", "peg-mount",
];

describe("new functional shapes", () => {
  for (const kind of NEW_KINDS) {
    it(kind + ": makes printable finite 3D geometry", () => {
      const shape = makeShape(kind);
      const geometry = buildGeometry(shape);
      expect(geometry).not.toBeNull();
      const positions = geometry!.getAttribute("position");
      expect(positions.count).toBeGreaterThan(20);
      for (let i = 0; i < positions.count; i++) {
        expect(Number.isFinite(positions.getX(i))).toBe(true);
        expect(Number.isFinite(positions.getY(i))).toBe(true);
        expect(Number.isFinite(positions.getZ(i))).toBe(true);
      }
      geometry!.computeBoundingBox();
      const bounds = geometry!.boundingBox!;
      expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0);
      expect(bounds.max.x - bounds.min.x).toBeGreaterThan(0);
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0);
      geometry!.dispose();
    });
    it(kind + ": save, reopen and resize", () => {
      const shape = makeShape(kind);
      const project = validateProject({
        id: "test-project", version: 1, name: "test",
        nodes: { [shape.id]: shape }, rootOrder: [shape.id],
      });
      expect(project.nodes[shape.id]).toMatchObject({kind, role: "solid"});
      const reopened = project.nodes[shape.id];
      if ("type" in reopened) throw new Error("Expected a shape");
      const dim = Object.keys(reopened.params).find(k => typeof reopened.params[k] === "number" && !["segments", "radius"].includes(k))!;
      const edited = { ...reopened, params: {...reopened.params, [dim]: Number(reopened.params[dim]) + 2}, role: "hole" as const };
      const editedGeometry = buildGeometry(edited);
      expect(editedGeometry?.getAttribute("position")?.count).toBeGreaterThan(20);
      editedGeometry?.dispose();
    });
  }
});
