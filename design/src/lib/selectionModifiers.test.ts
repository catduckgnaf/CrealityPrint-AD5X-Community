import {describe, expect, it} from "vitest";
import {
  shouldMeasurePointer,
  shouldCruiseDrag,
  shouldIgnoreMeshSelection,
} from "./selectionModifiers";

describe("Shift-click multi-selection while other tools are active", () => {
  it("ordinary Measure click still captures a point", () => {
    expect(shouldMeasurePointer(true, false)).toBe(true);
  });
  it("Shift-click does not create a measurement point", () => {
    expect(shouldMeasurePointer(true, true)).toBe(false);
  });
  it("Shift-click reaches mesh selection in Measure mode", () => {
    expect(shouldIgnoreMeshSelection(false, true, false, true)).toBe(false);
  });
  it("ordinary clicks in Measure mode do not select shapes", () => {
    expect(shouldIgnoreMeshSelection(false, true, false, false)).toBe(true);
  });
  it("Shift-click does not begin cruise-drag", () => {
    expect(shouldCruiseDrag(true, false, true)).toBe(false);
    expect(shouldCruiseDrag(true, false, false)).toBe(true);
  });
  it("Shift-click can extend selection after a gizmo interaction", () => {
    expect(shouldIgnoreMeshSelection(false, false, true, true)).toBe(false);
    expect(shouldIgnoreMeshSelection(false, false, true, false)).toBe(true);
  });
  it("placement still wins over Shift to prevent accidental double actions", () => {
    expect(shouldIgnoreMeshSelection(true, true, false, true)).toBe(true);
  });
  it("normal and shifted clicks select when no other tool is active", () => {
    expect(shouldIgnoreMeshSelection(false, false, false, false)).toBe(false);
    expect(shouldIgnoreMeshSelection(false, false, false, true)).toBe(false);
  });
});
