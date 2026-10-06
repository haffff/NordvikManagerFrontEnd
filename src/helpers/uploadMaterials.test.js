import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./transport', () => ({ ActiveWebHelper: { postMaterial: vi.fn() } }));
vi.mock('./ProgressToastManager', () => ({
  default: { start: vi.fn(), update: vi.fn(), complete: vi.fn(), fail: vi.fn() },
}));

import { uploadMaterials } from './uploadMaterials';
import { ActiveWebHelper } from './transport';
import ProgressToastManager from './ProgressToastManager';

const file = (name) => ({ name, type: 'image/png' });

// postMaterial(file, onok, onerror, onException): succeed unless the name starts with "bad".
const serverAccepts = () =>
  ActiveWebHelper.postMaterial.mockImplementation((f, onok, onerror) =>
    setTimeout(() => (f.name.startsWith('bad') ? onerror('nope') : onok({ id: `id-${f.name}`, key: f.name })), 0));

describe('uploadMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverAccepts();
  });

  it('one toast counting up through every file, then success', async () => {
    const onUploaded = vi.fn();
    const result = await uploadMaterials([file('a.png'), file('b.png'), file('c.png')], { onUploaded });

    const [id, start] = ProgressToastManager.start.mock.calls[0];
    expect(start).toMatchObject({ title: 'Uploading 3 files…', total: 3 });
    expect(ProgressToastManager.update.mock.calls.map(([i, u]) => [i, u.current, u.total])).toEqual([[id, 1, 3], [id, 2, 3], [id, 3, 3]]);
    expect(ProgressToastManager.complete).toHaveBeenCalledWith(id, expect.objectContaining({ title: 'Uploaded 3 files' }));
    expect(onUploaded).toHaveBeenCalledTimes(3);
    expect(result.uploaded.map((r) => r.id).sort()).toEqual(['id-a.png', 'id-b.png', 'id-c.png']);
    expect(result.failed).toEqual([]);
  });

  it('some failing: reports how many, and which in the updates', async () => {
    const result = await uploadMaterials([file('a.png'), file('bad.png'), file('c.png')]);

    expect(ProgressToastManager.fail).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: '1 of 3 uploads failed' }));
    expect(ProgressToastManager.update.mock.calls.map(([, u]) => u.message)).toContain('Failed: bad.png');
    expect(result.failed.map((f) => f.name)).toEqual(['bad.png']);
  });

  it('an exception while reading a file counts as a failure, not a hang', async () => {
    ActiveWebHelper.postMaterial.mockImplementation((f, onok, onerror, onException) => setTimeout(() => onException(new Error('read')), 0));

    const result = await uploadMaterials([file('a.png')]);

    expect(ProgressToastManager.fail).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: 'Upload failed' }));
    expect(result.failed).toHaveLength(1);
  });

  it('a single file names it in the toast', async () => {
    await uploadMaterials([file('dragon.png')]);

    expect(ProgressToastManager.start.mock.calls[0][1].title).toBe('Uploading dragon.png…');
    expect(ProgressToastManager.complete.mock.calls[0][1].title).toBe('Uploaded dragon.png');
  });

  it('no files: does nothing', async () => {
    const result = await uploadMaterials([]);

    expect(ProgressToastManager.start).not.toHaveBeenCalled();
    expect(result).toEqual({ uploaded: [], failed: [] });
  });
});
