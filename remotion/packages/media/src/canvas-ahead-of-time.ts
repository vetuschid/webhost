import type {CanvasSink, WrappedCanvas} from 'mediabunny';

export type CanvasAheadOfTimeNext =
	| {type: 'ready'; frame: WrappedCanvas | null}
	| {type: 'pending'; wait: () => Promise<WrappedCanvas | null>};

export const canvasesAheadOfTime = (
	videoSink: CanvasSink,
	startTimestamp?: number,
) => {
	const iterator = videoSink.canvases(startTimestamp);

	let inFlight: Promise<IteratorResult<WrappedCanvas, void>> = iterator.next();
	let resolved: IteratorResult<WrappedCanvas, void> | null = null;

	const trackResolution = () => {
		const captured = inFlight;
		captured.then(
			(result) => {
				if (captured === inFlight) {
					resolved = result;
				}
			},
			() => undefined,
		);
	};

	trackResolution();

	const advance = () => {
		inFlight = iterator.next();
		resolved = null;
		trackResolution();
	};

	const next = (): CanvasAheadOfTimeNext => {
		if (resolved) {
			if (resolved.done) {
				return {type: 'ready', frame: null};
			}

			const frame = resolved.value;
			advance();
			return {type: 'ready', frame};
		}

		const captured = inFlight;
		return {
			type: 'pending',
			wait: async () => {
				const result = await captured;
				if (captured === inFlight && !result.done) {
					advance();
				}

				return result.done ? null : result.value;
			},
		};
	};

	const closeFrame = (frame: WrappedCanvas) => {
		(frame as unknown as {close?: () => void}).close?.();
	};

	const closeIterator = async () => {
		if (resolved) {
			if (!resolved.done) {
				closeFrame(resolved.value);
			}
		} else {
			const captured = inFlight;
			captured.then(
				(result) => {
					if (!result.done) {
						closeFrame(result.value);
					}
				},
				() => undefined,
			);
		}

		await iterator.return();
	};

	return {next, closeIterator};
};

export type CanvasAheadOfTimeIterator = ReturnType<typeof canvasesAheadOfTime>;
