import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseIni } from 'ini';

function defaultCuraDir() {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appdata, 'cura');
  }
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'cura');
  return join(homedir(), '.local', 'share', 'cura');
}

function findLatestVersion(curaDir) {
  if (!existsSync(curaDir)) return null;
  const dirs = readdirSync(curaDir)
    .filter(e => /^\d+\.\d+/.test(e) && statSync(join(curaDir, e)).isDirectory())
    .sort((a, b) => {
      const [aMaj, aMin = 0] = a.split('.').map(Number);
      const [bMaj, bMin = 0] = b.split('.').map(Number);
      return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
    })
    .reverse();
  return dirs[0] ?? null;
}

export function discoverCuraProfiles(curaDir = defaultCuraDir()) {
  const version = findLatestVersion(curaDir);
  if (!version) return [];
  const profilesDir = join(curaDir, version, 'quality_changes');
  if (!existsSync(profilesDir)) return [];
  return readdirSync(profilesDir)
    .filter(f => f.endsWith('.inst.cfg'))
    .flatMap(f => {
      try {
        const content = readFileSync(join(profilesDir, f), 'utf8');
        const parsed = parseIni(content);
        return [{
          name: parsed.general?.name ?? f.replace(/\.inst\.cfg$/, ''),
          path: join(profilesDir, f),
          values: parsed.values ?? {}
        }];
      } catch {
        console.warn(`[orobot] Skipping unreadable Cura profile: ${f}`);
        return [];
      }
    });
}
