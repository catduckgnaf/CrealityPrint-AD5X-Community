import {describe,expect,it} from "vitest";
import menu from "../components/SmartContextMenu.tsx?raw";
import advanced from "../components/AdvancedTools.tsx?raw";
import boxFit from "../components/BoxFitTools.tsx?raw";
import tray from "../components/TrayRoundingControls.tsx?raw";

describe("v19.5.2 contextual hollow box actions",()=>{
  it("offers rounding and dividers only on recognized editable hollow shells",()=>{
    expect(menu).toContain("identifyShell(only.id, project)");
    expect(menu).toContain('id:"dividers",label:"Dividers"');
    expect(menu).toContain('id:"organizers",label:"Organizers, lids & bins"');
    expect(menu).not.toContain('label="Add  ›"');
    expect(menu).toContain("{showShellTools && <>");
    expect(menu).toContain("resemblesHollowBox(project,only.id)");
    expect(menu).toContain("shellReason&&");
    expect(menu).toContain('label="Dividers..." disabled={!canShell}');
    expect(menu).toContain('label="Corners & floor..." disabled={!canTrayRound}');
    expect(menu).toContain('label="Dividers..."');
    expect(menu).toContain('label="Matching lid..."');
    expect(menu).toContain("canRoundTray(only.id, project)");
    expect(menu).toContain('new Event("ad5x-tray-round")');
    expect(tray).toContain('window.addEventListener("ad5x-tray-round",launch)');
  });
  it("opens existing Box & Fit tab on exactly the requested subpage",()=>{
    expect(menu).toContain('run={openBoxTool("Dividers")}');
    expect(menu).toContain('run={openBoxTool("Lids")}');
    expect(menu).toContain('run={openBoxTool("Labels")}');
    expect(menu).toContain('new CustomEvent("ad5x-open-boxfit", {detail: {page}})');
    expect(advanced).toContain('window.addEventListener("ad5x-open-boxfit",openBoxFit)');
    expect(advanced).toContain('setTool("Box & Fit")');
    expect(advanced).toContain('<BoxFitTools key={boxFitPage} initialPage={boxFitPage} />');
    expect(boxFit).toContain('useState<Page>(initialPage)');
  });
  it("offers shell wall labels while preserving safe group editing",()=>{
    expect(menu).toContain("const canLid =");
    expect(menu).toContain("identifyLid(only.id)");
    expect(menu).toContain('disabled={!canLabel}');
    expect(menu).toContain('label="Edit / move dividers..."');
    expect(menu).toContain("findDividerEditTarget(useScene.getState().project,only!.id)");
    expect(menu).toContain('label="Edit Inside (keep cuts)"');
    expect(menu).toContain('label="Ungroup"');
    expect(menu).toContain("isGroup(only) && !only.locked");
  });
});