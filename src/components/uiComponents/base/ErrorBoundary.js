import * as React from "react";

/**
 * Catches render errors below it so one broken panel or chat message doesn't
 * unmount the whole app (React removes the entire tree on an uncaught error).
 *
 * fallback({ error, reset }) renders in place of the children; reset() tries the
 * children again. A changed resetKey also starts over (e.g. new message data).
 */
export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`ErrorBoundary${this.props.name ? ` (${this.props.name})` : ""}:`, error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback ? this.props.fallback({ error: this.state.error, reset: this.reset }) : null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
