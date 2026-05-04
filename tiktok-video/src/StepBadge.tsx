import React from "react";
import { motion } from "framer-motion";
import { useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  number: number;
  label: string;
  startFrame: number;
}

export const StepBadge: React.FC<Props> = ({ number, label, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startFrame;
  const progress = Math.min(Math.max(elapsed / (fps * 0.4), 0), 1);
  const eased = 1 - Math.pow(1 - progress, 3);

  return (
    <motion.div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        opacity: eased,
        transform: `translateX(${(1 - eased) * -60}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: "#e8622a",
          borderRadius: "12px 0 0 12px",
          padding: "14px 22px",
          fontFamily: "'Arial Black', sans-serif",
          fontSize: 36,
          fontWeight: 900,
          color: "white",
          letterSpacing: "-0.5px",
          fontStyle: "italic",
          whiteSpace: "nowrap",
        }}
      >
        {number}.{" "}
        <span style={{ textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.4)" }}>
          {label}
        </span>
      </div>
      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "0 12px 12px 0",
          padding: "14px 28px",
          width: 180,
          height: 64,
        }}
      />
    </motion.div>
  );
};
