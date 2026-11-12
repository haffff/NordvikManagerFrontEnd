import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { HostDrawer } from './HostDrawer';
import { keepTabWhileRunning } from './HostApp';

const info = {
  kind: 'browser',
  version: '0.0.3',
  protocol: 2,
  unavailable: [{ path: 'api/Backup', reason: 'Backs up and restores the whole GM server.' }],
  limitations: [{ id: 'tab-open', title: 'Keep this tab open', detail: 'The game runs in this tab.' }],
};

describe('HostDrawer', () => {
  it('shows what the browser host is, what to expect, and what it does not do', async () => {
    render(<Provider><HostDrawer info={info} sessions={1} persisted={false} /></Provider>);

    fireEvent.click(screen.getByRole('button', { name: /game host/i }));

    expect(await screen.findByText('Keep this tab open')).toBeTruthy();
    expect(screen.getByText('The game runs in this tab.')).toBeTruthy();
    expect(screen.getByText('Backs up and restores the whole GM server.')).toBeTruthy();
    expect(screen.getByText(/1 game running/i)).toBeTruthy();
    expect(screen.getByText(/may clear/i)).toBeTruthy();
    expect(screen.getByText(/0\.0\.3/)).toBeTruthy();
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
