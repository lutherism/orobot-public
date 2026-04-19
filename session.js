import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SESSION_PATH = process.env.OROBOT_SESSION_PATH
  || join(__dirname, '.session');

export function readSession() {
  if (!existsSync(SESSION_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function writeSession(data) {
  writeFileSync(SESSION_PATH, JSON.stringify(data), 'utf8');
}

export function deleteSession() {
  if (existsSync(SESSION_PATH)) {
    unlinkSync(SESSION_PATH);
  }
}
