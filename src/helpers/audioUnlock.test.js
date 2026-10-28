import { describe, it, expect, vi, afterEach } from 'vitest';
import { playOrWait, forgetWaiting, waitingCount, onWaitingChange } from './audioUnlock';

const refused = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
const fakeAudio = (play = refused) => ({ play: vi.fn(play), __disposed: false });
const flush = () => new Promise((r) => setTimeout(r, 0));
const click = () => document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

describe('audioUnlock', () => {
  // Drain whatever a test left waiting.
  afterEach(() => click());

  it('plays straight away when the browser allows it', async () => {
    const audio = fakeAudio(() => Promise.resolve());

    playOrWait(audio);
    await flush();

    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(waitingCount()).toBe(0);
  });

  it('keeps refused audio waiting and plays it on the first click, after onUnlock', async () => {
    const audio = fakeAudio();
    const onUnlock = vi.fn();

    playOrWait(audio, onUnlock);
    await flush();
    expect(waitingCount()).toBe(1);

    audio.play.mockImplementation(() => Promise.resolve());
    click();

    expect(onUnlock).toHaveBeenCalledWith(audio);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(waitingCount()).toBe(0);
  });

  it('a key press unlocks too', async () => {
    const audio = fakeAudio();
    playOrWait(audio);
    await flush();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('does not start audio disposed or forgotten while it waited', async () => {
    const disposed = fakeAudio();
    const paused = fakeAudio();
    playOrWait(disposed);
    playOrWait(paused);
    await flush();

    disposed.__disposed = true;
    forgetWaiting(paused);
    expect(waitingCount()).toBe(1);
    click();

    expect(disposed.play).toHaveBeenCalledTimes(1);
    expect(paused.play).toHaveBeenCalledTimes(1);
  });

  it('does not keep audio that failed for another reason', async () => {
    const audio = fakeAudio(() => Promise.reject(Object.assign(new Error('bad file'), { name: 'NotSupportedError' })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    playOrWait(audio);
    await flush();

    expect(waitingCount()).toBe(0);
  });

  it('tells listeners when the waiting count changes', async () => {
    const seen = vi.fn();
    const off = onWaitingChange(seen);

    playOrWait(fakeAudio());
    await flush();
    click();
    off();

    expect(seen.mock.calls.map(([n]) => n)).toEqual([1, 0]);
  });
});
