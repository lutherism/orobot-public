#!/usr/bin/env node
import { program } from 'commander';
import { createClient, AuthError } from './client.js';
import { writeSession, deleteSession } from './session.js';
import { createInterface } from 'node:readline';
import { join, basename, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createWriteStream, unlinkSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { readPrintConfig, writePrintConfig } from './print-config.js';
import { getSlicer } from './print-slicer.js';
import { discoverMoonrakerDevices, testMoonrakerConnection } from './print-connect.js';
import { uploadGcode, startPrint, pollPrintStatus } from './print-moonraker.js';
import { registerUriScheme } from './print-register.js';
import fetch from 'node-fetch';

const DEFAULT_API = process.env.OROBOT_TEST_API || 'https://orobot.io';

function out(data) {
  const opts = program.opts();
  console.log(JSON.stringify(data, null, opts.pretty ? 2 : 0));
}

function fail(message) {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

function client() {
  return createClient({ api: program.opts().api });
}

async function run(fn) {
  try {
    await fn();
  } catch (e) {
    fail(e.message);
  }
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function ensureSlicerConfigured(config) {
  let updated = { ...config };

  if (!updated.slicer) {
    const choice = await prompt('Slicer not configured for this printer. Choose [cura/ideamaker] (cura): ');
    updated.slicer = choice.trim().toLowerCase() === 'ideamaker' ? 'ideamaker' : 'cura';
  }

  if (updated.slicer === 'ideamaker' && !updated.ideamakerPath) {
    const defaultPath = process.platform === 'win32'
      ? 'C:\\Program Files\\ideaMaker'
      : '/Applications/ideaMaker.app';
    const p = await prompt(`ideaMaker install path [${defaultPath}]: `);
    updated.ideamakerPath = p.trim() || defaultPath;
  }

  if (updated.slicer === 'ideamaker' && !updated.ideamakerProfilesDir) {
    const p = await prompt('Directory containing exported ideaMaker .bin profiles: ');
    updated.ideamakerProfilesDir = p.trim();
  }

  const changed = updated.slicer !== config.slicer
    || updated.ideamakerPath !== config.ideamakerPath
    || updated.ideamakerProfilesDir !== config.ideamakerProfilesDir;
  if (changed) {
    const updates = { slicer: updated.slicer };
    if (updated.ideamakerPath) updates.ideamakerPath = updated.ideamakerPath;
    if (updated.ideamakerProfilesDir) updates.ideamakerProfilesDir = updated.ideamakerProfilesDir;
    writePrintConfig(updates);
  }

  return updated;
}

async function runPrintJob(programUuid, { stlUrl, profileName, printerIpOverride } = {}) {
  let config = readPrintConfig();
  if (!config.printerIp && !printerIpOverride) fail('No printer configured. Run: orobot print connect');

  config = await ensureSlicerConfigured(config);
  const slicer = getSlicer(config);
  const printerIp = printerIpOverride ?? config.printerIp;

  let resolvedStlUrl = stlUrl;
  if (!resolvedStlUrl) {
    const prog = await client().get(`/api/program/${programUuid}`);
    const stlFiles = (prog.files ?? []).filter(f => f.toLowerCase().endsWith('.stl'));
    if (stlFiles.length === 0) fail('This program has no STL files');
    if (stlFiles.length === 1) {
      resolvedStlUrl = stlFiles[0];
    } else {
      stlFiles.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
      const choice = await prompt('Select STL file number: ');
      resolvedStlUrl = stlFiles[parseInt(choice) - 1];
    }
  }

  console.error('Downloading STL...');
  const stlPath = join(tmpdir(), `orobot-${randomUUID()}.stl`);
  const stlRes = await fetch(resolvedStlUrl);
  if (!stlRes.ok) fail(`Failed to download STL: ${stlRes.status}`);
  await pipeline(stlRes.body, createWriteStream(stlPath));

  const profiles = slicer.discoverProfiles();
  if (profiles.length === 0) fail(`No profiles found for ${config.slicer ?? 'cura'}. Configure profiles in your slicer and try again.`);
  let profile;
  if (profileName) {
    profile = profiles.find(p => p.name === profileName);
    if (!profile) fail(`Profile "${profileName}" not found. Run: orobot print profiles`);
  } else {
    profiles.forEach((p, i) => console.error(`  ${i + 1}. ${p.name}`));
    const choice = await prompt('Select profile number: ');
    profile = profiles[parseInt(choice) - 1];
    if (!profile) fail('Invalid profile selection');
  }

  console.error(`Slicing with profile "${profile.name}"...`);
  const gcodePath = await slicer.slice(stlPath, profile.name);
  const gcodeFilename = basename(gcodePath);

  console.error('Uploading gcode to printer...');
  await uploadGcode(printerIp, gcodePath);
  console.error('Starting print...');
  await startPrint(printerIp, gcodeFilename);

  console.error('Printing...');
  await pollPrintStatus(printerIp, (progress, state) => {
    process.stderr.write(`\r  ${state}: ${Math.round(progress * 100)}%   `);
  });
  console.error('\nPrint complete!');

  try { unlinkSync(stlPath); } catch {}
  try { unlinkSync(gcodePath); } catch {}
}

program
  .name('orobot')
  .option('--api <url>', 'API base URL', DEFAULT_API)
  .option('--pretty', 'Pretty-print JSON output');

// ── Auth ──────────────────────────────────────────────────────────────────────

program
  .command('signup <email> <password> <name>')
  .description('Create a new account')
  .action((email, password, name) => run(async () => {
    const res = await client().post('/api/signup', { username: name, email, password }, { auth: false });
    writeSession({ sessUuid: res.sessUuid, userUuid: res.uuid });
    out(res);
  }));

program
  .command('login <email> <password>')
  .description('Log in and save session')
  .action((email, password) => run(async () => {
    const res = await client().post('/api/login', { email, password }, { auth: false });
    writeSession({ sessUuid: res.sessUuid, userUuid: res.uuid });
    out(res);
  }));

program
  .command('logout')
  .description('Delete session')
  .action(() => run(async () => {
    const res = await client().delete('/api/session', {});
    deleteSession();
    out(res);
  }));

program
  .command('me')
  .description('Get current user')
  .action(() => run(async () => {
    out(await client().get('/api/me'));
  }));

// ── Devices ───────────────────────────────────────────────────────────────────

const devices = program.command('devices').description('Manage devices');

devices
  .command('list')
  .description('List your devices')
  .action(() => run(async () => out(await client().get('/api/devices'))));

devices
  .command('get <uuid>')
  .description('Get a device by UUID')
  .action((uuid) => run(async () => out(await client().get(`/api/device/${uuid}`))));

devices
  .command('create <name> <uuid>')
  .description('Create a new device')
  .action((name, uuid) => run(async () =>
    out(await client().post('/api/device', { name, uuid }))));

devices
  .command('delete <uuid>')
  .description('Delete a device')
  .action((uuid) => run(async () =>
    out(await client().delete('/api/device', { uuid }))));

devices
  .command('register <deviceUuid>')
  .description('Register a device to your account')
  .action((deviceUuid) => run(async () =>
    out(await client().post('/api/device/register', { deviceUuid }))));

devices
  .command('code-register <code>')
  .description('Register device by short code')
  .action((code) => run(async () =>
    out(await client().post('/api/device/code-register', { code }))));

devices
  .command('state-set <deviceUuid> <payloadJSON>')
  .description('Post device state')
  .action((deviceUuid, payloadJSON) => run(async () =>
    out(await client().post('/api/device/state', { deviceUuid, payloadJSON }))));

devices
  .command('state-get <deviceUuid>')
  .description('Get device state')
  .action((deviceUuid) => run(async () =>
    out(await client().post('/api/device/state/get', { deviceUuids: [deviceUuid] }))));

devices
  .command('logs <uuid>')
  .description('List log files for a device')
  .action((uuid) => run(async () =>
    out(await client().get(`/api/device/logs/${uuid}`))));

devices
  .command('log-content <uuid> <filename>')
  .description('Get the content of a device log file')
  .action((uuid, filename) => run(async () =>
    out(await client().post('/api/device/log/content', { uuid, filename }))));

// ── Robots ────────────────────────────────────────────────────────────────────

const robots = program.command('robots').description('Manage robots');

robots
  .command('list')
  .description('List your robots')
  .option('--filter <name>', 'Filter robots by name substring (case-sensitive)')
  .action((opts) => run(async () => {
    const data = await client().get('/api/robots');
    const result = opts.filter
      ? data.filter(r => r.name && r.name.includes(opts.filter))
      : data;
    out(result);
  }));

robots
  .command('get <uuid>')
  .description('Get a robot by UUID')
  .action((uuid) => run(async () => out(await client().get(`/api/robot/${uuid}`))));

robots
  .command('create <name> <programUuid>')
  .description('Create a robot linked to a program')
  .action((name, programUuid) => run(async () =>
    out(await client().post('/api/robot', { name, programUuid }))));

robots
  .command('delete <uuid>')
  .description('Delete a robot')
  .action((uuid) => run(async () =>
    out(await client().delete('/api/robot', { uuid }))));

robots
  .command('state <uuid> <payloadJSON>')
  .description('Post robot state')
  .action((uuid, payloadJSON) => run(async () =>
    out(await client().post('/api/robots/state', { uuid, payloadJSON }))));

robots
  .command('action <uuid> <action>')
  .description('Trigger a robot action')
  .action((uuid, action) => run(async () =>
    out(await client().post('/api/robot/action', { uuid, action }))));

// ── Programs ──────────────────────────────────────────────────────────────────

const programs = program.command('programs').description('Manage programs');

programs
  .command('list')
  .description('List your programs')
  .action(() => run(async () => out(await client().get('/api/programs'))));

programs
  .command('get <uuid>')
  .description('Get a program by UUID')
  .action((uuid) => run(async () => out(await client().get(`/api/program/${uuid}`))));

programs
  .command('create <name>')
  .description('Create a new program')
  .action((name) => run(async () =>
    out(await client().post('/api/program', { name }))));

programs
  .command('delete <uuid>')
  .description('Delete a program')
  .action((uuid) => run(async () =>
    out(await client().delete('/api/program', { uuid }))));

programs
  .command('save-data <jsonBody>')
  .description('Update program data — pass JSON string')
  .action((jsonBody) => run(async () =>
    out(await client().put('/api/program-data', JSON.parse(jsonBody)))));

programs
  .command('run <jsonBody>')
  .description('Run a program — pass JSON body string')
  .action((jsonBody) => run(async () =>
    out(await client().post('/api/program-ide/run', JSON.parse(jsonBody)))));

programs
  .command('run-action <jsonBody>')
  .description('Run a specific action — pass JSON body string')
  .action((jsonBody) => run(async () =>
    out(await client().post('/api/program-ide/runActionN', JSON.parse(jsonBody)))));

programs
  .command('categories')
  .description('List all program categories')
  .action(() => run(async () => out(await client().get('/api/program/categories'))));

programs
  .command('category <cat>')
  .description('List programs in a category')
  .action((cat) => run(async () =>
    out(await client().get(`/api/program/categories/${cat}`))));

programs
  .command('stats <uuid>')
  .description('Get engagement stats for a program (comment count, bookmark count)')
  .action((uuid) => run(async () =>
    out(await client().get(`/api/program/${uuid}/stats`))));

programs
  .command('search <query>')
  .description('Search programs by name, description, or author')
  .action((query) => run(async () =>
    out(await client().get(`/api/programs/search?q=${encodeURIComponent(query)}`))));

programs
  .command('publish <uuid>')
  .description('Publish a program to the catalog')
  .action((uuid) => run(async () =>
    out(await client().post(`/api/program/${uuid}/publish`))));

programs
  .command('unpublish <uuid>')
  .description('Remove a program from the catalog')
  .action((uuid) => run(async () =>
    out(await client().delete(`/api/program/${uuid}/publish`))));

programs
  .command('export <uuid> [outfile]')
  .description('Export a program as a zip file (defaults to <uuid>.zip)')
  .action((uuid, outfile) => run(async () => {
    const buf = await client().getBuffer(`/api/program/${uuid}/export`);
    const dest = outfile ?? `${uuid}.zip`;
    writeFileSync(dest, buf);
    console.log(`Exported to ${dest}`);
  }));

programs
  .command('import <zipfile>')
  .description('Import a program from a zip file')
  .action((zipfile) => run(async () => {
    const buf = readFileSync(zipfile);
    out(await client().postMultipart('/api/program/import', buf, basename(zipfile)));
  }));

// ── Emulator ──────────────────────────────────────────────────────────────────

const emulator = program.command('emulator').description('Control the device emulator');

emulator
  .command('start <deviceUuid>')
  .description('Start the emulator for a device')
  .action((deviceUuid) => run(async () =>
    out(await client().post('/api/device/emulator/start', { deviceUuid }))));

emulator
  .command('stop <deviceUuid>')
  .description('Stop the emulator for a device')
  .action((deviceUuid) => run(async () =>
    out(await client().post('/api/device/emulator/stop', { deviceUuid }))));

emulator
  .command('motor-config <deviceUuid> <configJSON>')
  .description('Update motor config — pass JSON string')
  .action((deviceUuid, configJSON) => run(async () =>
    out(await client().put('/api/device/motor-config', { deviceUuid, ...JSON.parse(configJSON) }))));

// ── Users ─────────────────────────────────────────────────────────────────────

const users = program.command('users').description('Manage users');

users
  .command('list')
  .description('List all users')
  .action(() => run(async () => out(await client().get('/api/users'))));

users
  .command('get <uuid>')
  .description('Get a user by UUID')
  .action((uuid) => run(async () => out(await client().get(`/api/user/${uuid}`))));

users
  .command('update <jsonBody>')
  .description("Update your account — pass JSON string e.g. '{\"name\":\"Alex\"}'")
  .action((jsonBody) => run(async () =>
    out(await client().put('/api/user', JSON.parse(jsonBody)))));

users
  .command('programs <uuid>')
  .description('Get programs for a user')
  .action((uuid) => run(async () =>
    out(await client().get(`/api/users/${uuid}/programs`))));

users
  .command('robots <uuid>')
  .description('Get robots for a user')
  .action((uuid) => run(async () =>
    out(await client().get(`/api/users/${uuid}/robots`))));

// ── Comments ──────────────────────────────────────────────────────────────────

const comments = program.command('comments').description('Manage comments');

comments
  .command('list <programUuid>')
  .description('List comments for a program')
  .action((programUuid) => run(async () =>
    out(await client().get(
      `/api/comments/entity?targetEntityType=program&targetEntityUuid=${programUuid}`,
      { auth: false }
    ))));

comments
  .command('post <programUuid> <text>')
  .description('Post a comment on a program')
  .action((programUuid, text) => run(async () =>
    out(await client().post('/api/comment/response', {
      targetEntityType: 'program',
      targetEntityUuid: programUuid,
      text
    }))));

comments
  .command('reply <parentUuid> <text>')
  .description('Reply to a comment')
  .action((parentUuid, text) => run(async () =>
    out(await client().post(`/api/comment/${parentUuid}/reply`, { text }))));

// ── Files ─────────────────────────────────────────────────────────────────────

const files = program.command('files').description('Upload and download files');

files
  .command('upload <localPath> <programUuid>')
  .description('Upload a program photo/STL to orobot-stls bucket')
  .action((localPath, programUuid) => run(async () =>
    out(await client().upload('/api/upload', localPath, { programUuid }, false))));

files
  .command('upload-profile-photo <localPath>')
  .description('Upload a profile photo (auth required)')
  .action((localPath) => run(async () =>
    out(await client().upload('/api/profile-photo/upload', localPath, {}, true))));

files
  .command('upload-banner-photo <localPath>')
  .description('Upload a banner photo (auth required)')
  .action((localPath) => run(async () =>
    out(await client().upload('/api/banner-photo/upload', localPath, {}, true))));

files
  .command('upload-misc <localPath>')
  .description('Upload a miscellaneous file to orobot-misc-files bucket')
  .action((localPath) => run(async () =>
    out(await client().upload('/api/misc-upload', localPath, {}, false))));

files
  .command('download <urlOrKey> <localPath>')
  .description('Download a file. Accepts full GCS URL or filename key.')
  .action((urlOrKey, localPath) => run(async () => {
    let key = urlOrKey;
    const storageProxyMatch = urlOrKey.match(/storage-proxy\/(.+)$/);
    const gcsMatch = urlOrKey.match(/storage\.googleapis\.com\/[^/]+\/(.+)$/);
    if (storageProxyMatch) key = storageProxyMatch[1];
    else if (gcsMatch) key = gcsMatch[1];
    out(await client().download(`/api/storage-proxy/${key}`, localPath));
  }));

// ── Print ─────────────────────────────────────────────────────────────────────

const print = program.command('print').description('3D print a robot');

print
  .command('connect')
  .description('Discover and connect to a Moonraker printer on your network')
  .action(() => run(async () => {
    console.error('Scanning for Moonraker printers (5s)...');
    const devices = await discoverMoonrakerDevices(5000);
    let ip;
    if (devices.length === 0) {
      console.error('No printers found via mDNS.');
      ip = await prompt('Enter printer IP address manually: ');
    } else {
      devices.forEach((d, i) => console.error(`  ${i + 1}. ${d.name} (${d.ip})`));
      const choice = await prompt('Select printer number (or type IP manually): ');
      const idx = parseInt(choice) - 1;
      ip = devices[idx]?.ip ?? choice;
    }
    console.error(`Testing connection to ${ip}...`);
    const info = await testMoonrakerConnection(ip);
    console.error(`Connected: ${JSON.stringify(info.result ?? info)}`);

    const slicerChoice = await prompt('Slicer [cura/ideamaker] (cura): ');
    const slicer = slicerChoice.trim().toLowerCase() === 'ideamaker' ? 'ideamaker' : 'cura';
    const configUpdates = { printerIp: ip, slicer };

    if (slicer === 'ideamaker') {
      const defaultPath = process.platform === 'win32'
        ? 'C:\\Program Files\\ideaMaker'
        : '/Applications/ideaMaker.app';
      const p = await prompt(`ideaMaker install path [${defaultPath}]: `);
      configUpdates.ideamakerPath = p.trim() || defaultPath;
      const dir = await prompt('Directory containing exported ideaMaker .bin profiles: ');
      configUpdates.ideamakerProfilesDir = dir.trim();
    }

    writePrintConfig(configUpdates);
    out({ saved: true, printerIp: ip, slicer,
      ...(configUpdates.ideamakerPath ? { ideamakerPath: configUpdates.ideamakerPath } : {}),
      ...(configUpdates.ideamakerProfilesDir ? { ideamakerProfilesDir: configUpdates.ideamakerProfilesDir } : {}),
    });
  }));

print
  .command('setup')
  .description('Configure slicer paths and printer definition')
  .option('--ideamaker', 'Configure ideaMaker install path')
  .action((opts) => run(async () => {
    if (opts.ideamaker) {
      const defaultPath = process.platform === 'win32'
        ? 'C:\\Program Files\\ideaMaker'
        : '/Applications/ideaMaker.app';
      const p = await prompt(`ideaMaker install path [${defaultPath}]: `);
      const dir = await prompt('Directory containing exported ideaMaker .bin profiles: ');
      writePrintConfig({ ideamakerPath: p.trim() || defaultPath, ideamakerProfilesDir: dir.trim() });
      out({ saved: true });
    } else {
      const defaultCuraPath = process.platform === 'win32'
        ? 'C:\\Program Files\\Ultimaker Cura 5.x'
        : '/Applications/UltiMaker Cura.app/Contents/MacOS';
      const curaPath = await prompt(`Cura install path [${defaultCuraPath}]: `);
      const printerDefinition = await prompt('Printer definition name [creality_cr30]: ');
      writePrintConfig({
        curaPath: curaPath || defaultCuraPath,
        printerDefinition: printerDefinition || 'creality_cr30',
      });
      out({ saved: true });
    }
  }));

print
  .command('register')
  .description('Register orobot:// URI scheme with the OS')
  .action(() => run(async () => {
    const binPath = process.argv[1];
    registerUriScheme(binPath);
    out({ registered: true, binPath });
  }));

print
  .command('profiles')
  .description('List profiles for the configured slicer')
  .action(() => run(async () => {
    let config = readPrintConfig();
    if (config.printerIp) config = await ensureSlicerConfigured(config);
    const profiles = getSlicer(config).discoverProfiles();
    out(profiles.map(p => ({ name: p.name, path: p.path })));
  }));

print
  .command('printers')
  .description('List printers reported by Moonraker')
  .action(() => run(async () => {
    const config = readPrintConfig();
    if (!config.printerIp) fail('No printer configured. Run: orobot print connect');
    const res = await fetch(`http://${config.printerIp}:7125/printer/info`);
    out(await res.json());
  }));

print
  .command('program <programUuid>')
  .description('Download, slice, and print a robot')
  .option('--profile <name>', 'Profile name (skips interactive prompt)')
  .option('--printer <ip>', 'Printer IP override')
  .action((programUuid, opts) => run(() =>
    runPrintJob(programUuid, {
      profileName: opts.profile,
      printerIpOverride: opts.printer
    })
  ));

print
  .command('uri <uri>')
  .description('Handle orobot:// URI — called by the OS when browser fires the URI')
  .action((uri) => run(async () => {
    const url = new URL(uri);
    const programUuid = url.searchParams.get('programUuid');
    const stlUrl = url.searchParams.get('stlUrl');
    if (!programUuid) fail('Invalid URI: missing programUuid');
    await runPrintJob(programUuid, { stlUrl: stlUrl ? decodeURIComponent(stlUrl) : undefined });
  }));

program.parse();
