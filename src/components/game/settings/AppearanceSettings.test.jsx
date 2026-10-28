import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

// Game Settings → Appearance: the game's stylesheets, then its sounds and images, each
// chosen from the game's materials (the picker also takes a dropped file).

const { chooser } = vi.hoisted(() => ({ chooser: { props: null } }));
vi.mock('../../uiComponents/MaterialChooser', () => ({
  MaterialChooser: (props) => {
    chooser.props = props;
    return <button onClick={() => props.onSelect('m1')}>pick m1</button>;
  },
}));
vi.mock('../theme/StylesheetSettings', () => ({ GameStylesheetSettings: () => <div>stylesheet list</div> }));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getMaterialAsync: vi.fn(), postAsync: vi.fn(), putAsync: vi.fn() },
}));
vi.mock('../../../helpers/systemAssets', async (original) => ({
  ...(await original()),
  resolveSystemAssetUrl: vi.fn(async () => undefined),
  invalidateSystemAsset: vi.fn(),
}));

import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { invalidateSystemAsset } from '../../../helpers/systemAssets';
import { AppearanceSettings } from './AppearanceSettings';

const sound = new Blob(['ding'], { type: 'audio/mpeg' });

describe('AppearanceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chooser.props = null;
    WebHelper.getMaterialAsync.mockResolvedValue(sound);
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: {} });
  });

  it('shows the stylesheets and the sounds and images together', async () => {
    renderWithProviders(<AppearanceSettings gameId="g1" />);

    expect(screen.getByText('stylesheet list')).toBeInTheDocument();
    expect(screen.getByText('Sounds & images')).toBeInTheDocument();
    expect(await screen.findByText('Your turn sound')).toBeInTheDocument();
  });

  it("picks a sound from the game's materials, audio only, and uses it for that slot", async () => {
    renderWithProviders(<AppearanceSettings gameId="g1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Choose Your turn sound' }));
    expect(chooser.props.additionalFilter({ mimeType: 'audio/ogg' })).toBe(true);
    expect(chooser.props.additionalFilter({ mimeType: 'image/png' })).toBe(false);
    fireEvent.click(screen.getByText('pick m1'));

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith('Materials/CreateResource', expect.objectContaining({
      Key: 'turnSound', MimeType: 'audio/mpeg',
    })));
    expect(WebHelper.getMaterialAsync).toHaveBeenCalledWith('m1');
    await waitFor(() => expect(invalidateSystemAsset).toHaveBeenCalledWith('turnSound'));
    expect(screen.queryByText('pick m1')).not.toBeInTheDocument();
  });

  it('replaces a slot that was already set', async () => {
    WebHelper.postAsync.mockResolvedValue({ status: 409, body: {} });
    WebHelper.putAsync.mockResolvedValue({ status: 200, body: {} });
    renderWithProviders(<AppearanceSettings gameId="g1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Choose Your turn sound' }));
    fireEvent.click(screen.getByText('pick m1'));

    await waitFor(() => expect(WebHelper.putAsync).toHaveBeenCalledWith('Materials/ResourceData', expect.objectContaining({ Key: 'turnSound' })));
  });

  it('offers images only for an image slot', async () => {
    renderWithProviders(<AppearanceSettings gameId="g1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Choose Empty token image' }));

    expect(chooser.props.additionalFilter({ mimeType: 'image/webp' })).toBe(true);
    expect(chooser.props.additionalFilter({ mimeType: 'audio/mpeg' })).toBe(false);
  });
});
