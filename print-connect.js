import Bonjour from 'bonjour-service';
import fetch from 'node-fetch';

export async function discoverMoonrakerDevices(timeoutMs = 5000, bonjourFactory = Bonjour) {
  return new Promise((resolve) => {
    const bonjour = new bonjourFactory();
    const devices = [];
    const browser = bonjour.find({ type: 'moonraker' });
    browser.on('up', (service) => {
      devices.push({
        name: service.name,
        ip: service.addresses?.[0] ?? service.host,
        port: service.port ?? 7125
      });
    });
    setTimeout(() => {
      browser.stop();
      bonjour.destroy();
      resolve(devices);
    }, timeoutMs);
  });
}

export async function testMoonrakerConnection(ip, port = 7125, fetchFn = fetch) {
  const res = await fetchFn(`http://${ip}:${port}/printer/info`);
  if (!res.ok) throw new Error(`Moonraker returned ${res.status}`);
  return res.json();
}
