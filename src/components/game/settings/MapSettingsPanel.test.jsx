import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

const subscribableHandlers = {};
vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage, children }) => {
    subscribableHandlers[commandPrefix] = onMessage;
    return <>{children}</>;
  },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() }),
}));

vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: vi.fn() },
}));

vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

vi.mock('./SettingsPanelWithPropertySettings', () => ({
  SettingsPanelWithPropertySettings: ({ dto, editableKeyLabelDict }) => (
    <div data-testid={editableKeyLabelDict.some((e) => e.key.startsWith('mask_')) ? 'mask-settings' : 'settings-name'}
         data-keys={editableKeyLabelDict.map((e) => e.key).join(',')}>{dto?.name}</div>
  ),
}));

// Which battle maps are open, and the mask groups found on their tokens.
let openedMaps = [];
let maskGroups = [];
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, cmd, data) => {
      if (cmd === 'GetOpenedBattleMaps') return openedMaps;
      if (cmd === 'GetSelectedMap') return { id: 'map-1' };
      return undefined;
    }),
    sendCommandAsync: vi.fn(async (panel, cmd) => (cmd === 'GetAvailableMaskGroups' ? maskGroups : undefined)),
  },
}));
vi.mock('./SecuritySettingsPanel', () => ({ default: () => null }));
vi.mock('./PropertiesSettingsPanel', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));

import { MapSettingsPanel } from './MapSettingsPanel';

// Regression coverage: MapSettingsPanel computed mapDto from the websocket-
// confirmed update but rendered the original, immutable `map` prop everywhere —
// a confirmed server-side edit never reached the visible form.
beforeEach(() => { openedMaps = []; maskGroups = []; });

describe('MapSettingsPanel — renders the tracked mapDto, not the stale map prop', () => {
  it('reflects a settings_map update for its own map id', () => {
    renderWithProviders(<MapSettingsPanel map={{ id: 'map-1', name: 'Map One' }} />);
    expect(screen.getByTestId('settings-name')).toHaveTextContent('Map One');

    act(() => {
      subscribableHandlers['settings_map']({ data: { id: 'map-1', name: 'Map One (renamed)' } });
    });

    expect(screen.getByTestId('settings-name')).toHaveTextContent('Map One (renamed)');
  });

  it('ignores an update for a different map id', () => {
    renderWithProviders(<MapSettingsPanel map={{ id: 'map-1', name: 'Map One' }} />);

    act(() => {
      subscribableHandlers['settings_map']({ data: { id: 'map-2', name: 'Hijacked' } });
    });

    expect(screen.getByTestId('settings-name')).toHaveTextContent('Map One');
  });
});

describe('MapSettingsPanel — token elements', () => {
  beforeEach(() => {
    openedMaps = [{ id: 'bm-1' }];
    maskGroups = [{ maskGroup: 'hp', label: 'HP bar' }];
  });

  it('has its own Token Elements tab, so the Settings tab stays short', async () => {
    renderWithProviders(<MapSettingsPanel map={{ id: 'map-1', name: 'Map One' }} />);

    expect(screen.getByTestId('settings-name').dataset.keys).not.toContain('mask_');

    fireEvent.click(screen.getByRole('tab', { name: 'Token Elements' }));
    const masks = await screen.findByTestId('mask-settings');
    expect(masks.dataset.keys).toBe('mask_hp_enabled,mask_hp_gmonly');
  });

  it('explains when there is nothing to set', async () => {
    maskGroups = [];
    renderWithProviders(<MapSettingsPanel map={{ id: 'map-1', name: 'Map One' }} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Token Elements' }));
    expect(await screen.findByText(/No token on this map/)).toBeInTheDocument();
  });
});
