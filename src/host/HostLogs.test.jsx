import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { HostLogs, formatLines } from './HostLogs';

// host.js's log: lines(), subscribe(fn) -> unsubscribe, clear().
const fakeLog = (initial) => {
  let lines = [...initial];
  const listeners = new Set();
  return {
    lines: () => lines.slice(),
    subscribe: vi.fn((fn) => { listeners.add(fn); return () => listeners.delete(fn); }),
    clear: vi.fn(() => { lines = []; }),
    push(line) { lines.push(line); listeners.forEach((fn) => fn(line)); },
    listeners,
  };
};

const at = Date.UTC(2026, 10, 12, 10, 0, 5);
const LINES = [
  { id: 1, at, level: 'info', text: 'GM host ready' },
  { id: 2, at, level: 'warn', text: 'WebRTCSessionService: ICE slow' },
  { id: 3, at, level: 'error', text: 'GameLobby: boom' },
];

const show = (logs) => render(<Provider><HostLogs logs={logs} /></Provider>);

describe('HostLogs', () => {
  it('shows the lines kept, and new ones as they come', () => {
    const logs = fakeLog(LINES);
    show(logs);

    expect(screen.getByText('GM host ready')).toBeTruthy();
    expect(screen.getByText('GameLobby: boom')).toBeTruthy();
    act(() => logs.push({ id: 4, at, level: 'info', text: 'a new line' }));
    expect(screen.getByText('a new line')).toBeTruthy();
  });

  it('filters to warnings and errors, or errors only', () => {
    show(fakeLog(LINES));

    fireEvent.click(screen.getByRole('button', { name: /warnings/i }));
    expect(screen.queryByText('GM host ready')).toBeNull();
    expect(screen.getByText('WebRTCSessionService: ICE slow')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^errors$/i }));
    expect(screen.queryByText('WebRTCSessionService: ICE slow')).toBeNull();
    expect(screen.getByText('GameLobby: boom')).toBeTruthy();
  });

  it('clears', () => {
    const logs = fakeLog(LINES);
    show(logs);

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(logs.clear).toHaveBeenCalled();
    expect(screen.queryByText('GM host ready')).toBeNull();
  });

  it('copies what is shown as text', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    show(fakeLog(LINES));

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith(formatLines(LINES));
  });

  it('stops listening when closed', () => {
    const logs = fakeLog(LINES);
    const { unmount } = show(logs);
    expect(logs.listeners.size).toBe(1);
    unmount();
    expect(logs.listeners.size).toBe(0);
  });
});

describe('formatLines', () => {
  it('is one line each: time, level, text', () => {
    expect(formatLines([LINES[2]])).toMatch(/^\d\d:\d\d:\d\d ERROR GameLobby: boom$/);
  });
});
