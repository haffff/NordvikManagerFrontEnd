import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const containerProps = vi.hoisted(() => ({ current: null }));
const send = vi.hoisted(() => vi.fn());

vi.mock('@hlorenzi/react-dockable', () => ({
  Container: (props) => { containerProps.current = props; return null; },
}));
vi.mock('../../helpers/transport', () => ({ ActiveTransportManager: { Send: send } }));
vi.mock('../../helpers/DockableHelper', () => ({ default: { getPopOutHandler: () => undefined } }));
vi.mock('../../helpers/PanelsList', () => ({ getPanelKeyForComponent: (type) => type.panelKey }));

import GameDock from './GameDock';
import { PermissionsProvider } from '../../contexts/PermissionsContext';

const CardPanel = Object.assign(() => null, { panelKey: 'CardPanel' });
const cardContent = { contentId: 1, title: 'Goblin', element: { type: CardPanel, props: { id: 'card-1', name: 'Goblin' } } };

describe('GameDock', () => {
  beforeEach(() => { containerProps.current = null; send.mockClear(); });

  it('gives the GM "Show to players" in a panel menu, which shows the panel to the others', () => {
    render(<PermissionsProvider gameId="g" isOwner><GameDock state={{}} battleMaps={{}} /></PermissionsProvider>);

    const items = containerProps.current.menuItems(cardContent);
    expect(items.map((i) => i.label)).toEqual(['Show to players']);
    items[0].onClick();
    expect(send).toHaveBeenCalledWith({ command: 'show_panel', data: { type: 'CardPanel', props: { id: 'card-1', name: 'Goblin' } } });
  });

  it('gives players nothing extra', () => {
    render(<PermissionsProvider gameId="g"><GameDock state={{}} battleMaps={{}} /></PermissionsProvider>);

    expect(containerProps.current.menuItems(cardContent)).toEqual([]);
  });
});
