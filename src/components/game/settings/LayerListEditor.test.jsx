import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

const layerList = JSON.stringify([
  { id: 'secrets', fields: { name: 'Secrets', layerId: '150', gmOnly: 'true', hidden: 'false' } },
  { id: 'decor', fields: { name: 'Decor', layerId: '50' } },
]);

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    get: vi.fn((url, ok) => ok([{ id: 'prop-1', name: 'customLayers', entityName: 'GameModel', value: layerList }])),
  },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommand: vi.fn() } }));

import { ActiveTransportManager } from '../../../helpers/transport';
import { LayerListEditor } from './LayerListEditor';

const sentFlags = () => ActiveTransportManager.Send.mock.calls
  .map(([cmd]) => cmd)
  .filter((cmd) => cmd.command === 'property_list_item_update')
  .map((cmd) => [cmd.data.itemId, cmd.data.fields]);

describe('LayerListEditor — hiding layers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows which layers are GM-only or hidden', async () => {
    renderWithProviders(<LayerListEditor gameId="game-1" />);

    expect(await screen.findByRole('button', { name: 'Secrets: GM only (click to make visible to players)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Decor: visible (click to hide)' })).toBeInTheDocument();
  });

  it('hides a layer, and makes one GM-only, from its row', async () => {
    renderWithProviders(<LayerListEditor gameId="game-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Decor: visible (click to hide)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decor: for everyone (click to make GM only)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Secrets: GM only (click to make visible to players)' }));

    expect(sentFlags()).toEqual([
      ['decor', { hidden: 'true', gmOnly: 'false' }],
      ['decor', { hidden: 'false', gmOnly: 'true' }],
      ['secrets', { hidden: 'false', gmOnly: 'false' }],
    ]);
  });
});
