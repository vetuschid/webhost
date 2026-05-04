import fs from 'fs';
import {expect, test} from '@playwright/test';
import {newVideoFile, STUDIO_URL} from './constants.mts';
import {startStudio, stopStudio} from './studio-server.mts';

test.describe('node-path cache for stale source maps', () => {
	let originalContent: string;

	test.beforeEach(async () => {
		originalContent = fs.readFileSync(newVideoFile, 'utf-8');
		await startStudio();
	});

	test.afterEach(async () => {
		fs.writeFileSync(newVideoFile, originalContent);
		await stopStudio();
	});

	// Regression test for the following scenario:
	//
	// 1. NewVideo.tsx has <Video> on line 22:
	//
	//      export const Component = () => {
	//        return <Video src={src} />;      // line 22
	//      };
	//
	// 2. The studio updates a prop via the API (suppressing the webpack rebuild).
	//    Prettier then wraps the return in parentheses, shifting <Video> to line 23:
	//
	//      export const Component = () => {
	//        return (
	//          <Video src={src} style={{}} />  // now line 23
	//        );
	//      };
	//
	// 3. On reload, the stale source map still resolves to line 22, but the tag
	//    is now on line 23. Without the node-path cache, subscribe-to-sequence-props
	//    would fail because lineColumnToNodePath(ast, 22) finds nothing.
	//
	// The cache stores (fileName, line, column) → AST nodePath on first successful
	// resolution. When the same stale coordinates are sent again, the cached
	// nodePath is reused (and verified against the current AST).

	test('subscribe-to-sequence-props succeeds with stale line number after file reformatting', async () => {
		const content = fs.readFileSync(newVideoFile, 'utf-8');
		const lines = content.split('\n');
		const videoLineIndex = lines.findIndex((l) => l.includes('<Video'));
		expect(videoLineIndex).toBeGreaterThan(-1);
		const videoLine = videoLineIndex + 1; // 1-indexed

		// 1. Initial subscription → resolves line to AST nodePath and caches it
		const res1 = await fetch(`${STUDIO_URL}/api/subscribe-to-sequence-props`, {
			method: 'POST',
			headers: {'content-type': 'application/json'},
			body: JSON.stringify({
				fileName: 'src/NewVideo.tsx',
				line: videoLine,
				column: 0,
				keys: ['src'],
				clientId: 'e2e-cache-test-1',
			}),
		});
		const result1 = await res1.json();
		expect(result1.data.canUpdate).toBe(true);
		expect(result1.data.nodePath).toBeTruthy();

		// 2. Simulate prettier wrapping the return in parentheses,
		//    shifting <Video> down by one line.
		const editedContent = content.replace(
			'return <Video src={src} debugOverlay />;',
			'return (\n\t\t<Video src={src} debugOverlay />\n\t);',
		);
		expect(editedContent).not.toBe(content);
		fs.writeFileSync(newVideoFile, editedContent);

		// Verify the tag actually moved
		const editedLines = editedContent.split('\n');
		const newVideoLineIndex = editedLines.findIndex((l) =>
			l.includes('<Video'),
		);
		expect(newVideoLineIndex + 1).toBe(videoLine + 1);

		// 3. Subscribe again with the ORIGINAL (stale) line number.
		//    Without the cache, this would fail because the tag is no longer on this line.
		//    With the cache, the previously resolved nodePath is reused.
		const res2 = await fetch(`${STUDIO_URL}/api/subscribe-to-sequence-props`, {
			method: 'POST',
			headers: {'content-type': 'application/json'},
			body: JSON.stringify({
				fileName: 'src/NewVideo.tsx',
				line: videoLine, // stale line number
				column: 0,
				keys: ['src'],
				clientId: 'e2e-cache-test-2',
			}),
		});
		const result2 = await res2.json();
		expect(result2.data.canUpdate).toBe(true);
		expect(result2.data.nodePath).toBeTruthy();

		// The nodePath should be the same — both refer to the same <Video> element
		expect(result2.data.nodePath).toEqual(result1.data.nodePath);
	});
});
