import { describe, expect, it } from "vitest";
// @ts-ignore Vitest runs in Node
import {readFileSync} from "node:fs";
// @ts-ignore Vitest runs in Node
import {resolve} from "node:path";
declare const process: { cwd(): string };
const css=readFileSync(resolve(process.cwd(),"src/prepare-match.css"),"utf8");
import toolbar from "../components/Toolbar.tsx?raw";
import workflow from "../components/ToolbarWorkflow.tsx?raw";
describe("v18.4 native Prepare-style ribbon", () => {
  it("scopes native-style overrides to Design only", () => {
    expect(css).toContain("#root .prepare-match-theme .design-native-ribbon");
    expect(toolbar).toContain('className="design-toolbar design-native-ribbon');
  });
  it("styles square outline buttons and subtle green active states", () => {
    expect(css).toContain("border: 1px solid var(--pm-tile-border)");
    expect(css).toContain("height: 38px");
    expect(css).toContain(".design-icon-button.is-active");
    expect(css).toContain("color: #39dc72");
  });
  it("preserves visible disabled cues, dividers and popover contrast", () => {
    expect(css).toContain(".design-icon-button:disabled");
    expect(css).toContain(".toolbar-divider");
    expect(css).toContain(".design-workflow-popover");
  });
  it("keeps snap, workplane, face placement, ruler and export tools available", () => {
    for (const s of ['label="Snap to grid"', 'label="Workplane', 'label="Place on surface',
                     'label="Measure', 'label="Ruler', 'label="Export"']) {
      expect(toolbar).toContain(s);
    }
    expect(workflow).toContain("ToolbarWorkflow");
    expect(workflow).toContain("Mounting holes");
  });
  it("moves build plate settings to an icon menu without losing choices", () => {
    expect(toolbar).toContain('className="design-toolbar-settings relative"');
    expect(toolbar).toContain('label="Grid, units and build plate"');
    expect(toolbar).toContain('SETTINGS.map(({ label, node })');
    expect(toolbar).toContain('onClick={() => setMenu(menu === "grid" ? null : "grid")}');
  });
});
