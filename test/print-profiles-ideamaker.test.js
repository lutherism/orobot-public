import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverIdeaMakerProfiles } from '../print-profiles-ideamaker.js';

test('returns empty array when profilesDir is undefined', () => {
  const result = discoverIdeaMakerProfiles(undefined);
  assert.deepEqual(result, []);
});

test('returns empty array when profilesDir does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const result = discoverIdeaMakerProfiles(join(dir, 'nonexistent'));
  assert.deepEqual(result, []);
  rmSync(dir, { recursive: true });
});

test('returns empty array when no .bin files exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  writeFileSync(join(dir, 'notaprofile.txt'), 'data');
  const result = discoverIdeaMakerProfiles(dir);
  assert.deepEqual(result, []);
  rmSync(dir, { recursive: true });
});

test('uses filename (without .bin) as profile name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  writeFileSync(join(dir, 'PLA Standard.bin'), Buffer.alloc(16));
  const profiles = discoverIdeaMakerProfiles(dir);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'PLA Standard');
  assert.ok(profiles[0].path.endsWith('PLA Standard.bin'));
  rmSync(dir, { recursive: true });
});

test('returns multiple profiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  writeFileSync(join(dir, 'PLA.bin'), Buffer.alloc(16));
  writeFileSync(join(dir, 'PETG.bin'), Buffer.alloc(16));
  const profiles = discoverIdeaMakerProfiles(dir);
  assert.equal(profiles.length, 2);
  const names = profiles.map(p => p.name).sort();
  assert.deepEqual(names, ['PETG', 'PLA']);
  rmSync(dir, { recursive: true });
});

test('ignores non-.bin files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  writeFileSync(join(dir, 'profile.bin'), Buffer.alloc(16));
  writeFileSync(join(dir, 'readme.txt'), 'ignore me');
  writeFileSync(join(dir, 'export.tmfg'), '{}');
  const profiles = discoverIdeaMakerProfiles(dir);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'profile');
  rmSync(dir, { recursive: true });
});
