import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceStlIdeaMaker } from '../print-slice-ideamaker.js';

test('sliceStlIdeaMaker builds correct CLI arguments', () => {
  let captured;
  const mockSpawn = (cmd, args) => {
    captured = { cmd, args };
    return { status: 0, stderr: '' };
  };
  const result = sliceStlIdeaMaker({
    ideamakerPath: '/path/to/ideamaker',
    stlPath: '/tmp/model.stl',
    profilePath: '/profiles/PLA Standard.bin',
  }, mockSpawn);

  assert.ok(result.endsWith('.gcode'), 'output path should end with .gcode');
  assert.ok(captured.args.includes('-m'));
  assert.ok(captured.args.includes('/tmp/model.stl'));
  assert.ok(captured.args.includes('-r'));
  assert.ok(captured.args.includes('/profiles/PLA Standard.bin'));
  assert.ok(captured.args.includes('-o'));
  assert.ok(captured.args.includes('-hidden'));
});

test('sliceStlIdeaMaker passes -o flag pointing to a temp .gcode file', () => {
  let outputArg;
  const mockSpawn = (cmd, args) => {
    outputArg = args[args.indexOf('-o') + 1];
    return { status: 0, stderr: '' };
  };
  sliceStlIdeaMaker({ ideamakerPath: '/p', stlPath: '/s.stl', profilePath: '/pr/x.bin' }, mockSpawn);
  assert.ok(outputArg?.endsWith('.gcode'));
});

test('sliceStlIdeaMaker throws when ideaMaker exits non-zero', () => {
  const mockSpawn = () => ({ status: 1, stderr: 'Error: template not found' });
  assert.throws(
    () => sliceStlIdeaMaker({
      ideamakerPath: '/path/to/ideamaker',
      stlPath: '/tmp/model.stl',
      profilePath: '/profiles/missing.bin',
    }, mockSpawn),
    /ideaMaker failed/
  );
});

test('sliceStlIdeaMaker resolves exe path relative to ideamakerPath', () => {
  let capturedCmd;
  const mockSpawn = (cmd) => {
    capturedCmd = cmd;
    return { status: 0, stderr: '' };
  };
  sliceStlIdeaMaker({ ideamakerPath: '/p', stlPath: '/s.stl', profilePath: '/pr/x.bin' }, mockSpawn);
  assert.ok(capturedCmd.includes('/p') || capturedCmd.includes('\\p'), 'exe should be under ideamakerPath');
});
