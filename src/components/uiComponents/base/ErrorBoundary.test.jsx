import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';
import { ErrorBoundary } from './ErrorBoundary';

const Boom = ({ when = true }) => {
  if (when) throw new Error('kaboom');
  return <span>fine</span>;
};

describe('ErrorBoundary', () => {
  // React logs caught render errors; keep the test output readable.
  let consoleError;
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => consoleError.mockRestore());

  it('renders its children when nothing throws', () => {
    renderWithProviders(<ErrorBoundary fallback={() => <span>broken</span>}><Boom when={false} /></ErrorBoundary>);
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('renders the fallback instead of unmounting everything when a child throws', () => {
    renderWithProviders(
      <div>
        <span>sibling</span>
        <ErrorBoundary fallback={({ error }) => <span>broken: {error.message}</span>}><Boom /></ErrorBoundary>
      </div>
    );
    expect(screen.getByText('broken: kaboom')).toBeInTheDocument();
    expect(screen.getByText('sibling')).toBeInTheDocument();
  });

  it('retries the children when the fallback calls reset', () => {
    let shouldThrow = true;
    const Flaky = () => <Boom when={shouldThrow} />;
    renderWithProviders(
      <ErrorBoundary fallback={({ reset }) => <button onClick={reset}>Retry</button>}><Flaky /></ErrorBoundary>
    );
    shouldThrow = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('starts over when its resetKey changes', () => {
    const { rerender } = renderWithProviders(
      <ErrorBoundary resetKey="a" fallback={() => <span>broken</span>}><Boom /></ErrorBoundary>
    );
    expect(screen.getByText('broken')).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="b" fallback={() => <span>broken</span>}><Boom when={false} /></ErrorBoundary>);
    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
