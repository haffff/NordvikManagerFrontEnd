import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({}) }));

import { BasePanel } from './BasePanel';

describe('BasePanel', () => {
  let consoleError;
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => consoleError.mockRestore());

  it('shows an error with Retry in place of a panel body that throws, and keeps the title', () => {
    let shouldThrow = true;
    const Body = () => {
      if (shouldThrow) throw new Error('bad data');
      return <span>panel body</span>;
    };
    renderWithProviders(<BasePanel title="Chat"><Body /></BasePanel>);

    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText(/this panel ran into a problem/i)).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });
});
