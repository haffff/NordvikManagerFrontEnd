import { describe, it, expect } from 'vitest';
import { browseAddons, categoryName, usedCategories } from './addonsBrowse';

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
