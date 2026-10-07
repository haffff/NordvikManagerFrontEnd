import { describe, it, expect } from 'vitest';
import { resourceEditFields, resourceEditDto, resourceUpdateData } from './resourceEdit';

describe('Edit Resource dialog', () => {
  it('only audio files get a volume field', () => {
    expect(resourceEditFields(false).map((f) => f.key)).toEqual(['name', 'key']);
    const volume = resourceEditFields(true).find((f) => f.key === 'volume');
    expect(volume).toMatchObject({ type: 'number', min: 0, max: 100 });
  });

  it('shows the volume as a percentage, full when not set', () => {
    expect(resourceEditDto({ id: 'r1', name: 'Door', key: 'door', volume: 0.4, mimeType: 'audio/mpeg' }))
      .toEqual({ id: 'r1', name: 'Door', key: 'door', volume: 40, isAudio: true });
    expect(resourceEditDto({ id: 'r1', name: 'Door', mimeType: 'audio/mpeg' }).volume).toBe(100);
    expect(resourceEditDto({ id: 'r2', name: 'Map', mimeType: 'image/png' })).toEqual({ id: 'r2', name: 'Map', key: undefined });
  });

  it('saves the volume from 0 to 1, only for audio', () => {
    expect(resourceUpdateData({ id: 'r1', name: 'Door', key: 'door', volume: 40, isAudio: true }))
      .toEqual({ id: 'r1', name: 'Door', key: 'door', volume: 0.4 });
    expect(resourceUpdateData({ id: 'r1', name: 'Door', volume: 250, isAudio: true }).volume).toBe(1);
    expect(resourceUpdateData({ id: 'r1', name: 'Door', volume: NaN, isAudio: true })).not.toHaveProperty('volume');
    expect(resourceUpdateData({ id: 'r2', name: 'Map', key: '' })).toEqual({ id: 'r2', name: 'Map', key: '' });
  });
});
