import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AUDIO_CATEGORIES, getVolume, setVolume, onVolumeChange, applyVolume } from './audioVolume';

describe('audioVolume', () => {
  beforeEach(() => localStorage.clear());

  it('has music, sound effects and notifications, all at full volume until changed', () => {
    expect(AUDIO_CATEGORIES.map((c) => c.key)).toEqual(['music', 'sounds', 'notifications']);
    expect(getVolume('music')).toBe(1);
    expect(getVolume('sounds')).toBe(1);
  });

  it('remembers a volume in this browser, kept between 0 and 1', () => {
    setVolume('music', 0.35);
    setVolume('sounds', 7);
    setVolume('notifications', -2);

    expect(getVolume('music')).toBe(0.35);
    expect(getVolume('sounds')).toBe(1);
    expect(getVolume('notifications')).toBe(0);
    expect(JSON.parse(localStorage.getItem('nm_audio_volume'))).toEqual({ music: 0.35, sounds: 1, notifications: 0 });
  });

  it('ignores a broken stored value', () => {
    localStorage.setItem('nm_audio_volume', '{ broken');
    expect(getVolume('music')).toBe(1);
  });

  it('tells listeners which volume changed', () => {
    const seen = vi.fn();
    const off = onVolumeChange(seen);

    setVolume('music', 0.5);
    off();
    setVolume('music', 0.2);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith('music', 0.5);
  });

  it("sets an audio element's volume from its category", () => {
    setVolume('sounds', 0.4);
    const audio = { volume: 1 };

    applyVolume(audio, 'sounds');

    expect(audio.volume).toBe(0.4);
    expect(audio.__volumeCategory).toBe('sounds');
  });
});

describe('audioVolume with the GM volume', () => {
  beforeEach(() => localStorage.clear());

  it("plays at the GM's volume times the player's own", () => {
    setVolume('music', 0.5);
    const audio = {};

    applyVolume(audio, 'music', 0.8);

    expect(audio.volume).toBeCloseTo(0.4);
    expect(audio.__gmVolume).toBe(0.8);
  });

  it('the GM volume can change on its own', async () => {
    const { setGmVolume } = await import('./audioVolume');
    setVolume('music', 0.5);
    const audio = applyVolume({}, 'music', 1);

    setGmVolume(audio, 0.2);

    expect(audio.volume).toBeCloseTo(0.1);
  });
});
