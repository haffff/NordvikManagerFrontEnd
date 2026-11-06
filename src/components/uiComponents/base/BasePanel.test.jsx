import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

const { dockCtx } = vi.hoisted(() => ({ dockCtx: { current: {} } }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => dockCtx.current }));

// A panel component as the dock knows it; its name is its PanelList key in tests.
const asPanel = (name) => ({ layoutContent: { content: { element: { type: { [name]: () => null }[name] } } } });

import { BasePanel } from './BasePanel';

describe('BasePanel', () => {
  let consoleError;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    dockCtx.current = {};
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });
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

  it('shows a help icon in the corner of a panel that has a user guide page, which opens it', () => {
    dockCtx.current = asPanel('ChatPanel');
    renderWithProviders(<BasePanel><span>chat body</span></BasePanel>);

    const icon = screen.getByTestId('help-icon');
    fireEvent.click(icon);
    expect(window.open).toHaveBeenCalledWith(expect.stringMatching(/\/user-guide\/chat$/), '_blank', 'noopener,noreferrer');
  });

  it('a panel can give its own help instead', () => {
    dockCtx.current = asPanel('SomethingElse');
    renderWithProviders(<BasePanel helpText="Your shortcuts" docUrl="/user-guide/x"><span>body</span></BasePanel>);
    fireEvent.click(screen.getByTestId('help-icon'));
    expect(window.open).toHaveBeenCalledWith(expect.stringMatching(/\/user-guide\/x$/), '_blank', 'noopener,noreferrer');
  });

  // Game Settings is a panel whose tabs are panels too: the dock panel's page showed
  // twice, once per BasePanel.
  it("a panel inside another one doesn't repeat the outer panel's help icon", () => {
    dockCtx.current = asPanel('ChatPanel');
    renderWithProviders(<BasePanel><BasePanel><span>inner body</span></BasePanel></BasePanel>);
    expect(screen.getAllByTestId('help-icon')).toHaveLength(1);
  });

  it('a panel inside another one still shows help of its own', () => {
    dockCtx.current = asPanel('ChatPanel');
    renderWithProviders(<BasePanel><BasePanel helpText="Inner help"><span>inner body</span></BasePanel></BasePanel>);
    expect(screen.getAllByTestId('help-icon')).toHaveLength(2);
  });

  it('no icon for a panel without a page', () => {
    dockCtx.current = asPanel('SomethingElse');
    renderWithProviders(<BasePanel><span>body</span></BasePanel>);
    expect(screen.queryByTestId('help-icon')).toBeNull();
  });
});
