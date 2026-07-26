import { useState } from "react";
import LandingPage from "./components/LandingPage.tsx";
import WorkspaceLayout from "./components/WorkspaceLayout.tsx";

type View = "landing" | "workspace";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [workspaceVisible, setWorkspaceVisible] = useState(false);

  const enterWorkspace = () => {
    setView("workspace");
    // Small delay so workspace mounts before the opacity transition starts
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setWorkspaceVisible(true));
    });
  };

  return (
    <>
      {view === "landing" && <LandingPage onEnter={enterWorkspace} />}
      {view === "workspace" && <WorkspaceLayout visible={workspaceVisible} />}
    </>
  );
}
