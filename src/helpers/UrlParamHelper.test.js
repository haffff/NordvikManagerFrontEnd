import { setUrlParam, removeUrlParam } from './UrlParamHelper';

describe('UrlParamHelper', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('setUrlParam adds a param while preserving existing ones and the hash', () => {
    window.history.replaceState({}, '', '/?rp=1#section');
    setUrlParam('game', 'abc-123');
    expect(window.location.search).toContain('rp=1');
    expect(window.location.search).toContain('game=abc-123');
    expect(window.location.hash).toBe('#section');
  });

  it('setUrlParam overwrites an existing value for the same param', () => {
    window.history.replaceState({}, '', '/?game=old');
    setUrlParam('game', 'new');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('game')).toBe('new');
  });

  it('removeUrlParam removes only the named param, preserving the rest', () => {
    window.history.replaceState({}, '', '/?code=abc&game=def&rp=1');
    removeUrlParam('code');
    const params = new URLSearchParams(window.location.search);
    expect(params.has('code')).toBe(false);
    expect(params.get('game')).toBe('def');
    expect(params.get('rp')).toBe('1');
  });

  it('removeUrlParam is a no-op (does not touch history) when the param is absent', () => {
    window.history.replaceState({}, '', '/?game=def');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    removeUrlParam('code');
    expect(replaceStateSpy).not.toHaveBeenCalled();
    replaceStateSpy.mockRestore();
  });
});
