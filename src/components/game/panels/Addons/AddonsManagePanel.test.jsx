import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../setupTests';

vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), postAsync: vi.fn() },
}));
vi.mock('../../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import { ActiveWebHelper as WebHelper } from '../../../../helpers/transport';
import { AddonsManagePanel } from './AddonsManagePanel';

const spinner = (container) => container.querySelector('.chakra-spinner');

// Regression: a request over WebRTC that gets no answer rejects (30 s timeout) rather
// than resolving undefined. handleReload awaited both lists in a Promise.all and only
// then cleared `loading`, so one slow/failed list left the panel spinning forever —
// nothing could be installed until the page was refreshed.
describe('AddonsManagePanel loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stops loading and offers a retry when the addon list request fails', async () => {
    WebHelper.getAsync.mockImplementation(async (path) => {
      if (path === 'addon/repository') throw new Error('WebRTC API timeout: GET api/addon/repository');
      return [];
    });

    const { container } = renderWithProviders(<AddonsManagePanel />);

    expect(await screen.findByText(/couldn't load the addon list/i)).toBeInTheDocument();
    expect(spinner(container)).toBeNull();
  });

  it('retrying loads the list', async () => {
    const user = userEvent.setup();
    let failRepository = true;
    WebHelper.getAsync.mockImplementation(async (path) => {
      if (path === 'addon/repository') {
        if (failRepository) throw new Error('timeout');
        return [{ key: 'dnd5e', name: 'Fifth Edition', author: 'someone' }];
      }
      return [];
    });

    renderWithProviders(<AddonsManagePanel />);
    await screen.findByText(/couldn't load the addon list/i);

    failRepository = false;
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Fifth Edition')).toBeInTheDocument();
  });

  it('shows the list when both requests succeed', async () => {
    WebHelper.getAsync.mockImplementation(async (path) =>
      path === 'addon/repository' ? [{ key: 'dnd5e', name: 'Fifth Edition', author: 'someone' }] : []);

    const { container } = renderWithProviders(<AddonsManagePanel />);

    expect(await screen.findByText('Fifth Edition')).toBeInTheDocument();
    await waitFor(() => expect(spinner(container)).toBeNull());
  });
});
