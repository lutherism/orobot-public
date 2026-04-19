import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayMock, runCLI } from './helpers.js';

// Validates that createGatewayMock serves default routes and accepts overrides.
// Uses the `robots list` and `programs list` CLI commands as end-to-end probes.

const SESSION = { sessUuid: 'sess-x', userUuid: 'user-x' };
let mock;

before(async () => {
  mock = await createGatewayMock({
    'GET /api/robots': [{ uuid: 'r-1', name: 'Arm' }, { uuid: 'r-2', name: 'Leg' }],
    'GET /api/programs': [{ uuid: 'p-1', name: 'Spin' }],
  });
});

after(() => mock.close());

const api = () => ['--api', `http://localhost:${mock.port}`];

test('createGatewayMock: default GET /api/session responds with sess-x', async () => {
  // `robots list` calls /api/session internally to validate session — exits 0 means it resolved
  const { code } = await runCLI([...api(), 'robots', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
});

test('createGatewayMock: override GET /api/robots returns injected list', async () => {
  const { stdout, code } = await runCLI([...api(), 'robots', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  const robots = JSON.parse(stdout);
  assert.equal(robots.length, 2);
  assert.equal(robots[0].name, 'Arm');
  assert.equal(robots[1].name, 'Leg');
});

test('createGatewayMock: override GET /api/programs returns injected list', async () => {
  const { stdout, code } = await runCLI([...api(), 'programs', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  const programs = JSON.parse(stdout);
  assert.equal(programs.length, 1);
  assert.equal(programs[0].name, 'Spin');
});

test('createGatewayMock: unregistered route returns 404', async () => {
  // `devices list` → GET /api/devices — not in this mock's overrides or defaults
  // but it IS in DEFAULT_ROUTES so it returns []
  const { stdout, code } = await runCLI([...api(), 'devices', 'list'], { sessionData: SESSION });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), []);
});
