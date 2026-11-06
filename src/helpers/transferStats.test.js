import { describe, it, expect, beforeEach, vi } from 'vitest';
import transferStats from './transferStats';

// What moves over the game connection and how long it takes, so streaming changes can be
// measured: per transfer its size, time to the first byte and in all; and how long the
// heartbeat takes meanwhile (how the game feels while a big file comes in).
describe('transferStats', () => {
  beforeEach(() => {
    transferStats._reset();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  it('records a transfer with its first byte, total time and size', () => {
    const t = transferStats.start('GET', 'api/materials/resource');
    vi.setSystemTime(300);
    t.firstByte();
    vi.setSystemTime(900);
    t.firstByte(); // only the first counts
    vi.setSystemTime(2000);
    t.done({ status: 200, bytes: 5_000_000 });

    expect(transferStats.transfers()).toEqual([
      { method: 'GET', path: 'api/materials/resource', status: 200, bytes: 5_000_000, firstByteMs: 300, totalMs: 2000, at: 0 },
    ]);
  });

  it('keeps the latest 200 transfers and 100 heartbeats', () => {
    for (let i = 0; i < 250; i++) transferStats.start('GET', `p${i}`).done({ status: 200, bytes: 1 });
    for (let i = 0; i < 150; i++) transferStats.heartbeat(i);
    expect(transferStats.transfers()).toHaveLength(200);
    expect(transferStats.transfers()[0].path).toBe('p50');
    expect(transferStats.heartbeats()).toHaveLength(100);
  });

  it('summarizes: the biggest transfers and the heartbeat while they ran', () => {
    const big = transferStats.start('GET', 'api/materials/resource');
    vi.setSystemTime(100); transferStats.heartbeat(40);
    vi.setSystemTime(5000); transferStats.heartbeat(900);
    big.done({ status: 200, bytes: 50_000_000 });
    vi.setSystemTime(9000); transferStats.heartbeat(30);

    const s = transferStats.summary();
    expect(s.biggest[0]).toMatchObject({ bytes: 50_000_000, totalMs: 5000 });
    expect(s.biggest[0].heartbeatMaxMs).toBe(900);
    expect(s.heartbeat).toEqual({ count: 3, medianMs: 40, maxMs: 900 });
  });
});
