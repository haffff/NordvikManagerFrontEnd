import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

vi.mock('../../../uiComponents/base/Subscribable', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('../../../../ClientMediator', () => ({ default: { sendCommand: vi.fn(), register: vi.fn(), unregister: vi.fn(), fireEvent: vi.fn() } }));
vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(() => Promise.resolve([])), get: vi.fn() },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));
// Map permission bits this test's player has (all of them unless a test says otherwise).
let mapPermission = 31;
vi.mock('../../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({
    isGM: true,
    isAdmin: true,
    hasEntityPermission: (type, id, bit) => type !== 'MapModel' || (mapPermission & bit) === bit,
  }),
}));
vi.mock('../../../uiComponents/hooks/useCustomLayers', () => ({ useCustomLayers: () => ({ layers: [] }) }));

import BattleMapContextMenu from './BattleMapContextMenu';

const canvasStub = { getActiveObjects: () => [], contextMenuLock: false, on: vi.fn(), off: vi.fn() };

describe('BattleMapContextMenu', () => {
  beforeEach(() => { mapPermission = 31; });

  it('does not wrap the map in a button', () => {
    renderWithProviders(
      <BattleMapContextMenu battleMapId="bm" canvas={canvasStub}>
        <canvas data-testid="map" />
      </BattleMapContextMenu>
    );

    // A button around the whole canvas picks up every button style (hover, focus) and
    // tells assistive tech the map is one big button.
    expect(screen.getByTestId('map').closest('button')).toBeNull();
  });

  it('still opens the menu on right-click', async () => {
    renderWithProviders(
      <BattleMapContextMenu battleMapId="bm" canvas={canvasStub}>
        <canvas data-testid="map" />
      </BattleMapContextMenu>
    );

    const trigger = screen.getByTestId('map').closest('[data-part="context-trigger"]');
    expect(trigger).not.toBeNull();
    fireEvent.contextMenu(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('data-state', 'open'));
  });

  it('offers Add (to place tokens) with Control on the map, but not Paste', async () => {
    mapPermission = 1 | 2 | 4; // See + Execute + Control, no Edit
    renderWithProviders(
      <BattleMapContextMenu battleMapId="bm" canvas={canvasStub}>
        <canvas data-testid="map" />
      </BattleMapContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId('map').closest('[data-part="context-trigger"]'));

    expect(await screen.findByText('Add')).toBeInTheDocument();
    expect(screen.queryByText('Paste')).not.toBeInTheDocument();
  });

  it('offers no Add with only See on the map', async () => {
    mapPermission = 1;
    renderWithProviders(
      <BattleMapContextMenu battleMapId="bm" canvas={canvasStub}>
        <canvas data-testid="map" />
      </BattleMapContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId('map').closest('[data-part="context-trigger"]'));

    expect(await screen.findByText('Battle Map')).toBeInTheDocument();
    expect(screen.queryByText('Add')).not.toBeInTheDocument();
  });
});
