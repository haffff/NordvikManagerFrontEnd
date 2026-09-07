import { vi, describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/transport', () => ({
  ActiveWebHelper: { postAsync: vi.fn() },
}));
vi.mock('../../../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import { BrowseInstalledTab } from './BrowseInstalledTab';

// Regression coverage: selectedKey is set via `addon.key ?? addon.id`, but
// currentSelected was looked up via `x.key` only — for an addon that has an id
// but no key (the uninstall/toggle handlers already assumed such records exist),
// clicking it never selected/highlighted it; the detail pane stayed on
// "Select an addon to view details".
describe('BrowseInstalledTab — selection fallback for addons without a key', () => {
  it('selects and shows details for an addon that has an id but no key', async () => {
    const user = userEvent.setup();
    const addons = [{ id: 'addon-1', name: 'No Key Addon', version: '1.0.0' }];

    renderWithProviders(<BrowseInstalledTab addons={addons} loading={false} handleReload={vi.fn()} />);

    expect(screen.getByText(/select an addon to view details/i)).toBeInTheDocument();

    await user.click(screen.getByText('No Key Addon'));

    // The detail pane only renders (with its Update/Uninstall actions) once
    // currentSelected actually resolves — this is the concrete, unambiguous
    // signal that selection worked for an addon with no `key`.
    expect(screen.queryByText(/select an addon to view details/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });

  it('still works normally for an addon that does have a key', async () => {
    const user = userEvent.setup();
    const addons = [{ key: 'addon-key-1', id: 'addon-1', name: 'Keyed Addon' }];

    renderWithProviders(<BrowseInstalledTab addons={addons} loading={false} handleReload={vi.fn()} />);
    await user.click(screen.getByText('Keyed Addon'));

    expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });
});
