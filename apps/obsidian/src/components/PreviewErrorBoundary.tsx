import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { resetKey: string; children: ReactNode };
type State = { error: Error | null; errorKey: string | null };

// PreviewPane hands a React-owned node to MarkdownRenderer, so Obsidian can mutate
// children React still owns and a teardown can throw mid-reconciliation. Without a
// boundary that throw unmounts the modal's whole root.
export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorKey: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // Reset on a prop change rather than a `key` change: a new key would unmount this
  // boundary in the same commit as its children, letting the throw escape upward.
  // Compare against the key captured in componentDidCatch, not the previous props —
  // a throw discards the in-progress render, so prop-derived state never committed.
  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (!state.error || state.errorKey === null) return null;
    if (props.resetKey === state.errorKey) return null;
    return { error: null, errorKey: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Discourse Graphs: node search preview failed", error, info);
    this.setState({ errorKey: this.props.resetKey });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="text-muted flex flex-1 items-center justify-center">
          Could not render this preview.
        </div>
      );
    }
    return this.props.children;
  }
}
