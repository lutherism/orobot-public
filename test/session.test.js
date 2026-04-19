import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Point session at a temp file so tests don't touch the real .session
const tmpDir = mkdtempSync(join(tmpdir(), 'orobot-test-'));
const sessionPath = join(tmpDir, '.session');
process.env.OROBOT_SESSION_PATH = sessionPath;

// Import AFTER setting env so session.js picks it up
const { readSession, writeSession, deleteSession } = await import('../session.js');

test('readSession returns null when file does not exist', () => {
  assert.equal(readSession(), null);
});

test('writeSession + readSession round-trips data', () => {
  writeSession({ sessUuid: 'abc', userUuid: '123' });
  assert.deepEqual(readSession(), { sessUuid: 'abc', userUuid: '123' });
});

test('deleteSession removes the file', () => {
  writeSession({ sessUuid: 'abc', userUuid: '123' });
  deleteSession();
  assert.equal(readSession(), null);
});

test('deleteSession is safe when file does not exist', () => {
  assert.doesNotThrow(() => deleteSession());
});

// Cleanup
process.on('exit', () => rmSync(tmpDir, { recursive: true }));
