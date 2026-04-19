import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayMock, runCLI } from './helpers.js';

const SESSION = { sessUuid: 'sess-x', userUuid: 'user-x' };
let mock;

before(async () => {
  mock = await createGatewayMock({
    'POST /api/device/emulator/start': { started: true },
    'POST /api/device/emulator/stop':  { stopped: true },
    'PUT /api/device/motor-config':    { ok: true },
    'GET /api/users':                  [{ uuid: 'user-1', name: 'Alex' }],
    'GET /api/user/user-1':            { uuid: 'user-1', name: 'Alex' },
    'PUT /api/user':                   { ok: true },
    'GET /api/users/user-1/programs':  [{ uuid: 'prog-1' }],
    'GET /api/users/user-1/robots':    [{ uuid: 'rob-1' }],
    'GET /api/comments/entity':        [{ uuid: 'comment-1', text: 'Hello' }],
    'POST /api/comment/response':      { uuid: 'comment-new' },
    'POST /api/comment/parent-1/reply': { uuid: 'reply-new' },
  });
});

after(() => mock.close());

const api = () => ['--api', `http://localhost:${mock.port}`];

test('emulator start exits 0', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'emulator', 'start', 'dev-1'], { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.ok(JSON.parse(stdout).started);
});

test('users list returns array', async () => {
  const { stdout, code } = await runCLI([...api(), 'users', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});

test('users update sends JSON body', async () => {
  const { code } = await runCLI(
    [...api(), 'users', 'update', '{"name":"Bob"}'], { sessionData: SESSION }
  );
  assert.equal(code, 0);
});

test('comments list for a program', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'comments', 'list', 'prog-1'], { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});

test('comments reply posts to parent endpoint', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'comments', 'reply', 'parent-1', 'Great robot!'], { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.ok(JSON.parse(stdout).uuid);
});
