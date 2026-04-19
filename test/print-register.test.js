import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerWindows, registerLinux } from '../print-register.js';

test('registerWindows calls reg add with correct registry keys', () => {
  const calls = [];
  registerWindows('C:\\Users\\alex\\bin\\orobot', (cmd) => calls.push(cmd));
  assert.ok(calls.some(c => c.includes('HKCU\\Software\\Classes\\orobot')));
  assert.ok(calls.some(c => c.includes('URL Protocol')));
  assert.ok(calls.some(c => c.includes('print uri')));
  assert.equal(calls.length, 3);
});

test('registerWindows embeds the binary path in the command handler', () => {
  const calls = [];
  registerWindows('C:\\Users\\alex\\orobot', (cmd) => calls.push(cmd));
  const commandEntry = calls.find(c => c.includes('shell\\open\\command'));
  assert.ok(commandEntry.includes('orobot'));
  assert.ok(commandEntry.includes('print uri'));
});

test('registerLinux writes .desktop file with correct content', () => {
  let writtenPath, writtenContent;
  const mockWrite = (path, content) => { writtenPath = path; writtenContent = content; };
  const mockExec = () => {};
  registerLinux('/usr/local/bin/orobot', mockWrite, mockExec);
  assert.ok(writtenPath.endsWith('orobot-uri.desktop'));
  assert.ok(writtenContent.includes('x-scheme-handler/orobot'));
  assert.ok(writtenContent.includes('/usr/local/bin/orobot print uri %u'));
});

test('registerLinux calls update-desktop-database with desktop dir path', () => {
  let execArg;
  registerLinux('/usr/bin/orobot', () => {}, (cmd) => { execArg = cmd; });
  assert.ok(execArg.includes('update-desktop-database'));
  assert.ok(execArg.includes('applications'));
});
