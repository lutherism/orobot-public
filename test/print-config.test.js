import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPrintConfig, writePrintConfig } from '../print-config.js';

test('readPrintConfig returns empty object when file missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const path = join(dir, 'config.json');
  assert.deepEqual(readPrintConfig(path), {});
  rmSync(dir, { recursive: true });
});

test('writePrintConfig creates file and readPrintConfig reads it back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const path = join(dir, 'config.json');
  writePrintConfig({ printerIp: '192.168.1.10' }, path);
  assert.deepEqual(readPrintConfig(path), { printerIp: '192.168.1.10' });
  rmSync(dir, { recursive: true });
});

test('writePrintConfig merges with existing config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const path = join(dir, 'config.json');
  writePrintConfig({ printerIp: '192.168.1.10' }, path);
  writePrintConfig({ curaPath: '/path/to/cura' }, path);
  const config = readPrintConfig(path);
  assert.equal(config.printerIp, '192.168.1.10');
  assert.equal(config.curaPath, '/path/to/cura');
  rmSync(dir, { recursive: true });
});

test('readPrintConfig throws clear error on corrupt JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
  const path = join(dir, 'config.json');
  writeFileSync(path, 'not valid json {{');
  assert.throws(
    () => readPrintConfig(path),
    { message: /not valid JSON/ }
  );
  rmSync(dir, { recursive: true });
});
