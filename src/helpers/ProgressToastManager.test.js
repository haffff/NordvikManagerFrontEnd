import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const visible = new Set();
vi.mock('../components/ui/toaster', () => ({
  toaster: {
    create: vi.fn(({ id, type }) => { if (type === 'loading') visible.add(id); }),
    update: vi.fn(),
    isVisible: vi.fn((id) => visible.has(id)),
  },
}));

import { toaster } from '../components/ui/toaster';
import ClientMediator from '../ClientMediator';
import ProgressToastManager from './ProgressToastManager';

// fireEvent dispatches on a timer.
const fire = async (name, data) => {
  ClientMediator.fireEvent(name, data);
  await new Promise((r) => setTimeout(r, 0));
};

// The server starts an operation in the background before it answers the request
// that returns its id, so a fast one (e.g. reinstalling an addon that's already
// installed) can finish before the client knows the id.
describe('ProgressToastManager, operation finishing before its start', () => {
  beforeEach(() => {
    visible.clear();
    vi.clearAllMocks();
  });

  it('does not open a never-ending spinner for an operation that already completed', async () => {
    await fire('Progress:Complete', { id: 'op-1', title: 'Addon installed' });
    ProgressToastManager.start('op-1', { title: 'Installing…' });

    expect(toaster.create).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'op-1', type: 'loading' }));
  });

  it('track() resolves for an operation that already completed', async () => {
    await fire('Progress:Complete', { id: 'op-2' });

    await expect(ProgressToastManager.track('op-2', { title: 'Installing…' })).resolves.toBeDefined();
  });

  it('track() rejects for an operation that already failed', async () => {
    await fire('Progress:Failed', { id: 'op-3', description: 'boom' });

    await expect(ProgressToastManager.track('op-3', { title: 'Installing…' })).rejects.toThrow('boom');
  });

  it('track() shows progress and settles when the operation completes later', async () => {
    const done = ProgressToastManager.track('op-4', { title: 'Installing…' });
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'op-4', type: 'loading' }));

    await fire('Progress:Complete', { id: 'op-4' });
    await expect(done).resolves.toBeDefined();
  });
});

// The outcome is one push from the server. When it was lost, the toast spun for the
// whole 10-minute timeout; track() now asks the server (GET operation/status) meanwhile.
describe('ProgressToastManager, outcome push lost', () => {
  beforeEach(() => {
    visible.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const settle = async (promise) => {
    const outcome = promise.then((v) => ({ ok: v }), (e) => ({ error: e.message }));
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(5000);
    return outcome;
  };

  it('resolves from the server when the completion never arrives', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'complete', title: 'Addon installed', description: 'Fifth Edition' }));
    const result = await settle(ProgressToastManager.track('lost-1', { title: 'Installing…' }, 600000, { fetchStatus }));

    expect(fetchStatus).toHaveBeenCalledWith('lost-1');
    expect(result.ok).toEqual(expect.objectContaining({ id: 'lost-1', title: 'Addon installed' }));
    expect(toaster.update).toHaveBeenCalledWith('lost-1', expect.objectContaining({ type: 'success' }));
  });

  it('rejects from the server when it failed', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'failed', title: 'Installation failed', description: 'zip is broken' }));
    const result = await settle(ProgressToastManager.track('lost-2', {}, 600000, { fetchStatus }));

    expect(result.error).toBe('zip is broken');
  });

  it('gives up when the server no longer knows the operation (it restarted)', async () => {
    const fetchStatus = vi.fn(async () => ({ status: 'unknown' }));
    const result = await settle(ProgressToastManager.track('lost-3', {}, 600000, { fetchStatus }));

    expect(result.error).toMatch(/no longer knows/i);
  });

  it('keeps waiting while it runs or the server cannot be reached, and stops asking once settled', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce({ status: 'running' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ status: 'running' });
    const tracked = ProgressToastManager.track('lost-4', {}, 600000, { fetchStatus });
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    ClientMediator.fireEvent('Progress:Complete', { id: 'lost-4', title: 'Done' });
    await vi.advanceTimersByTimeAsync(1);
    await expect(tracked).resolves.toEqual(expect.objectContaining({ title: 'Done' }));

    const calls = fetchStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetchStatus).toHaveBeenCalledTimes(calls);
  });
});
