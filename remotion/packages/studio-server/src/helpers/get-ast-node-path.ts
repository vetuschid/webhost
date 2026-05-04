import type {File} from '@babel/types';
import type {SequenceNodePath} from '@remotion/studio-shared';
import * as recast from 'recast';

export const getAstNodePath = (
	ast: File,
	nodePath: SequenceNodePath,
): recast.types.NodePath | null => {
	let current = new recast.types.NodePath(ast);
	for (const segment of nodePath) {
		current = current.get(segment);
		if (current.value === null || current.value === undefined) {
			return null;
		}
	}

	return current;
};
