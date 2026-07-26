import { useState } from "react";
import GrainHeroSection from "./ui/grain-gradient-hero-section.tsx";

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    setExiting(true);
    // 500ms gives the fade-out time to play before the workspace mounts
    setTimeout(onEnter, 500);
  };

  return (
    <div
      style={{
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.5s ease",
        position: "relative",
        zIndex: 1,
      }}
    >
      <GrainHeroSection
        title="Lumina"
        subtitle="A private workspace for deep thinking — powered by the world's fastest AI models."
        ctaLabel="Get Started"
        onCtaClick={handleEnter}
      />
    </div>
  );
}
