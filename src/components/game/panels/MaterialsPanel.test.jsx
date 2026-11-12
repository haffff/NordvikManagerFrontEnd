import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

const { perms } = vi.hoisted(() => ({ perms: { canEditGame: false, isLocalAdmin: false } }));

vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/base/CollectionSyncer', () => ({ default: () => null }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ ...perms, hasEntityPermission: () => perms.canEditGame }),
}));
// The tree draws each folder's add row (Upload files / Link local file or folder…).
// Its items' buttons are drawn for two sample resources: a JSON file and a picture.
const SAMPLE_ITEMS = vi.hoisted(() => [
  { id: 'r-json', name: 'token_hero.json', mimeType: 'application/json', storage: 0 },
  { id: 'r-png', name: 'hero.png', mimeType: 'image/png', storage: 0 },
]);
// thumbnails: whether the game's backend makes them; bodies: render each item's row body too.
const view = vi.hoisted(() => ({ thumbnails: true, bodies: false }));
vi.mock('../../../host/hostInfo', () => ({ useHasThumbnails: () => view.thumbnails }));
vi.mock('../../uiComponents/base/List/DTreeListItem', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/ResourceImage', () => ({ default: ({ id, thumbnail }) => <img alt="" data-testid={`image-${id}${thumbnail ? '-thumbnail' : ''}`} /> }));
vi.mock('../../uiComponents/treeList/DTreeList', () => ({
  default: ({ renderAddRow, onGenerateEditButtons, generateItem }) => (
    <>
      {renderAddRow ? renderAddRow(null) : null}
      {view.bodies && generateItem && SAMPLE_ITEMS.map((item) => <div key={item.id} data-testid={`body-${item.id}`}>{generateItem(item)}</div>)}
      {onGenerateEditButtons && SAMPLE_ITEMS.map((item) => <div key={item.id} data-testid={`item-${item.id}`}>{onGenerateEditButtons(item)}</div>)}
    </>
  ),
  AddRow: ({ label, onClick, children }) => <div><button onClick={onClick}>{label}</button>{children}</div>,
}));
vi.mock('../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../../../ClientMediator', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    sendCommand: vi.fn((panel, command) => {
      if (command === 'GetCurrentPlayer') return { id: 'player-1' };
      if (command === 'GetGameId') return 'game-1';
      return undefined;
    }),
  },
}));
vi.mock('../../../helpers/ProgressToastManager', () => ({ default: {} }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(async () => []), get: vi.fn(), getResourceString: (id) => `/api/Materials/Resource?id=${id}` },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));

const tokenEditing = vi.hoisted(() => ({ editTokenResource: vi.fn() }));
vi.mock('../tokenEditing', async (importOriginal) => ({ ...(await importOriginal()), editTokenResource: tokenEditing.editTokenResource }));

import { MaterialsPanel } from './MaterialsPanel';
import { fireEvent, within } from '@testing-library/react';

const LINK = 'Link local file or folder…';

// Linking reaches into the disk of whoever runs the server, so only its local admin gets
// it; seeing every player's materials follows Edit on the game.
describe('MaterialsPanel', () => {
  beforeEach(() => {
    perms.canEditGame = false;
    perms.isLocalAdmin = false;
    view.thumbnails = true;
    view.bodies = false;
  });

  // A game hosted in a browser has no thumbnails: each preview would be the whole image.
  it('shows image thumbnails when the backend makes them', async () => {
    view.bodies = true;
    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByTestId('image-r-png-thumbnail')).not.toBeNull());
    expect(screen.queryByTestId('material-preview-eye')).toBeNull();
  });

  it('shows an eye instead of loading the image when the backend makes no thumbnails', async () => {
    view.bodies = true;
    view.thumbnails = false;
    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByTestId('material-preview-eye')).not.toBeNull());
    expect(screen.queryByTestId('image-r-png-thumbnail')).toBeNull();
    expect(screen.getByLabelText('Preview hero.png')).toBeTruthy();
  });

  it('an editor who is not the local admin sees all resources but cannot link files', async () => {
    perms.canEditGame = true;

    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByText('All Resources')).not.toBeNull());
    expect(screen.queryByText(LINK)).toBeNull();
  });

  it('the local admin can link files', async () => {
    perms.canEditGame = true;
    perms.isLocalAdmin = true;

    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryAllByText(LINK).length).toBeGreaterThan(0));
  });

  it('a player sees only their own materials and no link button', async () => {
    renderWithProviders(<MaterialsPanel state={{}} />);

    await waitFor(() => expect(screen.queryByText('All Resources')).toBeNull());
    expect(screen.queryByText(LINK)).toBeNull();
  });
});

describe('MaterialsPanel add row', () => {
  it('offers Upload files as a real button, and opens the file picker', async () => {
    perms.canEditGame = true;
    const { container } = renderWithProviders(<MaterialsPanel state={{}} />);

    const upload = (await screen.findAllByRole('button', { name: /Upload files/ }))[0];
    const input = container.querySelector('input[type="file"]');
    const click = vi.spyOn(input, 'click');
    upload.click();

    expect(click).toHaveBeenCalled();
  });
});

// A JSON resource can be a token file: an editor of the game opens it in the token
// editor, whose "Save to game" writes it back (components/game/tokenEditing.js).
describe('MaterialsPanel token files', () => {
  beforeEach(() => { perms.canEditGame = false; });

  it('JSON resources get "Edit in token editor" for an editor of the game', async () => {
    perms.canEditGame = true;
    renderWithProviders(<MaterialsPanel state={{}} />);

    const json = (await screen.findAllByTestId('item-r-json'))[0];
    fireEvent.click(within(json).getByRole('button', { name: 'Edit in token editor' }));
    expect(tokenEditing.editTokenResource).toHaveBeenCalledWith({ id: 'r-json', name: 'token_hero.json' });
    expect(within(screen.getAllByTestId('item-r-png')[0]).queryByRole('button', { name: 'Edit in token editor' })).toBeNull();
  });

  it('not for players', async () => {
    renderWithProviders(<MaterialsPanel state={{}} />);
    await waitFor(() => expect(screen.queryAllByText(/Upload files/).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Edit in token editor' })).toBeNull();
  });
});
