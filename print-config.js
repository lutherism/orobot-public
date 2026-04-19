import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_CONFIG_PATH = join(homedir(), '.orobot-print.json');

export function readPrintConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    throw new Error(`Print config at ${configPath} is not valid JSON. Delete it and run: orobot print setup`);
  }
}

export function writePrintConfig(updates, configPath = DEFAULT_CONFIG_PATH) {
  const existing = readPrintConfig(configPath);
  writeFileSync(configPath, JSON.stringify({ ...existing, ...updates }, null, 2));
}
