import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import FormData from 'form-data';
import fetch from 'node-fetch';

export async function uploadGcode(printerIp, gcodePath, { port = 7125, fetchFn = fetch } = {}) {
  const form = new FormData();
  form.append('file', createReadStream(gcodePath), basename(gcodePath));
  form.append('path', 'gcodes');
  const res = await fetchFn(`http://${printerIp}:${port}/server/files/upload`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  if (!res.ok) throw new Error(`Gcode upload failed: ${res.status}`);
  return res.json();
}

export async function startPrint(printerIp, filename, { port = 7125, fetchFn = fetch } = {}) {
  const res = await fetchFn(`http://${printerIp}:${port}/printer/print/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  });
  if (!res.ok) throw new Error(`Start print failed: ${res.status}`);
  return res.json();
}

export async function pollPrintStatus(printerIp, onProgress, { port = 7125, fetchFn = fetch, intervalMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetchFn(`http://${printerIp}:${port}/printer/objects/query?print_stats`);
        const data = await res.json();
        const stats = data.result?.status?.print_stats;
        if (!stats) return;
        onProgress(stats.progress ?? 0, stats.state);
        if (stats.state === 'complete') { clearInterval(timer); resolve(); }
        else if (stats.state === 'error') { clearInterval(timer); reject(new Error('Print failed on printer')); }
      } catch (e) { clearInterval(timer); reject(e); }
    }, intervalMs);
  });
}
