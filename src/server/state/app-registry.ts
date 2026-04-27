import * as path from 'node:path';

export type AppSource = 'internal' | 'external';

export type AppRegistryEntry = {
  appId: string;
  appDir: string;
  source: AppSource;
};

export function safeAppId(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null;
  if (trimmed === '.' || trimmed === '..') return null;
  return trimmed;
}

class AppRegistry {
  private byId = new Map<string, AppRegistryEntry>();

  register(entry: AppRegistryEntry): void {
    this.byId.set(entry.appId, entry);
  }

  unregister(appId: string): void {
    this.byId.delete(appId);
  }

  has(appId: string): boolean {
    return this.byId.has(appId);
  }

  get(appId: string): AppRegistryEntry | undefined {
    return this.byId.get(appId);
  }

  getAppDir(appId: string): string | undefined {
    return this.byId.get(appId)?.appDir;
  }

  entries(): AppRegistryEntry[] {
    return Array.from(this.byId.values());
  }

  // Longest-prefix match — needed because external appDirs can be arbitrary
  // and one could nest under another (rare, but cheap to handle correctly).
  findByPath(absPath: string): AppRegistryEntry | null {
    let best: AppRegistryEntry | null = null;
    for (const entry of this.byId.values()) {
      if (absPath === entry.appDir || absPath.startsWith(entry.appDir + path.sep)) {
        if (!best || entry.appDir.length > best.appDir.length) best = entry;
      }
    }
    return best;
  }
}

export const appRegistry = new AppRegistry();
