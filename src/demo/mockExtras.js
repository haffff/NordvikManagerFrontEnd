// The GM's side of the mock game (mockGame.js): materials, playlists and a soundboard,
// installed addons and the registry, an action with its steps, and an event log. Enough
// for those windows to show something in the demo and in the docs screenshots.

import { toBase64 } from './mockGame';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const EXTRA_IDS = Object.freeze({
  images: Object.freeze({ floor: id(200), aria: id(201), goblin: id(202), handout: id(203) }),
  sounds: Object.freeze({ rain: id(210), tavern: id(211), door: id(212), roar: id(213) }),
  playlists: Object.freeze({ ambience: id(220), battle: id(221), effects: id(222) }),
  addon: id(230),
  action: id(240),
});

const svg = (body, w = 256, h = 256) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const portrait = (letter, bg) =>
  svg(`<rect width="256" height="256" fill="${bg}"/><circle cx="128" cy="100" r="52" fill="rgba(255,255,255,0.85)"/>` +
    `<rect x="48" y="168" width="160" height="88" rx="60" fill="rgba(255,255,255,0.85)"/>` +
    `<text x="128" y="118" font-family="Georgia" font-size="56" text-anchor="middle" fill="${bg}">${letter}</text>`);

const planks = svg(Array.from({ length: 8 }, (_, i) =>
  `<rect y="${i * 32}" width="256" height="31" fill="${i % 2 ? '#7a5a3c' : '#6b4e33'}"/>`).join(''));

const handout = svg('<rect width="256" height="256" fill="#e8d9b5"/>' +
  '<path d="M40 200 C 90 120, 150 190, 210 60" stroke="#8b2e16" stroke-width="5" fill="none" stroke-dasharray="10 8"/>' +
  '<text x="200" y="60" font-size="34" fill="#8b2e16">✕</text>' +
  '<text x="40" y="232" font-family="Georgia" font-size="20" fill="#5a4630">The old mine</text>');

const image = (resId, name, key, body) => ({ id: resId, name, key, mimeType: 'image/svg+xml', data: toBase64(body) });

/** Files the demo can serve: the pictures (with data) and the sounds (listed only). */
export function mockResources() {
  const i = EXTRA_IDS.images;
  return [
    image(i.floor, 'Tavern floor.svg', 'tavern_floor', planks),
    image(i.aria, 'Aria.svg', 'portrait_aria', portrait('A', '#2e6fb0')),
    image(i.goblin, 'Goblin.svg', 'portrait_goblin', portrait('G', '#5f7f2a')),
    image(i.handout, 'Map to the old mine.svg', 'handout_mine', handout),
  ];
}

const sound = (resId, name, volume = 1) => ({ id: resId, name, key: null, mimeType: 'audio/ogg', storage: 1, volume });

function materialsList(gmId, gmName) {
  const s = EXTRA_IDS.sounds;
  const owned = (r, storage = 0) => ({ ...r, storage, data: undefined, path: null, playerId: gmId, playerName: gmName });
  return [
    ...mockResources().map((r) => owned(r)),
    owned(sound(s.rain, 'Rain on the roof.ogg'), 2),
    owned(sound(s.tavern, 'Tavern chatter.ogg', 0.7), 1),
    owned(sound(s.door, 'Door creak.ogg'), 1),
    owned(sound(s.roar, 'Dragon roar.ogg', 0.8), 1),
  ];
}

/** Tree entries (TreeEntryDto) for one list: folders with their items, chained in order. */
export function treeOf(entryType, folders, firstId) {
  let n = firstId;
  const entries = [];
  const chain = (list) => list.forEach((e, i) => { e.head = i === 0; e.next = list[i + 1]?.id ?? null; });
  const top = folders.map(({ name, items }) => {
    const folder = { id: id(n++), name, parentId: null, isFolder: true, targetId: null, entryType, color: null, icon: null };
    const children = items.map((targetId) => ({ id: id(n++), name: '', parentId: folder.id, isFolder: false, targetId, entryType }));
    chain(children);
    entries.push(...children);
    return folder;
  });
  chain(top);
  return [...top, ...entries];
}

function playlists(gameId) {
  const s = EXTRA_IDS.sounds;
  const p = EXTRA_IDS.playlists;
  const tracks = (...ids) => materialsList().filter((r) => ids.includes(r.id));
  return {
    music: [
      { id: p.ambience, gameId, name: 'Tavern ambience', description: 'Rain and voices, layered.', mode: 1, shuffle: false, repeat: true, kind: 0, volume: 0.8, resources: tracks(s.rain, s.tavern) },
      { id: p.battle, gameId, name: 'Battle', description: '', mode: 0, shuffle: true, repeat: true, kind: 0, volume: 1, resources: tracks(s.roar) },
    ],
    soundboard: [
      { id: p.effects, gameId, name: 'Effects', description: 'One-off sounds.', mode: 0, shuffle: false, repeat: false, kind: 1, volume: 1, resources: tracks(s.door, s.roar) },
    ],
  };
}

const basicsAddon = {
  id: EXTRA_IDS.addon, key: 'basics', name: 'Basics', version: '0.1.0', author: 'haffff', license: 'AGPL-3.0-only',
  website: null, dependencies: [], isEnabled: true,
  description: 'Ships with NordvikManager and is added to every new game: a generic token with two bars and a private Note card.',
};

const registry = [
  { key: 'basics', name: 'Basics', version: '0.1.0', author: 'haffff', license: 'AGPL-3.0-only', repositoryUrl: null, description: basicsAddon.description },
  { key: 'dnd5e', name: 'Fifth Edition (SRD)', version: '1.4.0', author: 'haffff', license: 'OGL / CC-BY-4.0', repositoryUrl: null, description: 'Character sheets, monsters, spells and items for 5th-edition games, from the SRD.' },
  { key: 'themes', name: 'Themes', version: '0.3.0', author: 'haffff', license: 'AGPL-3.0-only', repositoryUrl: null, description: 'Ready-made looks for your game: parchment, sci-fi and more.' },
];

const arg = (name, type, description, extra = {}) => ({ name, type, description, conditionField: null, conditionValue: null, isOutput: false, deferred: false, ...extra });

const stepDefinitions = [
  {
    name: 'Get Property Value', value: 'GetPropertyValue', category: 'Properties',
    description: "Reads a single named property's value for one entity, falling back to DefaultValue when it doesn't exist.",
    summary: 'Read {PropertyName} of {ParentId}[ → {Output}]',
    arguments: [
      arg('ParentId', 'String', 'GUID of the entity whose property to read, e.g. %Data.id% or %playerId%.'),
      arg('PropertyName', 'String', 'Name of the property to read.'),
      arg('Output', 'String', "Name of the variable where the property's value will be stored.", { isOutput: true }),
      arg('DefaultValue', 'String', "Value to store when the property doesn't exist."),
    ],
  },
  {
    name: 'Roll Dice', value: 'RollDice', category: 'Roll',
    description: "Rolls dice using standard notation (e.g. '2d6+3'). Stores the result and optionally prints it to chat.",
    summary: 'Roll {DiceString}[ → {OutputVariable}]',
    arguments: [
      arg('DiceString', 'String', "Dice notation to roll, e.g. '1d20', '2d6+3'. Supports %variable% substitution."),
      arg('OutputVariable', 'String', 'Name of the variable where the result is stored.', { isOutput: true }),
      arg('PrintToChat', 'Boolean', 'When true, broadcasts the roll result to the game chat.'),
      arg('ChatTitle', 'String', 'Title shown on the chat roll card.', { conditionField: 'PrintToChat', conditionValue: 'true' }),
    ],
  },
  {
    name: 'Send Chat', value: 'SendChat', category: 'Client',
    description: 'Sends a formatted message to the game chat.',
    summary: 'Chat[ to {Player}]:[ {Title}][ {Message}][ {Number}]',
    arguments: [
      arg('Template', 'String', "Template type: 'Roll', 'BigNumber', or 'Text'."),
      arg('Title', 'String', 'Title shown on the chat card.'),
      arg('Message', 'String', 'Message body shown below the main content.'),
      arg('Player', 'String', 'Whisper: send only to this player.'),
    ],
  },
];

const hooks = [
  { value: 1, name: 'Player Joined', category: 'Game', description: 'A player joined the game.' },
  { value: 9, name: 'Chat Command', category: 'Chat', description: 'Someone typed a chat command no one else handles.' },
  { value: 23, name: 'Turn Changed', category: 'Turn order', description: 'A new turn or round started.' },
];

const action = {
  id: EXTRA_IDS.action, name: 'perception_check', prefix: 'demo', description: "Rolls a Perception check with the character's modifier.",
  hook: 0, isEnabled: true, genericPermission: 3,
  // The server sends the steps as a JSON string.
  content: JSON.stringify([
    { Type: 'GetPropertyValue', Data: { Label: 'Read the modifier', ParentId: '%cardId%', PropertyName: 'perception_mod', Output: 'mod', DefaultValue: '0' } },
    { Type: 'RollDice', Data: { Label: 'Roll', DiceString: '1d20+%mod%', OutputVariable: 'roll', PrintToChat: true, ChatTitle: 'Perception' } },
    { Type: 'SendChat', Data: { Label: 'Whisper to the GM', Template: 'Text', Title: 'Perception', Message: 'Rolled %roll.Result%', Player: 'GM' } },
  ]),
};

function eventLog(playerName) {
  const at = (s) => new Date(Date.UTC(2026, 9, 16, 19, 0, s)).toISOString();
  return [
    { id: 1, timestamp: at(2), level: 'Info', category: 'Hook', player: playerName, message: 'Player Joined: Aria', details: null },
    { id: 2, timestamp: at(15), level: 'Info', category: 'Action', player: playerName, message: 'demo/perception_check finished in 12 ms', details: { steps: 3 } },
    { id: 3, timestamp: at(31), level: 'Warning', category: 'Action', player: playerName, message: "Property 'perception_mod' not found, used the default", details: null },
  ];
}

/** The extra answers, keyed by [path, query] like mockGame's answer(). */
export function mockExtraAnswers({ gameId, gm }) {
  const lists = playlists(gameId);
  const materials = materialsList(gm.id, gm.name);
  const i = EXTRA_IDS.images;
  const s = EXTRA_IDS.sounds;
  return [
    ['api/materials/getresources', {}, materials],
    ['api/battlemap/gettree', { entityType: 'ResourceModel' }, treeOf('ResourceModel', [
      { name: 'Maps', items: [i.floor, i.handout] },
      { name: 'Portraits', items: [i.aria, i.goblin] },
      { name: 'Sounds', items: [s.rain, s.tavern, s.door, s.roar] },
    ], 300)],
    ['api/playlist/getplaylists', { kind: '0' }, lists.music],
    ['api/playlist/getplaylists', { kind: '1' }, lists.soundboard],
    ['api/battlemap/gettree', { entityType: 'Playlist' }, treeOf('Playlist', [{ name: 'Music', items: lists.music.map((p) => p.id) }], 320)],
    ['api/battlemap/gettree', { entityType: 'Soundboard' }, treeOf('Soundboard', [{ name: 'Sounds', items: lists.soundboard.map((p) => p.id) }], 330)],
    ['api/battlemap/gettree', { entityType: 'CustomView' }, []],
    ['api/materials/getcustomwiews', {}, []],
    ['api/addon/installed', {}, [basicsAddon]],
    ['api/addon/repository', {}, registry],
    ['api/addon/actions', {}, [{ id: action.id, name: action.name, prefix: action.prefix, hook: action.hook, isEnabled: action.isEnabled }]],
    ['api/addon/action', { id: action.id }, action],
    ['api/addon/stepdefinitions', {}, { stepDefinitions }],
    ['api/addon/hooks', {}, hooks],
    ['api/addon/eventlog', {}, eventLog(gm.name)],
  ];
}
