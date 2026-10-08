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

  // Regression coverage: the same addon action re-firing (a reconnect, or any Hook
  // it's wired to running more than once — e.g. before RunPendingAddonInstallHooksAsync's
  // own idempotency guard existed) re-broadcast menu_item_add for the same item every
  // time, and this handler appended a duplicate on each broadcast with no check —
  // unlike AddSubMenu, which already guarded against the equivalent case.
  it('ignores a re-broadcast AddMenuItem for the same key instead of duplicating it', async () => {
    renderWithProviders(<DropDownMenu viewId="battlemap_add" name="Add" />);

    const send = () => ClientMediator.sendCommand('DropDownMenu', 'AddMenuItem', {
      contextId: 'battlemap_add',
      item: <div key="create-item-card" data-testid="create-item-card">Create Item Card</div>,
    });

    act(() => { send(); });
    expect(await screen.findAllByTestId('create-item-card')).toHaveLength(1);

    act(() => { send(); });
    expect(await screen.findAllByTestId('create-item-card')).toHaveLength(1);
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

// Addon menu items arrive whenever the server's hooks run — often before the menu
// they belong to exists (the map's "Add" submenu only mounts with a battle map and
// the map permissions loaded). They used to be dropped then, at random.
describe('DropDownMenu items added while the menu is not mounted', () => {
  beforeEach(() => {
    ClientMediator._clientsHashSet = {};
    ClientMediator._clientPanelIndex = {};
    resetPersistedMenuItems();
  });

  it('shows an item added before the menu first mounts', async () => {
    const { addMenuItem } = await import('./menuItemsStore');
    addMenuItem('battlemap_add', <div key="generic-token" data-testid="generic-token">Generic token</div>);

    renderWithProviders(<DropDownMenu viewId="battlemap_add" name="Add" />);

    expect(await screen.findByTestId('generic-token')).toBeInTheDocument();
  });

  it('keeps an item sent while the menu was unmounted, for when it mounts again', async () => {
    const { unmount } = renderWithProviders(<DropDownMenu viewId="battlemap_add" name="Add" />);
    unmount();

    act(() => {
      ClientMediator.sendCommand('DropDownMenu', 'AddMenuItem', {
        contextId: 'battlemap_add',
        item: <div key="note" data-testid="note">Note</div>,
      });
    });
    renderWithProviders(<DropDownMenu viewId="battlemap_add" name="Add" />);

    expect(await screen.findByTestId('note')).toBeInTheDocument();
  });

  it('builds a submenu and its items before any of them is mounted', async () => {
    const { addMenuItem, addSubMenu } = await import('./menuItemsStore');
    addMenuItem('basics', <div key="note" data-testid="sub-note">Note</div>);
    addSubMenu('battlemap_add', 'basics', 'Basics');

    renderWithProviders(<DropDownMenu viewId="battlemap_add" name="Add" />);

    expect(await screen.findByText('Basics')).toBeInTheDocument();
    expect(await screen.findByTestId('sub-note')).toBeInTheDocument();
  });
});

// dnd5e's "Card Settings" item says Location "5e_settings" AND SubMenuId "5e_settings":
// a submenu inside itself. Rendering that nested menus without end and crashed the tab.
describe('DropDownMenu submenus that would contain themselves', () => {
  beforeEach(() => {
    ClientMediator._clientsHashSet = {};
    ClientMediator._clientPanelIndex = {};
    resetPersistedMenuItems();
  });

  it('ignores a submenu added to itself', async () => {
    const { addMenuItem, addSubMenu } = await import('./menuItemsStore');
    addMenuItem('5e_settings', <div key="card_settings" data-testid="card-settings">Card Settings</div>);
    addSubMenu('addons', '5e_settings', '5E Settings');
    addSubMenu('5e_settings', '5e_settings', '5e_settings');

    renderWithProviders(<DropDownMenu viewId="addons" name="Addons" />);

    expect(await screen.findAllByText('5E Settings')).toHaveLength(1);
    expect(screen.getAllByTestId('card-settings')).toHaveLength(1);
  });

  it('does not loop when two submenus contain each other', async () => {
    const { addSubMenu } = await import('./menuItemsStore');
    addSubMenu('a', 'b', 'B');
    addSubMenu('b', 'a', 'A');

    renderWithProviders(<DropDownMenu viewId="a" name="A" />);

    expect(await screen.findAllByText('B')).toHaveLength(1);
    expect(screen.queryAllByText('A', { selector: '[data-part="trigger-item"] *, [data-part="trigger-item"]' })).toHaveLength(0);
  });
});
