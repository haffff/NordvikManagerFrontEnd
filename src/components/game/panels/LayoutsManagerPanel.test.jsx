import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

const subHandlers = {};
vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage }) => { subHandlers[commandPrefix] = onMessage; return null; },
}));
vi.mock('../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../settings/LayoutSettingsPanel', () => ({ default: () => null }));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() }),
  spawnFloating: vi.fn(),
}));

// Flatten the Chakra Select compound into a plain <select> we can drive.
vi.mock('../../ui/select', () => ({
  SelectRoot: ({ value, onValueChange, children }) => (
    <select data-testid="default-select" value={value?.[0] ?? ''}
      onChange={(e) => onValueChange({ value: [e.target.value] })}>{children}</select>
  ),
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ item, children }) => <option value={item.value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValueText: () => null,
}));

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { get: vi.fn(), getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../helpers/LayoutCloneHelper', () => ({
  default: { GetCloneForSaving: vi.fn(() => ({ __clone: true })) },
}));
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, cmd) => {
      if (cmd === 'GetGameId') return 'game-1';
      if (cmd === 'GetLayout') return { id: 'layout-A' };
      return undefined;
    }),
  },
}));
vi.mock('../../BattleMap/Factories/CommandFactory', () => ({
  default: {
    CreateLayoutUpdateCommand: (data) => ({ command: 'layout_update', data }),
    CreateLayoutRemoveCommand: (id) => ({ command: 'layout_remove', data: id }),
    CreateLayoutForceCommand: (id) => ({ command: 'layout_forcechange', data: id }),
    CreateLayoutAddCommand: (data) => ({ command: 'layout_add', data }),
    CreateUpdatePermissionsCommand: (id, entityType, permissions) => ({
      command: 'permission_update', data: { id, entityType, permissions },
    }),
  },
}));

import { ActiveWebHelper as WebHelper, ActiveTransportManager as Transport } from '../../../helpers/transport';
import { LayoutsManagerPanel } from './LayoutsManagerPanel';

const EMPTY = '00000000-0000-0000-0000-000000000000';
const LAYOUTS = [
  { id: 'layout-A', name: 'Combat', default: true, gameModelId: 'game-1' },
  { id: 'layout-B', name: 'Exploration', default: false, gameModelId: 'game-1' },
];

const fakeState = { ref: { current: { rootPanel: {} } } };

beforeEach(() => {
  vi.clearAllMocks();
  WebHelper.get.mockImplementation((path, cb) => cb(LAYOUTS.map((l) => ({ ...l }))));
  WebHelper.getAsync.mockResolvedValue({}); // no share rows
});

const render = () => renderWithProviders(<LayoutsManagerPanel state={fakeState} battlemapsRef={{ current: [] }} />);
const ready = () => waitFor(() => expect(screen.getAllByLabelText('Apply this layout')).toHaveLength(2));

describe('LayoutsManagerPanel', () => {
  it('renders one row per layout with the default marked', async () => {
    render();
    await ready();
    expect(screen.getByText('★ default')).toBeInTheDocument();
    expect(screen.getByTestId('default-select')).toHaveValue('layout-A');
  });

  it('changing the default combobox sends layout_update{default:true} and flips the badge', async () => {
    render();
    await ready();

    fireEvent.change(screen.getByTestId('default-select'), { target: { value: 'layout-B' } });

    expect(Transport.Send).toHaveBeenCalledWith({
      command: 'layout_update',
      data: { id: 'layout-B', default: true, gameModelId: 'game-1' },
    });
    // optimistic: the select now shows B
    expect(screen.getByTestId('default-select')).toHaveValue('layout-B');
  });

  it('"Overwrite with current arrangement" sends layout_update with a value string', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render();
    await ready();

    fireEvent.click(screen.getAllByLabelText('Overwrite with current arrangement')[1]); // row B

    expect(Transport.Send).toHaveBeenCalledWith({
      command: 'layout_update',
      data: { id: 'layout-B', gameModelId: 'game-1', value: JSON.stringify({ __clone: true }) },
    });
  });

  it('"Share with all players" sends permission_update granting SEE to everyone', async () => {
    render();
    await ready();

    fireEvent.click(screen.getAllByLabelText('Share with all players')[1]); // row B

    expect(Transport.Send).toHaveBeenCalledWith({
      command: 'permission_update',
      data: { id: 'layout-B', entityType: 'LayoutModel', permissions: { [EMPTY]: 1 } },
    });
  });

  it('an incoming layout_update{default:true} moves the default badge', async () => {
    render();
    await ready();

    act(() => subHandlers['layout_update']({ data: { id: 'layout-B', default: true } }));

    expect(screen.getByTestId('default-select')).toHaveValue('layout-B');
  });
});
