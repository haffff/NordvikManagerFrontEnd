import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugEnabled, debugLog } from './debugLog';

describe('debugLog', () => {
  let log;
  beforeEach(() => { log = vi.spyOn(console, 'log').mockImplementation(() => {}); localStorage.clear(); });
  afterEach(() => { log.mockRestore(); localStorage.clear(); });

  it('stays quiet in a production build unless nm_debug is set', () => {
    expect(debugEnabled({ production: true })).toBe(false);
    localStorage.setItem('nm_debug', '1');
    expect(debugEnabled({ production: true })).toBe(true);
  });

  it('logs in development builds', () => {
    expect(debugEnabled({ production: false })).toBe(true);
  });

  it('passes its arguments to console.log when enabled', () => {
    localStorage.setItem('nm_debug', '1');
    debugLog('[X]', 'hello', 1);
    expect(log).toHaveBeenCalledWith('[X]', 'hello', 1);
  });
});
