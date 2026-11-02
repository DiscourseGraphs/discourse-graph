import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { resetKey: string; children: ReactNode };
type State = { error: Error | null; errorKey: string | null };

// PreviewPane lets Obsidian mutate React-owned DOM, so a teardown can throw
// mid-reconciliation; uncaught, that unmounts the modal's whole root.
export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorKey: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // Reset by prop, not `key`, which would unmount this boundary with its children.
  // Compare the catch-time key: a render-stored one is discarded when that render throws.
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
        <div className="text-error flex flex-1 items-center justify-center">
          Could not render this preview.
        </div>
      );
    }
    return this.props.children;
  }
}
