import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useStore } from '../store.js';
import { postJson, getJson } from '../api/http.js';

type Kind = 'number' | 'string' | 'object';

type Slot = {
  kind: Kind;
  value: number | string | unknown;
};

type Snap = Record<string, Slot>;

export function PersistenceViewer() {
  const apps = useStore(s => s.snapshot.apps);
  const users = useStore(s => s.snapshot.users);
  const [snaps, setSnaps] = useState<Record<string, Snap>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ appId: string; key: string; kind: Kind; raw: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, Set<number>>>({});
  const [collapsedApps, setCollapsedApps] = useState<Set<string>>(new Set());
  const [collapsedUserSections, setCollapsedUserSections] = useState<Set<string>>(new Set());
  const [collapsedKvTables, setCollapsedKvTables] = useState<Set<string>>(new Set());

  const appIdsKey = apps.map(a => a.appId).sort().join('|');

  const loadOne = useCallback(async (appId: string) => {
    try {
      const snap = await getJson<Snap>(`/api/debug/persistence/${encodeURIComponent(appId)}`);
      setSnaps(prev => ({ ...prev, [appId]: snap }));
      setErrs(prev => {
        if (!prev[appId]) return prev;
        const next = { ...prev };
        delete next[appId];
        return next;
      });
    } catch (e: any) {
      setErrs(prev => ({ ...prev, [appId]: e.message }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all(apps.map(a => loadOne(a.appId)));
  }, [apps, loadOne]);

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [appIdsKey]);
  useEffect(() => {
    const id = window.setInterval(() => { loadAll(); }, 1500);
    return () => window.clearInterval(id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [appIdsKey]);

  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setEditing(null); setEditError(null); } }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }
  const toggleApp = (id: string) => toggle(collapsedApps, setCollapsedApps, id);
  const toggleUserSection = (id: string) => toggle(collapsedUserSections, setCollapsedUserSections, id);
  const toggleKvTable = (id: string) => toggle(collapsedKvTables, setCollapsedKvTables, id);

  function nickFor(userId: number): string {
    return users.find(u => u.userId === userId)?.nick ?? `#${userId}`;
  }

  if (apps.length === 0) {
    return <div className="card"><p className="muted">Keine App geladen.</p></div>;
  }

  return (
    <div>
      {apps.map(app => (
        <AppPersistenceCard
          key={app.appId}
          appId={app.appId}
          data={snaps[app.appId] ?? {}}
          err={errs[app.appId]}
          collapsed={collapsedApps.has(app.appId)}
          userSectionCollapsed={collapsedUserSections.has(app.appId)}
          kvTableCollapsed={collapsedKvTables.has(app.appId)}
          selectedUserIds={selectedUserIds[app.appId] ?? new Set<number>()}
          onToggle={() => toggleApp(app.appId)}
          onToggleUserSection={() => toggleUserSection(app.appId)}
          onToggleKvTable={() => toggleKvTable(app.appId)}
          onReload={() => loadOne(app.appId)}
          onSetSelectedUserIds={(s: Set<number>) => setSelectedUserIds(prev => ({ ...prev, [app.appId]: s }))}
          onEdit={(key: string, slot: Slot) => { setEditing({ appId: app.appId, key, kind: slot.kind, raw: rawForEditing(slot) }); setEditError(null); }}
          nickFor={nickFor}
        />
      ))}

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) { setEditing(null); setEditError(null); } }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}>
          <div
            className="card"
            style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto', margin: 0, boxShadow: '0 12px 48px rgba(0,0,0,0.6)' }}>
          <h3>Edit <code>{editing.key}</code> <span className="muted small">({editing.appId} · {editing.kind})</span></h3>
          {editing.kind === 'number' ? (
            <input
              type="number"
              step="any"
              value={editing.raw}
              onChange={e => { setEditing({ ...editing, raw: e.target.value }); setEditError(null); }}
              autoFocus
              style={{ width: '100%' }} />
          ) : (
            <textarea
              rows={editing.kind === 'object' ? 12 : 4}
              value={editing.raw}
              onChange={e => { setEditing({ ...editing, raw: e.target.value }); setEditError(null); }}
              autoFocus
              style={{ width: '100%', fontFamily: editing.kind === 'object' ? 'monospace' : undefined }} />
          )}
          {editError && <p className="small" style={{ color: 'var(--red)', marginTop: 4 }}>{editError}</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={async () => {
              if (!editing) return;
              let parsed: unknown;
              if (editing.kind === 'number') {
                if (editing.raw.trim() === '') { setEditError('Bitte eine Zahl eingeben'); return; }
                const n = Number(editing.raw);
                if (!Number.isFinite(n)) { setEditError('Keine gültige Zahl'); return; }
                parsed = n;
              } else if (editing.kind === 'string') {
                parsed = editing.raw;
              } else {
                try { parsed = JSON.parse(editing.raw); }
                catch (e: any) { setEditError(`Ungültiges JSON: ${e?.message ?? e}`); return; }
                if (parsed === null || typeof parsed !== 'object') {
                  setEditError('Wert muss ein Objekt oder Array sein');
                  return;
                }
              }
              const slot: Slot = { kind: editing.kind, value: parsed };
              try {
                await postJson(`/api/debug/persistence/${encodeURIComponent(editing.appId)}`, { key: editing.key, slot });
              } catch (e: any) {
                setEditError(`Speichern fehlgeschlagen: ${e?.message ?? e}`);
                return;
              }
              setEditing(null);
              setEditError(null);
              loadOne(editing.appId);
            }}>Speichern</button>
            <button onClick={() => { setEditing(null); setEditError(null); }}>Abbrechen</button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CardProps = {
  appId: string;
  data: Snap;
  err?: string;
  collapsed: boolean;
  userSectionCollapsed: boolean;
  kvTableCollapsed: boolean;
  selectedUserIds: Set<number>;
  onToggle: () => void;
  onToggleUserSection: () => void;
  onToggleKvTable: () => void;
  onReload: () => void;
  onSetSelectedUserIds: (s: Set<number>) => void;
  onEdit: (key: string, slot: Slot) => void;
  nickFor: (userId: number) => string;
};

function rawForEditing(slot: Slot): string {
  if (slot.kind === 'number') return String(slot.value);
  if (slot.kind === 'string') return String(slot.value);
  return JSON.stringify(slot.value, null, 2);
}

const VALUE_TRUNCATE = 200;
type ScopeFilter = 'all' | 'app' | 'users';
type KindFilter = 'all' | Kind;

function AppPersistenceCard(props: CardProps) {
  const {
    appId, data, err, collapsed, userSectionCollapsed, kvTableCollapsed,
    selectedUserIds, onToggle, onToggleUserSection, onToggleKvTable,
    onReload, onSetSelectedUserIds, onEdit, nickFor,
  } = props;

  const [filterText, setFilterText] = useState('');
  const [filterScope, setFilterScope] = useState<ScopeFilter>('all');
  const [filterKind, setFilterKind] = useState<KindFilter>('all');
  const [expandedValues, setExpandedValues] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

  function toggleExpandedUser(uid: number) {
    const next = new Set(expandedUsers);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setExpandedUsers(next);
  }

  const userIdsWithData = useMemo(() => {
    const ids = new Set<number>();
    for (const k of Object.keys(data)) {
      const m = /^user:(\d+):/.exec(k);
      if (m) ids.add(parseInt(m[1]!, 10));
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [data]);

  const counts = useMemo(() => {
    let app = 0, user = 0;
    for (const k of Object.keys(data)) {
      if (k.startsWith('app:')) app++;
      else if (k.startsWith('user:')) user++;
    }
    return { app, user, total: app + user };
  }, [data]);

  async function del(key: string) {
    if (!confirm(`Key "${key}" löschen?`)) return;
    await postJson(`/api/debug/persistence/${encodeURIComponent(appId)}`, { key, slot: null });
    onReload();
  }
  async function clear(scope: 'all' | 'app' | 'users', confirmText: string) {
    if (!confirm(confirmText)) return;
    await postJson(`/api/debug/persistence/${encodeURIComponent(appId)}/clear`, { scope });
    onReload();
  }
  async function clearSelectedUsers() {
    if (selectedUserIds.size === 0) return;
    if (!confirm(`Persistence von ${selectedUserIds.size} ausgewählten User(n) löschen?`)) return;
    for (const userId of selectedUserIds) {
      await postJson(`/api/debug/persistence/${encodeURIComponent(appId)}/clear`, { scope: 'user', userId });
    }
    onSetSelectedUserIds(new Set());
    onReload();
  }
  function toggleUser(userId: number) {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    onSetSelectedUserIds(next);
  }
  function toggleAllUsers() {
    if (selectedUserIds.size === userIdsWithData.length) onSetSelectedUserIds(new Set());
    else onSetSelectedUserIds(new Set(userIdsWithData));
  }

  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));

  const filteredEntries = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    return entries.filter(([key, slot]) => {
      if (filterScope === 'app' && !key.startsWith('app:')) return false;
      if (filterScope === 'users' && !key.startsWith('user:')) return false;
      if (filterKind !== 'all' && slot.kind !== filterKind) return false;
      if (needle && !key.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [entries, filterText, filterScope, filterKind]);

  const filteredKeySet = useMemo(() => new Set(filteredEntries.map(([k]) => k)), [filteredEntries]);
  const allFilteredSelected = filteredEntries.length > 0 && filteredEntries.every(([k]) => selectedKeys.has(k));
  const filterActive = filterText !== '' || filterScope !== 'all' || filterKind !== 'all';

  function toggleSelectKey(key: string) {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedKeys(next);
  }
  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const next = new Set(selectedKeys);
      for (const k of filteredKeySet) next.delete(k);
      setSelectedKeys(next);
    } else {
      const next = new Set(selectedKeys);
      for (const k of filteredKeySet) next.add(k);
      setSelectedKeys(next);
    }
  }
  function toggleExpanded(key: string) {
    const next = new Set(expandedValues);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedValues(next);
  }
  function resetFilters() {
    setFilterText('');
    setFilterScope('all');
    setFilterKind('all');
  }
  async function delSelected() {
    if (selectedKeys.size === 0) return;
    if (!confirm(`${selectedKeys.size} ausgewählte Key(s) löschen?`)) return;
    for (const key of selectedKeys) {
      await postJson(`/api/debug/persistence/${encodeURIComponent(appId)}`, { key, slot: null });
    }
    setSelectedKeys(new Set());
    onReload();
  }

  return (
    <div className="card">
      <div className="toolbar">
        <button onClick={onToggle} aria-label={collapsed ? 'expand' : 'collapse'}>
          {collapsed ? '▸' : '▾'}
        </button>
        <h3 style={{ margin: 0 }}>Persistence: <code>{appId}</code></h3>
        <span className="muted small">{counts.total} Einträge ({counts.app} App / {counts.user} User)</span>
        <span className="spacer" />
        {!collapsed && <button onClick={onReload}>Reload</button>}
      </div>
      {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}

      {!collapsed && (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              disabled={counts.total === 0}
              onClick={() => clear('all', `Wirklich ALLE ${counts.total} Persistence-Einträge von '${appId}' löschen?`)}>
              Alles löschen ({counts.total})
            </button>
            <button
              disabled={counts.app === 0}
              onClick={() => clear('app', `App-Persistence von '${appId}' (${counts.app} Einträge) löschen?`)}>
              App-Persistence löschen ({counts.app})
            </button>
            <button
              disabled={counts.user === 0}
              onClick={() => clear('users', `Alle UserPersistences von '${appId}' (${counts.user} Einträge) löschen?`)}>
              Alle UserPersistences löschen ({counts.user})
            </button>
          </div>

          {userIdsWithData.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="toolbar">
                <button onClick={onToggleUserSection} aria-label={userSectionCollapsed ? 'expand' : 'collapse'}>
                  {userSectionCollapsed ? '▸' : '▾'}
                </button>
                <h4 style={{ margin: 0 }}>UserPersistences nach User ({userIdsWithData.length})</h4>
                <span className="spacer" />
                {!userSectionCollapsed && (
                  <>
                    <button onClick={toggleAllUsers}>
                      {selectedUserIds.size === userIdsWithData.length ? 'Auswahl aufheben' : 'Alle auswählen'}
                    </button>
                    <button disabled={selectedUserIds.size === 0} onClick={clearSelectedUsers}>
                      Auswahl löschen ({selectedUserIds.size})
                    </button>
                  </>
                )}
              </div>
              {!userSectionCollapsed && (
                <table className="kv-table">
                  <thead><tr><th></th><th></th><th>UserId</th><th>Nick</th><th>Einträge</th><th></th></tr></thead>
                  <tbody>
                    {userIdsWithData.map(uid => {
                      const userEntries = Object.entries(data)
                        .filter(([k]) => k.startsWith(`user:${uid}:`))
                        .sort(([a], [b]) => a.localeCompare(b));
                      const isExpanded = expandedUsers.has(uid);
                      return (
                        <React.Fragment key={uid}>
                          <tr>
                            <td>
                              <button
                                onClick={() => toggleExpandedUser(uid)}
                                aria-label={isExpanded ? 'collapse' : 'expand'}
                                disabled={userEntries.length === 0}>
                                {isExpanded ? '▾' : '▸'}
                              </button>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(uid)}
                                onChange={() => toggleUser(uid)}
                                style={{ width: 'auto' }} />
                            </td>
                            <td className="muted">{uid}</td>
                            <td><strong>{nickFor(uid)}</strong></td>
                            <td className="muted small">{userEntries.length}</td>
                            <td>
                              <button onClick={async () => {
                                if (!confirm(`Persistence von User ${nickFor(uid)} (${uid}) löschen?`)) return;
                                await postJson(`/api/debug/persistence/${encodeURIComponent(appId)}/clear`, { scope: 'user', userId: uid });
                                onReload();
                              }}>del</button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td></td>
                              <td colSpan={5} style={{ paddingTop: 0 }}>
                                <table className="kv-table" style={{ marginTop: 0 }}>
                                  <thead><tr><th>Key</th><th>Type</th><th>Value</th><th></th></tr></thead>
                                  <tbody>
                                    {userEntries.map(([key, slot]) => {
                                      const valueStr = stringify(slot.value);
                                      const isLong = valueStr.length > VALUE_TRUNCATE;
                                      const isValueExpanded = expandedValues.has(key);
                                      const display = !isLong || isValueExpanded ? valueStr : valueStr.slice(0, VALUE_TRUNCATE) + '…';
                                      const subKey = key.slice(`user:${uid}:`.length);
                                      return (
                                        <tr key={key}>
                                          <td><code>{subKey}</code></td>
                                          <td className="muted small">{slot.kind}</td>
                                          <td style={{ maxWidth: 600, wordBreak: 'break-all' }}>
                                            <code
                                              onClick={isLong ? () => toggleExpanded(key) : undefined}
                                              title={isLong ? (isValueExpanded ? 'Klicken zum Einklappen' : 'Klicken zum Ausklappen') : undefined}
                                              style={isLong ? { cursor: 'pointer' } : undefined}>
                                              {display}
                                            </code>
                                            {isLong && (
                                              <span className="muted small" style={{ marginLeft: 6 }}>
                                                ({isValueExpanded ? 'weniger' : `${valueStr.length} Zeichen`})
                                              </span>
                                            )}
                                          </td>
                                          <td>
                                            <div className="row">
                                              <button onClick={() => onEdit(key, slot)}>edit</button>
                                              <button onClick={() => del(key)}>del</button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className="toolbar">
              <button onClick={onToggleKvTable} aria-label={kvTableCollapsed ? 'expand' : 'collapse'}>
                {kvTableCollapsed ? '▸' : '▾'}
              </button>
              <h4 style={{ margin: 0 }}>
                Alle Einträge ({filterActive ? `${filteredEntries.length} / ${entries.length}` : entries.length})
              </h4>
            </div>
            {!kvTableCollapsed && (
              <>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    placeholder="Filter Key…"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    style={{ minWidth: 200 }} />
                  <select value={filterScope} onChange={e => setFilterScope(e.target.value as ScopeFilter)}>
                    <option value="all">Scope: alle</option>
                    <option value="app">Scope: app:</option>
                    <option value="users">Scope: user:</option>
                  </select>
                  <select value={filterKind} onChange={e => setFilterKind(e.target.value as KindFilter)}>
                    <option value="all">Type: alle</option>
                    <option value="number">number</option>
                    <option value="string">string</option>
                    <option value="object">object</option>
                  </select>
                  {filterActive && <button onClick={resetFilters}>Reset</button>}
                  <span className="spacer" />
                  <button disabled={selectedKeys.size === 0} onClick={delSelected}>
                    Auswahl löschen ({selectedKeys.size})
                  </button>
                </div>
                <table className="kv-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Alle gefilterten auswählen"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          disabled={filteredEntries.length === 0}
                          style={{ width: 'auto' }} />
                      </th>
                      <th>Key</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 && (
                      <tr><td colSpan={5} className="muted small">{entries.length === 0 ? '— leer —' : '— keine Treffer —'}</td></tr>
                    )}
                    {filteredEntries.map(([key, slot]) => {
                      const valueStr = stringify(slot.value);
                      const isLong = valueStr.length > VALUE_TRUNCATE;
                      const isExpanded = expandedValues.has(key);
                      const display = !isLong || isExpanded ? valueStr : valueStr.slice(0, VALUE_TRUNCATE) + '…';
                      return (
                    <tr key={key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => toggleSelectKey(key)}
                          style={{ width: 'auto' }} />
                      </td>
                      <td><code>{key}</code></td>
                      <td className="muted small">{slot.kind}</td>
                      <td style={{ maxWidth: 600, wordBreak: 'break-all' }}>
                        <code
                          onClick={isLong ? () => toggleExpanded(key) : undefined}
                          title={isLong ? (isExpanded ? 'Klicken zum Einklappen' : 'Klicken zum Ausklappen') : undefined}
                          style={isLong ? { cursor: 'pointer' } : undefined}>
                          {display}
                        </code>
                        {isLong && (
                          <span className="muted small" style={{ marginLeft: 6 }}>
                            ({isExpanded ? 'weniger' : `${valueStr.length} Zeichen`})
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="row">
                          <button onClick={() => onEdit(key, slot)}>edit</button>
                          <button onClick={() => del(key)}>del</button>
                        </div>
                      </td>
                    </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  return JSON.stringify(v);
}
