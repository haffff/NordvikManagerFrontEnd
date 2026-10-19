import { describe, it, expect } from 'vitest';
import { PANEL_HELP, panelHelp } from './panelHelp';
import { PanelList } from './PanelsList';

describe('PANEL_HELP', () => {
  it('only names real panels, each with a line of text and a user guide page', () => {
    for (const [key, help] of Object.entries(PANEL_HELP)) {
      expect(PanelList, key).toHaveProperty(key);
      expect(help.text, key).toMatch(/\S/);
      expect(help.docUrl, key).toMatch(/^\/user-guide\/[a-z0-9/-]+(#[a-z0-9-]+)?$/);
    }
  });

  it('covers the windows people open from the menus', () => {
    ['ChatPanel', 'DiceRollerPanel', 'ToolsPanel', 'CardsPanel', 'TurnOrderPanel', 'PlayersPanel', 'MaterialsPanel',
      'PlaylistsPanel', 'SoundboardPanel', 'GameSettingsPanel', 'PlayerSettingsPanel', 'MapSettingsPanel',
      'LayoutsManagerPanel', 'AddonsManagePanel', 'ActionsPanel'].forEach((key) => expect(PANEL_HELP, key).toHaveProperty(key));
  });

  it('panelHelp: explicit text and link win, else the panel\'s entry, else nothing', () => {
    expect(panelHelp('ChatPanel')).toBe(PANEL_HELP.ChatPanel);
    expect(panelHelp('ChatPanel', { text: 'mine', docUrl: '/user-guide/x' })).toEqual({ text: 'mine', docUrl: '/user-guide/x' });
    expect(panelHelp('Unknown')).toBeNull();
    expect(panelHelp(undefined)).toBeNull();
  });
});
