import type {
	EffectDefinitionAndStack,
	SequenceControls,
	SequenceFieldSchema,
	TSequence,
} from 'remotion';

export const TIMELINE_PADDING = 16;
export const TIMELINE_BORDER = 1;
export const TIMELINE_ITEM_BORDER_BOTTOM = 1;

export const TIMELINE_TRACK_EXPANDED_HEIGHT = 100;

export const SCHEMA_FIELD_ROW_HEIGHT = 22;
export const UNSUPPORTED_FIELD_ROW_HEIGHT = 22;
export const TREE_GROUP_ROW_HEIGHT = 22;
export const TREE_INDENT_PER_LEVEL = 16;
export const EXPANDED_SECTION_PADDING_LEFT = 28;
export const EXPANDED_SECTION_PADDING_RIGHT = 10;

const SUPPORTED_SCHEMA_TYPES = new Set([
	'number',
	'boolean',
	'rotation',
	'translate',
]);

export type SchemaFieldInfo = {
	key: string;
	description: string | undefined;
	typeName: string;
	supported: boolean;
	rowHeight: number;
	currentValue: unknown;
	fieldSchema: SequenceFieldSchema;
};

export const getSchemaFields = (
	controls: SequenceControls | null,
): SchemaFieldInfo[] | null => {
	if (!controls) {
		return null;
	}

	return Object.entries(controls.schema).map(([key, fieldSchema]) => {
		const typeName = fieldSchema.type;
		const supported = SUPPORTED_SCHEMA_TYPES.has(typeName);
		return {
			key,
			description: fieldSchema.description,
			typeName,
			supported,
			rowHeight: supported
				? SCHEMA_FIELD_ROW_HEIGHT
				: UNSUPPORTED_FIELD_ROW_HEIGHT,
			currentValue: controls.currentValue[key],
			fieldSchema,
		};
	});
};

export type EffectSchemaFieldLabel = {
	key: string;
	description: string | undefined;
};

export const getEffectSchemaLabels = (
	effect: EffectDefinitionAndStack<unknown>,
): EffectSchemaFieldLabel[] => {
	if (!effect.definition.schema) {
		return [];
	}

	return Object.entries(effect.definition.schema).map(([key, fieldSchema]) => ({
		key,
		description: fieldSchema.description,
	}));
};

export type TimelineTreeNode =
	| {
			readonly kind: 'group';
			readonly id: string;
			readonly label: string;
			readonly children: TimelineTreeNode[];
	  }
	| {
			readonly kind: 'field';
			readonly id: string;
			readonly label: string;
			readonly field: SchemaFieldInfo | null;
	  };

export const buildTimelineTree = (sequence: TSequence): TimelineTreeNode[] => {
	const roots: TimelineTreeNode[] = [];

	if (sequence.effects.length > 0) {
		roots.push({
			kind: 'group',
			id: `${sequence.id}::effects`,
			label: 'Effects',
			children: sequence.effects.map((effect, i): TimelineTreeNode => {
				const effectId = `${sequence.id}::effects::${i}`;
				return {
					kind: 'group',
					id: effectId,
					label: effect.definition.label,
					children: getEffectSchemaLabels(effect).map(
						(label): TimelineTreeNode => ({
							kind: 'field',
							id: `${effectId}::${label.key}`,
							label: label.description ?? label.key,
							field: null,
						}),
					),
				};
			}),
		});
	}

	const controlFields = getSchemaFields(sequence.controls);
	if (controlFields && controlFields.length > 0) {
		roots.push({
			kind: 'group',
			id: `${sequence.id}::controls`,
			label: 'Controls',
			children: controlFields.map(
				(f): TimelineTreeNode => ({
					kind: 'field',
					id: `${sequence.id}::controls::${f.key}`,
					label: f.description ?? f.key,
					field: f,
				}),
			),
		});
	}

	return roots;
};

export type FlatTreeRow = {
	readonly node: TimelineTreeNode;
	readonly depth: number;
};

export const flattenVisibleTreeNodes = (
	nodes: TimelineTreeNode[],
	expandedTracks: Record<string, boolean>,
	depth = 0,
): FlatTreeRow[] => {
	const out: FlatTreeRow[] = [];
	for (const node of nodes) {
		out.push({node, depth});
		if (node.kind === 'group' && (expandedTracks[node.id] ?? false)) {
			out.push(
				...flattenVisibleTreeNodes(node.children, expandedTracks, depth + 1),
			);
		}
	}

	return out;
};

export const getTreeRowHeight = (node: TimelineTreeNode): number => {
	if (node.kind === 'field' && node.field) {
		return node.field.rowHeight;
	}

	return TREE_GROUP_ROW_HEIGHT;
};

export const getExpandedTrackHeight = (
	sequence: TSequence,
	expandedTracks: Record<string, boolean>,
): number => {
	const tree = buildTimelineTree(sequence);
	const flat = flattenVisibleTreeNodes(tree, expandedTracks);

	if (flat.length === 0) {
		return TIMELINE_TRACK_EXPANDED_HEIGHT;
	}

	const totalRowsHeight = flat.reduce(
		(sum, {node}) => sum + getTreeRowHeight(node),
		0,
	);
	const separators = Math.max(0, flat.length - 1);
	return totalRowsHeight + separators;
};

export const TIMELINE_LAYER_HEIGHT_VIDEO = 75;
export const TIMELINE_LAYER_HEIGHT_IMAGE = 50;
export const TIMELINE_LAYER_HEIGHT_AUDIO = 25;

export const getTimelineLayerHeight = (
	type: 'video' | 'image' | 'audio' | 'sequence' | 'other',
) => {
	if (type === 'video') {
		return TIMELINE_LAYER_HEIGHT_VIDEO;
	}

	if (type === 'image') {
		return TIMELINE_LAYER_HEIGHT_IMAGE;
	}

	return TIMELINE_LAYER_HEIGHT_AUDIO;
};
