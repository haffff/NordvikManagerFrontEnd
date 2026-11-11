import { vi, describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/transport', () => ({
  ActiveWebHelper: { postAsync: vi.fn(), getAsync: vi.fn() },
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

describe('BrowseInstalledTab — dependencies', () => {
  const installed = () => [
    { id: 'a1', key: 'dnd5e', name: 'Fifth Edition', dependencies: [{ key: 'core', version: '2.0' }, { key: 'dice', version: null }] },
    { id: 'a2', key: 'core', name: 'Core', dependencies: [] },
  ];

  it('lists what the addon needs, by installed name, with the lowest version', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrowseInstalledTab addons={installed()} loading={false} handleReload={vi.fn()} />);

    await user.click(screen.getByText('Fifth Edition'));

    expect(screen.getByText('Core ≥ 2.0')).toBeInTheDocument();
    // Not installed: shown by its key.
    expect(screen.getByText('dice')).toBeInTheDocument();
  });

  it('names the installed addons that need the selected one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BrowseInstalledTab addons={installed()} loading={false} handleReload={vi.fn()} />);

    await user.click(screen.getByText('Core'));

    expect(screen.getByText('Needed by')).toBeInTheDocument();
    expect(screen.getAllByText('Fifth Edition').length).toBeGreaterThan(1);
  });

  it('shows why an uninstall was refused', async () => {
    const { ActiveWebHelper } = await import('../../../../../helpers/transport');
    const { toaster } = await import('../../../../ui/toaster');
    const error = '"Core" is needed by "Fifth Edition". Uninstall those first.';
    ActiveWebHelper.postAsync.mockResolvedValue({ status: 409, body: { error } });
    const user = userEvent.setup();
    renderWithProviders(<BrowseInstalledTab addons={installed()} loading={false} handleReload={vi.fn()} />);

    await user.click(screen.getByText('Core'));
    await user.click(screen.getByRole('button', { name: /uninstall/i }));

    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Uninstall failed', description: error }));
  });

  it('warns, naming them, when turning off an addon others need', async () => {
    const { ActiveWebHelper } = await import('../../../../../helpers/transport');
    const { toaster } = await import('../../../../ui/toaster');
    ActiveWebHelper.postAsync.mockResolvedValue({ status: 200 });
    toaster.create.mockClear();
    const user = userEvent.setup();
    renderWithProviders(<BrowseInstalledTab addons={installed()} loading={false} handleReload={vi.fn()} />);

    await user.click(screen.getByText('Core'));
    await user.click(screen.getByText('Enabled'));

    expect(ActiveWebHelper.postAsync).toHaveBeenCalledWith('addon/setEnabled', { addonId: 'a2', enabled: false });
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      description: expect.stringContaining('Fifth Edition'),
    }));
  });
});

describe('BrowseInstalledTab — readme', () => {
  it('shows the readme of the registry entry with the same key', async () => {
    const { ActiveWebHelper } = await import('../../../../../helpers/transport');
    const url = 'https://raw.githubusercontent.com/haffff/NordvikManager-Extras/poll-0.1.0/poll/README.md';
    ActiveWebHelper.getAsync.mockImplementation(async (path) =>
      path === 'addon/readme?key=poll' ? { key: 'poll', url, markdown: '## How to vote' } : undefined);
    const user = userEvent.setup();

    renderWithProviders(<BrowseInstalledTab addons={[{ id: 'a1', key: 'poll', name: 'Poll' }]} repository={[{ key: 'poll', readme: url }]}
      loading={false} handleReload={vi.fn()} />);
    await user.click(screen.getByText('Poll'));

    expect(await screen.findByRole('heading', { name: 'How to vote' })).toBeInTheDocument();
  });
});
