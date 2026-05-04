import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DottedBackground } from "./DottedBackground";
import { StepBadge } from "./StepBadge";
import { Caption } from "./Caption";

const TOOLS = ["Cursor", "Windsurf", "Antigravity", "GitHub Copilot", "Kiro"];

export const Step3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardProgress = Math.min(Math.max((frame - fps * 0.3) / (fps * 0.5), 0), 1);
  const cardEased = 1 - Math.pow(1 - cardProgress, 3);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <DottedBackground />

      <div style={{ position: "absolute", top: 120, left: 30 }}>
        <StepBadge number={3} label="UI/UX pro max skill" startFrame={0} />
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
        <div
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #7c3aed 100%)",
            borderRadius: 24,
            padding: "36px",
            overflow: "hidden",
          }}
        >
          {/* Tool pills */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 32,
            }}
          >
            {TOOLS.map((tool) => (
              <div
                key={tool}
                style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderRadius: 100,
                  padding: "8px 18px",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 24,
                  color: "white",
                  backdropFilter: "blur(4px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {tool}
              </div>
            ))}
          </div>

          {/* Hero text */}
          <div
            style={{
              fontFamily: "'Arial Black', sans-serif",
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              UI UX Pro Max
            </span>
            <br />
            <span style={{ color: "white" }}>Design Intelligence</span>
          </div>

          <p
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 26,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.5,
              margin: "0 0 28px",
            }}
          >
            Searchable database of UI styles, color palettes, font pairings,
            chart types, and UX guidelines. Build beautiful interfaces with
            AI-powered design recommendations.
          </p>

          {/* Terminal */}
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 12,
              padding: "18px 22px",
              fontFamily: "monospace",
              fontSize: 28,
              color: "#f59e0b",
              marginBottom: 24,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span style={{ color: "#6b7280" }}>$ </span>
            uipro init --ai antigravity
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                backgroundColor: "#3b82f6",
                borderRadius: 12,
                padding: "18px 32px",
                fontFamily: "Arial, sans-serif",
                fontSize: 28,
                fontWeight: 700,
                color: "white",
                flex: 1,
                textAlign: "center",
              }}
            >
              How it Works
            </div>
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: "18px 32px",
                fontFamily: "Arial, sans-serif",
                fontSize: 28,
                fontWeight: 700,
                color: "white",
                flex: 1,
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              View Demos
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 220, left: 30, right: 30 }}>
        <Caption text="the UI UX Pro Max skill" startFrame={fps * 0.6} />
      </div>
    </div>
  );
};
