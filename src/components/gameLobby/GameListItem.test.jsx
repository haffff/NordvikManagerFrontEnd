import { vi, describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../setupTests';

vi.mock('../../helpers/WebHelper', () => ({ default: { postAsync: vi.fn(), deleteAsync: vi.fn(), getResourceString: vi.fn() } }));
vi.mock('../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import WebHelper from '../../helpers/WebHelper';
import GameListItem from './GameListItem';

const game = (extra) => ({ id: 'g1', name: 'Campaign', shortDescription: 'Old one', isOwner: false, isMember: true, canManage: false, ...extra });

// The server's local admin sees every game: they can rename and delete games they are not
// in, but there's nothing for them to join.
describe('GameListItem', () => {
  afterEach(() => vi.clearAllMocks());

  it('a player who cannot manage the game gets no settings', () => {
    renderWithProviders(<GameListItem game={game()} onClick={vi.fn()} reload={vi.fn()} />);

    expect(screen.queryByTitle('Game settings')).toBeNull();
    expect(screen.queryByText('Join')).not.toBeNull();
  });

  it("the local admin manages a game they're not in, which they can't join", () => {
    const onClick = vi.fn();
    renderWithProviders(<GameListItem game={game({ canManage: true, isMember: false })} onClick={onClick} reload={vi.fn()} />);

    expect(screen.queryByTitle('Game settings')).not.toBeNull();
    expect(screen.queryByText('Not a member')).not.toBeNull();
    expect(screen.queryByText('Join')).toBeNull();
    fireEvent.click(screen.getByText('Campaign'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('saving sends the name and the description shown on the card', async () => {
    WebHelper.postAsync.mockResolvedValue({ ok: true });
    renderWithProviders(<GameListItem game={game({ canManage: true })} onClick={vi.fn()} reload={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Game settings'));
    const description = await screen.findByDisplayValue('Old one');
    fireEvent.change(description, { target: { value: 'New one' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() =>
      expect(WebHelper.postAsync).toHaveBeenCalledWith('gamelist/updategame', { gameId: 'g1', name: 'Campaign', description: 'New one' })
    );
  });
});
