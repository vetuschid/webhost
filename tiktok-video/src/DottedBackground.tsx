import React from "react";

export const DottedBackground: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "#0d0d0d",
      backgroundImage:
        "radial-gradient(circle, #2a2a2a 1px, transparent 1px)",
      backgroundSize: "22px 22px",
    }}
  />
);
