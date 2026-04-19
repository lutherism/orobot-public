import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSlicer } from '../print-slicer.js';

test('getSlicer returns adapter with slice and discoverProfiles for cura config', () => {
  const slicer = getSlicer({ slicer: 'cura', curaPath: '/cura', printerDefinition: 'cr30' });
  assert.equal(typeof slicer.slice, 'function');
  assert.equal(typeof slicer.discoverProfiles, 'function');
});

test('getSlicer returns adapter with slice and discoverProfiles for ideamaker config', () => {
  const slicer = getSlicer({ slicer: 'ideamaker', ideamakerPath: '/ideamaker', ideamakerProfilesDir: '/profiles' });
  assert.equal(typeof slicer.slice, 'function');
  assert.equal(typeof slicer.discoverProfiles, 'function');
});

test('getSlicer defaults to cura when slicer field is absent', () => {
  const slicer = getSlicer({ curaPath: '/cura', printerDefinition: 'cr30' });
  assert.equal(typeof slicer.slice, 'function');
  assert.equal(typeof slicer.discoverProfiles, 'function');
  // cura adapter's discoverProfiles doesn't throw when cura dir is absent — returns []
  const profiles = slicer.discoverProfiles();
  assert.ok(Array.isArray(profiles));
});

test('cura adapter slice returns a Promise', () => {
  const mockSpawn = (cmd, args) => ({ status: 0, stderr: '' });
  const slicer = getSlicer(
    { slicer: 'cura', curaPath: '/cura', printerDefinition: 'cr30' },
    { spawnFn: mockSpawn, curaProfiles: [{ name: 'PLA', path: '/p.cfg', values: { layer_height: '0.2' } }] }
  );
  const result = slicer.slice('/tmp/model.stl', 'PLA');
  assert.ok(result instanceof Promise);
});

test('ideamaker adapter slice returns a Promise when profile found', () => {
  const mockSpawn = () => ({ status: 0, stderr: '' });
  const slicer = getSlicer(
    { slicer: 'ideamaker', ideamakerPath: '/ideamaker', ideamakerProfilesDir: '/profiles' },
    { spawnFn: mockSpawn, ideamakerProfiles: [{ name: 'PLA Standard', path: '/profiles/PLA Standard.bin' }] }
  );
  const result = slicer.slice('/tmp/model.stl', 'PLA Standard');
  assert.ok(result instanceof Promise);
});

test('cura adapter slice rejects when profile not found', async () => {
  const slicer = getSlicer(
    { slicer: 'cura', curaPath: '/cura', printerDefinition: 'cr30' },
    { spawnFn: () => ({ status: 0 }), curaProfiles: [{ name: 'PLA', path: '/p.cfg', values: {} }] }
  );
  await assert.rejects(() => slicer.slice('/tmp/m.stl', 'Nonexistent'), /not found/);
});

test('ideamaker adapter slice rejects when profile not found', async () => {
  const slicer = getSlicer(
    { slicer: 'ideamaker', ideamakerPath: '/ideamaker', ideamakerProfilesDir: '/profiles' },
    { spawnFn: () => ({ status: 0 }), ideamakerProfiles: [{ name: 'PLA', path: '/profiles/PLA.bin' }] }
  );
  await assert.rejects(() => slicer.slice('/tmp/m.stl', 'Nonexistent'), /not found/);
});

test('ideamaker adapter discoverProfiles returns injected profiles', () => {
  const fakeProfiles = [{ name: 'PLA Standard', path: '/profiles/PLA Standard.bin' }];
  const slicer = getSlicer(
    { slicer: 'ideamaker', ideamakerPath: '/ideamaker', ideamakerProfilesDir: '/profiles' },
    { ideamakerProfiles: fakeProfiles }
  );
  const profiles = slicer.discoverProfiles();
  assert.ok(Array.isArray(profiles));
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, 'PLA Standard');
});
