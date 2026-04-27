import { world, AppRecord } from '../state/world.js';

/** Resolve the per-app User proxy for a sim user. Mirrors the helper in debug-api.ts. */
export function userFor(a: AppRecord, userId: number): any {
  const get = (a.context as any)?.__getUser as ((id: number) => any) | undefined;
  if (get) {
    try { return get(userId); } catch { /* unknown user */ }
  }
  return (a.context as any)?.__userCache?.get(userId);
}

export type JoinResult =
  | { joined: true }
  | { joined: false; appId: string; reason: string };

export function dispatchUserJoined(userId: number): JoinResult {
  const sim = world.users.get(userId);
  if (!sim) return { joined: false, appId: '', reason: 'unknown user' };
  if (sim.isInChannel) return { joined: true };

  for (const a of world.apps.values()) {
    if (typeof a.app?.mayJoinChannel !== 'function') continue;
    const u = userFor(a, userId);
    let permission: any;
    try {
      permission = a.app.mayJoinChannel(u);
    } catch (e: any) {
      world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `mayJoinChannel threw: ${e?.message ?? e}` });
      world.emitChange();
      return { joined: false, appId: a.appId, reason: 'mayJoinChannel threw' };
    }
    if (permission && permission.__accepted === false) {
      const reason = String(permission.reason ?? '');
      world.log({ ts: Date.now(), appId: a.appId, level: 'info', msg: `join denied for user ${userId}: ${reason}` });
      world.emitChange();
      return { joined: false, appId: a.appId, reason };
    }
  }

  sim.isInChannel = true;
  world.emitChange();
  for (const a of world.apps.values()) {
    const u = userFor(a, userId);
    try { a.app?.onUserJoined?.(u); }
    catch (e: any) { world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `onUserJoined threw: ${e?.message ?? e}` }); }
  }
  return { joined: true };
}

export function dispatchUserLeft(userId: number): void {
  const sim = world.users.get(userId);
  if (!sim || !sim.isInChannel) return;
  sim.isInChannel = false;
  world.emitChange();
  for (const a of world.apps.values()) {
    const u = userFor(a, userId);
    try { a.app?.onUserLeft?.(u); }
    catch (e: any) { world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `onUserLeft threw: ${e?.message ?? e}` }); }
  }
}

export type DispatchResult =
  | { dispatched: true }
  | { dispatched: false; blockedBy: string };

export function dispatchPublicMessage(
  userId: number,
  text: string,
  sourceAppId: string = 'simulation',
): DispatchResult {
  const sim = world.users.get(userId);
  if (!sim) return { dispatched: false, blockedBy: '' };

  for (const a of world.apps.values()) {
    if (typeof a.app?.mayShowPublicMessage !== 'function') continue;
    const u = userFor(a, userId);
    const msg = makePublicMessage(u, text);
    let allowed: any;
    try { allowed = a.app.mayShowPublicMessage(msg); }
    catch (e: any) {
      world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `mayShowPublicMessage threw: ${e?.message ?? e}` });
      continue;
    }
    if (allowed === false) {
      world.log({ ts: Date.now(), appId: a.appId, level: 'info', msg: `public message blocked by mayShowPublicMessage` });
      world.emitChange();
      return { dispatched: false, blockedBy: a.appId };
    }
  }

  world.chat({ ts: Date.now(), appId: sourceAppId, kind: 'public', fromUserId: userId, text });
  for (const a of world.apps.values()) {
    const u = userFor(a, userId);
    const msg = makePublicMessage(u, text);
    try { a.app?.onPublicMessage?.(msg); }
    catch (e: any) { world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `onPublicMessage threw: ${e?.message ?? e}` }); }
  }
  return { dispatched: true };
}

export function dispatchPublicActionMessage(
  userId: number,
  text: string,
  functionName: string,
  sourceAppId: string = 'simulation',
): DispatchResult {
  const sim = world.users.get(userId);
  if (!sim) return { dispatched: false, blockedBy: '' };

  for (const a of world.apps.values()) {
    if (typeof a.app?.mayShowPublicActionMessage !== 'function') continue;
    const u = userFor(a, userId);
    const msg = makePublicActionMessage(u, text, functionName);
    let allowed: any;
    try { allowed = a.app.mayShowPublicActionMessage(msg); }
    catch (e: any) {
      world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `mayShowPublicActionMessage threw: ${e?.message ?? e}` });
      continue;
    }
    if (allowed === false) {
      world.log({ ts: Date.now(), appId: a.appId, level: 'info', msg: `public action message blocked by mayShowPublicActionMessage` });
      world.emitChange();
      return { dispatched: false, blockedBy: a.appId };
    }
  }

  world.chat({ ts: Date.now(), appId: sourceAppId, kind: 'action', fromUserId: userId, text });
  for (const a of world.apps.values()) {
    const u = userFor(a, userId);
    const msg = makePublicActionMessage(u, text, functionName);
    try { a.app?.onPublicActionMessage?.(msg); }
    catch (e: any) { world.log({ ts: Date.now(), appId: a.appId, level: 'error', msg: `onPublicActionMessage threw: ${e?.message ?? e}` }); }
  }
  return { dispatched: true };
}

function makePublicMessage(author: any, text: string): any {
  const date = new Date();
  return {
    getAuthor: () => author,
    getText: () => text,
    getRawText: () => text,
    getCreationDate: () => date,
  };
}

function makePublicActionMessage(author: any, text: string, functionName: string): any {
  return { ...makePublicMessage(author, text), getFunctionName: () => functionName };
}
