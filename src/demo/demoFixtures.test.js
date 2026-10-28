import { describe, it, expect } from 'vitest';
import { pickFixture, hasRecording } from './demoFixtures';
import { MOCK_IDS } from './mockGame';

const recorded = { version: 1, role: 'gm', requests: { 'GET api/battlemap/getplayer': { status: 200, body: { id: 'p' } } }, after: {} };

describe('pickFixture', () => {
  it('uses the mock game while there is no recording', () => {
    const empty = { version: 1, role: 'gm', requests: {}, after: {} };
    expect(hasRecording(empty)).toBe(false);
    expect(hasRecording(undefined)).toBe(false);
    expect(pickFixture(empty, 'gm').requests['GET api/battlemap/getplayer'].body.id).toBe(MOCK_IDS.gm);
    expect(pickFixture(null, 'player').requests['GET api/battlemap/getplayer'].body.id).toBe(MOCK_IDS.player);
  });

  it('a recording wins', () => {
    expect(hasRecording(recorded)).toBe(true);
    expect(pickFixture(recorded, 'gm')).toBe(recorded);
  });
});
