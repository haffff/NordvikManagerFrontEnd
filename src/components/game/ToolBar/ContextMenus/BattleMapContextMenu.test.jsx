import { vi, describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

vi.mock('../../../uiComponents/base/Subscribable', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('../../../../ClientMediator', () => ({ default: { sendCommand: vi.fn(), register: vi.fn(), unregister: vi.fn(), fireEvent: vi.fn() } }));
vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(() => Promise.resolve([])), get: vi.fn() },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));
vi.mock('../../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ isGM: true, isAdmin: true, hasEntityPermission: () => true }),
}));
vi.mock('../../../uiComponents/hooks/useCustomLayers', () => ({ useCustomLayers: () => [] }));

import BattleMapContextMenu from './BattleMapContextMenu';

const canvasStub = { getActiveObjects: () => [], contextMenuLock: false, on: vi.fn(), off: vi.fn() };

describe('BattleMapContextMenu', () => {
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
});
