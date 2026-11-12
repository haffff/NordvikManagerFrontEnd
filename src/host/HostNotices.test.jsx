import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { HostDrawer } from './HostDrawer';
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

describe('the host icon', () => {
  it('warns when the browser may clear the games', () => {
    show(<HostDrawer info={info} persisted={false} logs={fakeLog()} />);

    const icon = screen.getByRole('button', { name: /game host/i });
    expect(icon.getAttribute('aria-label')).toMatch(/storage isn't persistent/i);
    expect(screen.getByTestId('host-badge-warning')).toBeTruthy();
  });

  it('has no warning when storage is persistent', () => {
    show(<HostDrawer info={info} persisted logs={fakeLog()} />);

    expect(screen.queryByTestId('host-badge-warning')).toBeNull();
  });

  it('counts errors logged since the logs were last looked at', async () => {
    const logs = fakeLog();
    show(<HostDrawer info={info} persisted logs={logs} />);

    act(() => {
      logs.push({ id: 1, at: 0, level: 'info', text: 'fine' });
      logs.push({ id: 2, at: 0, level: 'error', text: 'boom' });
      logs.push({ id: 3, at: 0, level: 'error', text: 'boom again' });
    });
    expect(screen.getByTestId('host-badge-errors').textContent).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: /game host/i }));
    fireEvent.click(await screen.findByRole('tab', { name: /logs/i }));
    expect(await screen.findByText('boom again')).toBeTruthy();
    expect(screen.queryByTestId('host-badge-errors')).toBeNull();
  });
});

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
