#!/usr/bin/env node
// Builds the demo's fixture for one view from a recording (see src/helpers/demoRecorder.js):
//
//   node scripts/demo/build-fixtures.mjs <recording.json> <gm|player>
//
// Writes src/demo/fixtures/<gm|player>.json. Refuses recordings that contain credentials.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixture } from '../../src/demo/fixtures.js';

const [recordingPath, role] = process.argv.slice(2);
if (!recordingPath || !['gm', 'player'].includes(role)) {
  console.error('Usage: node scripts/demo/build-fixtures.mjs <recording.json> <gm|player>');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const recording = JSON.parse(fs.readFileSync(recordingPath, 'utf8'));
const fixture = buildFixture(recording.entries ?? recording, role);

const outPath = path.join(root, 'src', 'demo', 'fixtures', `${role}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(fixture));

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`${outPath}: ${Object.keys(fixture.requests).length} requests, ${Object.keys(fixture.after).length} replies, ${kb} KB`);
