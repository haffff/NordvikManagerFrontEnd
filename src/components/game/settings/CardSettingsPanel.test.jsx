import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';
import { CardSettingsPanel } from './CardSettingsPanel';

// Saving the card's General tab used to send "settings_game", so renaming a card renamed
// the game; the panel also listened for "settings_card", which the backend never sends.

const subscribableHandlers = {};
vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage, children }) => {
    subscribableHandlers[commandPrefix] = onMessage;
    return <>{children}</>;
  },
}));

const { transport, settingsProps } = vi.hoisted(() => ({
  transport: { Send: vi.fn(), get: vi.fn() },
  settingsProps: { latest: [] },
}));
vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: transport.Send },
  ActiveWebHelper: { get: transport.get, getAsync: vi.fn(), postAsync: vi.fn() },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() }),
}));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommand: vi.fn(), sendCommandAsync: vi.fn() } }));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));
vi.mock('./SecuritySettingsPanel', () => ({ default: () => null }));
vi.mock('./PropertiesSettingsPanel', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('./SettingsPanelWithPropertySettings', () => ({
  SettingsPanelWithPropertySettings: (props) => {
    settingsProps.latest = [...settingsProps.latest.filter((p) => p.editableKeyLabelDict?.[0]?.key !== props.editableKeyLabelDict?.[0]?.key), props];
    return <div data-testid={`settings-${props.editableKeyLabelDict?.[0]?.key}`}>{props.dto?.name}</div>;
  },
}));
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

const card = { id: 'card-1', name: 'Goblin', description: 'A goblin', mainResource: null, additionalResources: [] };
const generalTab = () => settingsProps.latest.find((p) => p.editableKeyLabelDict?.[0]?.key === 'name');

describe('CardSettingsPanel', () => {
  beforeEach(() => {
    transport.Send.mockClear();
    settingsProps.latest = [];
    transport.get.mockImplementation((url, onOk) => onOk({ ...card }));
  });

  it('saves a renamed card as a card update, never as game settings', () => {
    renderWithProviders(<CardSettingsPanel cardId="card-1" />);

    act(() => generalTab().onSave({ name: 'Hobgoblin' }));

    expect(transport.Send).toHaveBeenCalledTimes(1);
    const [sent] = transport.Send.mock.calls[0];
    expect(sent.command).toBe('card_update');
    expect(sent.data).toMatchObject({ id: 'card-1', name: 'Hobgoblin', description: 'A goblin' });
  });

  it('shows the new name when this card is updated, and ignores other cards', () => {
    renderWithProviders(<CardSettingsPanel cardId="card-1" />);
    expect(subscribableHandlers.card_update).toBeTypeOf('function');

    act(() => subscribableHandlers.card_update({ data: { id: 'card-2', name: 'Orc' } }));
    expect(screen.getByTestId('settings-name').textContent).toBe('Goblin');

    act(() => subscribableHandlers.card_update({ data: { id: 'card-1', name: 'Hobgoblin' } }));
    expect(screen.getByTestId('settings-name').textContent).toBe('Hobgoblin');
  });
});
