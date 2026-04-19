import fetch from 'node-fetch';
import FormData from 'form-data';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { readSession } from './session.js';

export class AuthError extends Error {
  constructor() {
    super('Not authenticated — run: orobot login <email> <password>');
    this.name = 'AuthError';
  }
}

export function createClient({ api = 'https://orobot.io' } = {}) {
  async function request(method, path, { body, auth = true } = {}) {
    const session = readSession();
    if (auth && !session) throw new AuthError();

    const headers = { 'Content-Type': 'application/json' };
    if (auth && session) headers['Cookie'] = `_osess=${session.sessUuid}`;

    const res = await fetch(api + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    if (res.status === 401) throw new AuthError();
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error((j && j.err) || res.statusText);
    }
    return res.json();
  }

  return {
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { body, ...opts }),
    put: (path, body, opts) => request('PUT', path, { body, ...opts }),
    delete: (path, body, opts) => request('DELETE', path, { body, ...opts }),

    async upload(path, filePath, extraFields = {}, requireAuth = true) {
      const session = readSession();
      if (requireAuth && !session) throw new AuthError();

      const form = new FormData();
      form.append('file', createReadStream(filePath));
      for (const [k, v] of Object.entries(extraFields)) {
        form.append(k, v);
      }

      const headers = { ...form.getHeaders() };
      if (session) headers['Cookie'] = `_osess=${session.sessUuid}`;

      const res = await fetch(api + path, { method: 'POST', headers, body: form });
      if (res.status === 401) throw new AuthError();
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error((j && j.err) || res.statusText);
      }
      return res.json();
    },

    async download(path, localPath) {
      const session = readSession();
      const headers = session ? { Cookie: `_osess=${session.sessUuid}` } : {};
      const res = await fetch(api + path, { headers });
      if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
      await pipeline(res.body, createWriteStream(localPath));
      return { saved: localPath };
    },

    async getBuffer(path) {
      const session = readSession();
      if (!session) throw new AuthError();
      const headers = { Cookie: `_osess=${session.sessUuid}` };
      const res = await fetch(api + path, { headers });
      if (res.status === 401) throw new AuthError();
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error((j && j.err) || res.statusText);
      }
      return Buffer.from(await res.arrayBuffer());
    },

    async postMultipart(path, buf, filename) {
      const session = readSession();
      if (!session) throw new AuthError();
      const form = new FormData();
      form.append('file', buf, { filename, contentType: 'application/zip' });
      const headers = { ...form.getHeaders(), Cookie: `_osess=${session.sessUuid}` };
      const res = await fetch(api + path, { method: 'POST', headers, body: form });
      if (res.status === 401) throw new AuthError();
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error((j && j.err) || res.statusText);
      }
      return res.json();
    }
  };
}
