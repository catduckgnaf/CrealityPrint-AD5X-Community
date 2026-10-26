import { useEffect } from "react";
import "./prepare-match.css";
import "./qol.css";
import "./workspace-qol.css";
import "./advanced-tools.css";
import "./live-bend.css";
import "./direct-edit.css";
import "./label-move.css";
import "./tray-rounding.css";
import "./grouping-ux.css";
import { Toolbar } from "./components/Toolbar";
import { Palette } from "./components/Palette";
import { Viewport } from "./components/Viewport";
import { Inspector } from "./components/Inspector";
import {CommandPalette} from "./components/CommandPalette";
import {ObjectExplorer} from "./components/ObjectExplorer";
import {ProjectRecovery} from "./components/ProjectRecovery";
import {PrintabilityPanel} from "./components/PrintabilityPanel";
import {AdvancedTools} from "./components/AdvancedTools";
import {WorkshopTools} from "./components/WorkshopTools";
import {ComponentLibrary} from "./components/ComponentLibrary";
import {HingeEditor} from "./components/HingeEditor";
import {LiveBendPanel} from "./components/LiveBendControls";
import {DirectEditPanel} from "./components/DirectEditControls";
import {LabelMovePanel} from "./components/LabelMoveControls";
import {TrayRoundingPanel} from "./components/TrayRoundingControls";
import { SketchDialog } from "./components/SketchDialog";
import { SignInGate } from "./components/SignInGate";
import { useShortcuts } from "./hooks/useShortcuts";
import { useAuth } from "./state/auth";
import { startCloudSync } from "./state/cloudSync";

export default function App() {
  useShortcuts();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    useAuth.getState().init();
    return startCloudSync();
  }, []);

  // With a backend present, the workspace sits behind sign-in. Without one
  // ("offline"), the standalone tool is open as always.
  if (status === "checking") {
    return <div className="h-screen bg-neutral-100" />;
  }
  if (status === "signed-out" || status === "unreachable") {
    return <SignInGate />;
  }

  return (
    <div className="prepare-match-theme flex h-screen flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <div className="min-w-0 flex-1">
          <Viewport />
        </div>
        <Inspector />
      </div>
      <ObjectExplorer />
      <ProjectRecovery />
      <PrintabilityPanel />
      <AdvancedTools />
      <WorkshopTools />
      <ComponentLibrary />
      <HingeEditor />
      <LiveBendPanel />
      <DirectEditPanel />
      <LabelMovePanel />
      <TrayRoundingPanel />
      <SketchDialog />
      <CommandPalette />
    </div>
  );
}