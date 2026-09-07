import { vi, describe, it, expect } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

const subscribableHandlers = {};
vi.mock('../../uiComponents/base/Subscribable', () => ({
  // LayoutSettingsPanel wraps its whole tree in <Subscribable>...</Subscribable>
  // (unlike some components that render it as a sibling), so the mock must
  // render children through, not just capture the handler and return null.
  default: ({ commandPrefix, onMessage, children }) => {
    subscribableHandlers[commandPrefix] = onMessage;
    return <>{children}</>;
  },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() }),
}));

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));

// Render just enough of SettingsPanel/SecuritySettingsPanel to observe which
// layout's data actually reached them.
vi.mock('./SettingsPanel', () => ({
  default: ({ dto }) => <div data-testid="settings-name">{dto?.name}</div>,
}));
vi.mock('./SecuritySettingsPanel', () => ({
  default: ({ dto }) => <div data-testid="perms-name">{dto?.name}</div>,
}));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));

import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { LayoutSettingsPanel } from './LayoutSettingsPanel';

// Regression coverage: updateSettings was missing the id guard every sibling
// settings panel has (CardSettingsPanel/MapSettingsPanel both check
// event.data?.id !== dto?.id). Without it, ANY layout's "layout_update"
// broadcast (the prefix fires system-wide, same as LayoutsMenu's list-sync
// listener) overwrote this panel's state wholesale, including layout.id —
// corrupting the wrong layout on the next Save.
describe('LayoutSettingsPanel — cross-layout update isolation', () => {
  it("ignores a different layout's update", async () => {
    WebHelper.getAsync.mockResolvedValue({ id: 'layout-A', name: 'Layout A' });
    renderWithProviders(<LayoutSettingsPanel layoutId="layout-A" />);

    await waitFor(() => expect(screen.getByTestId('settings-name')).toHaveTextContent('Layout A'));

    act(() => {
      subscribableHandlers['layout_update']({ data: { id: 'layout-B', name: 'Layout B (hijacked)' } });
    });

    expect(screen.getByTestId('settings-name')).toHaveTextContent('Layout A');
    expect(screen.getByTestId('perms-name')).toHaveTextContent('Layout A');
  });

  it('applies an update for its OWN layout id', async () => {
    WebHelper.getAsync.mockResolvedValue({ id: 'layout-A', name: 'Layout A' });
    renderWithProviders(<LayoutSettingsPanel layoutId="layout-A" />);

    await waitFor(() => expect(screen.getByTestId('settings-name')).toHaveTextContent('Layout A'));

    act(() => {
      subscribableHandlers['layout_update']({ data: { id: 'layout-A', name: 'Layout A (renamed)' } });
    });

    expect(screen.getByTestId('settings-name')).toHaveTextContent('Layout A (renamed)');
  });
});
