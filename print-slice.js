import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const ENGINE_EXE = process.platform === 'win32' ? 'CuraEngine.exe' : 'CuraEngine';

export function sliceStl({ curaPath, printerDefinition, stlPath, profileValues }, spawnFn = spawnSync) {
  const outputPath = join(tmpdir(), `orobot-${randomUUID()}.gcode`);
  const enginePath = join(curaPath, ENGINE_EXE);
  const defPath = join(curaPath, 'resources', 'definitions', `${printerDefinition}.def.json`);
  const settingsArgs = Object.entries(profileValues).flatMap(([k, v]) => ['-s', `${k}=${v}`]);

  const result = spawnFn(enginePath, [
    'slice', '-v',
    '-j', defPath,
    '-l', stlPath,
    '-o', outputPath,
    ...settingsArgs
  ], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });

  if (result.status !== 0) {
    throw new Error(`CuraEngine failed (exit ${result.status}): ${result.stderr || result.error?.message}`);
  }
  return outputPath;
}
