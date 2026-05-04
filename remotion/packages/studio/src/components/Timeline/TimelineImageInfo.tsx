import React, {useEffect, useRef} from 'react';
import {getTimelineLayerHeight} from '../../helpers/timeline-layout';

const HEIGHT = getTimelineLayerHeight('image') - 2;

const containerStyle: React.CSSProperties = {
	height: HEIGHT,
	width: '100%',
	backgroundColor: 'rgba(0, 0, 0, 0.3)',
	display: 'flex',
	borderTopLeftRadius: 2,
	borderBottomLeftRadius: 2,
};

export const TimelineImageInfo: React.FC<{
	readonly src: string;
	readonly visualizationWidth: number;
}> = ({src, visualizationWidth}) => {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const {current} = ref;
		if (!current) {
			return;
		}

		const canvas = document.createElement('canvas');
		canvas.width = visualizationWidth * window.devicePixelRatio;
		canvas.height = HEIGHT * window.devicePixelRatio;
		canvas.style.width = visualizationWidth + 'px';
		canvas.style.height = HEIGHT + 'px';
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}

		current.appendChild(canvas);

		const img = new Image();
		img.crossOrigin = 'anonymous';

		img.onload = () => {
			const scale = (HEIGHT * window.devicePixelRatio) / img.naturalHeight;
			const scaledWidth = img.naturalWidth * scale;
			const scaledHeight = HEIGHT * window.devicePixelRatio;

			const offscreen = document.createElement('canvas');
			offscreen.width = scaledWidth;
			offscreen.height = scaledHeight;
			const offCtx = offscreen.getContext('2d');
			if (!offCtx) {
				return;
			}

			offCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

			const pattern = ctx.createPattern(offscreen, 'repeat-x');
			if (!pattern) {
				return;
			}

			ctx.fillStyle = pattern;
			ctx.fillRect(
				0,
				0,
				visualizationWidth * window.devicePixelRatio,
				HEIGHT * window.devicePixelRatio,
			);
		};

		img.src = src;

		return () => {
			current.removeChild(canvas);
		};
	}, [src, visualizationWidth]);

	return <div ref={ref} style={containerStyle} />;
};
