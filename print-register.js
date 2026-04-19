import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function registerWindows(binPath, execFn = execSync) {
  execFn(`reg add "HKCU\\Software\\Classes\\orobot" /ve /d "URL:orobot Protocol" /f`, { stdio: 'pipe' });
  execFn(`reg add "HKCU\\Software\\Classes\\orobot" /v "URL Protocol" /d "" /f`, { stdio: 'pipe' });
  execFn(`reg add "HKCU\\Software\\Classes\\orobot\\shell\\open\\command" /ve /d "\\"${binPath}\\" print uri \\"%1\\"" /f`, { stdio: 'pipe' });
}

export function registerLinux(binPath, writeFn = writeFileSync, execFn = execSync, mkdirFn = mkdirSync) {
  const desktopDir = join(homedir(), '.local', 'share', 'applications');
  if (!existsSync(desktopDir)) mkdirFn(desktopDir, { recursive: true });
  writeFn(join(desktopDir, 'orobot-uri.desktop'), [
    '[Desktop Entry]',
    'Name=orobot',
    `Exec=${binPath} print uri %u`,
    'Type=Application',
    'MimeType=x-scheme-handler/orobot',
    ''
  ].join('\n'));
  execFn(`update-desktop-database ${desktopDir}`, { stdio: 'pipe' });
}

export function registerUriScheme(binPath, opts = {}) {
  if (process.platform === 'win32') return registerWindows(binPath, opts.execFn);
  if (process.platform === 'linux') return registerLinux(binPath, opts.writeFn, opts.execFn, opts.mkdirFn);
  throw new Error('macOS URI registration requires manual setup — see docs');
}
