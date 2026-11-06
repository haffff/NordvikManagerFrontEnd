import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

// The Actions panel in a narrow window (a phone, a thin dock window): the list, then the
// editor with a way back that keeps the open action and its unsaved edits.

vi.mock('../../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('./ActionEditor/ActionEditor', () => ({
  fullActionName: (a) => (a ? (a.prefix ? `${a.prefix}/${a.name}` : a.name) : ''),
  ActionEditor: ({ draft }) => (
    <div data-testid="editor">
      Editing {draft.action.name}
      <button onClick={() => draft.updateAction({ description: 'changed' })}>change it</button>
    </div>
  ),
}));
vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from '../../../../helpers/transport';
import { ActionsPanel } from './ActionsPanel';

const actions = [{ id: 'a1', prefix: 'combat', name: 'Attack', hook: 0, content: '[]' }];

describe('ActionsPanel in a narrow window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.getAsync.mockImplementation(async (url) => {
      if (url === 'addon/actions') return actions;
      if (url.startsWith('addon/action?id=')) return actions[0];
      return [];
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
  });
  afterEach(() => vi.restoreAllMocks());

  it('opens the editor, goes back without asking about unsaved edits, and reopens it', async () => {
    renderWithProviders(<ActionsPanel />);
    fireEvent.click(await screen.findByText('Attack'));
    expect(await screen.findByTestId('editor')).toBeVisible();
    expect(screen.getByText('Attack')).not.toBeVisible();

    fireEvent.click(screen.getByText('change it'));
    fireEvent.click(screen.getByRole('button', { name: /back to actions/i }));
    expect(screen.getByText('Attack')).toBeVisible();
    expect(screen.queryByText('Unsaved changes')).toBeNull();

    // The same action again: the editor comes back with the edit still there.
    fireEvent.click(screen.getByText('Attack'));
    expect(screen.getByTestId('editor')).toBeVisible();
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });
});
