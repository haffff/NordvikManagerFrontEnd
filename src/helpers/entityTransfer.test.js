import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), postAsync: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from './transport';
import { duplicateEntity, exportEntity, exportFileName, importEntity, parseExport } from './entityTransfer';

const exported = { format: 'nordvik-entity', version: 1, kind: 'card', name: 'Hero', data: { name: 'Hero' } };

describe('entityTransfer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports through Transfer/Export, with the files when asked', async () => {
    WebHelper.getAsync.mockResolvedValue(exported);

    expect(await exportEntity('card', 'c1', { includeFiles: true })).toBe(exported);
    expect(WebHelper.getAsync).toHaveBeenCalledWith('transfer/Export?kind=card&id=c1&includeFiles=true');
  });

  it('fails an export the server refused', async () => {
    WebHelper.getAsync.mockResolvedValue(undefined);

    await expect(exportEntity('card', 'c1')).rejects.toThrow();
  });

  it('imports into a folder and answers the new id with what is missing', async () => {
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'new', missing: ['portrait.png'] } });

    expect(await importEntity(exported, { kind: 'card', parentId: 'folder' })).toEqual({ id: 'new', missing: ['portrait.png'] });
    expect(WebHelper.postAsync).toHaveBeenCalledWith('transfer/Import', {
      export: exported, kind: 'card', name: null, treeParentId: 'folder', afterTreeEntryId: null,
    });
  });

  it("fails an import with the server's reason", async () => {
    WebHelper.postAsync.mockResolvedValue({ status: 400, body: { error: 'This file holds a map, not a card.' } });

    await expect(importEntity(exported, { kind: 'card' })).rejects.toThrow('This file holds a map, not a card.');
  });

  it('duplicates as a copy right after the original', async () => {
    WebHelper.getAsync.mockResolvedValue(exported);
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'copy', missing: [] } });

    expect(await duplicateEntity('card', 'c1', { id: 'entry-1', parentId: 'f' })).toEqual({ id: 'copy', missing: [] });
    expect(WebHelper.getAsync).toHaveBeenCalledWith('transfer/Export?kind=card&id=c1&includeFiles=false');
    expect(WebHelper.postAsync).toHaveBeenCalledWith('transfer/Import', {
      export: exported, kind: 'card', name: 'Hero (copy)', treeParentId: null, afterTreeEntryId: 'entry-1',
    });
  });

  it('reads an exported file and refuses anything else', () => {
    expect(parseExport(JSON.stringify(exported))).toEqual(exported);
    expect(() => parseExport('{"format":"other"}')).toThrow(/isn't an exported/);
    expect(() => parseExport('not json')).toThrow(/isn't an exported/);
  });

  it('names the file after what it holds', () => {
    expect(exportFileName({ kind: 'map', name: 'Forest: night/1' })).toBe('Forest_ night_1.map.json');
    expect(exportFileName({ kind: 'soundboard' })).toBe('soundboard.soundboard.json');
  });
});
