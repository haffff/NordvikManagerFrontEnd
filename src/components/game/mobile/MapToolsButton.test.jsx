import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import * as Dockable from '@hlorenzi/react-dockable';
import { renderWithProviders } from '../../../setupTests';
import ClientMediator from '../../../ClientMediator';

// The real Tools panel needs a live map; this one shows which map it is for and picks a
// tool the way the real one does: BMService fires BattleMap_ModeChanged.
vi.mock('../panels/ToolsPanel/ToolsPanel', () => ({
  default: ({ battleMapId }) => {
    const ctx = Dockable.useContentContext();
    React.useEffect(() => { ctx.setTitle('Tools - Cellar'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <div>
        tools for {battleMapId}
        <button onClick={() => ClientMediator.fireEvent('BattleMap_ModeChanged', { battleMapId, mode: 'Measure', type: undefined })}>
          Measure
        </button>
      </div>
    );
  },
}));

import MapToolsButton from './MapToolsButton';

describe('MapToolsButton', () => {
  let send;
  beforeEach(() => {
    send = vi.spyOn(ClientMediator, 'sendCommand').mockImplementation(() => undefined);
    return () => send.mockRestore();
  });

  it("opens the Tools panel for its map, without renaming the map's tab", () => {
    const setTitle = vi.fn();
    renderWithProviders(
      <Dockable.ContentContext.Provider value={{ setTitle, setPreferredSize: () => {}, layoutContent: {} }}>
        <MapToolsButton battleMapId="bm1" />
      </Dockable.ContentContext.Provider>
    );
    expect(screen.queryByText(/tools for/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Map tools' }));
    expect(screen.getByText('tools for bm1')).toBeInTheDocument();
    expect(setTitle).not.toHaveBeenCalled();
  });

  it('closes once a tool is picked, and shows the tool with a way to stop it', async () => {
    renderWithProviders(<MapToolsButton battleMapId="bm1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Map tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Measure' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Stop Measure' }));
    expect(screen.queryByText(/tools for/)).toBeNull();
    expect(send).toHaveBeenCalledWith('BattleMap', 'DisableAllModes', { contextId: 'bm1' });
    expect(send).toHaveBeenCalledWith('BattleMap', 'SetDragMode', { contextId: 'bm1', enabled: false });
  });

  it('follows the tool going off, and the Drag tool, of its own map only', async () => {
    // fireEvent dispatches on a timer, and skips the same event repeated within 200ms.
    const fire = (name, data) => ClientMediator.fireEvent(name, data);
    renderWithProviders(<MapToolsButton battleMapId="bm1" />);
    fire('BattleMap_ModeChanged', { battleMapId: 'bm2', mode: 'Measure' });
    fire('BattleMap_DragModeChanged', { battleMapId: 'bm1', enabled: true });
    expect(await screen.findByRole('button', { name: 'Stop Drag' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop Measure' })).toBeNull();

    fire('BattleMap_DragModeChanged', { battleMapId: 'bm1', enabled: false });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Stop/ })).toBeNull());

    fire('BattleMap_ModeChanged', { battleMapId: 'bm1', mode: 'SimpleCreate', type: 'Rectangle' });
    expect(await screen.findByRole('button', { name: 'Stop Rectangle' })).toBeInTheDocument();
    fire('BattleMap_ModeChanged', { battleMapId: 'bm1', mode: undefined, type: undefined });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Stop/ })).toBeNull());
  });

  it('closes when tapped outside', () => {
    renderWithProviders(<MapToolsButton battleMapId="bm1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Map tools' }));
    fireEvent.click(screen.getByTestId('map-tools-backdrop'));
    expect(screen.queryByText(/tools for/)).toBeNull();
  });
});
