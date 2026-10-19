import { describe, it, expect, afterEach, vi } from 'vitest';
import { isPlayerMode, isDemo, setDemoRole, getDemoRole } from './appMode';

describe('appMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setDemoRole('gm');
  });

  it('follows REACT_APP_MODE in normal builds', () => {
    vi.stubEnv('REACT_APP_MODE', 'player');
    expect(isPlayerMode()).toBe(true);
    expect(isDemo()).toBe(false);

    vi.stubEnv('REACT_APP_MODE', 'gm');
    expect(isPlayerMode()).toBe(false);
  });

  it('in the demo, the chosen role decides', () => {
    vi.stubEnv('REACT_APP_MODE', 'demo');
    expect(isDemo()).toBe(true);
    expect(getDemoRole()).toBe('gm');
    expect(isPlayerMode()).toBe(false);

    setDemoRole('player');
    expect(isPlayerMode()).toBe(true);
  });

  it('ignores unknown roles', () => {
    setDemoRole('admin');
    expect(getDemoRole()).toBe('gm');
  });
});
