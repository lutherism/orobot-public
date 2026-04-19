import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CLI = join(__dirname, '..', 'cli.js');

// ── createGatewayMock ────────────────────────────────────────────────────────
// Route-keyed mock server for CLI tests. Eliminates 20-40 lines of inline
// URL-matching boilerplate per test file.
//
// Usage:
//   mock = await createGatewayMock({
//     'GET /api/robots': [{ uuid: 'r-1', name: 'Arm' }],
//     'POST /api/robot': req => ({ uuid: 'new', name: req.parsedBody.name }),
//   });
//
// Default routes cover common happy-path responses. Override any route by
// passing a value (returned as JSON) or a function(req) => value.
const DEFAULT_ROUTES = {
  'GET /api/session':  { sessUuid: 'sess-x', userUuid: 'user-x' },
  'GET /api/me':       { uuid: 'user-x', name: 'Test User' },
  'GET /api/robots':   [],
  'GET /api/devices':  [],
  'GET /api/programs': [],
};

export async function createGatewayMock(overrides = {}) {
  const routes = { ...DEFAULT_ROUTES, ...overrides };
  return startMockServer((req, res) => {
    const key = `${req.method} ${req.url.split('?')[0]}`;
    if (key in routes) {
      const entry = routes[key];
      if (typeof entry === 'function' && entry.length === 2) {
        // Raw handler: entry(req, res) controls the response directly
        entry(req, res);
      } else {
        const body = typeof entry === 'function' ? entry(req) : entry;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

export async function startMockServer(handler) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try { req.parsedBody = body ? JSON.parse(body) : null; } catch { req.parsedBody = body; }
      handler(req, res);
    });
  });
  await new Promise(resolve => server.listen(0, resolve));
  return {
    server,
    port: server.address().port,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

export function runCLI(args, { sessionData } = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'orobot-cli-test-'));
  const sessionPath = join(tmpDir, '.session');
  if (sessionData) writeFileSync(sessionPath, JSON.stringify(sessionData));

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI, ...args], {
      env: { ...process.env, OROBOT_SESSION_PATH: sessionPath }
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      rmSync(tmpDir, { recursive: true });
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
    });
    proc.on('error', reject);
  });
}
