// Which data the demo serves: a recorded game (fixtures/gm.json and player.json, made
// by scripts/demo/build-fixtures.mjs) once there is one, else the hand-made mock game.

import { buildMockFixture } from './mockGame';

/** True when the fixture is a real recording, not the empty placeholder. */
export const hasRecording = (fixture) => Object.keys(fixture?.requests ?? {}).length > 0;

export const pickFixture = (recorded, role) => (hasRecording(recorded) ? recorded : buildMockFixture(role));
