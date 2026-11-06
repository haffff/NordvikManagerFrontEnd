import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openLayoutAsTabs } from './mobileLayout';
import { getTabsSnapshot, resetTabs } from './mobileTabs';

const layout = {
  splitPanels: [],
  _contents: [
    { contentId: 'c1', type: 'Battlemap', syncId: 'bm1', props: {} },
    { contentId: 'c2', type: 'ChatPanel', props: {} },
    { contentId: 'c3', type: 'CardPanel', props: { id: 'card1' } },
  ],
};

function makeCreate() {
  // What Game.js's CreateLayoutElement builds: the panel with the saved props (+ withID).
  const types = {};
  return vi.fn((content) => {
    types[content.type] ??= Object.defineProperty(() => null, 'name', { value: content.type });
    return { type: types[content.type], props: { ...content.props, withID: content.syncId } };
  });
}
const resolveKey = (type) => type?.name;

describe('openLayoutAsTabs', () => {
  beforeEach(() => resetTabs());

  it('opens every panel of the layout as a tab, the first one active', () => {
    const create = makeCreate();
    const count = openLayoutAsTabs(layout, create, resolveKey);
    expect(count).toBe(3);
    const { tabs, activeId } = getTabsSnapshot();
    expect(tabs.map((t) => t.panelKey)).toEqual(['Battlemap', 'ChatPanel', 'CardPanel']);
    expect(activeId).toBe(tabs[0].id);
    expect(create).toHaveBeenCalledWith(layout._contents[0]);
  });

  it('accepts the layout as a JSON string', () => {
    expect(openLayoutAsTabs(JSON.stringify(layout), makeCreate(), resolveKey)).toBe(3);
  });

  it('keeps tabs that are already open and does not duplicate them', () => {
    const create = makeCreate();
    openLayoutAsTabs(layout, create, resolveKey);
    openLayoutAsTabs(layout, create, resolveKey);
    expect(getTabsSnapshot().tabs).toHaveLength(3);
  });

  it('a missing or broken layout opens nothing', () => {
    expect(openLayoutAsTabs(undefined, makeCreate(), resolveKey)).toBe(0);
    expect(openLayoutAsTabs('{not json', makeCreate(), resolveKey)).toBe(0);
    expect(openLayoutAsTabs({ splitPanels: [] }, makeCreate(), resolveKey)).toBe(0);
    expect(getTabsSnapshot().tabs).toHaveLength(0);
  });
});
