import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { addonCommandSections } from './mobileCommands';

// What addons put in the toolbar's menus (Add Menu Item / Add Toolbar Button steps),
// laid out as the mobile "+" sheet's sections.
const item = (name, onClick = vi.fn(), extra = {}) => React.createElement('x-item', { key: name, name, onClick, ...extra });
const sub = (viewId, name) => ({ key: viewId, subMenu: { viewId, name } });

function store(byView) {
  return (viewId) => byView[viewId] ?? [];
}

describe('addonCommandSections', () => {
  it('lists the items added to the toolbar menus, under the menu name', () => {
    const roll = vi.fn();
    const sections = addonCommandSections({
      getItems: store({ game: [item('Roll initiative', roll)], views: [item('Party sheet')] }),
      toolbarButtons: [],
      canEditGame: false,
    });
    expect(sections.map((s) => [s.title, s.items.map((i) => i.name)])).toEqual([
      ['Game', ['Roll initiative']],
      ['View', ['Party sheet']],
    ]);
    sections[0].items[0].onClick();
    expect(roll).toHaveBeenCalled();
  });

  it('gives a submenu its own section, named by its path, and never loops', () => {
    const sections = addonCommandSections({
      getItems: store({
        settings: [sub('dnd', 'D&D')],
        dnd: [item('Rest'), sub('settings', 'Back to settings'), sub('dnd_more', 'More')],
        dnd_more: [item('Long rest'), sub('dnd', 'D&D again')],
      }),
      toolbarButtons: [],
      canEditGame: false,
    });
    expect(sections.map((s) => [s.title, s.items.map((i) => i.name)])).toEqual([
      ['Settings › D&D', ['Rest']],
      ['Settings › D&D › More', ['Long rest']],
    ]);
  });

  it("shows the Addons menu's items only to those who may edit the game", () => {
    const getItems = store({ addons: [item('Rebuild')], addons_code: [item('Run script')] });
    expect(addonCommandSections({ getItems, toolbarButtons: [], canEditGame: false })).toEqual([]);
    expect(addonCommandSections({ getItems, toolbarButtons: [], canEditGame: true }).map((s) => s.title))
      .toEqual(['Addons', 'Addons › Code']);
  });

  it('leaves out items meant for GMs when the player may not edit, and items that do nothing', () => {
    const sections = addonCommandSections({
      getItems: store({ game: [item('GM thing', vi.fn(), { requiresEdit: true }), item('Inert', null), item('Ok')] }),
      toolbarButtons: [],
      canEditGame: false,
    });
    expect(sections[0].items.map((i) => i.name)).toEqual(['Ok']);
  });

  it('adds toolbar buttons: plain ones together, menu buttons as their own section', () => {
    const rest = vi.fn();
    const sections = addonCommandSections({
      getItems: store({ spells_menu: [item('Fireball')] }),
      toolbarButtons: [
        { key: 'Rest', name: 'Rest', onClick: rest },
        { key: 'spells_menu', name: 'Spells', menuId: 'spells_menu', menuName: 'Spells' },
      ],
      canEditGame: false,
    });
    expect(sections.map((s) => [s.title, s.items.map((i) => i.name)])).toEqual([
      ['Toolbar', ['Rest']],
      ['Spells', ['Fireball']],
    ]);
    sections[0].items[0].onClick();
    expect(rest).toHaveBeenCalled();
  });
});
