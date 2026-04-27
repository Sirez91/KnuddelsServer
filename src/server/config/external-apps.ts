import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseAppConfig } from '../config.js';
import { safeAppId } from '../state/app-registry.js';

export type ExternalAppPath = {
  /** Absolute, normalized path to the external app folder. */
  appDir: string;
  /** Absolute path of the parent dir — what chokidar actually watches so we can pick the folder up if it appears later. */
  parentDir: string;
};

export type ValidationResult =
  | { ok: true; value: ExternalAppPath }
  | { ok: false; error: string };

/**
 * Validate a single user-supplied path. Resolves symlinks (so it matches what
 * the OS-level watcher reports, e.g. macOS FSEvents emits /private/tmp/... not
 * /tmp/...), and walks up to the deepest existing ancestor for the realpath
 * since appDir itself may not exist yet (build hasn't run).
 */
export function validateExternalAppPath(rawPath: string, appsRoot: string): ValidationResult {
  const trimmed = rawPath.trim();
  if (!trimmed) return { ok: false, error: 'path is empty' };
  if (!path.isAbsolute(trimmed)) return { ok: false, error: `path must be absolute: ${trimmed}` };

  const abs = realpathOfNearestExisting(trimmed);

  if (abs === appsRoot || abs.startsWith(appsRoot + path.sep)) {
    return { ok: false, error: `path lies under apps/ root, would cause double-watching: ${abs}` };
  }

  const parent = path.dirname(abs);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    return { ok: false, error: `parent directory does not exist: ${parent}` };
  }

  return { ok: true, value: { appDir: abs, parentDir: parent } };
}

/**
 * Parse KS_EXTERNAL_APPS into a list of validated, deduplicated absolute paths.
 * Invalid paths are logged and skipped (env-var bootstrap is best-effort).
 */
export function parseExternalAppsEnv(raw: string | undefined, appsRoot: string): ExternalAppPath[] {
  if (!raw) return [];
  const out: ExternalAppPath[] = [];
  const seen = new Set<string>();
  for (const piece of raw.split(',')) {
    if (!piece.trim()) continue;
    const result = validateExternalAppPath(piece, appsRoot);
    if (!result.ok) {
      console.error(`[external-apps] skipping ${piece.trim()}: ${result.error}`);
      continue;
    }
    if (seen.has(result.value.appDir)) continue;
    seen.add(result.value.appDir);
    out.push(result.value);
  }
  return out;
}

function realpathOfNearestExisting(p: string): string {
  // Walk up until we find an existing ancestor, realpath it, then re-append the missing tail.
  const segs = p.split(path.sep);
  for (let i = segs.length; i > 0; i--) {
    const candidate = segs.slice(0, i).join(path.sep) || path.sep;
    if (fs.existsSync(candidate)) {
      const real = fs.realpathSync(candidate);
      const tail = segs.slice(i).join(path.sep);
      return tail ? path.join(real, tail) : real;
    }
  }
  return p;
}

export type ReadAppIdResult =
  | { status: 'ok'; appId: string }
  | { status: 'no-config' }
  | { status: 'no-name' }
  | { status: 'invalid-name'; raw: string };

/**
 * Read the appId from `<appDir>/app.config`. Looks at `appName=` first (the
 * established convention used by apps/CG/app.config and the Knuddels build
 * tooling), falls back to `name=`.
 *
 * Distinguishes "file missing" (still pending — just wait) from various
 * parse-failure modes so the UI can show a useful error instead of
 * a perpetually pending entry.
 */
export function readAppIdFromConfig(appDir: string): ReadAppIdResult {
  const cfgPath = path.join(appDir, 'app.config');
  if (!fs.existsSync(cfgPath)) return { status: 'no-config' };
  const cfg = parseAppConfig(cfgPath);
  const raw = cfg.appName ?? cfg.name;
  if (!raw) return { status: 'no-name' };
  const valid = safeAppId(raw);
  if (!valid) return { status: 'invalid-name', raw };
  return { status: 'ok', appId: valid };
}
