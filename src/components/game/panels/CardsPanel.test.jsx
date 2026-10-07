import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

const { modal, perms } = vi.hoisted(() => ({
  modal: { opened: null },
  perms: { gameEdit: true },
}));

vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ hasEntityPermission: () => perms.gameEdit }),
}));
// The tree only matters for its "Add Item" button here.
vi.mock('../../uiComponents/treeList/DTreeList', () => ({
  default: ({ withAddItem, onAddItem }) =>
    withAddItem ? <button type="button" onClick={() => onAddItem()}>Add Item</button> : null,
}));
// Records what the create dialog would show when opened.
vi.mock('../../uiComponents/base/Modals/InputModal', () => ({
  default: ({ openRef, getConfigDict }) => {
    openRef.current = (initial) => { modal.opened = { initial, config: getConfigDict() }; };
    return null;
  },
}));
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, command) => {
      if (command === 'GetCurrentPlayer') return { id: 'player-1' };
      if (command === 'GetOwner') return 'gm-1';
      if (command === 'GetGameId') return 'game-1';
      return undefined;
    }),
  },
}));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));
vi.mock('./CardPanel', () => ({ default: () => null }));
vi.mock('../settings/CardSettingsPanel', () => ({ default: () => null }));

import { CardsPanel } from './CardsPanel';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';

const serve = (templates) =>
  WebHelper.getAsync.mockImplementation(async (path) => (path === 'materials/gettemplatesfull' ? templates : []));

describe('CardsPanel, creating cards as a player', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modal.opened = null;
    perms.gameEdit = false; // a plain player
  });

  it('a player can create a card from a template shared with them, but not pick an owner', async () => {
    serve([{ id: 't-note', name: 'Note' }, { id: 't-internal', name: 'Importer', isHidden: true }]);

    renderWithProviders(<CardsPanel state={{}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Item' }));

    const keys = modal.opened.config.map((c) => c.key);
    expect(keys).toEqual(['name', 'template']);
    expect(modal.opened.config.find((c) => c.key === 'template').options).toEqual([{ value: 't-note', label: 'Note' }]);
  });

  it('a player with no shared template gets no add button', async () => {
    serve([]);

    renderWithProviders(<CardsPanel state={{}} />);

    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledWith('materials/gettemplatesfull'));
    expect(screen.queryByRole('button', { name: 'Add Item' })).toBeNull();
  });

  it('the GM still picks an owner', async () => {
    perms.gameEdit = true;
    serve([{ id: 't-note', name: 'Note' }]);

    renderWithProviders(<CardsPanel state={{}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Item' }));

    expect(modal.opened.config.map((c) => c.key)).toEqual(['name', 'template', 'owner']);
  });
});
