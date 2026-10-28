// Each window's help: a line shown on hover and its page in the user guide (Central's docs,
// docs-site/user-guide). BasePanel shows it as a small ⓘ in the panel's corner. Keyed by
// PanelList key; a panel outside PanelList passes helpText/docUrl to BasePanel itself.
//
// Anchors are the guide's headings as Docusaurus turns them into ids: lower case, spaces
// become "-", other punctuation dropped ("Several battle maps (GM)" → several-battle-maps-gm).

const guide = (path) => `/user-guide/${path}`;

export const PANEL_HELP = Object.freeze({
  Battlemap: { text: 'The battle map: pan, zoom, right-click for more.', docUrl: guide('battle-map/overview') },
  ToolsPanel: { text: 'Tools for the battle map: select, draw, measure, sketch.', docUrl: guide('battle-map/overview#the-tools-window') },
  MapSelector: { text: 'The game\'s maps: pick the one this battle map shows.', docUrl: guide('battle-map/overview#several-battle-maps-gm') },
  MapSettingsPanel: { text: 'This map\'s size, grid and distances.', docUrl: guide('battle-map/map-settings') },
  PropertiesPanel: { text: 'The values stored on this element, mostly for addons.', docUrl: guide('battle-map/overview#the-right-click-menu') },
  ChatPanel: { text: 'Messages, rolls and whispers. Type /help for the commands.', docUrl: guide('chat') },
  DiceRollerPanel: { text: 'Build a roll by clicking dice.', docUrl: guide('rolling-dice') },
  TurnOrderPanel: { text: 'The turn order of the map on screen.', docUrl: guide('turn-order') },
  CardsPanel: { text: 'Your cards: character sheets, notes and more.', docUrl: guide('cards') },
  CardSettingsPanel: { text: 'This card\'s owner, token and permissions.', docUrl: guide('cards#card-settings') },
  MaterialsPanel: { text: 'Pictures, sounds and other files of the game.', docUrl: guide('materials') },
  PlayersPanel: { text: 'Everyone in the game, and who is online.', docUrl: guide('players-and-settings#the-players-window') },
  AdminPlayersPanel: { text: 'Players\' settings, and kicking a player.', docUrl: guide('players-and-settings#managing-players-gm') },
  PlayerSettingsPanel: { text: 'Name, avatar and colour; volumes and cache for this browser.', docUrl: guide('players-and-settings#your-player-settings') },
  LayoutsManagerPanel: { text: 'The game\'s layouts: default, shared, forced.', docUrl: guide('layouts#the-games-layouts-gm') },
  LayoutSettingsPanel: { text: 'This layout\'s name, and whether it\'s the default.', docUrl: guide('layouts') },
  PlaylistsPanel: { text: 'Music and ambience for everyone.', docUrl: guide('sound#playlists') },
  SoundboardPanel: { text: 'One-off sound effects for everyone.', docUrl: guide('sound#soundboard') },
  GameSettingsPanel: { text: 'Settings of the whole game.', docUrl: guide('game-settings') },
  AddonsManagePanel: { text: 'Install, update and remove addons.', docUrl: guide('addons#installing-addons') },
  TemplatesPanel: { text: 'Card templates from addons.', docUrl: guide('addons#templates') },
  CustomViewsPanel: { text: 'Windows made by addons.', docUrl: guide('addons#views') },
  ActionsPanel: { text: 'Actions: steps the GM\'s server runs.', docUrl: guide('addons#actions') },
  DebugConsolePanel: { text: 'Actions as they run: step through, inspect, stop.', docUrl: guide('addons#debugging') },
  EventLogPanel: { text: 'What happened in the game: hooks, actions, errors.', docUrl: guide('addons#debugging') },
});

/** The help for a panel: what the panel passed itself, else its entry, else null. */
export function panelHelp(panelKey, { text, docUrl } = {}) {
  if (text) return { text, docUrl };
  return (panelKey && PANEL_HELP[panelKey]) || null;
}

export default PANEL_HELP;
