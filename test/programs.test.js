import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createGatewayMock, runCLI } from './helpers.js';

const SESSION = { sessUuid: 'sess-x', userUuid: 'user-x' };
let mock;

// Minimal zip-like buffer for export tests (PK magic bytes)
const FAKE_ZIP = Buffer.from([0x50, 0x4B, 0x05, 0x06, ...new Array(18).fill(0)]);

before(async () => {
  mock = await createGatewayMock({
    'GET /api/programs':               [{ uuid: 'prog-1', name: 'Drive' }],
    'GET /api/program/prog-1':         { uuid: 'prog-1', name: 'Drive' },
    'POST /api/program':               req => ({ uuid: 'prog-new', name: req.parsedBody.name }),
    'DELETE /api/program':             { deleted: true },
    'PUT /api/program-data':           { ok: true },
    'POST /api/program-ide/run':       { result: 'ran' },
    'POST /api/program-ide/runActionN': { result: 'action ran' },
    'GET /api/program/categories':     ['Home', 'Sports'],
    'GET /api/program/categories/Home': [{ uuid: 'prog-1', name: 'Drive' }],
    'GET /api/program/prog-1/stats':   { commentCount: 5, bookmarkCount: 12 },
    'GET /api/programs/search':        req => {
      const q = new URL(req.url, 'http://localhost').searchParams.get('q');
      return [{ uuid: 'prog-1', name: 'Drive', matchedQuery: q }];
    },
    'POST /api/program/prog-1/publish':   { published: true },
    'DELETE /api/program/prog-1/publish': { published: false },
    'GET /api/program/prog-1/export':  (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/zip' });
      res.end(FAKE_ZIP);
    },
    'POST /api/program/import':        { uuid: 'prog-imported', name: 'Imported' },
  });
});

after(() => mock.close());

const api = () => ['--api', `http://localhost:${mock.port}`];

test('programs list returns array', async () => {
  const { stdout, code } = await runCLI([...api(), 'programs', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});

test('programs create sends name', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'programs', 'create', 'Drive'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).name, 'Drive');
});

test('programs run sends body as JSON', async () => {
  const body = JSON.stringify({ programUuid: 'prog-1', deviceUuid: 'dev-1' });
  const { stdout, code } = await runCLI(
    [...api(), 'programs', 'run', body],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).result, 'ran');
});

test('programs categories returns list', async () => {
  const { stdout, code } = await runCLI([...api(), 'programs', 'categories'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});

test('programs stats returns comment and bookmark counts', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'programs', 'stats', 'prog-1'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.equal(result.commentCount, 5);
  assert.equal(result.bookmarkCount, 12);
});

test('programs search returns matching programs', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'programs', 'search', 'robot arm'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  const results = JSON.parse(stdout);
  assert.ok(Array.isArray(results));
  assert.equal(results[0].matchedQuery, 'robot arm');
});

test('programs publish posts to publish endpoint', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'programs', 'publish', 'prog-1'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).published, true);
});

test('programs unpublish deletes from publish endpoint', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'programs', 'unpublish', 'prog-1'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).published, false);
});
test('programs export writes zip file to default path', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'orobot-export-test-'));
  const dest = join(tmpDir, 'prog-1.zip');
  try {
    // Run CLI from tmpDir so the default <uuid>.zip lands there
    const { code, stderr } = await runCLI(
      [...api(), 'programs', 'export', 'prog-1', dest],
      { sessionData: SESSION }
    );
    assert.equal(code, 0, `stderr: ${stderr}`);
    assert.ok(existsSync(dest), 'zip file should exist');
    const written = readFileSync(dest);
    // PK magic bytes
    assert.equal(written[0], 0x50);
    assert.equal(written[1], 0x4B);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('programs import sends zip to server and returns result', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'orobot-import-test-'));
  const zipPath = join(tmpDir, 'test.zip');
  writeFileSync(zipPath, Buffer.from([0x50, 0x4B, 0x05, 0x06, ...new Array(18).fill(0)]));
  try {
    const { stdout, code, stderr } = await runCLI(
      [...api(), 'programs', 'import', zipPath],
      { sessionData: SESSION }
    );
    assert.equal(code, 0, `stderr: ${stderr}`);
    const result = JSON.parse(stdout);
    assert.equal(result.uuid, 'prog-imported');
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});
