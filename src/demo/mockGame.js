// A small hand-made game for the demo, used until a real game has been recorded (see
// fixtures.js and demoFixtures.js): the layout a new game gets, plus the tour's panels,
// one battle map with a room and two tokens, a short chat, a turn order, and Note cards
// from the built-in Basics addon (its files are copied in ./mock/basics). The GM's
// windows (materials, sound, addons, actions) get their data from mockExtras.js.
//
// It has the same shape as a recorded fixture, so DemoServer serves it the same way.

import { requestKey, FIXTURE_VERSION } from './fixtures';
import noteHtml from './mock/basics/note_index.html?raw';
import quillJs from './mock/basics/quill.js?raw';
import quillCss from './mock/basics/quill.snow.css?raw';
import { mockExtraAnswers, mockResources, EXTRA_IDS } from './mockExtras';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const MOCK_IDS = Object.freeze({
  game: id(1),
  gm: id(2),
  player: id(3),
  map: id(10),
  battleMap: id(11),
  layout: id(12),
  template: id(20),
  resources: Object.freeze({ html: id(21), js: id(22), css: id(23) }),
  cards: Object.freeze({ gmNotes: id(30), ariaNotes: id(31), questLog: id(32) }),
  elements: Object.freeze({ room: id(40), table: id(41), label: id(42), aria: id(43), goblin: id(44), floor: id(45) }),
  turnEntries: Object.freeze({ aria: id(50), goblin: id(51) }),
});

const ALL = 31;
const READ = 1;

/** Base64 of the UTF-8 bytes of a text, as the server sends resource data. */
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const players = [
  { id: MOCK_IDS.gm, name: 'Game Master', color: 'rgba(190,60,50,1)', image: '' },
  { id: MOCK_IDS.player, name: 'Aria', color: 'rgba(50,130,220,1)', image: '' },
];

// The layout AddGameCommandHandler gives a new game (tools and map on the left, chat
// on the right), with the right column split so the tour has every panel to point at.
function defaultLayout() {
  const panel = (props) => ({
    floating: false, rect: { x: 0, y: 0, w: 0, h: 0 }, contentList: [], currentTabIndex: 0,
    splitPanels: [], splitMode: 0, splitSize: 0.5, preferredWidth: 300, preferredHeight: 250,
    ephemeral: false, ...props,
  });
  return {
    ...panel({ id: 1, splitSize: 0.75 }),
    splitPanels: [
      panel({
        id: 7, splitSize: 0.05, preferredWidth: 1000, preferredHeight: 1200,
        splitPanels: [
          panel({ id: 6, contentList: [7], preferredWidth: 300, preferredHeight: 800, isHeaderHidden: true, isLocked: false }),
          panel({ id: 8, contentList: [3], isHeaderHidden: false, isLocked: false }),
        ],
      }),
      panel({
        id: 5, splitMode: 1, splitSize: 0.55,
        splitPanels: [
          panel({ id: 9, contentList: [6, 10] }),
          panel({ id: 11, contentList: [12, 13, 14] }),
        ],
      }),
    ],
    _contents: [
      { contentId: 7, type: 'ToolsPanel', props: {} },
      {
        contentId: 3, type: 'Battlemap', syncId: MOCK_IDS.battleMap, mapId: MOCK_IDS.map,
        props: { syncId: MOCK_IDS.battleMap, withID: MOCK_IDS.battleMap },
      },
      { contentId: 6, type: 'ChatPanel', props: {} },
      { contentId: 10, type: 'DiceRollerPanel', props: {} },
      { contentId: 12, type: 'CardsPanel', props: {} },
      { contentId: 13, type: 'TurnOrderPanel', props: {} },
      { contentId: 14, type: 'PlayersPanel', props: {} },
    ],
  };
}

const fabricBase = {
  version: '5.3.0', originX: 'left', originY: 'top', angle: 0, opacity: 1, visible: true,
  scaleX: 1, scaleY: 1, strokeUniform: false, paintFirst: 'fill', globalCompositeOperation: 'source-over',
};

const nameProperty = (n, elementId, name) => ({ id: id(n), name: 'name', value: name, parentId: elementId, entityName: 'ElementModel' });

function element(elementId, layer, object, { permission = ALL, properties = [] } = {}) {
  return {
    id: elementId, mapID: MOCK_IDS.map, layer, permission, visible: true, isPublic: true, selectable: true,
    object: JSON.stringify(object), properties,
  };
}

function token(elementId, n, name, left, top, color, permission) {
  return element(elementId, 100, {
    ...fabricBase, type: 'image', left, top, width: 100, height: 100, scaleX: 0.5, scaleY: 0.5,
    fill: 'rgb(0,0,0)', stroke: color, strokeWidth: 0, crossOrigin: null, filters: [], clipShape: 'circle',
    name, isToken: true, tokenData: { editableProps: [], assignableIcons: [], propDeps: [] }, mapId: MOCK_IDS.map,
  }, { permission, properties: [nameProperty(n, elementId, name)] });
}

function mapElements(role) {
  const playerCan = (gmOnly) => (role === 'gm' ? ALL : gmOnly ? READ : ALL);
  const e = MOCK_IDS.elements;
  return [
    element(e.floor, -100, {
      ...fabricBase, type: 'image', left: 150, top: 100, width: 256, height: 256, scaleX: 700 / 256, scaleY: 450 / 256,
      crossOrigin: null, filters: [], resourceId: EXTRA_IDS.images.floor, mapId: MOCK_IDS.map,
    }, { permission: playerCan(true) }),
    element(e.room, -100, {
      ...fabricBase, type: 'rect', left: 150, top: 100, width: 700, height: 450, rx: 4, ry: 4,
      fill: 'rgba(120,96,70,0.55)', stroke: 'rgba(60,45,30,1)', strokeWidth: 8,
    }, { permission: playerCan(true) }),
    element(e.table, -100, {
      ...fabricBase, type: 'circle', left: 450, top: 270, radius: 60,
      fill: 'rgba(90,60,35,0.9)', stroke: 'rgba(40,28,18,1)', strokeWidth: 3,
    }, { permission: playerCan(true) }),
    element(e.label, -100, {
      ...fabricBase, type: 'textbox', left: 170, top: 112, width: 300, text: 'The Prancing Pony',
      fontSize: 26, fontFamily: 'Georgia', fill: 'rgba(245,235,215,1)',
    }, { permission: playerCan(true) }),
    token(e.aria, 60, 'Aria', 300, 400, 'rgba(50,130,220,1)', ALL),
    token(e.goblin, 61, 'Goblin', 650, 200, 'rgba(190,60,50,1)', playerCan(true)),
  ];
}

const templateResource = (resId, name, mimeType, text) => ({ id: resId, name, key: name, mimeType, data: toBase64(text) });

function noteCard(cardId, n, name, owner, permission, text) {
  return {
    card: {
      id: cardId, name, description: 'A rich-text note.', key: 'note', templateId: MOCK_IDS.template,
      isHidden: false, owner, firstOpen: false, permission, genericPermission: READ, gmPermission: ALL,
      mainResource: MOCK_IDS.resources.html, additionalResources: [MOCK_IDS.resources.js, MOCK_IDS.resources.css],
    },
    properties: [
      { id: id(n), name: 'note_text', value: text, parentId: cardId, entityName: 'CardModel' },
      { id: id(n + 1), name: 'app_styles', value: 'true', parentId: cardId, entityName: 'CardModel' },
    ],
  };
}

function cardsFor(role) {
  const c = MOCK_IDS.cards;
  const gm = role === 'gm';
  return [
    gm && noteCard(c.gmNotes, 80, 'Session notes', MOCK_IDS.gm, ALL,
      '<h2>Tonight</h2><p>The party meets in the <strong>Prancing Pony</strong>. A goblin is hiding under the table.</p><ul><li>Aria owes the innkeeper 3 silver</li><li>The map to the old mine is in the cellar</li></ul>'),
    noteCard(c.ariaNotes, 82, 'Aria’s notes', MOCK_IDS.player, ALL,
      '<p>Things to remember:</p><ol><li>Ask the innkeeper about the mine</li><li>Buy rope</li></ol><p><em>Edit this note — it’s saved until you reload.</em></p>'),
    noteCard(c.questLog, 84, 'Quest log', MOCK_IDS.gm, gm ? ALL : READ,
      '<h3>Find the old mine</h3><p>Rumours say it was closed after the miners heard voices.</p>'),
  ].filter(Boolean);
}

// The Cards panel lists tree entries (TreeEntryDto), chained in order by `next`: the
// cards at the top, then a Handouts folder holding the quest log.
function cardTree(cards) {
  const folder = { id: id(89), name: 'Handouts', parentId: null, isFolder: true, targetId: null, entryType: 'CardModel', color: '#b08d57', icon: null };
  const loose = cards.filter((c) => c.id !== MOCK_IDS.cards.questLog);
  const top = [
    ...loose.map((card, i) => ({ id: id(90 + i), name: card.name, parentId: null, isFolder: false, targetId: card.id, entryType: 'CardModel' })),
    folder,
  ];
  top.forEach((e, i) => { e.head = i === 0; e.next = top[i + 1]?.id ?? null; });
  const inFolder = { id: id(95), name: 'Quest log', parentId: folder.id, isFolder: false, head: true, next: null, targetId: MOCK_IDS.cards.questLog, entryType: 'CardModel' };
  return [...top, inFolder];
}

// Newest first, as battlemap/getchat answers.
function chat() {
  const at = (minutes) => new Date(Date.UTC(2026, 9, 16, 19, minutes)).toISOString();
  const roll = { type: 'Roll', title: 'Roll', message: 'Perception', roll: { result: 17, rolled: '1d20+3', dices: [{ index: 0, diceValue: 20, times: 1, result: 14, kept: true }] } };
  return [
    { id: id(70), gameId: MOCK_IDS.game, playerId: MOCK_IDS.gm, data: 'Welcome to the demo! You arrive at the Prancing Pony as the rain starts.', created: at(0), isTemplate: false },
    { id: id(71), gameId: MOCK_IDS.game, playerId: MOCK_IDS.player, data: 'I look around the room.', created: at(1), isTemplate: false },
    { id: id(72), gameId: MOCK_IDS.game, playerId: MOCK_IDS.player, data: JSON.stringify(roll), created: at(1), isTemplate: true },
    { id: id(73), gameId: MOCK_IDS.game, playerId: MOCK_IDS.gm, data: 'Something moves under the big table…', created: at(2), isTemplate: false },
    { id: id(74), gameId: MOCK_IDS.game, playerId: MOCK_IDS.player, recipientId: MOCK_IDS.gm, data: 'Can I sneak a look under the table?', created: at(3), isTemplate: false },
  ].reverse();
}

function turnOrder(role) {
  const gm = role === 'gm';
  return {
    mapId: MOCK_IDS.map, round: 1, currentEntryId: MOCK_IDS.turnEntries.aria, currentHidden: false,
    canEndTurn: true, canEdit: gm,
    entries: [
      { id: MOCK_IDS.turnEntries.aria, name: 'Aria', initiative: 18, elementId: MOCK_IDS.elements.aria, hidden: false, controlled: true },
      { id: MOCK_IDS.turnEntries.goblin, name: 'Goblin', initiative: 12, elementId: MOCK_IDS.elements.goblin, hidden: false, controlled: gm },
    ],
  };
}

/** The mock game as the GM ('gm') or as the player Aria ('player') sees it. */
export function buildMockFixture(role) {
  const gm = role === 'gm';
  const me = gm ? players[0] : players[1];
  const layout = { id: MOCK_IDS.layout, gameModelId: MOCK_IDS.game, name: 'Default', default: true, value: JSON.stringify(defaultLayout()), permission: gm ? ALL : READ };
  const cards = cardsFor(role);
  const template = {
    id: MOCK_IDS.template, name: 'Note', key: 'note', description: 'A rich-text note. Only you and the GM can see it.',
    mainResource: MOCK_IDS.resources.html, additionalResources: [MOCK_IDS.resources.js, MOCK_IDS.resources.css],
    isHidden: false, permission: gm ? ALL : READ, genericPermission: READ,
    properties: [{ name: 'note_text', value: '' }, { name: 'app_styles', value: 'true' }],
  };
  const resources = [
    templateResource(MOCK_IDS.resources.html, 'basics_note_index.html', 'text/html', noteHtml),
    templateResource(MOCK_IDS.resources.js, 'basics_quill.js', 'text/javascript', quillJs),
    templateResource(MOCK_IDS.resources.css, 'basics_quill.snow.css', 'text/css', quillCss),
  ];
  const elements = mapElements(role);
  const map = {
    id: MOCK_IDS.map, gameID: MOCK_IDS.game, name: 'The Prancing Pony', width: 1000, height: 650,
    gridSize: 50, gridVisible: true, gridUnitSize: 5, gridColor: null, permission: gm ? ALL : READ,
    properties: [], elements,
  };
  const battleMap = { id: MOCK_IDS.battleMap, name: 'Default', mapId: MOCK_IDS.map, gameId: MOCK_IDS.game, permission: gm ? ALL : READ };

  const requests = {};
  const answer = (path, query, body) => { requests[requestKey('GET', path, query)] = { status: 200, body }; };

  answer('api/battlemap/getplayer', {}, me);
  answer('api/battlemap/getfullgame', {}, {
    id: MOCK_IDS.game, name: 'Demo game', master: players[0], players, battleMaps: [battleMap],
    maps: [{ id: MOCK_IDS.map, name: map.name }], defaultLayout: layout, layouts: [layout],
    permission: gm ? ALL : READ, requirePassword: false, useSquaredSystem: true,
    baseDistancePerSquare: 5, baseDistanceUnit: 'ft', centralSessionId: 'demo',
    disallowPlayerLayouts: false, saveLayoutOnExit: false,
  });
  answer('api/session/whoami', {}, { gameId: MOCK_IDS.game });
  // Who may do what with each thing: { playerId: permission bits }, the GM always all.
  const permissions = (entityId, entityType, playerBits) => answer(
    'api/security/permissions', { entityId, entityType }, { [MOCK_IDS.gm]: ALL, [MOCK_IDS.player]: playerBits });
  permissions(MOCK_IDS.game, 'GameModel', READ);
  permissions(MOCK_IDS.map, 'MapModel', READ);
  permissions(MOCK_IDS.battleMap, 'BattleMapModel', READ);
  permissions(MOCK_IDS.layout, 'LayoutModel', READ);
  elements.forEach((e) => permissions(e.id, 'ElementModel', e.id === MOCK_IDS.elements.aria ? ALL : READ));
  cards.forEach(({ card }) => permissions(card.id, 'CardModel', card.owner === MOCK_IDS.player ? ALL : READ));
  answer('api/battlemap/getbattlemap', { id: MOCK_IDS.battleMap }, battleMap);
  answer('api/battlemap/getbattlemaps', {}, [battleMap]);
  answer('api/map/get', { mapId: MOCK_IDS.map }, map);
  answer('api/map/getallflat', {}, [{ id: MOCK_IDS.map, name: map.name }]);
  answer('api/turnorder', { mapId: MOCK_IDS.map }, turnOrder(role));
  answer('api/battlemap/getchat', {}, chat());
  answer('api/battlemap/getlayouts', {}, [layout]);
  answer('api/battlemap/getlayout', { id: MOCK_IDS.layout }, layout);
  answer('api/materials/getcards', {}, cards.map(({ card }) => card));
  answer('api/materials/gettemplatesfull', {}, [template]);
  answer('api/battlemap/gettree', { entityType: 'CardModel' }, cardTree(cards.map(({ card }) => card)));
  answer('api/playlist/getcurrentplayback', {}, []);
  answer('api/security/sandboxorigins', {}, { origins: [] }); // the Note loads nothing from outside
  cards.forEach(({ card }) => answer('api/materials/getcard', { id: card.id }, card));
  resources.forEach((res) => answer('api/materials/resourcemetadata', { id: res.id }, res));
  if (gm) {
    answer('api/battlemap/gettree', { entityType: 'CardTemplate' }, [
      { id: id(99), name: 'Note', parentId: null, isFolder: false, head: true, next: null, targetId: MOCK_IDS.template, entryType: 'CardTemplate' },
    ]);
    mockExtraAnswers({ gameId: MOCK_IDS.game, gm: players[0] }).forEach(([path, query, body]) => answer(path, query, body));
  } else {
    answer('api/materials/getresources', {}, []); // a player lists only their own uploads
    answer('api/battlemap/gettree', { entityType: 'ResourceModel' }, []);
  }

  const gameProperty = (n, name, value) => ({ id: id(n), name, value, parentId: MOCK_IDS.game, entityName: 'GameModel' });
  const properties = [
    ...cards.flatMap((c) => c.properties),
    ...elements.flatMap((e) => e.properties),
    gameProperty(110, 'shortDescription', 'A short adventure to try Nordvik Manager.'),
    gameProperty(111, 'longDescription', 'The party meets in a tavern on a rainy night. A goblin, a map and an old mine.'),
    gameProperty(112, 'allowPlayerUseLayouts', 'True'),
  ];

  return {
    version: FIXTURE_VERSION,
    role,
    requests,
    after: { player_list: [{ command: 'player_list', data: players, result: 'Ok' }] },
    properties,
    resources: mockResources(),
  };
}
