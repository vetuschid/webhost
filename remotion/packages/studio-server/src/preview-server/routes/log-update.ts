import {RenderInternals} from '@remotion/renderer';
import type {LogLevel} from '@remotion/renderer';

let warnedAboutPrettier = false;

export const warnAboutPrettierOnce = (logLevel: LogLevel) => {
	if (warnedAboutPrettier) {
		return;
	}

	warnedAboutPrettier = true;
	RenderInternals.Log.warn(
		{indent: false, logLevel},
		RenderInternals.chalk.yellow(
			'Could not format with Prettier. File will need to be formatted manually.',
		),
	);
};

export const normalizeQuotes = (str: string): string => {
	if (
		str.length >= 2 &&
		((str.startsWith("'") && str.endsWith("'")) ||
			(str.startsWith('"') && str.endsWith('"')))
	) {
		return `'${str.slice(1, -1)}'`;
	}

	return str;
};

// 24-bit ANSI helpers
const fg = (r: number, g: number, b: number, str: string) =>
	`\u001b[38;2;${r};${g};${b}m${str}\u001b[39m`;
const bg = (r: number, g: number, b: number, str: string) =>
	`\u001b[48;2;${r};${g};${b}m${str}\u001b[49m`;

// Monokai-inspired syntax colors
const attrName = (str: string) => fg(166, 226, 46, str);
const equals = (str: string) => fg(249, 38, 114, str);
const punctuation = (str: string) => fg(248, 248, 242, str);
const stringValue = (str: string) => fg(230, 219, 116, str);
const numberValue = (str: string) => fg(174, 129, 255, str);

const colorValue = (str: string) => {
	if (
		(str.startsWith("'") && str.endsWith("'")) ||
		(str.startsWith('"') && str.endsWith('"'))
	) {
		return stringValue(str);
	}

	if (/^-?\d+(\.\d+)?$/.test(str)) {
		return numberValue(str);
	}

	return punctuation(str);
};

// Subtle background tints
const removedBg = (str: string) => bg(80, 20, 20, str);
const addedBg = (str: string) => bg(30, 80, 30, str);

const colorEnabled = () => RenderInternals.chalk.enabled();

// Format key={value} with Monokai syntax highlighting
const formatSimpleProp = (key: string, value: string) => {
	return `${attrName(key)}${equals('=')}${punctuation('{')}${colorValue(value)}${punctuation('}')}`;
};

// Format parentKey={{childKey: value}} with Monokai syntax highlighting
const formatNestedProp = (
	parentKey: string,
	childKey: string,
	value: string,
) => {
	return `${attrName(parentKey)}${equals('=')}${punctuation('{{')}${punctuation(childKey)}${punctuation(':')} ${colorValue(value)}${punctuation('}}')}`;
};

export const formatPropChange = ({
	key,
	oldValueString,
	newValueString,
	defaultValueString,
}: {
	key: string;
	oldValueString: string;
	newValueString: string;
	defaultValueString: string | null;
}) => {
	if (!colorEnabled()) {
		const dotIdx = key.indexOf('.');
		if (dotIdx === -1) {
			return `${key}={${oldValueString}} \u2192 ${key}={${newValueString}}`;
		}

		const parent = key.slice(0, dotIdx);
		const child = key.slice(dotIdx + 1);
		return `${parent}={{${child}: ${oldValueString}}} \u2192 ${parent}={{${child}: ${newValueString}}}`;
	}

	const isResetToDefault =
		defaultValueString !== null && newValueString === defaultValueString;
	const isChangeFromDefault =
		defaultValueString !== null && oldValueString === defaultValueString;

	const dotIndex = key.indexOf('.');
	if (dotIndex === -1) {
		if (isResetToDefault) {
			return removedBg(formatSimpleProp(key, oldValueString));
		}

		if (isChangeFromDefault) {
			return addedBg(formatSimpleProp(key, newValueString));
		}

		return `${removedBg(formatSimpleProp(key, oldValueString))} \u2192 ${addedBg(formatSimpleProp(key, newValueString))}`;
	}

	const parentKey = key.slice(0, dotIndex);
	const childKey = key.slice(dotIndex + 1);

	if (isResetToDefault) {
		return removedBg(formatNestedProp(parentKey, childKey, oldValueString));
	}

	if (isChangeFromDefault) {
		return addedBg(formatNestedProp(parentKey, childKey, newValueString));
	}

	return `${removedBg(formatNestedProp(parentKey, childKey, oldValueString))} \u2192 ${addedBg(formatNestedProp(parentKey, childKey, newValueString))}`;
};

export const logUpdate = ({
	fileRelativeToRoot,
	line,
	key,
	oldValueString,
	newValueString,
	defaultValueString,
	formatted,
	logLevel,
}: {
	fileRelativeToRoot: string;
	line: number;
	key: string;
	oldValueString: string;
	newValueString: string;
	defaultValueString: string | null;
	formatted: boolean;
	logLevel: LogLevel;
}) => {
	const locationLabel = `${fileRelativeToRoot}:${line}`;
	const propChange = formatPropChange({
		key,
		oldValueString: normalizeQuotes(oldValueString),
		newValueString: normalizeQuotes(newValueString),
		defaultValueString:
			defaultValueString !== null ? normalizeQuotes(defaultValueString) : null,
	});
	RenderInternals.Log.info(
		{indent: false, logLevel},
		`${RenderInternals.chalk.blueBright(`${locationLabel}:`)} ${propChange}`,
	);
	if (!formatted) {
		warnAboutPrettierOnce(logLevel);
	}
};
