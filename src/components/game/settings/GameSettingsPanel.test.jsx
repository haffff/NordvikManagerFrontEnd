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
  ActiveWebHelper: { get: vi.fn() },
}));

vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(() => ({ id: 'someone-else' })) },
}));

vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

vi.mock('../../uiComponents/hooks/useGameHook', () => ({
  default: () => ({ id: 'game-1', name: 'Game One' }),
}));

vi.mock('./LayerListEditor', () => ({ default: () => null }));
vi.mock('./SystemAssetsSettingsPanel', () => ({ default: () => null }));
vi.mock('./SecuritySettingsPanel', () => ({ default: () => null }));
vi.mock('./PropertiesSettingsPanel', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('./SettingsPanelWithPropertySettings', () => ({
  SettingsPanelWithPropertySettings: ({ dto }) => <div data-testid="settings-name">{dto?.name}</div>,
}));

// Bypass Chakra's real tab-switching/lazyMount machinery entirely — this test
// only cares about what data reaches the tab content, not which tab is visible.
vi.mock('@chakra-ui/react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Tabs: {
      Root: ({ children }) => <div>{children}</div>,
      List: ({ children }) => <div>{children}</div>,
      Trigger: ({ children }) => <div>{children}</div>,
      Content: ({ children }) => <div>{children}</div>,
    },
  };
});

import { GameSettingsPanel } from './GameSettingsPanel';

// Regression coverage: updateSettings used to mutate gameData in place
// (gameData.name = event.data.name) with no setter call, so it never triggered a
// re-render — and only ever copied .name, dropping every other field.
describe('GameSettingsPanel — reflects settings_game broadcasts', () => {
  it('applies a full settings_game update (not just .name) to the rendered dto', () => {
    renderWithProviders(<GameSettingsPanel />);
    expect(screen.getAllByTestId('settings-name')[0]).toHaveTextContent('Game One');

    act(() => {
      subscribableHandlers['settings_game']({
        playerId: 'someone-else',
        data: { name: 'Game One (renamed)', color: 'red' },
      });
    });

    const nameNodes = screen.getAllByTestId('settings-name');
    expect(nameNodes.length).toBeGreaterThan(0);
    nameNodes.forEach((node) => expect(node).toHaveTextContent('Game One (renamed)'));
  });
});
