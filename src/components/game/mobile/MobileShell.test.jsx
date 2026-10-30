import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import * as Dockable from '@hlorenzi/react-dockable';
import { renderWithProviders } from '../../../setupTests';

const getAsync = vi.fn(async () => []);
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: (...a) => getAsync(...a) },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));

// The real panels are heavy; the dialog only needs entries that create something.
function Chat() {
  const ctx = Dockable.useContentContext();
  React.useEffect(() => { ctx.setTitle('Chat (2)'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div>chat body {ctx.layoutContent.layoutPanel.rect.w > 0 ? 'sized' : 'unsized'}</div>;
}
function Dice() { return <div>dice body</div>; }
function Sound() { return <div>sound body</div>; }
vi.mock('./mobileCatalog', () => ({
  MOBILE_SECTIONS: [
    { name: 'Play', entries: [
      { key: 'Chat', name: 'Chat', icon: () => null, create: () => <Chat /> },
      { key: 'Dice', name: 'Dice', icon: () => null, create: () => <Dice /> },
    ] },
    { name: 'Game master', entries: [
      { key: 'Sound', name: 'Soundboard', icon: () => null, requiresEdit: true, create: () => <Sound /> },
    ] },
  ],
  panelLook: (key) => ({ name: key, icon: () => null }),
}));

let canEditGame = false;
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ canEditGame }),
}));

import MobileShell from './MobileShell';
import { openTab, resetTabs, getTabsSnapshot } from './mobileTabs';

const resolveKey = (type) => type?.name;

describe('MobileShell', () => {
  beforeEach(() => {
    resetTabs();
    canEditGame = false;
  });

  it('shows only the active tab and switches when a tab card is tapped', () => {
    act(() => { openTab(<Chat />, resolveKey); openTab(<Dice />, resolveKey); });
    renderWithProviders(<MobileShell state={{}} />);

    expect(screen.getByText('dice body')).toBeVisible();
    expect(screen.getByText(/chat body/)).not.toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: /Chat \(2\)/ }));
    expect(screen.getByText(/chat body/)).toBeVisible();
    expect(screen.getByText('dice body')).not.toBeVisible();
  });

  it("a panel's setTitle names its tab card", () => {
    act(() => { openTab(<Chat />, resolveKey); });
    renderWithProviders(<MobileShell state={{}} />);
    expect(screen.getByRole('tab', { name: /Chat \(2\)/ })).toBeInTheDocument();
  });

  it('closing the active tab removes it', () => {
    act(() => { openTab(<Chat />, resolveKey); openTab(<Dice />, resolveKey); });
    renderWithProviders(<MobileShell state={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /close Dice/i }));
    expect(getTabsSnapshot().tabs.map((t) => t.panelKey)).toEqual(['Chat']);
    expect(screen.queryByText('dice body')).toBeNull();
  });

  it('+ lists what a player may open and adds the chosen panel as a tab', async () => {
    renderWithProviders(<MobileShell state={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));

    expect(screen.getByRole('button', { name: 'Dice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soundboard' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Dice' }));
    expect(getTabsSnapshot().tabs.map((t) => t.panelKey)).toEqual(['Dice']);
    expect(screen.getByText('dice body')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Chat' })).toBeNull(); // the dialog closed
  });

  it('+ shows the GM entries and the battle maps to a GM', async () => {
    canEditGame = true;
    getAsync.mockResolvedValueOnce([{ id: 'bm1', name: 'Cellar' }]);
    renderWithProviders(<MobileShell state={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
    expect(screen.getByRole('button', { name: 'Soundboard' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Cellar' })).toBeInTheDocument();
    expect(getAsync).toHaveBeenCalledWith('battleMap/getBattleMaps');
  });

  it('with no tabs it invites to add one', () => {
    renderWithProviders(<MobileShell state={{}} />);
    expect(screen.getByText(/no panels open/i)).toBeInTheDocument();
  });
});

describe('MobileShell and the current battle map', () => {
  beforeEach(() => resetTabs());

  it('bringing a battle map tab to the front makes it the active battle map', async () => {
    const ClientMediator = (await import('../../../ClientMediator')).default;
    const fire = vi.spyOn(ClientMediator, 'fireEvent');
    function Battlemap() { return <div>map</div>; }
    act(() => { openTab(<Battlemap withID="bm1" />, resolveKey); openTab(<Dice />, resolveKey); });
    renderWithProviders(<MobileShell state={{}} />);
    expect(fire).not.toHaveBeenCalledWith('ActivePanelChanged', expect.anything());

    fireEvent.click(screen.getByRole('tab', { name: /Battlemap/ }));

    expect(fire).toHaveBeenCalledWith('ActivePanelChanged', { panel: 'BattleMap', contextId: 'bm1' });
    fire.mockRestore();
  });
});

describe('MobileShell: game commands and addon items in +', () => {
  beforeEach(async () => {
    resetTabs();
    canEditGame = false;
    const { resetMenuItems } = await import('../../uiComponents/base/DDItems/menuItemsStore');
    const { resetToolbarButtons } = await import('../../uiComponents/base/DDItems/toolbarButtonsStore');
    resetMenuItems();
    resetToolbarButtons();
  });

  it('Run command and Exit go through the game, closing the sheet', async () => {
    const ClientMediator = (await import('../../../ClientMediator')).default;
    const send = vi.spyOn(ClientMediator, 'sendCommand').mockImplementation(() => undefined);
    renderWithProviders(<MobileShell state={{}} />);

    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    expect(send).toHaveBeenCalledWith('game', 'OpenRun');
    expect(screen.queryByRole('dialog', { name: /open a panel/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit game' }));
    expect(send).toHaveBeenCalledWith('game', 'Exit');
    send.mockRestore();
  });

  it('Full screen hides the browser bars, and is left out where the browser has no fullscreen', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = requestFullscreen;
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    try {
      renderWithProviders(<MobileShell state={{}} />);
      fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      expect(requestFullscreen).toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: /open a panel/i })).toBeNull();
    } finally {
      delete document.documentElement.requestFullscreen;
      Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
    }

    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull();
  });

  it('offers Exit full screen while full screen', async () => {
    const exitFullscreen = vi.fn(() => Promise.resolve());
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true });
    try {
      renderWithProviders(<MobileShell state={{}} />);
      fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
      expect(exitFullscreen).toHaveBeenCalled();
    } finally {
      delete document.exitFullscreen;
      Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    }
  });

  it("shows addons' menu items and toolbar buttons, and runs the one tapped", async () => {
    const { addMenuItem } = await import('../../uiComponents/base/DDItems/menuItemsStore');
    const { addToolbarButton } = await import('../../uiComponents/base/DDItems/toolbarButtonsStore');
    const roll = vi.fn();
    const rest = vi.fn();
    act(() => {
      addMenuItem('game', <span key="roll" name="Roll initiative" onClick={roll} />);
      addToolbarButton({ name: 'Short rest', onClick: rest });
    });
    renderWithProviders(<MobileShell state={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Roll initiative' }));
    expect(roll).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /open a panel/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Short rest' }));
    expect(rest).toHaveBeenCalled();
  });

  it('a toolbar button an addon sends through the mediator shows up too', async () => {
    const ClientMediator = (await import('../../../ClientMediator')).default;
    renderWithProviders(<MobileShell state={{}} />);
    act(() => { ClientMediator.sendCommand('Toolbar', 'AddButton', { name: 'Loot', onClick: () => {} }); });
    fireEvent.click(screen.getByRole('button', { name: /add a tab/i }));
    expect(screen.getByRole('button', { name: 'Loot' })).toBeInTheDocument();
  });
});

describe('MobileShell: map tools', () => {
  beforeEach(() => resetTabs());

  it('a battle map tab has the map tools button; other tabs do not', () => {
    function Battlemap() { return <div>map</div>; }
    act(() => { openTab(<Battlemap withID="bm1" />, resolveKey); });
    renderWithProviders(<MobileShell state={{}} />);
    expect(screen.getByRole('button', { name: 'Map tools' })).toBeInTheDocument();

    act(() => { openTab(<Dice />, resolveKey); });
    expect(screen.queryByRole('button', { name: 'Map tools' })).toBeNull(); // hidden with its tab
  });
});
