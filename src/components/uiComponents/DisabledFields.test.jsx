import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../setupTests';

// Chakra 3 components (and DListItemButton) take `disabled`; `isDisabled` (the Chakra 2
// name) was silently ignored, so these fields stayed usable when they should be locked.

vi.mock('./base/Subscribable', () => ({ default: () => null }));
vi.mock('../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), get: vi.fn(), getResourceBlobAsync: vi.fn(() => Promise.resolve(null)) },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn(), WebSocketReady: true },
}));
vi.mock('../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

import { ActiveWebHelper } from '../../helpers/transport';
import ClientMediator from '../../ClientMediator';
import { DColorPicker } from './settingsComponents/ColorPicker';
import { MaterialChooser } from './MaterialChooser';
import { PlayerChooser } from './PlayerChooser';
import SettingsPanel from '../game/settings/SettingsPanel';

describe('disabled fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ActiveWebHelper.getAsync.mockResolvedValue([{ id: 'm1', name: 'map.png', mimeType: 'image/png' }]);
    ClientMediator.sendCommand.mockImplementation((panel, command) =>
      command === 'GetPlayers' ? [{ id: 'p1', name: 'Alice' }] : null);
  });

  it('colour picker', () => {
    renderWithProviders(<DColorPicker initColor="rgba(255,0,0,1)" isDisabled />);

    expect(screen.getByRole('button').disabled).toBe(true);
  });

  it('material chooser: the remove button of a chosen material', async () => {
    renderWithProviders(<MaterialChooser materialsSelected={['m1']} isDisabled />);

    const remove = await screen.findByRole('button', { name: 'Remove map.png' });
    expect(remove.disabled).toBe(true);
  });

  it('player chooser: the remove button of a chosen player', async () => {
    renderWithProviders(<PlayerChooser selectedPlayers={['p1']} isDisabled />);

    const remove = await screen.findByRole('button', { name: 'Remove Alice' });
    expect(remove.disabled).toBe(true);
  });

  it('settings panel: a textarea field', async () => {
    renderWithProviders(
      <SettingsPanel
        dto={{ notes: 'hello' }}
        editableKeyLabelDict={[{ key: 'notes', label: 'Notes', type: 'textarea', disableOn: () => true }]}
        hideSaveButton
      />
    );

    await waitFor(() => expect(screen.getByDisplayValue('hello').disabled).toBe(true));
  });
});
