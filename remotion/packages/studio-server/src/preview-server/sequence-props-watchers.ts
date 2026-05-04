import path from 'node:path';
import type {
	CanUpdateSequencePropsResponse,
	SequenceNodePath,
} from '@remotion/studio-shared';
import {installFileWatcher} from '../file-watcher';
import {waitForLiveEventsListener} from './live-events';
import {getCachedNodePath, setCachedNodePath} from './node-path-cache';
import {
	computeSequencePropsStatusFromContent,
	computeSequencePropsStatusByLine,
	computeSequencePropsStatus,
} from './routes/can-update-sequence-props';

type WatcherInfo = {
	unwatch: () => void;
	refCount: number;
};

const sequencePropsWatchers: Record<string, Record<string, WatcherInfo>> = {};

const makeWatcherKey = ({
	absolutePath,
	nodePath,
}: {
	absolutePath: string;
	nodePath: SequenceNodePath;
}): string => {
	return `${absolutePath}:${JSON.stringify(nodePath)}`;
};

export const subscribeToSequencePropsWatchers = ({
	fileName,
	line,
	column,
	keys,
	remotionRoot,
	clientId,
}: {
	fileName: string;
	line: number;
	column: number;
	keys: string[];
	remotionRoot: string;
	clientId: string;
}): CanUpdateSequencePropsResponse => {
	const absolutePath = path.resolve(remotionRoot, fileName);

	// Try cached nodePath first (handles stale source maps after suppressed rebuilds)
	const cachedNodePath = getCachedNodePath(fileName, line, column);
	let initialResult: CanUpdateSequencePropsResponse;

	if (cachedNodePath) {
		const cachedResult = computeSequencePropsStatus({
			fileName,
			nodePath: cachedNodePath,
			keys,
			remotionRoot,
		});
		if (cachedResult.canUpdate) {
			initialResult = cachedResult;
		} else {
			// Cached nodePath no longer valid, fall back to line-based lookup
			initialResult = computeSequencePropsStatusByLine({
				fileName,
				line,
				keys,
				remotionRoot,
			});
		}
	} else {
		initialResult = computeSequencePropsStatusByLine({
			fileName,
			line,
			keys,
			remotionRoot,
		});
	}

	if (!initialResult.canUpdate) {
		return initialResult;
	}

	// Cache the resolved nodePath for future lookups with stale source maps
	setCachedNodePath(fileName, line, column, initialResult.nodePath);

	const {nodePath} = initialResult;
	const watcherKey = makeWatcherKey({absolutePath, nodePath});

	// If a watcher already exists for this key, just bump the ref count
	if (sequencePropsWatchers[clientId]?.[watcherKey]) {
		sequencePropsWatchers[clientId][watcherKey].refCount++;
		return initialResult;
	}

	const {unwatch} = installFileWatcher({
		file: absolutePath,
		existenceOnly: false,
		onChange: (event) => {
			if (event.type === 'deleted') {
				return;
			}

			let result: CanUpdateSequencePropsResponse;
			try {
				result = computeSequencePropsStatusFromContent(
					event.content,
					nodePath,
					keys,
				);
			} catch {
				return;
			}

			waitForLiveEventsListener().then((listener) => {
				listener.sendEventToClientId(clientId, {
					type: 'sequence-props-updated',
					fileName,
					nodePath,
					result,
				});
			});
		},
	});

	if (!sequencePropsWatchers[clientId]) {
		sequencePropsWatchers[clientId] = {};
	}

	sequencePropsWatchers[clientId][watcherKey] = {unwatch, refCount: 1};

	return initialResult;
};

export const unsubscribeFromSequencePropsWatchers = ({
	fileName,
	nodePath,
	remotionRoot,
	clientId,
}: {
	fileName: string;
	nodePath: SequenceNodePath;
	remotionRoot: string;
	clientId: string;
}) => {
	const absolutePath = path.resolve(remotionRoot, fileName);
	const watcherKey = makeWatcherKey({absolutePath, nodePath});

	if (
		!sequencePropsWatchers[clientId] ||
		!sequencePropsWatchers[clientId][watcherKey]
	) {
		return;
	}

	sequencePropsWatchers[clientId][watcherKey].refCount--;
	if (sequencePropsWatchers[clientId][watcherKey].refCount <= 0) {
		sequencePropsWatchers[clientId][watcherKey].unwatch();
		delete sequencePropsWatchers[clientId][watcherKey];
	}
};

export const unsubscribeClientSequencePropsWatchers = (clientId: string) => {
	if (!sequencePropsWatchers[clientId]) {
		return;
	}

	Object.values(sequencePropsWatchers[clientId]).forEach((watcher) => {
		watcher.unwatch();
	});

	delete sequencePropsWatchers[clientId];
};
