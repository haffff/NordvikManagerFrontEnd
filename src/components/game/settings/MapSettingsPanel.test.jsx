import { vi, describe, it, expect } from 'vitest';
import { screen, act } from '@testing-library/react';
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
  SettingsPanelWithPropertySettings: ({ dto }) => <div data-testid="settings-name">{dto?.name}</div>,
}));
vi.mock('./SecuritySettingsPanel', () => ({ default: () => null }));
vi.mock('./PropertiesSettingsPanel', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));

import { MapSettingsPanel } from './MapSettingsPanel';

// Regression coverage: MapSettingsPanel computed mapDto from the websocket-
// confirmed update but rendered the original, immutable `map` prop everywhere —
// a confirmed server-side edit never reached the visible form.
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
