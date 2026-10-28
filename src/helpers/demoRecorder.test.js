import { describe, it, expect, vi } from 'vitest';
import { createDemoRecorder, RECORD_STORAGE_KEY } from './demoRecorder';

const storageWith = (value) => ({ getItem: (k) => (k === RECORD_STORAGE_KEY ? value : null) });

describe('demo recorder', () => {
  it('is off unless localStorage nm_record_demo is "1"', () => {
    expect(RECORD_STORAGE_KEY).toBe('nm_record_demo');
    expect(createDemoRecorder({ storage: storageWith(null) }).enabled).toBe(false);
    expect(createDemoRecorder({ storage: storageWith('1') }).enabled).toBe(true);
    expect(createDemoRecorder({ storage: { getItem: () => { throw new Error('blocked'); } } }).enabled).toBe(false);
  });

  it('records nothing while off', () => {
    const r = createDemoRecorder({ storage: storageWith(null) });
    r.record('out', { command: 'x' });
    expect(r.entries).toEqual([]);
  });

  it('records a copy of each message with direction and time, in order', () => {
    let t = 100;
    const r = createDemoRecorder({ storage: storageWith('1'), now: () => t++ });
    const msg = { command: 'element_update', data: { id: 'e1' } };
    r.record('out', msg);
    msg.data.id = 'changed later';
    r.record('in', { type: 'api-response', id: '1', status: 200, body: {} });
    expect(r.entries).toEqual([
      { t: 100, dir: 'out', msg: { command: 'element_update', data: { id: 'e1' } } },
      { t: 101, dir: 'in', msg: { type: 'api-response', id: '1', status: 200, body: {} } },
    ]);
  });

  it('downloads the recording as JSON', () => {
    const r = createDemoRecorder({ storage: storageWith('1'), now: () => 1 });
    r.record('out', { command: 'a' });
    const save = vi.fn();
    r.download(save);
    const [fileName, text] = save.mock.calls[0];
    expect(fileName).toMatch(/^nordvik-demo-recording-.*\.json$/);
    expect(JSON.parse(text)).toEqual({ version: 1, entries: [{ t: 1, dir: 'out', msg: { command: 'a' } }] });
  });
});
