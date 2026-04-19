import { readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// ideaMaker profiles are .bin files exported manually from the ideaMaker app.
// There is no system default location — the user exports them to a directory of
// their choice, configured as ideamakerProfilesDir in ~/.orobot-print.json.
export function discoverIdeaMakerProfiles(profilesDir) {
  if (!profilesDir || !existsSync(profilesDir)) return [];
  return readdirSync(profilesDir)
    .filter(f => f.endsWith('.bin'))
    .map(f => ({
      name: basename(f, '.bin'),
      path: join(profilesDir, f),
    }));
}
