import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceStl } from '../print-slice.js';

test('sliceStl builds correct CuraEngine arguments', () => {
  let captured;
  const mockSpawn = (cmd, args, opts) => {
    captured = { cmd, args };
    return { status: 0, stderr: '' };
  };
  const result = sliceStl({
    curaPath: '/path/to/cura',
    printerDefinition: 'creality_cr30',
    stlPath: '/tmp/model.stl',
    profileValues: { layer_height: '0.2', infill_sparse_density: '20' }
  }, mockSpawn);

  assert.ok(result.endsWith('.gcode'), 'output path should end with .gcode');
  assert.ok(captured.args.includes('slice'));
  assert.ok(captured.args.some(a => a.endsWith('creality_cr30.def.json')));
  assert.ok(captured.args.includes('/tmp/model.stl'));
  const settingPairs = captured.args
    .map((a, i) => captured.args[i - 1] === '-s' ? a : null)
    .filter(Boolean);
  assert.ok(settingPairs.includes('layer_height=0.2'));
  assert.ok(settingPairs.includes('infill_sparse_density=20'));
});

test('sliceStl throws when CuraEngine exits non-zero', () => {
  const mockSpawn = () => ({ status: 1, stderr: 'Error: bad definition file' });
  assert.throws(
    () => sliceStl({
      curaPath: '/path/to/cura',
      printerDefinition: 'creality_cr30',
      stlPath: '/tmp/model.stl',
      profileValues: {}
    }, mockSpawn),
    /CuraEngine failed/
  );
});

test('sliceStl passes -o flag pointing to a temp .gcode file', () => {
  let outputArg;
  const mockSpawn = (cmd, args) => {
    outputArg = args[args.indexOf('-o') + 1];
    return { status: 0, stderr: '' };
  };
  sliceStl({ curaPath: '/c', printerDefinition: 'd', stlPath: '/s.stl', profileValues: {} }, mockSpawn);
  assert.ok(outputArg?.endsWith('.gcode'));
});
