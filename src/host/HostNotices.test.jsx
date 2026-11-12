import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { StorageBanner } from './StorageBanner';

const info = { kind: 'browser', version: '1.0.0', protocol: 2, unavailable: [], limitations: [] };

const fakeLog = (initial = []) => {
  let lines = [...initial];
  const listeners = new Set();
  return {
    lines: () => lines.slice(),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    clear: () => { lines = []; },
    push(line) { lines.push(line); listeners.forEach((fn) => fn(line)); },
  };
};

const show = (ui) => render(<Provider>{ui}</Provider>);

describe('StorageBanner', () => {
  beforeEach(() => { try { sessionStorage.clear(); } catch { /* none */ } });

  it('says the games may be cleared, until dismissed', () => {
    show(<StorageBanner persisted={false} onPersisted={() => {}} />);

    expect(screen.getByRole('alert').textContent).toMatch(/may delete your games/i);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is not there when storage is persistent (or not known yet)', () => {
    show(<><StorageBanner persisted onPersisted={() => {}} /><StorageBanner persisted={undefined} onPersisted={() => {}} /></>);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks the browser again', async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    const onPersisted = vi.fn();
    show(<StorageBanner persisted={false} onPersisted={onPersisted} />);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /ask again/i })); });

    expect(persist).toHaveBeenCalled();
    expect(onPersisted).toHaveBeenCalledWith(true);
  });
});
