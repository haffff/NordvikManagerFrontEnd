import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
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
vi.mock('../../turnOrder/TurnOrderService', () => ({ TurnOrderService: { Add: vi.fn(() => Promise.resolve(true)) } }));

import BattleMapContextMenu from './BattleMapContextMenu';
import { TurnOrderService } from '../../turnOrder/TurnOrderService';

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

  it('shows the options for a token selected after the menu last rendered', async () => {
    // Selecting a token on the canvas doesn't re-render this component, so the
    // selection has to be read when the menu opens, not when it last rendered.
    let active = [];
    const canvas = { ...canvasStub, getActiveObjects: () => active };
    renderWithProviders(
      <BattleMapContextMenu battleMapId="bm" canvas={canvas}>
        <canvas data-testid="map" />
      </BattleMapContextMenu>
    );

    // Let the component's own loading (maps, cards) settle first, so no later
    // re-render picks the selection up by accident.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    active = [{ id: 'tok-1', name: 'Inquisitor Vex', isToken: true, tokenData: {} }];
    fireEvent.contextMenu(screen.getByTestId('map').closest('[data-part="context-trigger"]'));

    expect(await screen.findByText('Inquisitor Vex')).toBeInTheDocument();
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
