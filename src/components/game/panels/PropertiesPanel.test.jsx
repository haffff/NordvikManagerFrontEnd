import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders as render } from '../../../setupTests';

const setTitle = vi.fn();
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle }) }));
vi.mock('../../uiComponents/hooks/useBattleMapName', () => ({ default: () => 'Dungeon' }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../settings/ElementsSettingsPanel', () => ({ default: ({ dto }) => <div>settings of {dto.name}</div> }));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(), sendCommandWaitForRegister: vi.fn() },
}));

import ClientMediator from '../../../ClientMediator';
import PropertiesPanel from './PropertiesPanel';

const goblin = { id: 'e1', name: 'Goblin' };
const orc = { id: 'e2', name: 'Orc' };

// The panel shows the element it was opened for, not whatever is selected later:
// selecting something else on the map must not swap what is being edited.
describe('PropertiesPanel', () => {
  let onSelectionChanged;

  beforeEach(() => {
    vi.clearAllMocks();
    onSelectionChanged = undefined;
    ClientMediator.sendCommandWaitForRegister.mockImplementation(async (panel, command, data) => {
      if (command === 'SubscribeSelectionChanged') onSelectionChanged = data.method;
      if (command === 'GetSelectedObjects') return [goblin];
    });
  });

  it('keeps showing the element it was opened for when the selection changes', async () => {
    render(<PropertiesPanel battlemapId="bm-1" />);
    expect(await screen.findByText('settings of Goblin')).toBeTruthy();

    await act(async () => onSelectionChanged?.({ selected: [orc], deselected: [goblin] }));

    expect(screen.getByText('settings of Goblin')).toBeTruthy();
    expect(screen.queryByText('settings of Orc')).toBeNull();
  });

  it('is titled after the element', async () => {
    render(<PropertiesPanel battlemapId="bm-1" />);
    await screen.findByText('settings of Goblin');

    expect(setTitle).toHaveBeenLastCalledWith('Dungeon - Goblin - Element Settings');
  });
});
