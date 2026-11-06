import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));

import { useGameEventHandlers } from './useGameEventHandlers';
import { setActiveUiMode } from '../../../helpers/uiMode';
import { openTab, resetTabs, getTabsSnapshot } from '../mobile/mobileTabs';
import { LayoutHelper } from '../../../helpers/LayoutCloneHelper';

function Battlemap() { return null; }
function ChatPanel() { return null; }
const types = { Battlemap, ChatPanel };
const create = (content) => React.createElement(types[content.type], { ...content.props, withID: content.syncId });

function setup(battleMapContexts = {}) {
  const gameState = {
    playersRef: { current: [] },
    connectedPlayersRef: { current: [] },
    setPlayers: vi.fn(),
    setConnectedPlayers: vi.fn(),
    battleMapsContextsRef: { current: battleMapContexts },
  };
  const state = { ref: { current: {} }, commit: vi.fn() };
  return renderHook(() => useGameEventHandlers({ state, gameState, CreateLayoutElement: create })).result.current;
}

describe('show_panel in the mobile UI', () => {
  beforeEach(() => {
    resetTabs();
    setActiveUiMode('mobile');
    LayoutHelper.SetPanelKeyResolver((type) => type?.name);
  });
  afterEach(() => setActiveUiMode('desktop'));

  it('opens the panel as a tab', () => {
    const handlers = setup();
    act(() => handlers.HandleShowPanel({ data: { type: 'ChatPanel', props: {} } }));
    expect(getTabsSnapshot().tabs.map((t) => t.panelKey)).toEqual(['ChatPanel']);
  });

  it("switches to a battle map that is already open in a background tab", () => {
    const mapTab = openTab(<Battlemap withID="bm1" />);
    openTab(<ChatPanel />);
    // The background map tab stays mounted, so its battle map context is registered.
    const handlers = setup({ bm1: { id: 'bm1' } });

    act(() => handlers.HandleShowPanel({ data: { type: 'Battlemap', syncId: 'bm1' } }));

    expect(getTabsSnapshot().activeId).toBe(mapTab);
    expect(getTabsSnapshot().tabs).toHaveLength(2);
  });
});
