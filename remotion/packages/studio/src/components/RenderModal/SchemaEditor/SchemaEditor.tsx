import React from 'react';
import {useZodIfPossible} from '../../get-zod-if-possible';
import {VERTICAL_SCROLLBAR_CLASSNAME} from '../../Menu/is-menu-item';
import {TopLevelZodValue} from './SchemaErrorMessages';
import {defaultPropsEditorScrollableAreaRef} from './scroll-to-default-props-path';
import type {AnyZodSchema} from './zod-schema-type';
import {getZodSchemaType} from './zod-schema-type';
import {ZodDiscriminatedUnionEditor} from './ZodDiscriminatedUnionEditor';
import {ZodObjectEditor} from './ZodObjectEditor';
import type {UpdaterFunction} from './ZodSwitch';

const scrollable: React.CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	overflowY: 'auto',
};

export const SchemaEditor: React.FC<{
	readonly schema: AnyZodSchema;
	readonly value: Record<string, unknown>;
	readonly setValue: UpdaterFunction<Record<string, unknown>>;
}> = ({schema, value, setValue}) => {
	const z = useZodIfPossible();
	if (!z) {
		throw new Error('expected zod');
	}

	const typeName = getZodSchemaType(schema);

	if (typeName !== 'object' && typeName !== 'discriminatedUnion') {
		return <TopLevelZodValue typeReceived={typeName} />;
	}

	if (typeName === 'discriminatedUnion') {
		return (
			<div
				ref={defaultPropsEditorScrollableAreaRef}
				style={scrollable}
				className={VERTICAL_SCROLLBAR_CLASSNAME}
			>
				<ZodDiscriminatedUnionEditor
					schema={schema}
					setValue={setValue}
					value={value}
					mayPad
					jsonPath={[]}
					onRemove={null}
				/>
			</div>
		);
	}

	return (
		<div
			ref={defaultPropsEditorScrollableAreaRef}
			style={scrollable}
			className={VERTICAL_SCROLLBAR_CLASSNAME}
		>
			<ZodObjectEditor
				discriminatedUnionReplacement={null}
				value={value as Record<string, unknown>}
				setValue={setValue}
				jsonPath={[]}
				schema={schema}
				onRemove={null}
				mayPad
			/>
		</div>
	);
};
