import { vi, describe, it, expect } from 'vitest';

const sendCommandAsync = vi.fn();
vi.mock('../../../../../ClientMediator', () => ({
  default: { sendCommandAsync: (...args) => sendCommandAsync(...args) },
}));

import { OnPropertyDeleteBehavior } from './OnPropertyDeleteBehavior';

// Regression coverage: Handle() used to be a complete no-op — unlike its
// Add/Update siblings, a deleted property never told dependent token UI (e.g. a
// status icon prop-dep) to re-evaluate, so it kept showing its last value.
describe('OnPropertyDeleteBehavior', () => {
  it('tells BattleMap_token to re-evaluate the deleted property, mirroring Add/Update', () => {
    const response = { data: { id: 'prop-1', name: 'poisoned', entityName: 'CardModel' } };

    new OnPropertyDeleteBehavior().Handle(response, {}, 'bm-1');

    expect(sendCommandAsync).toHaveBeenCalledWith('BattleMap_token', 'UpdateTokensPropertySpecific', {
      contextId: 'bm-1',
      property: response.data,
    });
  });
});
