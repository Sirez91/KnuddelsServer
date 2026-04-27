import React, { useEffect, useRef, useState } from 'react';
import type { AppContentSpec } from '../store.js';
import { useStore } from '../store.js';
import { postJson } from '../api/http.js';

export function AppContentFrame({ spec }: { spec: AppContentSpec }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const version = useStore(s => s.frontendVersion[spec.appId] ?? 0);
  const users = useStore(s => s.snapshot.users);
  const [reloadKey, setReloadKey] = useState(0);

  // Auto-reload iframe when frontend files change.
  useEffect(() => {
    setReloadKey(k => k + 1);
  }, [version]);

  // Listen for postMessage('close') from the shim.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.data?.kind === 'close' && ev.data?.sessionId === spec.sessionId) {
        postJson('/api/debug/closeSession', { sessionId: spec.sessionId });
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [spec.sessionId]);

  const url = `/app/${encodeURIComponent(spec.appId)}/${spec.assetPath}`
    + `?sessionId=${encodeURIComponent(spec.sessionId)}`
    + `&userId=${encodeURIComponent(String(spec.userId))}`
    + `&v=${reloadKey}`;
  const userNick = users.find(u => u.userId === spec.userId)?.nick ?? `#${spec.userId}`;

  return (
    <div className="app-frame">
      <div className="frame-header">
        <span>
          <span className="pill">{spec.appViewMode}</span>
          {' '}<strong>{userNick}</strong>
          {' · '}<code>{spec.sessionId}</code>
        </span>
        <span className="row">
          <button onClick={() => setReloadKey(k => k + 1)}>↻</button>
          <button onClick={() => postJson('/api/debug/closeSession', { sessionId: spec.sessionId })}>×</button>
        </span>
      </div>
      <iframe ref={ref}
              key={reloadKey}
              src={url}
              style={{ width: '100%', height: spec.height || 480 }}
              title={`${spec.appId}/${spec.sessionId}`} />
    </div>
  );
}
