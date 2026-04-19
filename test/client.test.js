import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Session setup
const tmpDir = mkdtempSync(join(tmpdir(), 'orobot-client-test-'));
const sessionPath = join(tmpDir, '.session');
process.env.OROBOT_SESSION_PATH = sessionPath;
writeFileSync(sessionPath, JSON.stringify({ sessUuid: 'test-sess', userUuid: 'test-user' }));

const { createClient, AuthError } = await import('../client.js');

let server;
let port;
let lastRequest;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      lastRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : null
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise(resolve => server.listen(0, resolve));
  port = server.address().port;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  rmSync(tmpDir, { recursive: true });
});

test('GET sends cookie and returns JSON', async () => {
  const client = createClient({ api: `http://localhost:${port}` });
  const result = await client.get('/api/me');
  assert.equal(result.ok, true);
  assert.ok(lastRequest.headers.cookie.includes('_osess=test-sess'));
  assert.equal(lastRequest.method, 'GET');
  assert.equal(lastRequest.url, '/api/me');
});

test('POST sends JSON body with cookie', async () => {
  const client = createClient({ api: `http://localhost:${port}` });
  await client.post('/api/login', { email: 'a@b.com', password: 'pw' }, { auth: false });
  assert.equal(lastRequest.method, 'POST');
  assert.deepEqual(lastRequest.body, { email: 'a@b.com', password: 'pw' });
});

test('throws on non-2xx response', async () => {
  const errServer = http.createServer((req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ err: 'Bad request' }));
  });
  await new Promise(resolve => errServer.listen(0, resolve));
  const errPort = errServer.address().port;
  const client = createClient({ api: `http://localhost:${errPort}` });
  await assert.rejects(() => client.get('/api/test'), /Bad request/);
  await new Promise(resolve => errServer.close(resolve));
});
