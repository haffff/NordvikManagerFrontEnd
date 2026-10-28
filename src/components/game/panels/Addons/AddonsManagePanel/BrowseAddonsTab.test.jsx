import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../../setupTests';

vi.mock('../../../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), postAsync: vi.fn() },
}));
vi.mock('../../../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));
vi.mock('../../../../../helpers/ProgressToastManager', () => ({ default: { track: vi.fn(() => Promise.resolve()) } }));

import { ActiveWebHelper as WebHelper } from '../../../../../helpers/transport';
import { BrowseAddonsTab } from './BrowseAddonsTab';
import { clearReadmeCache } from './AddonReadme';

const README = 'https://raw.githubusercontent.com/haffff/NordvikManager-Extras/poll-0.1.0/poll/README.md';
const repository = [
  { key: 'poll', name: 'Poll', author: 'haffff', version: '0.1.0', license: 'AGPL-3.0-only', description: 'Let the table vote', categories: ['tools'], readme: README, repositoryUrl: 'https://github.com/haffff/NordvikManager-Extras' },
  { key: 'obsidian', name: 'Obsidian', author: 'haffff', version: '0.1.0', description: 'Notes from your vault', categories: ['tools'] },
  { key: 'dnd5e', name: '5E Edition', author: 'haffff', version: '0.0.7', description: 'Sheets and monsters', categories: ['game-system'] },
];
const categories = [{ key: 'game-system', name: 'Game systems' }, { key: 'tools', name: 'Tools' }];

const renderTab = (props = {}) => renderWithProviders(
  <BrowseAddonsTab repository={repository} categories={categories} addons={[]} handleReload={vi.fn()} loading={false} repositoryError={false} {...props} />);

const listedNames = () => screen.getAllByTestId('addon-row').map((row) => within(row).getByTestId('addon-name').textContent);

describe('BrowseAddonsTab', () => {
  beforeEach(() => {
    clearReadmeCache();
    WebHelper.getAsync.mockReset();
    WebHelper.postAsync.mockReset();
  });

  it('lists addons with their category badges, sorted by name', () => {
    renderTab();
    expect(listedNames()).toEqual(['5E Edition', 'Obsidian', 'Poll']);
    expect(within(screen.getAllByTestId('addon-row')[2]).getByText('Tools')).toBeInTheDocument();
  });

  it('filters by category and searches descriptions', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Category'), 'tools');
    expect(listedNames()).toEqual(['Obsidian', 'Poll']);

    await user.selectOptions(screen.getByLabelText('Category'), 'all');
    await user.type(screen.getByPlaceholderText(/search/i), 'monsters');
    expect(listedNames()).toEqual(['5E Edition']);
  });

  it('sorts by category', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.selectOptions(screen.getByLabelText('Sort by'), 'category');
    expect(listedNames()).toEqual(['5E Edition', 'Obsidian', 'Poll']);
  });

  it('shows an addon\'s details with its readme rendered', async () => {
    const user = userEvent.setup();
    WebHelper.getAsync.mockImplementation(async (path) =>
      path === 'addon/readme?key=poll' ? { key: 'poll', url: README, markdown: '# Poll readme\n\n![shot](shot.png)' } : undefined);
    renderTab();

    await user.click(screen.getByText('Poll'));

    const details = await screen.findByTestId('addon-details');
    expect(await within(details).findByRole('heading', { name: 'Poll readme' })).toBeInTheDocument();
    expect(within(details).getByRole('img').getAttribute('src')).toBe('https://raw.githubusercontent.com/haffff/NordvikManager-Extras/poll-0.1.0/poll/shot.png');
    expect(within(details).getByText('AGPL-3.0-only')).toBeInTheDocument();
    expect(within(details).getByRole('link', { name: /repository/i })).toHaveAttribute('href', 'https://github.com/haffff/NordvikManager-Extras');
  });

  it('shows the short description for an addon without a readme, without asking the server', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByText('Obsidian'));

    const details = await screen.findByTestId('addon-details');
    expect(within(details).getByText('Notes from your vault')).toBeInTheDocument();
    expect(WebHelper.getAsync).not.toHaveBeenCalled();
  });

  it('installs from the details pane', async () => {
    const user = userEvent.setup();
    WebHelper.getAsync.mockResolvedValue(undefined);
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { operationId: 'op-1' } });
    renderTab();

    await user.click(screen.getByText('5E Edition'));
    await user.click(within(await screen.findByTestId('addon-details')).getByRole('button', { name: /install/i }));

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith('addon/install', { key: 'dnd5e' }));
  });

  it('works with an older server: no categories, no filter shown', () => {
    renderTab({ categories: [], repository: repository.map(({ categories: _c, ...a }) => a) });
    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument();
    expect(listedNames()).toHaveLength(3);
  });
});
