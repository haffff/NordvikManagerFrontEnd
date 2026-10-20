import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(),
    sendCommandWaitForRegister: vi.fn(),
  },
}));

import ClientMediator from '../../../../ClientMediator';
import { OnPermissionsChangedBehavior } from './OnPermissionsChangedBehavior';

const EVERYONE = '00000000-0000-0000-0000-000000000000';
const ME = 'me';

const flush = () => new Promise((r) => setTimeout(r, 0));

const gameUpdate = async (permissions) => {
  await new OnPermissionsChangedBehavior().Handle({ data: { entityType: 'GameModel', id: 'g1', permissions } }, null, 'bm');
  await flush();
  return ClientMediator.sendCommand.mock.calls.filter(([, cmd]) => cmd === 'UpdateEntityPermission').map(([, , data]) => data.bits);
};

// The game permission decides whether the player gets the co-GM UI, so a live update must
// read it the way the server does: own row, else "everyone", never "not set" (-1) as bits.
describe('OnPermissionsChangedBehavior — the game permission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue({ id: ME });
    ClientMediator.sendCommand.mockImplementation(() => false); // GetIsGM: not the owner
  });

  it("uses the player's own row", async () => {
    expect(await gameUpdate({ [ME]: 15, [EVERYONE]: 1 })).toEqual([15]);
  });

  it('"not set" (-1) falls back to everyone, not to all bits', async () => {
    expect(await gameUpdate({ [ME]: -1, [EVERYONE]: 1 })).toEqual([1]);
  });

  it('"not set" for both is no permission', async () => {
    expect(await gameUpdate({ [ME]: -1, [EVERYONE]: -1 })).toEqual([0]);
  });

  it("an update about other players only leaves this player's permission alone", async () => {
    expect(await gameUpdate({ other: 15 })).toEqual([]);
  });
});
