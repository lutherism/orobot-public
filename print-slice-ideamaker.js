import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

function resolveExe(ideamakerPath) {
  if (process.platform === 'win32') return join(ideamakerPath, 'ideamaker.exe');
  if (process.platform === 'darwin') return join(ideamakerPath, 'ideaMaker.app', 'Contents', 'MacOS', 'ideaMaker');
  return join(ideamakerPath, 'ideamaker');
}

export function sliceStlIdeaMaker({ ideamakerPath, stlPath, profilePath }, spawnFn = spawnSync) {
  const outputPath = join(tmpdir(), `orobot-${randomUUID()}.gcode`);
  const exePath = resolveExe(ideamakerPath);

  const result = spawnFn(exePath, [
    '-m', stlPath,
    '-r', profilePath,
    '-o', outputPath,
    '-hidden',
  ], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });

  if (result.status !== 0) {
    throw new Error(`ideaMaker failed (exit ${result.status}): ${result.stderr || result.error?.message}`);
  }
  return outputPath;
}
