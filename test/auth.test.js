import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayMock, runCLI } from './helpers.js';

let mock;

before(async () => {
  mock = await createGatewayMock({
    'POST /api/signup': req => ({ sessUuid: 'sess-1', uuid: 'user-1', email: req.parsedBody.email }),
    'POST /api/login':  { sessUuid: 'sess-2', uuid: 'user-2' },
    'GET /api/me':      { uuid: 'user-2', name: 'Alex' },
    'DELETE /api/session': { success: 'ok' },
  });
});

after(() => mock.close());

test('signup outputs JSON and exits 0', async () => {
  const { stdout, code } = await runCLI(
    ['--api', `http://localhost:${mock.port}`, 'signup', 'a@b.com', 'pass123', 'Alex']
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.email, 'a@b.com');
});

test('login outputs JSON and exits 0', async () => {
  const { stdout, code } = await runCLI(
    ['--api', `http://localhost:${mock.port}`, 'login', 'a@b.com', 'pass123']
  );
  assert.equal(code, 0);
  assert.ok(JSON.parse(stdout).sessUuid);
});

test('me requires session, exits 1 with no session', async () => {
  const { stderr, code } = await runCLI(
    ['--api', `http://localhost:${mock.port}`, 'me']
  );
  assert.equal(code, 1);
  assert.ok(JSON.parse(stderr).error.includes('Not authenticated'));
});

test('me with valid session outputs user JSON', async () => {
  const { stdout, code } = await runCLI(
    ['--api', `http://localhost:${mock.port}`, 'me'],
    { sessionData: { sessUuid: 'sess-2', userUuid: 'user-2' } }
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).name, 'Alex');
});

test('--pretty flag formats output with indentation', async () => {
  const { stdout, code } = await runCLI(
    ['--api', `http://localhost:${mock.port}`, '--pretty', 'me'],
    { sessionData: { sessUuid: 'sess-2', userUuid: 'user-2' } }
  );
  assert.equal(code, 0);
  assert.ok(stdout.includes('\n'));
});
