import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DottedBackground } from "./DottedBackground";
import { StepBadge } from "./StepBadge";
import { Caption } from "./Caption";

export const Step1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardProgress = Math.min(Math.max((frame - fps * 0.3) / (fps * 0.5), 0), 1);
  const cardEased = 1 - Math.pow(1 - cardProgress, 3);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <DottedBackground />

      {/* Step badge top-left */}
      <div style={{ position: "absolute", top: 120, left: 30 }}>
        <StepBadge number={1} label="Install Remotion" startFrame={0} />
      </div>

      {/* Content card */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 30,
          right: 30,
          opacity: cardEased,
          transform: `translateY(${(1 - cardEased) * 40}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: "#111827",
            borderRadius: 24,
            padding: "40px 36px",
            border: "1px solid #1f2937",
          }}
        >
          {/* Terminal block */}
          <div
            style={{
              backgroundColor: "#0d0d0d",
              borderRadius: 12,
              padding: "20px 24px",
              fontFamily: "monospace",
              fontSize: 32,
              color: "#f59e0b",
              marginBottom: 32,
              border: "1px solid #1f2937",
            }}
          >
            <span style={{ color: "#6b7280" }}>$ </span>
            npm create video@latest
          </div>

          <div
            style={{
              backgroundColor: "#0d0d0d",
              borderRadius: 12,
              padding: "20px 24px",
              fontFamily: "monospace",
              fontSize: 32,
              color: "#f59e0b",
              marginBottom: 32,
              border: "1px solid #1f2937",
            }}
          >
            <span style={{ color: "#6b7280" }}>$ </span>
            npm i framer-motion
          </div>

          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 30,
              color: "#9ca3af",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Scaffold your Remotion project and install Framer Motion for
            smooth, physics-based animations.
          </p>
        </div>
      </div>

      {/* Caption */}
      <div style={{ position: "absolute", bottom: 220, left: 30, right: 30 }}>
        <Caption text="Set up your project" startFrame={fps * 0.6} />
      </div>
    </div>
  );
};
