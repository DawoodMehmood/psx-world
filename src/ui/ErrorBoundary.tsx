import { Component, type ReactNode } from 'react';

/** Shows what broke instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel crash">
        <strong>PSX World hit an error.</strong>
        <pre>{this.state.error.message}</pre>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
