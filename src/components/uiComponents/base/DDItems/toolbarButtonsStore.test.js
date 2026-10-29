import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addToolbarButton,
  getToolbarButtons,
  resetToolbarButtons,
  subscribeToolbarButtons,
} from './toolbarButtonsStore';

describe('toolbarButtonsStore', () => {
  beforeEach(() => resetToolbarButtons());

  it('keeps the buttons in the order they came, and tells its listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToolbarButtons(listener);
    addToolbarButton({ name: 'Rest', onClick: () => {} });
    addToolbarButton({ name: 'Spells', menuId: 'spells_menu', menuName: 'Spells' });
    expect(getToolbarButtons().map((b) => b.key)).toEqual(['Rest', 'spells_menu']);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('ignores a button sent again (a reconnect, a hook running twice)', () => {
    addToolbarButton({ name: 'Rest', onClick: () => {} });
    const before = getToolbarButtons();
    addToolbarButton({ name: 'Rest', onClick: () => {} });
    expect(getToolbarButtons()).toBe(before);
  });

  it('starts empty again after a reset (leaving the game)', () => {
    addToolbarButton({ name: 'Rest' });
    resetToolbarButtons();
    expect(getToolbarButtons()).toEqual([]);
  });
});
