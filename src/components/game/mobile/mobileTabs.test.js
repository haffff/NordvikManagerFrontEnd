import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as React from 'react';
import {
  openTab,
  closeTab,
  activateTab,
  setTabTitle,
  getTabsSnapshot,
  subscribeTabs,
  resetTabs,
} from './mobileTabs';

// Stand-ins for panels; the store only needs a key resolver and the element's props.
function ChatPanel() { return null; }
function CardPanel() { return null; }
function Battlemap() { return null; }
const resolveKey = (type) => type?.name;

const open = (element) => openTab(element, resolveKey);

describe('mobileTabs', () => {
  beforeEach(() => resetTabs());

  it('opening a panel adds a tab and makes it active', () => {
    const id = open(<ChatPanel />);
    const { tabs, activeId } = getTabsSnapshot();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ id, panelKey: 'ChatPanel' });
    expect(activeId).toBe(id);
  });

  it('opening the same panel again switches to it instead of adding one', () => {
    const chat = open(<ChatPanel />);
    open(<CardPanel id="a" />);
    const again = open(<ChatPanel />);
    expect(again).toBe(chat);
    expect(getTabsSnapshot().tabs).toHaveLength(2);
    expect(getTabsSnapshot().activeId).toBe(chat);
  });

  it('cards with different ids are different tabs, the same id is one', () => {
    open(<CardPanel id="a" />);
    open(<CardPanel id="b" />);
    open(<CardPanel id="a" />);
    expect(getTabsSnapshot().tabs.map((t) => t.element.props.id)).toEqual(['a', 'b']);
  });

  it('props that cannot be saved (refs, dock state, functions) do not make a new tab', () => {
    open(<CardPanel id="a" state={{ ref: {} }} gameDataManagerRef={{ current: 1 }} onX={() => {}} />);
    open(<CardPanel id="a" state={{ ref: {} }} gameDataManagerRef={{ current: 2 }} />);
    expect(getTabsSnapshot().tabs).toHaveLength(1);
  });

  it('battle maps are told apart by their sync id', () => {
    open(<Battlemap withID="m1" />);
    open(<Battlemap withID="m2" />);
    open(<Battlemap withID="m1" foo="bar" />);
    expect(getTabsSnapshot().tabs).toHaveLength(2);
  });

  it('closing the active tab activates its neighbour', () => {
    const a = open(<CardPanel id="a" />);
    const b = open(<CardPanel id="b" />);
    const c = open(<CardPanel id="c" />);
    activateTab(b);
    closeTab(b);
    expect(getTabsSnapshot().tabs.map((t) => t.id)).toEqual([a, c]);
    expect(getTabsSnapshot().activeId).toBe(c);
    closeTab(c);
    expect(getTabsSnapshot().activeId).toBe(a);
    closeTab(a);
    expect(getTabsSnapshot()).toEqual({ tabs: [], activeId: null });
  });

  it('closing a background tab keeps the active one', () => {
    const a = open(<CardPanel id="a" />);
    const b = open(<CardPanel id="b" />);
    closeTab(a);
    expect(getTabsSnapshot().activeId).toBe(b);
  });

  it('setTabTitle notifies only when the title changes', () => {
    const id = open(<ChatPanel />);
    const listener = vi.fn();
    const unsubscribe = subscribeTabs(listener);
    setTabTitle(id, 'Chat');
    setTabTitle(id, 'Chat');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTabsSnapshot().tabs[0].title).toBe('Chat');
    unsubscribe();
  });

  it('the snapshot only changes when something changed', () => {
    open(<ChatPanel />);
    const before = getTabsSnapshot();
    activateTab(before.activeId);
    setTabTitle('missing', 'x');
    expect(getTabsSnapshot()).toBe(before);
  });
});
