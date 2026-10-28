import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../ClientMediator', () => ({ default: { sendCommand: vi.fn() } }));
vi.mock('./entityTransfer', async (importOriginal) => ({
  ...(await importOriginal()),
  importEntity: vi.fn(),
}));

import ClientMediator from '../ClientMediator';
import { importEntity } from './entityTransfer';
import { readExport, takeDroppedExports } from './droppedExports';

const exported = { format: 'nordvik-entity', version: 1, kind: 'map', name: 'Forest', data: { name: 'Forest' } };
const exportFile = () => new File([JSON.stringify(exported)], 'Forest.map.json', { type: 'application/json' });
const image = () => new File(['png'], 'goblin.png', { type: 'image/png' });
const otherJson = () => new File(['{"a":1}'], 'settings.json', { type: 'application/json' });

describe('droppedExports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ClientMediator.sendCommand.mockReturnValue(true);
    importEntity.mockResolvedValue({ id: 'new', missing: [] });
  });

  it('recognises an export file, and nothing else', async () => {
    expect(await readExport(exportFile())).toEqual(exported);
    expect(await readExport(otherJson())).toBeNull();
    expect(await readExport(image())).toBeNull();
  });

  it('imports an export the GM chooses to import and uploads the rest', async () => {
    const ask = vi.fn().mockResolvedValue('import');
    const onImported = vi.fn();
    const img = image();
    const json = otherJson();

    const rest = await takeDroppedExports([img, exportFile(), json], { ask, onImported });

    expect(rest).toEqual([img, json]);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(importEntity).toHaveBeenCalledWith(exported, { kind: 'map' });
    expect(onImported).toHaveBeenCalledWith({ id: 'new', missing: [] }, exported);
  });

  it('uploads an export as a plain file when asked to, and drops it on cancel', async () => {
    const file = exportFile();
    expect(await takeDroppedExports([file], { ask: async () => 'material' })).toEqual([file]);
    expect(await takeDroppedExports([exportFile()], { ask: async () => 'cancel' })).toEqual([]);
    expect(importEntity).not.toHaveBeenCalled();
  });

  it('asks nothing of whoever cannot edit the game', async () => {
    ClientMediator.sendCommand.mockReturnValue(false);
    const ask = vi.fn();
    const file = exportFile();

    expect(await takeDroppedExports([file], { ask })).toEqual([file]);
    expect(ask).not.toHaveBeenCalled();
  });

  it('reports a failed import', async () => {
    importEntity.mockRejectedValue(new Error('This file holds a map, not a card.'));
    const onError = vi.fn();

    await takeDroppedExports([exportFile()], { ask: async () => 'import', onError });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'This file holds a map, not a card.' }), exported);
  });
});
