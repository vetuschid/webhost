import path from 'node:path';
import {webdriverio} from '@vitest/browser-webdriverio';
import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		browser: {
			provider: webdriverio(),
			instances: [{browser: 'chrome'}],
			headless: true,
			screenshotFailures: false,
		},
	},
	publicDir: path.join(__dirname, '..', 'example-videos', 'videos'),
});
