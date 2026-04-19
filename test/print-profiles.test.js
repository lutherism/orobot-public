import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverCuraProfiles } from '../print-profiles.js';

test('returns empty array when cura dir does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const result = discoverCuraProfiles(join(dir, 'nonexistent'));
  assert.deepEqual(result, []);
  rmSync(dir, { recursive: true });
});

test('returns empty array when quality_changes dir is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  mkdirSync(join(dir, '5.2'), { recursive: true });
  assert.deepEqual(discoverCuraProfiles(dir), []);
  rmSync(dir, { recursive: true });
});

test('returns parsed profiles from quality_changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const profilesDir = join(dir, '5.2', 'quality_changes');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(join(profilesDir, 'pla_fast.inst.cfg'), [
    '[general]',
    'name = PLA Fast',
    '',
    '[values]',
    'layer_height = 0.2',
    'infill_sparse_density = 20',
    ''
  ].join('\n'));
  const profiles = discoverCuraProfiles(dir);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'PLA Fast');
  assert.equal(profiles[0].values.layer_height, '0.2');
  assert.equal(profiles[0].values.infill_sparse_density, '20');
  rmSync(dir, { recursive: true });
});

test('picks the most recent version directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  mkdirSync(join(dir, '4.9', 'quality_changes'), { recursive: true });
  writeFileSync(join(dir, '4.9', 'quality_changes', 'old.inst.cfg'),
    '[general]\nname = Old Profile\n\n[values]\n');
  mkdirSync(join(dir, '5.2', 'quality_changes'), { recursive: true });
  writeFileSync(join(dir, '5.2', 'quality_changes', 'new.inst.cfg'),
    '[general]\nname = New Profile\n\n[values]\n');
  const profiles = discoverCuraProfiles(dir);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'New Profile');
  rmSync(dir, { recursive: true });
});

test('falls back to filename when general.name is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const profilesDir = join(dir, '5.2', 'quality_changes');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(join(profilesDir, 'my_profile.inst.cfg'), '[values]\nlayer_height = 0.1\n');
  const profiles = discoverCuraProfiles(dir);
  assert.equal(profiles[0].name, 'my_profile');
  rmSync(dir, { recursive: true });
});

test('picks version 5.10 over 5.9 (semver not lexicographic)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  mkdirSync(join(dir, '5.9', 'quality_changes'), { recursive: true });
  writeFileSync(join(dir, '5.9', 'quality_changes', 'old.inst.cfg'),
    '[general]\nname = Old\n\n[values]\n');
  mkdirSync(join(dir, '5.10', 'quality_changes'), { recursive: true });
  writeFileSync(join(dir, '5.10', 'quality_changes', 'new.inst.cfg'),
    '[general]\nname = New\n\n[values]\n');
  const profiles = discoverCuraProfiles(dir);
  assert.equal(profiles[0].name, 'New');
  rmSync(dir, { recursive: true });
});

test('skips unreadable profile files and returns others', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const profilesDir = join(dir, '5.2', 'quality_changes');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(join(profilesDir, 'good.inst.cfg'), '[general]\nname = Good\n\n[values]\n');
  mkdirSync(join(profilesDir, 'bad.inst.cfg'));
  const profiles = discoverCuraProfiles(dir);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'Good');
  rmSync(dir, { recursive: true });
});
