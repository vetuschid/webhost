import type {Sandbox} from '@vercel/sandbox';

export type VercelSandbox = Sandbox & AsyncDisposable;

export type CreateSandboxOnProgress = (update: {
	progress: number;
	message: string;
}) => Promise<void> | void;

export type {
	AudioCodec,
	Bitrate,
	ChromeMode,
	ChromiumOptions,
	Codec,
	ColorSpace,
	FrameRange,
	LogLevel,
	OpenGlRenderer,
	PixelFormat,
	RenderMediaOnProgress,
	RenderMediaProgress,
	StillImageFormat,
	StitchingState,
	VideoImageFormat,
	X264Preset,
} from '@remotion/renderer';

import type {RenderMediaProgress} from '@remotion/renderer';

export type RenderMediaOnVercelProgress =
	| {stage: 'opening-browser'; overallProgress: number}
	| {stage: 'selecting-composition'; overallProgress: number}
	| {
			stage: 'render-progress';
			progress: RenderMediaProgress;
			overallProgress: number;
	  };

export type RenderStillOnVercelProgress =
	| {stage: 'opening-browser'; overallProgress: number}
	| {stage: 'selecting-composition'; overallProgress: number};

export type {
	HardwareAccelerationOption,
	ProResProfile,
} from '@remotion/renderer/client';

export type VercelBlobAccess = 'public' | 'private';

export type SandboxRenderMediaMessage =
	| {stage: 'opening-browser'; overallProgress: number}
	| {stage: 'selecting-composition'; overallProgress: number}
	| {
			stage: 'render-progress';
			progress: RenderMediaProgress;
			overallProgress: number;
	  }
	| {stage: 'render-complete'; overallProgress: number}
	| {stage: 'done'; size: number; contentType: string; overallProgress: number};

export type SandboxRenderStillMessage =
	| {type: 'opening-browser'}
	| {type: 'selecting-composition'}
	| {type: 'render-complete'}
	| {type: 'done'; size: number; contentType: string};
