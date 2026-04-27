import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store.js';

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
type Level = typeof LEVELS[number];

export function LogPanel() {
  const logs = useStore(s => s.logs);
  const apps = useStore(s => s.snapshot.apps);
  const [levels, setLevels] = useState<Set<Level>>(new Set(LEVELS));
  const [appFilter, setAppFilter] = useState<string>('');
  const [autoscroll, setAutoscroll] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => logs.filter(l => levels.has(l.level) && (!appFilter || l.appId === appFilter)), [logs, levels, appFilter]);

  useEffect(() => {
    if (autoscroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [filtered, autoscroll]);

  function toggle(level: Level) {
    const next = new Set(levels);
    if (next.has(level)) next.delete(level); else next.add(level);
    setLevels(next);
  }

  return (
    <div>
      <div className="card">
        <div className="toolbar">
          {LEVELS.map(l => (
            <label key={l} className="row" style={{ gap: 4 }}>
              <input type="checkbox" checked={levels.has(l)} onChange={() => toggle(l)} style={{ width: 'auto' }} />
              <span className={`small ${l}`} style={{ color: levelColor(l) }}>{l}</span>
            </label>
          ))}
          <span className="spacer" />
          <label className="muted small">App</label>
          <select value={appFilter} onChange={e => setAppFilter(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">(alle)</option>
            {apps.map(a => <option key={a.appId} value={a.appId}>{a.appId}</option>)}
          </select>
          <label className="row" style={{ gap: 4 }}>
            <input type="checkbox" checked={autoscroll} onChange={e => setAutoscroll(e.target.checked)} style={{ width: 'auto' }} />
            <span className="small">Autoscroll</span>
          </label>
        </div>
      </div>
      <div className="log" ref={ref} style={{ height: 'calc(100vh - 240px)' }}>
        {filtered.length === 0 && <div className="muted small">— leer —</div>}
        {filtered.map((l, i) => (
          <div key={i} className={`line ${l.level}`}>
            <span className="meta">{new Date(l.ts).toLocaleTimeString()}</span>
            <span className="meta">[{l.appId}]</span>
            <span className="meta">{l.level}</span>
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function levelColor(l: Level): string {
  switch (l) {
    case 'debug': return 'var(--muted)';
    case 'info':  return 'var(--text)';
    case 'warn':  return 'var(--yellow)';
    case 'error': return 'var(--red)';
    case 'fatal': return 'var(--red)';
  }
}
