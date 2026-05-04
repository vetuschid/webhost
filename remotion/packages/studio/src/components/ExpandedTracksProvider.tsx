import React, {createContext, useCallback, useMemo, useState} from 'react';

type ExpandedTracksContextValue = {
	readonly expandedTracks: Record<string, boolean>;
	readonly toggleTrack: (id: string) => void;
};

export const ExpandedTracksContext = createContext<ExpandedTracksContextValue>({
	expandedTracks: {},
	toggleTrack: () => {
		throw new Error('ExpandedTracksContext not initialized');
	},
});

export const ExpandedTracksProvider: React.FC<{
	readonly children: React.ReactNode;
}> = ({children}) => {
	const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>(
		{},
	);

	const toggleTrack = useCallback((id: string) => {
		setExpandedTracks((prev) => ({
			...prev,
			[id]: !prev[id],
		}));
	}, []);

	const value = useMemo(
		(): ExpandedTracksContextValue => ({
			expandedTracks,
			toggleTrack,
		}),
		[expandedTracks, toggleTrack],
	);

	return (
		<ExpandedTracksContext.Provider value={value}>
			{children}
		</ExpandedTracksContext.Provider>
	);
};
