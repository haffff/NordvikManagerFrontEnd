import { describe, it, expect } from 'vitest';
import { alsoInstalls, browseAddons, categoryName, usedCategories, versionAtLeast } from './addonsBrowse';

const repo = [
  { key: 'poll', name: 'Poll', author: 'haffff', description: 'Let the table vote', categories: ['tools'] },
  { key: 'dnd5e', name: '5E Edition', author: 'haffff', description: 'Sheets and monsters', categories: ['game-system'] },
  { key: 'imperiummaledictumtheme', name: '40K Imperium Maledictum Theme', author: 'Someone', description: 'Dark imperial frame', categories: ['theme'] },
  { key: 'obsidian', name: 'Obsidian', author: 'haffff', description: 'Notes from your vault', categories: ['tools'] },
  { key: 'plain', name: 'Plain', author: 'Zed' },
];
const categories = [
  { key: 'game-system', name: 'Game systems' },
  { key: 'theme', name: 'Themes' },
  { key: 'tools', name: 'Tools' },
];
const keys = (list) => list.map((a) => a.key);

describe('browseAddons', () => {
  it('searches name, author, description and key', () => {
    expect(keys(browseAddons(repo, { search: 'vote' }))).toEqual(['poll']);
    expect(keys(browseAddons(repo, { search: 'someone' }))).toEqual(['imperiummaledictumtheme']);
    expect(keys(browseAddons(repo, { search: 'DND5' }))).toEqual(['dnd5e']);
    expect(keys(browseAddons(repo, { search: '  ' }))).toHaveLength(5);
  });

  it('filters by category', () => {
    expect(keys(browseAddons(repo, { category: 'tools' }))).toEqual(['obsidian', 'poll']);
    expect(keys(browseAddons(repo, { category: 'all' }))).toHaveLength(5);
  });

  it('sorts by name (default), author, or category name with uncategorised last', () => {
    expect(keys(browseAddons(repo, {}))).toEqual(['imperiummaledictumtheme', 'dnd5e', 'obsidian', 'plain', 'poll']);
    expect(keys(browseAddons(repo, { sort: 'author' }))[0]).toBe('dnd5e');
    expect(keys(browseAddons(repo, { sort: 'author' })).at(-1)).toBe('plain');
    expect(keys(browseAddons(repo, { sort: 'category' }, categories)))
      .toEqual(['dnd5e', 'imperiummaledictumtheme', 'obsidian', 'poll', 'plain']);
  });

  it('copes with a missing list', () => {
    expect(browseAddons(undefined, {})).toEqual([]);
  });
});

describe('categories', () => {
  it('names a category, or shows its key when the server sent no names', () => {
    expect(categoryName('tools', categories)).toBe('Tools');
    expect(categoryName('tools', [])).toBe('tools');
  });

  it('lists only the categories some addon uses, in the registry order', () => {
    expect(usedCategories(repo, categories).map((c) => c.key)).toEqual(['game-system', 'theme', 'tools']);
    expect(usedCategories(repo, []).map((c) => c.key)).toEqual(['game-system', 'theme', 'tools']);
  });
});

// A dependency's version is the lowest that works, as the server checks it.
describe('versionAtLeast', () => {
  it('compares part by part as numbers', () => {
    expect(versionAtLeast('0.0.5', '0.0.4')).toBe(true);
    expect(versionAtLeast('1.10.0', '1.9')).toBe(true);
    expect(versionAtLeast('1.0', '1.0.0')).toBe(true);
    expect(versionAtLeast('0.0.3', '0.0.4')).toBe(false);
    expect(versionAtLeast('2.0.0-beta', '1.9')).toBe(true);
  });

  it('accepts anything without a required version, and nothing without an installed one', () => {
    expect(versionAtLeast('0.0.1', null)).toBe(true);
    expect(versionAtLeast(null, '1.0')).toBe(false);
  });

  it('matches versions that are not numbers only exactly', () => {
    expect(versionAtLeast('nightly', 'nightly')).toBe(true);
    expect(versionAtLeast('nightly', '1.0')).toBe(false);
  });
});

describe('alsoInstalls', () => {
  const registry = [
    { key: 'a', name: 'A', version: '1.0', dependencies: [{ key: 'b' }, { key: 'c', version: '2.0' }] },
    { key: 'b', name: 'B', version: '1.0', dependencies: [{ key: 'd' }] },
    { key: 'c', name: 'C', version: '2.1', dependencies: [{ key: 'd' }] },
    { key: 'd', name: 'D', version: '1.0', dependencies: [] },
  ];
  const addon = (key) => registry.find((x) => x.key === key);

  it('lists every dependency the game lacks, deepest first, each once', () => {
    expect(alsoInstalls(addon('a'), registry, [])).toEqual([
      { key: 'd', name: 'D', update: false },
      { key: 'b', name: 'B', update: false },
      { key: 'c', name: 'C', update: false },
    ]);
  });

  it('skips what is installed and new enough, and marks what is too old as an update', () => {
    const installed = [{ key: 'b', version: '0.1' }, { key: 'c', version: '1.0' }];
    expect(alsoInstalls(addon('a'), registry, installed)).toEqual([
      { key: 'd', name: 'D', update: false },
      { key: 'c', name: 'C', update: true },
    ]);
  });

  it('names a dependency the registry does not have by its key', () => {
    expect(alsoInstalls({ key: 'x', dependencies: [{ key: 'basics' }] }, registry, [])).toEqual([
      { key: 'basics', name: 'basics', update: false },
    ]);
  });

  it('stops at a circle instead of looping', () => {
    const circle = [
      { key: 'p', name: 'P', dependencies: [{ key: 'q' }] },
      { key: 'q', name: 'Q', dependencies: [{ key: 'p' }] },
    ];
    expect(alsoInstalls(circle[0], circle, [])).toEqual([{ key: 'q', name: 'Q', update: false }]);
  });
});
