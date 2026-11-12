import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { HostDrawer } from './HostDrawer';
import { keepTabWhileRunning } from './HostApp';
import { getHostUi, resetHostUi, setHostUi } from './hostUi';

const info = {
  kind: 'browser',
  version: '0.0.3',
  protocol: 2,
  unavailable: [{ path: 'api/Backup', reason: 'Backs up and restores the whole GM server.' }],
  limitations: [{ id: 'tab-open', title: 'Keep this tab open', detail: 'The game runs in this tab.' }],
};

const fakeLog = () => {
  let lines = [];
  const listeners = new Set();
  return {
    lines: () => lines.slice(),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    clear: () => { lines = []; },
    push(line) { lines.push(line); listeners.forEach((fn) => fn(line)); },
  };
};

const show = (ui) => render(<Provider>{ui}</Provider>);

describe('HostDrawer', () => {
  beforeEach(() => resetHostUi());

  it('shows what runs and the browser storage, opened by the host button', async () => {
    show(<HostDrawer info={info} logs={fakeLog()} />);
    act(() => setHostUi({ drawerOpen: true, sessions: 1, persisted: false }));

    expect(await screen.findByText(/1 game running/i)).toBeTruthy();
    expect(screen.getByText(/0\.0\.3/)).toBeTruthy();
    expect(screen.getByText(/may clear/i)).toBeTruthy();
  });

  it('opens the startup dialog again (what the browser version can\'t do)', async () => {
    show(<HostDrawer info={info} logs={fakeLog()} />);
    act(() => setHostUi({ drawerOpen: true }));

    fireEvent.click(await screen.findByRole('button', { name: /what the browser version can't do/i }));
    expect(getHostUi().introOpen).toBe(true);
    expect(getHostUi().drawerOpen).toBe(false);
  });

  it('counts errors logged while the Logs tab is not being read, and clears them when it is', async () => {
    const logs = fakeLog();
    show(<HostDrawer info={info} logs={logs} />);

    act(() => {
      logs.push({ id: 1, at: 0, level: 'info', text: 'fine' });
      logs.push({ id: 2, at: 0, level: 'error', text: 'boom' });
      logs.push({ id: 3, at: 0, level: 'error', text: 'boom again' });
    });
    expect(getHostUi().unread).toBe(2);

    act(() => setHostUi({ drawerOpen: true, drawerTab: 'logs' }));
    expect(await screen.findByText('boom again')).toBeTruthy();
    expect(getHostUi().unread).toBe(0);
  });
});

describe('keepTabWhileRunning', () => {
  const event = () => {
    const e = { defaultPrevented: false, returnValue: undefined };
    e.preventDefault = () => { e.defaultPrevented = true; };
    return e;
  };

  it('asks before the tab goes away while a session runs', () => {
    const e = event();
    keepTabWhileRunning(() => 1)(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('lets it go when none does', () => {
    const e = event();
    keepTabWhileRunning(() => 0)(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
