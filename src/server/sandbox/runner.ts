import * as vm from 'node:vm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppRecord, world } from '../state/world.js';
import { buildApi } from '../api/index.js';
import { installKnuddelsStringExtensionsInContext } from './string-extensions.js';

export type LoadedApp = {
  rec: AppRecord;
  shutdown: () => void;
};

export function loadApp(appRec: AppRecord): LoadedApp {
  const api = buildApi(appRec);

  // Build the global object for the vm context.
  const sandbox: Record<string, unknown> = {
    ...api,
    console: {
      log:   (...args: any[]) => api.KnuddelsServer.getDefaultLogger().info(...args),
      info:  (...args: any[]) => api.KnuddelsServer.getDefaultLogger().info(...args),
      warn:  (...args: any[]) => api.KnuddelsServer.getDefaultLogger().warn(...args),
      error: (...args: any[]) => api.KnuddelsServer.getDefaultLogger().error(...args),
      debug: (...args: any[]) => api.KnuddelsServer.getDefaultLogger().debug(...args),
    },
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    Date, JSON, Math, RegExp, Error, TypeError, RangeError, SyntaxError,
    Object, Array, String, Number, Boolean, Function, Symbol, Map, Set, WeakMap, WeakSet, Promise,
    parseInt, parseFloat, isNaN, isFinite,
  };

  // buildApi() may have stored helpers on a placeholder appRec.context — preserve them.
  const placeholder = appRec.context as Record<string, unknown> | undefined;
  const context = vm.createContext(sandbox, { name: `userapp:${appRec.appId}` });
  if (placeholder) Object.assign(context as object, placeholder);
  installKnuddelsStringExtensionsInContext(context);

  // Provide KnuddelsServer.require — must be wired into the same context.
  const requireFile = (file: string) => {
    const filePath = path.resolve(appRec.appDir, file);
    if (!filePath.startsWith(path.resolve(appRec.appDir))) {
      throw new Error(`require() path escapes app dir: ${file}`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`require(): file not found: ${file}`);
    }
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, context, { filename: filePath });
  };
  (sandbox as any).KnuddelsServer.require = requireFile;
  // Tracked for KnuddelsServer.execute()
  (context as any).__execute = requireFile;
  appRec.context = context;

  // Run main.js. The app sets a global `App = { ... }`.
  const mainPath = path.join(appRec.appDir, 'main.js');
  const mainCode = fs.readFileSync(mainPath, 'utf8');
  try {
    vm.runInContext(mainCode, context, { filename: mainPath });
  } catch (err: any) {
    api.KnuddelsServer.getDefaultLogger().fatal(`main.js threw: ${err?.message ?? err}\n${err?.stack ?? ''}`);
    throw err;
  }

  const app = (sandbox as any).App;
  if (!app) {
    api.KnuddelsServer.getDefaultLogger().warn('main.js did not define a global `App` object');
  }
  appRec.app = app;

  // Lifecycle: onAppStart
  try { app?.onAppStart?.(); }
  catch (err: any) { api.KnuddelsServer.getDefaultLogger().error(`onAppStart threw: ${err?.message ?? err}`); }

  // Notify world of the new app
  world.emitChange();

  return {
    rec: appRec,
    shutdown: () => {
      try { app?.onShutdown?.(); }
      catch (err: any) { api.KnuddelsServer.getDefaultLogger().error(`onShutdown threw: ${err?.message ?? err}`); }
      const cleanup = (context as any).__cleanup as (() => void) | undefined;
      cleanup?.();
      // Flush persistence
      appRec.persistence.flush();
    },
  };
}
