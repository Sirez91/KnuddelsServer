import * as fs from 'node:fs';
import * as path from 'node:path';

const STORE_FILE = path.resolve('.test-env/external-apps.json');

type StoreShape = { paths: string[] };

function readStore(): StoreShape {
  try {
    if (!fs.existsSync(STORE_FILE)) return { paths: [] };
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    const paths = Array.isArray(parsed?.paths) ? parsed.paths.filter((p): p is string => typeof p === 'string') : [];
    return { paths };
  } catch (err) {
    console.error('[external-apps-store] failed to read; starting empty:', err);
    return { paths: [] };
  }
}

function writeStore(store: StoreShape): void {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function loadPersistedExternalAppPaths(): string[] {
  return readStore().paths;
}

export function persistExternalAppPath(absPath: string): void {
  const store = readStore();
  if (!store.paths.includes(absPath)) {
    store.paths.push(absPath);
    writeStore(store);
  }
}

export function unpersistExternalAppPath(absPath: string): void {
  const store = readStore();
  const next = store.paths.filter(p => p !== absPath);
  if (next.length !== store.paths.length) {
    writeStore({ paths: next });
  }
}
