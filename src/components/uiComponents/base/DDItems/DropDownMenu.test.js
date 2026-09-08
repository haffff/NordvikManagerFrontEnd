import { screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../../setupTests';
import ClientMediator from '../../../../ClientMediator';
import { DropDownMenu, resetPersistedMenuItems } from './DropDownMenu';

// Regression coverage for giving BattleMapContextMenu.js's "Add" submenu a
// viewId="battlemap_add" prop — the mechanism that makes it addressable by
// addon-authored AddMenuItem action steps (Location: "battlemap_add"). Before this,
// the submenu had no viewId, so it never registered with ClientMediator and
// silently ignored anything an addon tried to inject into it.
describe('DropDownMenu addon menu injection', () => {
  beforeEach(() => {
    ClientMediator._clientsHashSet = {};
    ClientMediator._clientPanelIndex = {};
  });

  it('does not register with ClientMediator when no viewId is given', () => {
    renderWithProviders(<DropDownMenu name="Add" />);
    expect(ClientMediator._resolveClients('DropDownMenu', { contextId: 'battlemap_add' })).toBeNull();
  });

  it('registers and renders items pushed via ClientMediator once a viewId is set', async () => {
    renderWithProviders(<DropDownMenu viewId="battlemap_add" name="Add" />);

    act(() => {
      ClientMediator.sendCommand('DropDownMenu', 'AddMenuItem', {
        contextId: 'battlemap_add',
        item: <div key="dnd-item" data-testid="dnd-item">DND Item</div>,
      });
    });

    expect(await screen.findByTestId('dnd-item')).toBeInTheDocument();
  });
});

// Regression coverage: _persistedItems is module-level and survives a
// <Game key={gameID}> remount on its own — without resetPersistedMenuItems()
// (called from MainApp.handleExit on game exit), an addon-added menu item from
// Game A would still be showing when the player joined a different Game B.
describe('DropDownMenu.resetPersistedMenuItems', () => {
  beforeEach(() => {
    ClientMediator._clientsHashSet = {};
    ClientMediator._clientPanelIndex = {};
  });

  it('clears persisted items so a fresh mount (e.g. a new game) does not see a previous game\'s addon menu item', async () => {
    const { unmount } = renderWithProviders(<DropDownMenu viewId="settings" name="Settings" />);

    act(() => {
      ClientMediator.sendCommand('DropDownMenu', 'AddMenuItem', {
        contextId: 'settings',
        item: <div key="stale-item" data-testid="stale-item">From Game A</div>,
      });
    });
    expect(await screen.findByTestId('stale-item')).toBeInTheDocument();

    // Simulate leaving the game (MainApp.handleExit) and joining a new one —
    // <Game key={gameID}> remounts everything, including this DropDownMenu.
    unmount();
    resetPersistedMenuItems();
    renderWithProviders(<DropDownMenu viewId="settings" name="Settings" />);

    expect(screen.queryByTestId('stale-item')).not.toBeInTheDocument();
  });
});
