import { useState } from "react";
import { GrainGradient, grainGradientPresets } from "@paper-design/shaders-react";
import LandingPage from "./components/LandingPage.tsx";
import WorkspaceLayout from "./components/WorkspaceLayout.tsx";

type View = "landing" | "workspace";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [workspaceVisible, setWorkspaceVisible] = useState(false);

  const enterWorkspace = () => {
    setView("workspace");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setWorkspaceVisible(true));
    });
  };

  return (
    <>
      {/*
       * GrainGradient sits at zIndex 0, covers the full viewport.
       * It mounts once and stays alive for the app's lifetime —
       * so animation is running before the user even reads the headline.
       * All page content lives in the sibling div at zIndex 1 and above.
       */}
      <GrainGradient
        {...grainGradientPresets[0]}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          width: "100vw",
          height: "100vh",
        }}
      />

      {/* All app content sits above the gradient */}
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
        {view === "landing" && <LandingPage onEnter={enterWorkspace} />}
        {view === "workspace" && <WorkspaceLayout visible={workspaceVisible} />}
      </div>
    </>
  );
}
