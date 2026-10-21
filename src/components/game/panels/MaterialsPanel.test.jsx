import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

const { perms } = vi.hoisted(() => ({ perms: { canEditGame: false, isLocalAdmin: false } }));

vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ ...perms, hasEntityPermission: () => perms.canEditGame }),
}));
vi.mock('../../uiComponents/treeList/DTreeList', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../../../ClientMediator', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    sendCommand: vi.fn((panel, command) => {
      if (command === 'GetCurrentPlayer') return { id: 'player-1' };
      if (command === 'GetGameId') return 'game-1';
      return undefined;
    }),
  },
}));
vi.mock('../../../helpers/ProgressToastManager', () => ({ default: {} }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(async () => []), get: vi.fn() },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));

import { MaterialsPanel } from './MaterialsPanel';

const LINK = 'Link local file or folder…';

// Linking reaches into the disk of whoever runs the server, so only its local admin gets
// it; seeing every player's materials follows Edit on the game.
describe('MaterialsPanel', () => {
  beforeEach(() => {
    perms.canEditGame = false;
    perms.isLocalAdmin = false;
  });

  it('an editor who is not the local admin sees all resources but cannot link files', async () => {
    perms.canEditGame = true;

    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByText('All Resources')).not.toBeNull());
    expect(screen.queryByText(LINK)).toBeNull();
  });

  it('the local admin can link files', async () => {
    perms.canEditGame = true;
    perms.isLocalAdmin = true;

    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByText(LINK)).not.toBeNull());
  });

  it('a player sees only their own materials and no link button', async () => {
    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByText('All Resources')).toBeNull());
    expect(screen.queryByText(LINK)).toBeNull();
  });
});
