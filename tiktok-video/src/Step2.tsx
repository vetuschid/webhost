import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DottedBackground } from "./DottedBackground";
import { StepBadge } from "./StepBadge";
import { Caption } from "./Caption";

export const Step2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardProgress = Math.min(Math.max((frame - fps * 0.3) / (fps * 0.5), 0), 1);
  const cardEased = 1 - Math.pow(1 - cardProgress, 3);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <DottedBackground />

      <div style={{ position: "absolute", top: 120, left: 30 }}>
        <StepBadge number={2} label="Install Framer Motion" startFrame={0} />
      </div>

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
        {/* NPM-style card */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: 24,
            padding: "40px 36px",
            border: "1px solid #e5e7eb",
          }}
        >
          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 40,
              marginBottom: 36,
              borderBottom: "2px solid #e5e7eb",
              paddingBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 26, color: "#3b82f6", fontWeight: 700 }}>
                48 Dependents
              </div>
            </div>
            <div>
              <div style={{ fontSize: 26, color: "#6b7280" }}>
                🏷 1,381 Versions
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 28,
              color: "#374151",
              fontWeight: 600,
              marginBottom: 16,
              fontFamily: "Arial, sans-serif",
            }}
          >
            Install
          </div>

          <div
            style={{
              backgroundColor: "#111827",
              borderRadius: 12,
              padding: "20px 24px",
              fontFamily: "monospace",
              fontSize: 32,
              color: "#f9fafb",
              marginBottom: 32,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              <span style={{ color: "#6b7280" }}>&gt; </span>
              npm i framer-motion
            </span>
            <span style={{ color: "#6b7280", fontSize: 24 }}>⧉</span>
          </div>

          <div
            style={{
              fontSize: 28,
              color: "#374151",
              fontWeight: 600,
              marginBottom: 12,
              fontFamily: "Arial, sans-serif",
            }}
          >
            Repository
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#6b7280",
              fontFamily: "Arial, sans-serif",
            }}
          >
            ◆ github.com/motiondivision/motion
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 220, left: 30, right: 30 }}>
        <Caption text="Copy the command" startFrame={fps * 0.6} />
      </div>
    </div>
  );
};
