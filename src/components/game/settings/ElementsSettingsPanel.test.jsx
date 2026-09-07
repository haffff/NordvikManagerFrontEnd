import { vi, describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ children }) => <>{children}</>,
}));
vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(() => ({ id: 'player-1' })) },
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));
vi.mock('./SettingsPanel', () => ({ default: () => <div data-testid="settings-panel" /> }));
vi.mock('./SecuritySettingsPanel', () => ({ default: () => <div data-testid="permissions-panel" /> }));
vi.mock('./PropertiesSettingsPanel', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/Containers/DButtonHorizontalContainer', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../uiComponents/base/DDItems/DropDrownButton', () => ({ default: () => null }));

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
