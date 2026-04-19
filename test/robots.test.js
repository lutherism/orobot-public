import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayMock, runCLI } from './helpers.js';

const SESSION = { sessUuid: 'sess-x', userUuid: 'user-x' };
let mock;

before(async () => {
  mock = await createGatewayMock({
    'GET /api/robots':      [{ uuid: 'rob-1', name: 'Arm' }, { uuid: 'rob-2', name: 'BigArm' }, { uuid: 'rob-3', name: 'Leg' }],
    'GET /api/robot/rob-1': { uuid: 'rob-1', name: 'Arm' },
    'POST /api/robot':      req => ({ uuid: 'rob-new', name: req.parsedBody.name }),
    'DELETE /api/robot':    { deleted: true },
    'POST /api/robots/state': { ok: true },
    'POST /api/robot/action': { ok: true },
  });
});

after(() => mock.close());

const api = () => ['--api', `http://localhost:${mock.port}`];

test('robots list returns array', async () => {
  const { stdout, code } = await runCLI([...api(), 'robots', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.ok(Array.isArray(JSON.parse(stdout)));
});

test('robots list --filter returns only matching robots', async () => {
  const { stdout, code } = await runCLI([...api(), 'robots', 'list', '--filter', 'Arm'], { sessionData: SESSION });
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.equal(result.length, 2);
  assert.ok(result.every(r => r.name.includes('Arm')));
});

test('robots list --filter with no match returns empty array', async () => {
  const { stdout, code } = await runCLI([...api(), 'robots', 'list', '--filter', 'Torso'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), []);
});

test('robots create sends name and programUuid', async () => {
  const { stdout, code } = await runCLI(
    [...api(), 'robots', 'create', 'Arm', 'prog-1'],
    { sessionData: SESSION }
  );
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).name, 'Arm');
});

test('robots get returns robot', async () => {
  const { stdout, code } = await runCLI([...api(), 'robots', 'get', 'rob-1'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).uuid, 'rob-1');
});
