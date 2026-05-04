import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  text: string;
  startFrame: number;
}

export const Caption: React.FC<Props> = ({ text, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startFrame;
  const progress = Math.min(Math.max(elapsed / (fps * 0.3), 0), 1);
  const eased = 1 - Math.pow(1 - progress, 3);

  return (
    <div
      style={{
        backgroundColor: "rgba(20,20,20,0.92)",
        borderRadius: 10,
        padding: "18px 28px",
        opacity: eased,
        transform: `translateY(${(1 - eased) * 20}px)`,
      }}
    >
      <span
        style={{
          fontFamily: "'Arial Black', sans-serif",
          fontSize: 42,
          fontWeight: 900,
          color: "white",
          letterSpacing: "-0.5px",
        }}
      >
        {text}
      </span>
    </div>
  );
};
