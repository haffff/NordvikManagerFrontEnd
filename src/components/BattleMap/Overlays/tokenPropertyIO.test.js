import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../helpers/transport', () => ({ ActiveTransportManager: { Send: vi.fn() } }));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommandAsync: vi.fn() } }));

import { writeTokenProperty } from './tokenPropertyIO';
import { ActiveTransportManager } from '../../../helpers/transport';
import ClientMediator from '../../../ClientMediator';

const token = { id: 'el-1', tokenData: { cardId: 'card-1' } };

describe('writeTokenProperty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a known property in place', async () => {
    await writeTokenProperty({ token, source: 'element', dtoProperty: 'status_prone', value: true, existingId: 'p1' });

    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(expect.objectContaining({
      command: 'property_update', data: expect.objectContaining({ id: 'p1', value: true }),
    }));
  });

  it('adds a property the token does not have yet', async () => {
    ClientMediator.sendCommandAsync.mockResolvedValue([]);

    await writeTokenProperty({ token, source: 'element', dtoProperty: 'status_prone', value: true });

    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(expect.objectContaining({ command: 'property_add' }));
  });

  // Toggling an icon on and off again in one go: the first click created the
  // property, so the second must update it — the server refuses a second add.
  it('updates a property created since its id was read', async () => {
    ClientMediator.sendCommandAsync.mockResolvedValue([{ id: 'p9', name: 'status_prone', value: 'True' }]);

    const id = await writeTokenProperty({ token, source: 'element', dtoProperty: 'status_prone', value: false });

    expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Properties', 'GetByNames', { parentId: 'el-1', names: ['status_prone'] });
    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(expect.objectContaining({
      command: 'property_update', data: expect.objectContaining({ id: 'p9', value: false }),
    }));
    expect(id).toBe('p9');
  });
});
