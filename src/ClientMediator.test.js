import { describe, it, expect, beforeEach, vi } from 'vitest';
import ClientMediator from './ClientMediator';

const client = (id, commands, panel = 'P') => ({ panel, id, ...commands });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  ClientMediator._clientsHashSet = {};
  ClientMediator._clientPanelIndex = {};
  ClientMediator._awaitingRequests = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('errors', () => {
  it("lets a handler's own error through", () => {
    ClientMediator.register(client('a', { Boom() { throw new Error('real cause'); } }));

    expect(() => ClientMediator.sendCommand('P', 'Boom')).toThrow('real cause');
  });

  it("lets an async handler's own error through", async () => {
    ClientMediator.register(client('a', { Boom: async () => { throw new Error('real cause'); } }));

    await expect(ClientMediator.sendCommandAsync('P', 'Boom')).rejects.toThrow('real cause');
  });

  it('names a missing command, whatever the data is', () => {
    ClientMediator.register(client('a', {}));
    const circular = {};
    circular.self = circular;

    expect(() => ClientMediator.sendCommand('P', 'Nope', circular)).toThrow('Command not found: Nope for panel: P');
  });
});

describe('waiting for a client', () => {
  it('a client without the command is not the one being waited for', async () => {
    ClientMediator.register(client('other', {}));
    const run = vi.fn(() => 'done');

    const answer = ClientMediator.sendCommandWaitForRegister('P', 'Run', {}, true);
    ClientMediator.register(client('right', { Run: run }));

    await expect(answer).resolves.toBe('done');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when a client without the command registers', async () => {
    const run = vi.fn(() => 'done');
    const answer = ClientMediator.sendCommandWaitForRegister('P', 'Run', {}, true);

    ClientMediator.register(client('other', {}));
    await settle();
    expect(ClientMediator._awaitingRequests).toHaveLength(1);

    ClientMediator.register(client('right', { Run: run }));
    await expect(answer).resolves.toBe('done');
  });

  it('asks again later when the answer is not ready yet', async () => {
    let player;
    ClientMediator.register(client('game', { GetPlayer: () => player }));

    const answer = ClientMediator.sendCommandWaitForRegister('P', 'GetPlayer', {}, true);
    player = 'me';
    ClientMediator.register(client('game', { GetPlayer: () => player }));

    await expect(answer).resolves.toBe('me');
  });

  it('does not lose a request made while the queue is being worked through', async () => {
    let finish;
    const slow = new Promise((resolve) => { finish = resolve; });
    const queued = ClientMediator.sendCommandWaitForRegister('Slow', 'Run', {}, true);
    ClientMediator.register(client('s', { Run: () => slow }, 'Slow'));

    const later = ClientMediator.sendCommandWaitForRegister('Later', 'Run', {}, true);
    finish('slow done');
    await queued;
    await settle();

    ClientMediator.register(client('l', { Run: () => 'later done' }, 'Later'));
    await expect(later).resolves.toBe('later done');
  });
});
