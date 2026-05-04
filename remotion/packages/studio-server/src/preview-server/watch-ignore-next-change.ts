import type {WatchIgnoreNextChangePlugin} from '@remotion/bundler';

let currentPlugin: WatchIgnoreNextChangePlugin | null = null;

export const setWatchIgnoreNextChangePlugin = (
	plugin: WatchIgnoreNextChangePlugin,
): void => {
	currentPlugin = plugin;
};

export const suppressBundlerUpdateForFile = (absolutePath: string): void => {
	currentPlugin?.ignoreNextChange(absolutePath);
};
