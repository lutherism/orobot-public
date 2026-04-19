import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPrint, pollPrintStatus, uploadGcode } from '../print-moonraker.js';

test('startPrint posts to correct endpoint with filename', async () => {
  let captured;
  const mockFetch = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ result: 'ok' }) };
  };
  await startPrint('192.168.1.10', 'robot.gcode', { fetchFn: mockFetch });
  assert.equal(captured.url, 'http://192.168.1.10:7125/printer/print/start');
  assert.equal(captured.body.filename, 'robot.gcode');
});

test('startPrint throws on non-ok response', async () => {
  const mockFetch = async () => ({ ok: false, status: 400 });
  await assert.rejects(
    () => startPrint('192.168.1.10', 'robot.gcode', { fetchFn: mockFetch }),
    { message: 'Start print failed: 400' }
  );
});

test('pollPrintStatus resolves and reports progress until complete', async () => {
  let call = 0;
  const states = [
    { progress: 0.3, state: 'printing' },
    { progress: 0.7, state: 'printing' },
    { progress: 1.0, state: 'complete' }
  ];
  const mockFetch = async () => ({
    json: async () => ({ result: { status: { print_stats: states[call++] } } })
  });
  const reported = [];
  await pollPrintStatus('192.168.1.10', (p, s) => reported.push(s),
    { fetchFn: mockFetch, intervalMs: 10 });
  assert.deepEqual(reported, ['printing', 'printing', 'complete']);
});

test('pollPrintStatus rejects on error state', async () => {
  const mockFetch = async () => ({
    json: async () => ({ result: { status: { print_stats: { progress: 0, state: 'error' } } } })
  });
  await assert.rejects(
    () => pollPrintStatus('192.168.1.10', () => {}, { fetchFn: mockFetch, intervalMs: 10 }),
    { message: 'Print failed on printer' }
  );
});

test('uploadGcode posts to correct endpoint', async () => {
  let captured;
  const mockFetch = async (url, opts) => {
    captured = { url, method: opts.method };
    return { ok: true, json: async () => ({ result: { item: { path: 'gcodes/robot.gcode' } } }) };
  };
  // Create a real temp file so createReadStream works
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const gcodePath = join(dir, 'robot.gcode');
  writeFileSync(gcodePath, 'G28\nG1 X0 Y0\n');
  await uploadGcode('192.168.1.10', gcodePath, { fetchFn: mockFetch });
  assert.equal(captured.url, 'http://192.168.1.10:7125/server/files/upload');
  assert.equal(captured.method, 'POST');
  rmSync(dir, { recursive: true });
});

test('uploadGcode throws on non-ok response', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const gcodePath = join(dir, 'robot.gcode');
  writeFileSync(gcodePath, 'G28\n');
  const mockFetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(
    () => uploadGcode('192.168.1.10', gcodePath, { fetchFn: mockFetch }),
    { message: 'Gcode upload failed: 500' }
  );
  rmSync(dir, { recursive: true });
});
