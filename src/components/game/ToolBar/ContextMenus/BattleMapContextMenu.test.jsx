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
vi.mock('../../../uiComponents/hooks/useCustomLayers', () => ({ useCustomLayers: () => ({ layers: [] }) }));
vi.mock('../../turnOrder/TurnOrderService', () => ({ TurnOrderService: { Add: vi.fn(() => Promise.resolve(true)) } }));

import BattleMapContextMenu from './BattleMapContextMenu';
import { TurnOrderService } from '../../turnOrder/TurnOrderService';

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

  it('a selected token can be added to the turn order', async () => {
    const token = { id: 'tok-1', name: 'Goblin', isToken: true, tokenData: {} };
    const canvas = { ...canvasStub, getActiveObjects: () => [token] };
    renderWithProviders(
      <BattleMapContextMenu battleMapId="bm" canvas={canvas}>
        <canvas data-testid="map" />
      </BattleMapContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId('map').closest('[data-part="context-trigger"]'));
    fireEvent.click(await screen.findByText('Add to turn order'));

    expect(TurnOrderService.Add).toHaveBeenCalledWith(expect.objectContaining({ elementIds: ['tok-1'] }));
  });
});
