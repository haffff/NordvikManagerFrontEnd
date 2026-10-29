import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';

vi.mock('@hlorenzi/react-dockable', () => ({
  spawnFloating: vi.fn(() => ({ rect: 'dock-panel' })),
}));

import * as Dockable from '@hlorenzi/react-dockable';
import DockableHelper from './DockableHelper';
import { setActiveUiMode } from './uiMode';
import { getTabsSnapshot, resetTabs } from '../components/game/mobile/mobileTabs';
import ChatPanel from '../components/game/panels/ChatPanel';

describe('DockableHelper.NewFloating', () => {
  beforeEach(() => {
    resetTabs();
    vi.mocked(Dockable.spawnFloating).mockClear();
  });
  afterEach(() => setActiveUiMode('desktop'));

  it('on desktop spawns a floating dock panel and commits', () => {
    const state = { commit: vi.fn() };
    const panel = DockableHelper.NewFloating(state, <ChatPanel />);
    expect(panel).toEqual({ rect: 'dock-panel' });
    expect(Dockable.spawnFloating).toHaveBeenCalledTimes(1);
    expect(state.commit).toHaveBeenCalled();
    expect(getTabsSnapshot().tabs).toHaveLength(0);
  });

  it('on mobile opens a tab instead and returns no dock panel', () => {
    setActiveUiMode('mobile');
    const state = { commit: vi.fn() };
    const panel = DockableHelper.NewFloating(state, <ChatPanel />);
    expect(panel).toBeNull();
    expect(Dockable.spawnFloating).not.toHaveBeenCalled();
    expect(getTabsSnapshot().tabs.map((t) => t.panelKey)).toEqual(['ChatPanel']);
  });
});
