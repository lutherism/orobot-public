import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testMoonrakerConnection, discoverMoonrakerDevices } from '../print-connect.js';

test('testMoonrakerConnection returns info on success', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ result: { hostname: 'sonic-pad', state: 'ready' } })
  });
  const result = await testMoonrakerConnection('192.168.1.10', 7125, mockFetch);
  assert.deepEqual(result, { result: { hostname: 'sonic-pad', state: 'ready' } });
});

test('testMoonrakerConnection calls correct URL', async () => {
  let calledUrl;
  const mockFetch = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({}) };
  };
  await testMoonrakerConnection('10.0.0.5', 7125, mockFetch);
  assert.equal(calledUrl, 'http://10.0.0.5:7125/printer/info');
});

test('testMoonrakerConnection throws when response not ok', async () => {
  const mockFetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () => testMoonrakerConnection('192.168.1.10', 7125, mockFetch),
    { message: 'Moonraker returned 503' }
  );
});

test('discoverMoonrakerDevices returns devices found via mDNS', async () => {
  const mockBrowser = {
    on(event, cb) {
      if (event === 'up') {
        cb({ name: 'Sonic Pad', addresses: ['192.168.1.42'], host: 'sonic-pad.local', port: 7125 });
      }
    },
    stop() {}
  };
  const mockBonjour = class {
    find() { return mockBrowser; }
    destroy() {}
  };
  const devices = await discoverMoonrakerDevices(10, mockBonjour);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, 'Sonic Pad');
  assert.equal(devices[0].ip, '192.168.1.42');
  assert.equal(devices[0].port, 7125);
});

test('discoverMoonrakerDevices returns empty array when no devices found', async () => {
  const mockBrowser = { on() {}, stop() {} };
  const mockBonjour = class {
    find() { return mockBrowser; }
    destroy() {}
  };
  const devices = await discoverMoonrakerDevices(10, mockBonjour);
  assert.deepEqual(devices, []);
});

test('discoverMoonrakerDevices calls browser.stop and bonjour.destroy on timeout', async () => {
  let stopped = false, destroyed = false;
  const mockBrowser = { on() {}, stop() { stopped = true; } };
  const mockBonjour = class {
    find() { return mockBrowser; }
    destroy() { destroyed = true; }
  };
  await discoverMoonrakerDevices(10, mockBonjour);
  assert.ok(stopped, 'browser.stop() should be called');
  assert.ok(destroyed, 'bonjour.destroy() should be called');
});
