import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('./transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), postAsync: vi.fn(), uploadInPieces: vi.fn() },
}));
vi.mock('./ProgressToastManager', () => ({
  default: { start: vi.fn(), update: vi.fn(), complete: vi.fn(), fail: vi.fn(), dismiss: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from './transport';
import ProgressToastManager from './ProgressToastManager';
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

  // The file goes up in parts first and waits on the server as an import upload.
  const uploaded = () => WebHelper.uploadInPieces.mockResolvedValue({ status: 200, body: { uploadId: 'up1' } });
  const sentText = () => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(WebHelper.uploadInPieces.mock.calls[0][0]);
  });
  const inspection = { kind: 'card', name: 'Hero', fromThisServer: false, needsConfirmation: true, code: [{ card: 'Hero', files: ['sheet.html'] }] };

  it('uploads the file for import, imports it into a folder and answers the new id with what is missing', async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'new', missing: ['portrait.png'] } });

    expect(await importEntity(exported, { kind: 'card', parentId: 'folder' })).toEqual({ id: 'new', missing: ['portrait.png'] });
    expect(WebHelper.uploadInPieces).toHaveBeenCalledWith(expect.any(Blob), { name: 'Hero.card.json', mimeType: 'application/json', forImport: true }, { onProgress: expect.any(Function) });
    expect(JSON.parse(await sentText())).toEqual(exported);
    expect(WebHelper.postAsync).toHaveBeenCalledWith('transfer/Import', {
      uploadId: 'up1', kind: 'card', name: null, treeParentId: 'folder', afterTreeEntryId: null,
    });
  });

  it('sends the file as it was read, untouched (its signature is over it)', async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'new', missing: [] } });
    const text = '{ "format": "nordvik-entity", "kind": "card", "name": "Hero", "data": { "scale": 1.0 } }';

    await importEntity(text, { kind: 'card' });

    expect(await sentText()).toBe(text);
  });

  it('code from another server: asks the GM, and imports it once they accept', async () => {
    uploaded();
    WebHelper.postAsync
      .mockResolvedValueOnce({ status: 409, body: { error: 'from another server', inspection } })
      .mockResolvedValueOnce({ status: 200, body: { id: 'new', missing: [] } });
    const confirmCode = vi.fn().mockResolvedValue(true);

    expect(await importEntity(exported, { kind: 'card', confirmCode })).toEqual({ id: 'new', missing: [] });
    expect(confirmCode).toHaveBeenCalledWith(inspection);
    expect(WebHelper.postAsync).toHaveBeenLastCalledWith('transfer/Import', expect.objectContaining({ uploadId: 'up1', acceptCode: true }));
    expect(WebHelper.uploadInPieces).toHaveBeenCalledTimes(1); // sent once
  });

  it('code from another server the GM declines: the upload is dropped and nothing imported', async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValueOnce({ status: 409, body: { error: 'from another server', inspection } }).mockResolvedValue({ status: 204 });

    expect(await importEntity(exported, { kind: 'card', confirmCode: async () => false })).toBeNull();
    expect(WebHelper.postAsync).toHaveBeenLastCalledWith('transfer/CancelImport', { uploadId: 'up1' });
    expect(WebHelper.postAsync).toHaveBeenCalledTimes(2);
  });

  it('without anyone to ask, code from another server is declined', async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValueOnce({ status: 409, body: { error: 'from another server', inspection } }).mockResolvedValue({ status: 204 });

    expect(await importEntity(exported, { kind: 'card' })).toBeNull();
  });

  it("fails an import with the server's reason", async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValue({ status: 400, body: { error: 'This file holds a map, not a card.' } });

    await expect(importEntity(exported, { kind: 'card' })).rejects.toThrow('This file holds a map, not a card.');
  });

  it("fails when the file can't be sent, with the server's reason", async () => {
    WebHelper.uploadInPieces.mockResolvedValue({ status: 403, body: { error: 'Only the GM can import.' } });

    await expect(importEntity(exported, { kind: 'card' })).rejects.toThrow('Only the GM can import.');
    expect(WebHelper.postAsync).not.toHaveBeenCalled();

    WebHelper.uploadInPieces.mockResolvedValue(null); // a server without parts uploads
    await expect(importEntity(exported, { kind: 'card' })).rejects.toThrow(/update/i);
  });

  it('duplicates as a copy right after the original, through the same import', async () => {
    WebHelper.getAsync.mockResolvedValue(exported);
    uploaded();
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'copy', missing: [] } });

    expect(await duplicateEntity('card', 'c1', { id: 'entry-1', parentId: 'f' })).toEqual({ id: 'copy', missing: [] });
    expect(WebHelper.getAsync).toHaveBeenCalledWith('transfer/Export?kind=card&id=c1&includeFiles=false');
    expect(WebHelper.postAsync).toHaveBeenCalledWith('transfer/Import', {
      uploadId: 'up1', kind: 'card', name: 'Hero (copy)', treeParentId: null, afterTreeEntryId: 'entry-1',
    });
  });

  // Like a Materials upload: a toast follows the import from the queue to the outcome.
  it('shows the import in a progress toast: the bytes sent, then the server, then what it made', async () => {
    WebHelper.uploadInPieces.mockImplementation(async (_blob, _meta, { onProgress }) => {
      onProgress(0.5);
      return { status: 200, body: { uploadId: 'up1' } };
    });
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'new', missing: [] } });

    await importEntity(exported, { kind: 'card' });

    const id = ProgressToastManager.start.mock.calls[0][0];
    expect(ProgressToastManager.start).toHaveBeenCalledWith(id, expect.objectContaining({ title: 'Importing "Hero"…' }));
    expect(ProgressToastManager.update).toHaveBeenCalledWith(id, expect.objectContaining({ message: expect.stringMatching(/50%/) }));
    expect(ProgressToastManager.update).toHaveBeenLastCalledWith(id, expect.objectContaining({ message: expect.stringMatching(/setting it up/i) }));
    expect(ProgressToastManager.complete).toHaveBeenCalledWith(id, expect.objectContaining({ title: 'Imported "Hero"', type: 'success' }));
  });

  it('the files it left out turn the finished toast into a warning naming them', async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValue({ status: 200, body: { id: 'new', missing: ['portrait.png'] } });

    await importEntity(exported, { kind: 'card' });

    expect(ProgressToastManager.complete).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      type: 'warning', description: expect.stringContaining('portrait.png'),
    }));
  });

  it('a failed or declined import closes its toast (the caller says why)', async () => {
    uploaded();
    WebHelper.postAsync.mockResolvedValue({ status: 400, body: { error: 'nope' } });
    await expect(importEntity(exported, { kind: 'card' })).rejects.toThrow('nope');
    expect(ProgressToastManager.dismiss).toHaveBeenCalledTimes(1);

    WebHelper.postAsync.mockReset().mockResolvedValueOnce({ status: 409, body: { inspection } }).mockResolvedValue({ status: 204 });
    expect(await importEntity(exported, { kind: 'card' })).toBeNull();
    expect(ProgressToastManager.dismiss).toHaveBeenCalledTimes(2);
    expect(ProgressToastManager.complete).not.toHaveBeenCalled();
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

describe('exportEntity with the cards', () => {
  it("asks for a map's token cards", async () => {
    WebHelper.getAsync.mockResolvedValue(exported);

    await exportEntity('map', 'm1', { includeCards: true });

    expect(WebHelper.getAsync).toHaveBeenCalledWith('transfer/Export?kind=map&id=m1&includeFiles=false&includeCards=true');
  });
});
