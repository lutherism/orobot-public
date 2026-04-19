import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayMock, runCLI } from './helpers.js';

const SESSION = { sessUuid: 'sess-x', userUuid: 'user-x' };
let mock;

before(async () => {
  mock = await createGatewayMock({
    'GET /api/devices':              [{ uuid: 'dev-1', name: 'Bot' }],
    'GET /api/device/dev-1':         { uuid: 'dev-1', name: 'Bot' },
    'POST /api/device':              req => ({ uuid: req.parsedBody.uuid, name: req.parsedBody.name }),
    'DELETE /api/device':            { deleted: true },
    'POST /api/device/register':     { ok: true },
    'POST /api/device/code-register': { ok: true },
    'POST /api/device/state':        { key: 'DeviceState/dev-1' },
    'POST /api/device/state/get':    [{ uuid: 'dev-1' }],
    'GET /api/device/logs/dev-1':    [{ filename: 'log.txt' }],
    'POST /api/device/log/content':  'log content here',
  });
});

after(() => mock.close());

const api = () => ['--api', `http://localhost:${mock.port}`];

test('devices list returns array', async () => {
  const { stdout, code } = await runCLI([...api(), 'devices', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});

test('devices get returns device', async () => {
  const { stdout, code } = await runCLI([...api(), 'devices', 'get', 'dev-1'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).uuid, 'dev-1');
});

test('devices create sends name and uuid', async () => {
  const { stdout, code } = await runCLI([...api(), 'devices', 'create', 'Bot', 'dev-1'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).uuid, 'dev-1');
});

test('devices list exits 1 without session', async () => {
  const { code } = await runCLI([...api(), 'devices', 'list']);
  assert.equal(code, 1);
});
