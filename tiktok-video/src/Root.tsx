import React from "react";
import { Composition, Series } from "remotion";
import { Step1 } from "./Step1";
import { Step2 } from "./Step2";
import { Step3 } from "./Step3";

const FPS = 30;
const STEP_DURATION = FPS * 4; // 4 seconds per step

const TikTokVideo: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={STEP_DURATION}>
      <Step1 />
    </Series.Sequence>
    <Series.Sequence durationInFrames={STEP_DURATION}>
      <Step2 />
    </Series.Sequence>
    <Series.Sequence durationInFrames={STEP_DURATION}>
      <Step3 />
    </Series.Sequence>
  </Series>
);

export const RemotionRoot: React.FC = () => (
  <Composition
    id="TikTokTutorial"
    component={TikTokVideo}
    durationInFrames={STEP_DURATION * 3}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
