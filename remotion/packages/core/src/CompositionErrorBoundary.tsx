import React from 'react';

type Props = {
	readonly children: React.ReactNode;
	readonly onError: (error: Error) => void;
	readonly onClear: () => void;
};

type State = {
	hasError: boolean;
};

export class CompositionErrorBoundary extends React.Component<Props, State> {
	state: State = {hasError: false};

	static getDerivedStateFromError(): Partial<State> {
		return {hasError: true};
	}

	componentDidCatch(error: Error): void {
		this.props.onError(error);
	}

	componentDidUpdate(_prevProps: Props): void {
		if (!this.state.hasError) {
			this.props.onClear();
		}
	}

	render() {
		if (this.state.hasError) {
			return null;
		}

		return this.props.children;
	}
}
