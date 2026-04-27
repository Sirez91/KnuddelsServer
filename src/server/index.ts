import { startHttpServer } from './http/server.js';
import { startWatcher } from './watcher.js';
import { simulationRunner } from './simulation/runner.js';
import { world } from './state/world.js';

startHttpServer();
startWatcher();

// After watcher loaded all initial apps and world.users is seeded, reconcile
// every app's persistence against the live user set. Anything left over from
// a previous session whose users aren't around anymore (typical after a hard
// kill or crash) gets pruned here, before any code can read it.
{
  const validIds = new Set(world.users.keys());
  for (const app of world.apps.values()) {
    const { prunedKeys } = app.persistence.pruneUserKeysExcept(validIds);
    if (prunedKeys.length) {
      world.log({ ts: Date.now(), appId: app.appId, level: 'warn', msg: `pruned ${prunedKeys.length} orphan user-persistence key(s) at startup` });
    }
  }
}

// Orderly shutdown on Ctrl-C, tsx-watch reload, or kill: drive the simulation
// stop path so simulated users get their cleanup hooks, then synchronously
// flush every app's persistence store. Without this, pending writes scheduled
// via queueMicrotask would be dropped and disk state would diverge from
// the in-memory world.
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  try { simulationRunner.stop(); }
  catch (e) { console.error('[shutdown] simulationRunner.stop threw:', e); }
  for (const app of world.apps.values()) {
    try { app.persistence.flush(); }
    catch (e) { console.error(`[shutdown] flush ${app.appId} threw:`, e); }
  }
  console.log(`[shutdown] ${signal} — clean exit`);
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
