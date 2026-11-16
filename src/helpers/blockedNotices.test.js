import { describe, it, expect, vi, beforeEach } from 'vitest';

const toaster = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../components/ui/toaster', () => ({ toaster }));

import { describeBlocked, startBlockedNotices, recordServerNotice } from './blockedNotices';
import { recordBlocked, resetBlocked } from './addonNetworkLog';
import ClientMediator from '../ClientMediator';

// What a GM is told the first time addon code is blocked from reaching somewhere.
describe('describeBlocked', () => {
  it('a card the CSP blocked: names the addon (or card) and the host, says where to allow it', () => {
    expect(describeBlocked({ source: 'card', addon: 'dnd5e', card: 'Sheet', origin: 'https://evil.example.com', directive: 'connect-src' }))
      .toEqual({
        title: 'dnd5e was blocked',
        description: "Its card \"Sheet\" tried to reach evil.example.com, which isn't one of this game's allowed hosts. If you trust it, add it in Application Settings › Server › Card sandbox.",
      });
    expect(describeBlocked({ source: 'card', card: 'Sheet', origin: 'https://cdn.example.com', directive: 'img-src' }).title)
      .toBe('Card "Sheet" was blocked');
  });

  it('on the browser version the hosts are fixed: no setting to point at', () => {
    const text = describeBlocked({ source: 'card', card: 'Sheet', origin: 'https://cdn.example.com', directive: 'img-src' }, { kind: 'browser' });
    expect(text.description).not.toMatch(/Application Settings/);
    expect(text.description).toMatch(/browser version/);
  });

  it.each([
    ['no-outside-connections', /browser version can't reach.*local server/],
    ['undeclared-host', /doesn't list/],
    ['blocked-host', /private or local address/],
    ['network-error', /couldn't reach/],
  ])('an action refused for %s says why', (reason, text) => {
    const notice = describeBlocked({ source: 'action', addon: 'trilium', action: 'Import', origin: 'https://notes.example.com', reason });
    expect(notice.title).toBe('trilium › Import was blocked');
    expect(notice.description).toMatch(text);
    expect(notice.description).toContain('notes.example.com');
  });
});

describe('startBlockedNotices', () => {
  beforeEach(() => {
    resetBlocked();
    toaster.create.mockClear();
  });

  it('shows a GM each new entry once, as a warning', () => {
    vi.spyOn(ClientMediator, 'sendCommand').mockImplementation((panel, command) => panel === 'Game' && command === 'GetIsGM');
    const stop = startBlockedNotices();
    const entry = { source: 'card', card: 'Sheet', origin: 'https://evil.example.com', directive: 'connect-src' };

    recordBlocked(entry);
    recordBlocked(entry);
    stop();
    recordBlocked({ ...entry, origin: 'https://other.example.com' });

    expect(toaster.create).toHaveBeenCalledTimes(1);
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', title: 'Card "Sheet" was blocked' }));
  });

  it('shows players nothing (their own cards are logged and in the console)', () => {
    vi.spyOn(ClientMediator, 'sendCommand').mockReturnValue(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stop = startBlockedNotices();

    recordBlocked({ source: 'card', card: 'Sheet', origin: 'https://evil.example.com', directive: 'connect-src' });
    stop();

    expect(toaster.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('evil.example.com'));
  });
});

// The GM backend tells GMs when it refused an action's request (addon_network_notice).
describe('recordServerNotice', () => {
  beforeEach(() => resetBlocked());

  it("logs the backend's addon_network_notice as an action entry, with only the fields it knows", async () => {
    const { getBlocked } = await import('./addonNetworkLog');
    const data = { source: 'card', addon: 'trilium', action: 'Import', actionId: 'a-1', origin: 'https://notes.example.com', reason: 'blocked-host', extra: 'x' };

    expect(recordServerNotice({ command: 'addon_network_notice', data })).toBe(true);
    expect(recordServerNotice({ command: 'chat_push', data })).toBe(false);

    expect(getBlocked()).toEqual([expect.objectContaining({
      source: 'action', addon: 'trilium', action: 'Import', actionId: 'a-1', origin: 'https://notes.example.com', reason: 'blocked-host',
    })]);
    expect(getBlocked()[0]).not.toHaveProperty('extra');
  });
});
