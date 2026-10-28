import { vi, describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ children }) => <>{children}</>,
}));
vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: vi.fn() },
  ActiveWebHelper: { get: vi.fn((url, ok) => ok([{ name: 'mask_hp_gmonly', value: 'True' }])), getAsync: vi.fn(async () => []) },
}));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(() => ({ id: 'player-1' })) },
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));
vi.mock('./SettingsPanel', () => ({
  default: ({ dto, editableKeyLabelDict, onSave }) => (
    <div data-testid={editableKeyLabelDict?.some((e) => e.key.startsWith('mask_')) ? 'mask-panel' : 'settings-panel'}
         data-dto={JSON.stringify(dto)} data-types={(editableKeyLabelDict ?? []).map((e) => e.type).join(',')}>
      <button onClick={() => onSave({ mask_hp_mode: 'hidden' })}>save</button>
    </div>
  ),
}));
vi.mock('./SecuritySettingsPanel', () => ({ default: () => <div data-testid="permissions-panel" /> }));
vi.mock('./PropertiesSettingsPanel', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/Containers/DButtonHorizontalContainer', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../uiComponents/base/DDItems/DropDrownButton', () => ({ default: () => null }));

import { ActiveTransportManager } from '../../../helpers/transport';
import { ElementSettingsPanel } from './ElementsSettingsPanel';

// Regression coverage: ElementsSettingsPanel was the only settings panel missing
// `defaultValue` on Tabs.Root — every sibling (GameSettingsPanel,
// MapSettingsPanel, CardSettingsPanel, LayoutSettingsPanel, ...) sets one.
// Combined with `lazyMount`, no tab's content mounted on first open.
describe('ElementsSettingsPanel — default tab', () => {
  it('mounts the Settings tab content by default, without clicking a tab trigger', () => {
    const dto = { toJSON: () => ({ id: 'el-1', name: 'Element' }), id: 'el-1', name: 'Element' };
    renderWithProviders(<ElementSettingsPanel dto={dto} battlemapId="bm-1" />);

    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('permissions-panel')).not.toBeInTheDocument();
  });
});

describe('ElementsSettingsPanel — token element overrides', () => {
  const renderGoblin = () => {
    const additionalObjects = [{ tokenData: { maskGroup: 'hp', label: 'HP bar' } }];
    const dto = { toJSON: () => ({ id: 'el-1', name: 'Goblin' }), id: 'el-1', name: 'Goblin', additionalObjects };
    renderWithProviders(<ElementSettingsPanel dto={dto} battlemapId="bm-1" />);
    fireEvent.click(screen.getByRole('tab', { name: /Token/ }));
    return screen.findByTestId('mask-panel');
  };

  it("shows this token's override as one four-way choice", async () => {
    const panel = await renderGoblin();

    expect(panel.dataset.types).toBe('segmented');
    expect(JSON.parse(panel.dataset.dto)).toMatchObject({ mask_hp_mode: 'gmonly' });
  });

  it('stores the choice on the token as both properties', async () => {
    const panel = await renderGoblin();

    fireEvent.click(panel.querySelector('button'));

    await waitFor(() => expect(ActiveTransportManager.Send).toHaveBeenCalledTimes(2));
    expect(ActiveTransportManager.Send).toHaveBeenCalledWith({
      command: 'property_add',
      data: { name: 'mask_hp_enabled', value: 'false', parentId: 'el-1', EntityName: 'ElementModel' },
    });
    expect(ActiveTransportManager.Send).toHaveBeenCalledWith({
      command: 'property_add',
      data: { name: 'mask_hp_gmonly', value: 'false', parentId: 'el-1', EntityName: 'ElementModel' },
    });
  });
});
