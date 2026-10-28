import { vi, describe, it, expect, beforeEach } from 'vitest';

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
