import type {AnyRemotionOption} from './option';

let experimentalVisualModeEnabled = false;

const cliFlag = 'experimental-visual-mode' as const;

export const experimentalVisualModeOption = {
	name: 'Experimental Visual Mode',
	cliFlag,
	description: () => (
		<>Nothing here yet, but this is our playground for experiments.</>
	),
	ssrName: null,
	docLink: 'https://www.remotion.dev/docs/config#setexperimentalvisualmode',
	type: false as boolean,
	getValue: ({commandLine}) => {
		if (commandLine[cliFlag] !== null) {
			return {
				value: commandLine[cliFlag] as boolean,
				source: 'cli',
			};
		}

		return {
			value: experimentalVisualModeEnabled,
			source: 'config',
		};
	},
	setConfig(value) {
		experimentalVisualModeEnabled = value;
	},
	id: cliFlag,
} satisfies AnyRemotionOption<boolean>;
