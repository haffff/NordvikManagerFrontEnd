import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../helpers/transport', () => ({
  ActiveWebHelper: { putAsync: vi.fn(), postAsync: vi.fn(), getAsync: vi.fn(), deleteAsync: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from '../../helpers/transport';
import PlaylistService from './PlaylistService';

describe('PlaylistService volumes', () => {
  beforeEach(() => vi.clearAllMocks());

  it("SetVolume saves a playlist's volume, keeping everything else as it is", async () => {
    const playlist = { id: 'p1', name: 'Tavern', description: 'd', mode: 1, shuffle: true, repeat: false, kind: 0, resources: [{ id: 't1' }, { id: 't2' }] };

    await PlaylistService.SetVolume({ playlist, volume: 0.45 });

    expect(WebHelper.putAsync).toHaveBeenCalledWith('Playlist/UpdatePlaylist', {
      Id: 'p1', Name: 'Tavern', Description: 'd', Mode: 1, Shuffle: true, Repeat: false, Kind: 0,
      ResourceIds: ['t1', 't2'], Volume: 0.45,
    });
    expect(PlaylistService.$meta.SetVolume.description).toBeTruthy();
  });

  it('PlaySound tells which soundboard the sound is from (its volume applies)', async () => {
    await PlaylistService.PlaySound({ resourceId: 'r1', soundboardId: 'b1' });

    expect(WebHelper.postAsync).toHaveBeenCalledWith('Soundboard/PlaySound', { ResourceId: 'r1', SoundboardId: 'b1' });
  });
});
