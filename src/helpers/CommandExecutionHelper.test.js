import { vi } from 'vitest';
import { CommandExecutionHelper } from './CommandExecutionHelper';

vi.mock('../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(),
  },
}));

import ClientMediator from '../ClientMediator';

const CONTEXT_A = { id: 'aaaaaaaa-0000-0000-0000-000000000000' };
const CONTEXT_B = { id: 'bbbbbbbb-0000-0000-0000-000000000000' };

describe('CommandExecutionHelper.GetArgCompletions — bmcontext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when no BattleMaps are open', async () => {
    ClientMediator.sendCommand.mockReturnValue([]);
    const result = await CommandExecutionHelper.GetArgCompletions('bmcontext');
    expect(result).toEqual([]);
  });

  it('returns completions with correct lowercase id (regression: ctx.Id was undefined)', async () => {
    // Contexts use lowercase `id` — this was the bug: code read ctx.Id (undefined)
    // and called .slice() on it, throwing TypeError.
    ClientMediator.sendCommand.mockImplementation((panel, command) => {
      if (command === 'GetOpenedBattleMaps') return [CONTEXT_A];
      if (command === 'GetSelectedMap') return { id: 'map-1', name: 'Forest' };
      return null;
    });

    const result = await CommandExecutionHelper.GetArgCompletions('bmcontext');

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(CONTEXT_A.id);
    expect(result[0].label).toMatch(/Forest/);
  });

  it('uses the context id as label when no map is loaded', async () => {
    ClientMediator.sendCommand.mockImplementation((panel, command) => {
      if (command === 'GetOpenedBattleMaps') return [CONTEXT_A];
      if (command === 'GetSelectedMap') return null;
      return null;
    });

    const result = await CommandExecutionHelper.GetArgCompletions('bmcontext');
    expect(result[0].label).toBe(CONTEXT_A.id);
  });

  it('returns one entry per open BattleMap context', async () => {
    ClientMediator.sendCommand.mockImplementation((panel, command) => {
      if (command === 'GetOpenedBattleMaps') return [CONTEXT_A, CONTEXT_B];
      return null;
    });

    const result = await CommandExecutionHelper.GetArgCompletions('bmcontext');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.value)).toEqual([CONTEXT_A.id, CONTEXT_B.id]);
  });
});
