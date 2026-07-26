interface GrainHeroSectionProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCtaClick: () => void;
}

export default function GrainHeroSection({
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
}: GrainHeroSectionProps) {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        /* GrainGradient is mounted at App root — this section is transparent */
        background: "transparent",
      }}
    >
      {/* Content */}
      <div
        style={{
          textAlign: "center",
          padding: "0 24px",
          maxWidth: 720,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1
          role="heading"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(64px, 10vw, 120px)",
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: "-0.04em",
            lineHeight: 0.90,
            marginBottom: 28,
            color: "#ffffff",
            mixBlendMode: "difference",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(15px, 2vw, 18px)",
            color: "#ffffff",
            mixBlendMode: "difference",
            opacity: 0.85,
            maxWidth: 420,
            margin: "0 auto 48px",
            lineHeight: 1.65,
            fontWeight: 400,
          }}
        >
          {subtitle}
        </p>

        {/* Liquid-glass CTA */}
        <button
          onClick={onCtaClick}
          id="enter-workspace-btn"
          className="btn-glass"
          style={{ fontSize: 15 }}
        >
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}
