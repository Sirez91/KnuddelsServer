import * as fs from 'node:fs';
import * as path from 'node:path';
import chokidar from 'chokidar';
import { world, AppRecord } from './state/world.js';
import { PersistenceStore } from './persistence/store.js';
import { parseAppConfig } from './config.js';
import { loadApp, LoadedApp } from './sandbox/runner.js';
import { appRegistry } from './state/app-registry.js';
import {
  ExternalAppPath,
  parseExternalAppsEnv,
  readAppIdFromConfig,
  validateExternalAppPath,
} from './config/external-apps.js';
import {
  loadPersistedExternalAppPaths,
  persistExternalAppPath,
  unpersistExternalAppPath,
} from './config/external-apps-store.js';

const APPS_DIR = path.resolve('apps');
const loaded = new Map<string, LoadedApp>();

export type ExternalSource = 'env' | 'persisted';

type ExternalTarget = ExternalAppPath & {
  source: ExternalSource;
  /** appId once successfully registered (via app.config name=). */
  registeredAppId: string | null;
  /** Last error encountered during registration (collision, invalid app.config, etc.). */
  lastError: string | null;
};

const externalTargets: ExternalTarget[] = [];
let chokidarWatcher: chokidar.FSWatcher | null = null;
let scheduleReload: (appId: string) => void = () => {};

export function startWatcher(): void {
  fs.mkdirSync(APPS_DIR, { recursive: true });

  // 1. Internal apps from apps/
  for (const appId of listAppDirs()) {
    appRegistry.register({ appId, appDir: path.join(APPS_DIR, appId), source: 'internal' });
    console.log(`[app-registry] registered internal app: ${appId}`);
    loadOrReload(appId);
  }

  // 2. External apps — env first (read-only), then persisted (mutable).
  for (const ext of parseExternalAppsEnv(process.env.KS_EXTERNAL_APPS, APPS_DIR)) {
    addTargetAndRegister(ext, 'env');
  }
  for (const persisted of loadPersistedExternalAppPaths()) {
    const result = validateExternalAppPath(persisted, APPS_DIR);
    if (!result.ok) {
      console.error(`[external-apps] persisted entry invalid (${persisted}): ${result.error}`);
      continue;
    }
    if (externalTargets.some(t => t.appDir === result.value.appDir)) continue;
    addTargetAndRegister(result.value, 'persisted');
  }

  // 3. chokidar watching apps/ + each external parent.
  const initialWatchPaths = Array.from(new Set([APPS_DIR, ...externalTargets.map(t => t.parentDir)]));

  const reloadTimers = new Map<string, NodeJS.Timeout>();
  scheduleReload = (appId: string) => {
    const existing = reloadTimers.get(appId);
    if (existing) clearTimeout(existing);
    reloadTimers.set(appId, setTimeout(() => {
      reloadTimers.delete(appId);
      loadOrReload(appId);
    }, 100));
  };

  chokidarWatcher = chokidar.watch(initialWatchPaths, {
    ignoreInitial: true,
    ignored: ignoredPredicate,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    followSymlinks: false,
  });

  chokidarWatcher.on('add',       p => onFileEvent(p, scheduleReload));
  chokidarWatcher.on('change',    p => onFileEvent(p, scheduleReload));
  chokidarWatcher.on('unlink',    p => onFileEvent(p, scheduleReload));
  chokidarWatcher.on('addDir',    p => onAddDir(p, scheduleReload));
  chokidarWatcher.on('unlinkDir', p => onUnlinkDir(p));
}

// ---- runtime mutation API (called from debug-api) ----------------------------

export type ExternalTargetView = {
  appDir: string;
  parentDir: string;
  source: ExternalSource;
  appId: string | null;
  status: 'loaded' | 'pending' | 'error';
  error: string | null;
};

export function listExternalTargets(): ExternalTargetView[] {
  return externalTargets.map(t => ({
    appDir: t.appDir,
    parentDir: t.parentDir,
    source: t.source,
    appId: t.registeredAppId,
    status: t.registeredAppId ? 'loaded' : (t.lastError ? 'error' : 'pending'),
    error: t.lastError,
  }));
}

export type AddResult = { ok: true; view: ExternalTargetView } | { ok: false; error: string };

export function addExternalAppPath(rawPath: string): AddResult {
  const result = validateExternalAppPath(rawPath, APPS_DIR);
  if (!result.ok) return { ok: false, error: result.error };
  if (externalTargets.some(t => t.appDir === result.value.appDir)) {
    return { ok: false, error: `already registered: ${result.value.appDir}` };
  }

  const target = addTargetAndRegister(result.value, 'persisted');
  persistExternalAppPath(target.appDir);

  // Start watching the parent if not already watched.
  const watcher = chokidarWatcher;
  if (watcher && !isParentWatched(target.parentDir, target)) {
    watcher.add(target.parentDir);
  }

  world.emit('external-apps-changed');
  return { ok: true, view: listExternalTargets().find(v => v.appDir === target.appDir)! };
}

export type RemoveResult = { ok: true } | { ok: false; error: string };

export function removeExternalAppPath(absPath: string): RemoveResult {
  const idx = externalTargets.findIndex(t => t.appDir === absPath);
  if (idx === -1) return { ok: false, error: `unknown external app path: ${absPath}` };
  const target = externalTargets[idx];
  if (target.source === 'env') {
    return { ok: false, error: `path is set via KS_EXTERNAL_APPS env var; remove it from the env to unregister` };
  }

  if (target.registeredAppId) {
    unloadApp(target.registeredAppId);
    appRegistry.unregister(target.registeredAppId);
  }
  externalTargets.splice(idx, 1);
  unpersistExternalAppPath(target.appDir);

  // Unwatch the parent if no remaining target uses it.
  const watcher = chokidarWatcher;
  if (watcher && !isParentWatched(target.parentDir, null)) {
    watcher.unwatch(target.parentDir);
  }
  console.log(`[app-registry] removed external app: ${target.appDir}`);
  world.emit('external-apps-changed');
  return { ok: true };
}

// ---- internals ---------------------------------------------------------------

function addTargetAndRegister(ext: ExternalAppPath, source: ExternalSource): ExternalTarget {
  const target: ExternalTarget = { ...ext, source, registeredAppId: null, lastError: null };
  externalTargets.push(target);
  tryRegisterExternal(target);
  if (target.registeredAppId) loadOrReload(target.registeredAppId);
  return target;
}

function isParentWatched(parentDir: string, ignoreTarget: ExternalTarget | null): boolean {
  if (parentDir === APPS_DIR) return true;
  for (const t of externalTargets) {
    if (t === ignoreTarget) continue;
    if (t.parentDir === parentDir) return true;
  }
  return false;
}

function ignoredPredicate(filepath: string): boolean {
  // Always allow the watch roots themselves so chokidar doesn't refuse to enter them.
  if (filepath === APPS_DIR) return false;
  for (const ext of externalTargets) {
    if (filepath === ext.parentDir) return false;
  }
  if (path.basename(filepath).startsWith('.')) return true;
  if (filepath.startsWith(APPS_DIR + path.sep)) return false;
  for (const ext of externalTargets) {
    if (filepath === ext.appDir || filepath.startsWith(ext.appDir + path.sep)) return false;
  }
  // External parent's siblings — outside any tracked subtree.
  return true;
}

function onFileEvent(p: string, schedule: (id: string) => void): void {
  // External target first — events under an external appDir take priority over the apps/ check.
  const ext = findExternalTarget(p);
  if (ext) {
    if (!ext.registeredAppId) {
      tryRegisterExternal(ext);
      if (!ext.registeredAppId) return;
      schedule(ext.registeredAppId);
      return;
    }
    const rel = path.relative(ext.appDir, p);
    if (rel.split(path.sep)[0] === 'www') {
      world.bumpFrontendVersion(ext.registeredAppId);
      world.emit('frontend-changed', ext.registeredAppId);
      return;
    }
    if (rel === 'app.config') {
      handleExternalAppConfigChange(ext, schedule);
      return;
    }
    schedule(ext.registeredAppId);
    return;
  }

  // Internal apps/ event.
  const rel = path.relative(APPS_DIR, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;
  if (rel.split(path.sep)[1] === 'www') {
    const appId = rel.split(path.sep)[0];
    if (appId) {
      world.bumpFrontendVersion(appId);
      world.emit('frontend-changed', appId);
    }
    return;
  }
  const appId = appIdFromInternalPath(p);
  if (appId) schedule(appId);
}

function onAddDir(p: string, schedule: (id: string) => void): void {
  for (const ext of externalTargets) {
    if (p === ext.appDir) return;
  }
  const rel = path.relative(APPS_DIR, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;
  const segs = rel.split(path.sep);
  if (segs.length !== 1) return;
  const appId = segs[0];
  if (appId && !appRegistry.has(appId)) {
    appRegistry.register({ appId, appDir: path.join(APPS_DIR, appId), source: 'internal' });
    console.log(`[app-registry] registered internal app: ${appId}`);
    schedule(appId);
  }
}

function onUnlinkDir(p: string): void {
  for (const ext of externalTargets) {
    if (p === ext.appDir && ext.registeredAppId) {
      const appId = ext.registeredAppId;
      unloadApp(appId);
      appRegistry.unregister(appId);
      ext.registeredAppId = null;
      world.emit('external-apps-changed');
      return;
    }
  }
  const rel = path.relative(APPS_DIR, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;
  if (rel.split(path.sep).length !== 1) return;
  const entry = appRegistry.get(rel);
  if (entry && entry.source === 'internal') {
    unloadApp(rel);
    appRegistry.unregister(rel);
  }
}

function findExternalTarget(absPath: string): ExternalTarget | null {
  for (const ext of externalTargets) {
    if (absPath === ext.appDir || absPath.startsWith(ext.appDir + path.sep)) {
      return ext;
    }
  }
  return null;
}

function appIdFromInternalPath(p: string): string | null {
  const rel = path.relative(APPS_DIR, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const first = rel.split(path.sep)[0];
  return first || null;
}

function tryRegisterExternal(target: ExternalTarget): void {
  if (target.registeredAppId) return;
  const r = readAppIdFromConfig(target.appDir);
  if (r.status === 'no-config') {
    target.lastError = null; // Genuinely pending — file hasn't appeared yet.
    return;
  }
  if (r.status === 'no-name') {
    target.lastError = 'app.config has no `appName=` field';
    return;
  }
  if (r.status === 'invalid-name') {
    target.lastError = `app.config name='${r.raw}' is not a valid appId (allowed: a-z A-Z 0-9 . _ -)`;
    return;
  }
  if (appRegistry.has(r.appId)) {
    const existing = appRegistry.get(r.appId)!;
    const msg = `appId '${r.appId}' already registered (source=${existing.source}, dir=${existing.appDir})`;
    console.error(`[app-registry] external app at ${target.appDir} skipped: ${msg}`);
    target.lastError = msg;
    return;
  }
  appRegistry.register({ appId: r.appId, appDir: target.appDir, source: 'external' });
  target.registeredAppId = r.appId;
  target.lastError = null;
  console.log(`[app-registry] registered external app: ${r.appId} -> ${target.appDir}`);
  world.emit('external-apps-changed');
}

function handleExternalAppConfigChange(ext: ExternalTarget, schedule: (id: string) => void): void {
  const r = readAppIdFromConfig(ext.appDir);
  if (r.status !== 'ok') {
    if (ext.registeredAppId) {
      unloadApp(ext.registeredAppId);
      appRegistry.unregister(ext.registeredAppId);
      ext.registeredAppId = null;
    }
    ext.lastError =
      r.status === 'no-config'   ? null :
      r.status === 'no-name'     ? 'app.config has no `appName=` field' :
      /* invalid-name */           `app.config name='${r.raw}' is not a valid appId (allowed: a-z A-Z 0-9 . _ -)`;
    world.emit('external-apps-changed');
    return;
  }
  if (r.appId === ext.registeredAppId) {
    schedule(r.appId);
    return;
  }
  if (ext.registeredAppId) {
    unloadApp(ext.registeredAppId);
    appRegistry.unregister(ext.registeredAppId);
  }
  if (appRegistry.has(r.appId)) {
    const existing = appRegistry.get(r.appId)!;
    const msg = `cannot adopt appId '${r.appId}': already registered (source=${existing.source})`;
    console.error(`[app-registry] external app at ${ext.appDir}: ${msg}`);
    ext.registeredAppId = null;
    ext.lastError = msg;
    world.emit('external-apps-changed');
    return;
  }
  appRegistry.register({ appId: r.appId, appDir: ext.appDir, source: 'external' });
  ext.registeredAppId = r.appId;
  ext.lastError = null;
  console.log(`[app-registry] external app re-registered: ${r.appId} -> ${ext.appDir}`);
  schedule(r.appId);
  world.emit('external-apps-changed');
}

function listAppDirs(): string[] {
  return fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name);
}

function unloadApp(appId: string): void {
  const existing = loaded.get(appId);
  if (existing) {
    // Close all open AppContent sessions first so closeListeners fire
    // while the (still-loaded) App's closures are intact.
    for (const sessionId of Array.from(existing.rec.sessions.keys())) {
      world.appContentRemoved(sessionId);
    }
    existing.shutdown();
    loaded.delete(appId);
  }
  world.apps.delete(appId);
  world.emitChange();
}

export function loadOrReload(appId: string): void {
  const entry = appRegistry.get(appId);
  if (!entry) return;
  const appDir = entry.appDir;
  const mainJs = path.join(appDir, 'main.js');
  if (!fs.existsSync(mainJs)) {
    if (loaded.has(appId)) unloadApp(appId);
    return;
  }
  unloadApp(appId);

  const config = parseAppConfig(path.join(appDir, 'app.config'));
  const rec: AppRecord = {
    appId,
    appDir,
    config,
    persistence: new PersistenceStore(appId),
    sessions: new Map(),
    toplists: new Map(),
  };
  world.apps.set(appId, rec);

  try {
    const la = loadApp(rec);
    loaded.set(appId, la);
    world.log({ ts: Date.now(), appId, level: 'info', msg: `[sandbox] loaded ${appId}` });
  } catch (err: any) {
    world.log({ ts: Date.now(), appId, level: 'fatal', msg: `[sandbox] failed to load: ${err?.message ?? err}` });
  }
  world.emitChange();
}
