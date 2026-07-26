import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import AnimatedGradient from "./ui/animated-gradient.tsx";

interface LandingPageProps {
  onEnter: () => void;
}

/*
 * Soft, relaxing gradient config — pale lavender / icy sky / warm white.
 * Very low distortion and gentle swirl so the motion is barely perceptible.
 */
const GRADIENT_CONFIG = {
  preset: "custom" as const,
  color1: "#E8EEFF",   // pale lavender-white
  color2: "#D4E9F7",   // icy sky blue
  color3: "#EEE8F5",   // soft lilac
  rotation: -20,
  proportion: 45,
  scale: 0.18,
  speed: 10,           // very slow
  distortion: 1,       // almost none
  swirl: 22,
  swirlIterations: 6,
  softness: 100,
  offset: 0,
  shape: "Checks" as const,
  shapeSize: 35,
};

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(onEnter, 420);
  };

  return (
    <div
      className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ opacity: exiting ? 0 : 1, transition: "opacity 0.42s ease" }}
    >
      {/* WebGL animated background */}
      <AnimatedGradient
        config={GRADIENT_CONFIG}
        noise={{ opacity: 0.06, scale: 0.8 }}
      />

      {/* Subtle radial vignette over the gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, rgba(230,235,250,0.25) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-slide px-6 text-center">
        {/* Logo mark */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "rgba(255,255,255,0.55)",
            border: "1.5px solid rgba(200,212,240,0.65)",
            boxShadow: "0 4px 24px rgba(120,130,180,0.14), inset 0 1px 0 rgba(255,255,255,0.8)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={28} style={{ color: "hsl(234, 55%, 60%)" }} strokeWidth={1.6} />
        </div>

        {/* Wordmark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <h1
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(40px, 7vw, 72px)",
              fontWeight: 300,
              letterSpacing: "-0.03em",
              color: "hsl(225, 25%, 18%)",
              lineHeight: 1.05,
            }}
          >
            Lumina
          </h1>
          <p
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(14px, 2vw, 17px)",
              fontWeight: 400,
              color: "hsl(225, 15%, 48%)",
              letterSpacing: "0.01em",
              maxWidth: 340,
              lineHeight: 1.6,
            }}
          >
            A quiet workspace for thinking with AI.
          </p>
        </div>

        {/* Liquid-glass CTA */}
        <button
          id="enter-workspace-btn"
          className="btn-glass"
          onClick={handleEnter}
          style={{ marginTop: 8 }}
        >
          <span>Enter Workspace</span>
          <ArrowRight size={16} strokeWidth={1.8} />
        </button>

        {/* Fine print */}
        <p
          style={{
            fontSize: 12,
            color: "hsl(225, 12%, 62%)",
            letterSpacing: "0.01em",
          }}
        >
          Offline · Groq · Gemini
        </p>
      </div>
    </div>
  );
}
