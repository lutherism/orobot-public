import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayMock, runCLI } from './helpers.js';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SESSION = { sessUuid: 'sess-x', userUuid: 'user-x' };
let mock;
let tmpDir;

before(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'orobot-files-test-'));

  mock = await createGatewayMock({
    'POST /api/upload':               { file: { url: 'https://storage.googleapis.com/orobot-stls/test.stl', uuid: 'file-1' } },
    'POST /api/profile-photo/upload': { file: { url: 'https://storage.googleapis.com/orobot-stls/pp/photo.jpg', uuid: 'file-2' } },
    'POST /api/banner-photo/upload':  { url: 'https://storage.googleapis.com/orobot-stls/bp/banner.jpg' },
    'POST /api/misc-upload':          { file: { url: 'https://storage.googleapis.com/orobot-misc-files/pp/item.stl', uuid: 'file-3' } },
    'GET /api/storage-proxy/test.stl': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end('binary-content');
    },
  });
});

after(async () => {
  await mock.close();
  rmSync(tmpDir, { recursive: true });
});

const api = () => ['--api', `http://localhost:${mock.port}`];

test('files upload returns file URL', async () => {
  const filePath = join(tmpDir, 'test.stl');
  writeFileSync(filePath, 'STL data');
  const { stdout, code } = await runCLI(
    [...api(), 'files', 'upload', filePath, 'prog-1'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.ok(result.file.url.includes('orobot-stls'));
});

test('files upload-profile-photo returns file URL', async () => {
  const filePath = join(tmpDir, 'photo.jpg');
  writeFileSync(filePath, 'JPEG data');
  const { stdout, code } = await runCLI(
    [...api(), 'files', 'upload-profile-photo', filePath],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.ok(JSON.parse(stdout).file.url.includes('pp/'));
});

test('files upload-misc returns file URL', async () => {
  const filePath = join(tmpDir, 'item.stl');
  writeFileSync(filePath, 'STL misc');
  const { stdout, code } = await runCLI(
    [...api(), 'files', 'upload-misc', filePath],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.ok(JSON.parse(stdout).file.url.includes('orobot-misc-files'));
});

test('files download via key saves to local path', async () => {
  const destPath = join(tmpDir, 'downloaded.stl');
  const { stdout, code } = await runCLI(
    [...api(), 'files', 'download', 'test.stl', destPath],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(readFileSync(destPath, 'utf8'), 'binary-content');
});

test('files download via full GCS URL saves to local path', async () => {
  const destPath = join(tmpDir, 'downloaded2.stl');
  const gcsUrl = `http://localhost:${mock.port}/api/storage-proxy/test.stl`;
  const { stdout, code } = await runCLI(
    [...api(), 'files', 'download', gcsUrl, destPath],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(readFileSync(destPath, 'utf8'), 'binary-content');
});
