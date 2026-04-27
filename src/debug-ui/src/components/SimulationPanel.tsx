import React, { useEffect, useState } from 'react';
import { postJson, getJson } from '../api/http.js';
import { useStore } from '../store.js';

type PersonalityId =
  | 'plauderer' | 'stammgast' | 'stiller' | 'newbie'
  | 'flirter' | 'troll' | 'spammer';

type Personality = { id: PersonalityId; label: string; category: 'normal' | 'troublemaker' };

type ActiveUser = { userId: number; nick: string; personality: PersonalityId; inChannel: boolean };

type Status = {
  running: boolean;
  config: { targetUsers: number; troublemakerRatio: number; weights?: Partial<Record<PersonalityId, number>> } | null;
  activeUsers: ActiveUser[];
  joinedSinceStart: number;
  leftSinceStart: number;
  messagesSinceStart: number;
};

export function SimulationPanel() {
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [targetUsers, setTargetUsers] = useState(5);
  const [troublemakerRatio, setTroublemakerRatio] = useState(0.2);
  const [advanced, setAdvanced] = useState(false);
  const [weights, setWeights] = useState<Record<PersonalityId, number>>({
    plauderer: 3, stammgast: 2, stiller: 2, newbie: 2, flirter: 1, troll: 1, spammer: 1,
  });
  const [err, setErr] = useState<string | null>(null);
  const users = useStore(s => s.snapshot.users);

  useEffect(() => {
    getJson<Personality[]>('/api/debug/simulation/personalities').then(setPersonalities).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await getJson<Status>('/api/debug/simulation/status');
        if (!cancelled) setStatus(s);
      } catch { /* ignore */ }
    }
    poll();
    const t = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  async function start() {
    setErr(null);
    try {
      const body: any = { targetUsers, troublemakerRatio };
      if (advanced) body.weights = weights;
      await postJson('/api/debug/simulation/start', body);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function stop() {
    setErr(null);
    try { await postJson('/api/debug/simulation/stop', {}); }
    catch (e: any) { setErr(e.message); }
  }

  const running = status?.running ?? false;
  const personalityLabel = (id: PersonalityId) => personalities.find(p => p.id === id)?.label ?? id;

  return (
    <div>
      <div className="card">
        <h3>Simulation</h3>
        <p className="small muted" style={{ marginTop: 0 }}>
          Erzeugt fiktive User, die automatisch joinen, im Channel chatten und nach einer Weile wieder gehen.
          Jeder User bekommt eine Persönlichkeit – manche unterhalten sich normal, andere stören.
        </p>
        <div className="grid">
          <div className="row">
            <label className="muted small" style={{ minWidth: 140 }}>Anzahl gleichzeitiger User</label>
            <input type="number" min={0} max={50} value={targetUsers}
                   onChange={e => setTargetUsers(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                   style={{ maxWidth: 100 }} />
          </div>
          <div className="row">
            <label className="muted small" style={{ minWidth: 140 }}>Anteil Störer</label>
            <input type="range" min={0} max={1} step={0.05}
                   value={troublemakerRatio}
                   onChange={e => setTroublemakerRatio(Number(e.target.value))}
                   style={{ flex: 1, maxWidth: 240 }} />
            <span className="small" style={{ minWidth: 48 }}>{Math.round(troublemakerRatio * 100)}%</span>
          </div>
          <div className="row">
            <label className="row small" style={{ gap: 4 }}>
              <input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)}
                     style={{ width: 'auto' }} />
              <span>Persönlichkeiten einzeln gewichten</span>
            </label>
          </div>
          {advanced && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {personalities.map(p => (
                <div key={p.id} className="row" style={{ gap: 8 }}>
                  <span className="small" style={{ minWidth: 110 }}>
                    {p.label}
                    {p.category === 'troublemaker' && <span className="small muted"> · Störer</span>}
                  </span>
                  <input type="number" min={0} max={10}
                         value={weights[p.id] ?? 0}
                         onChange={e => setWeights({ ...weights, [p.id]: Math.max(0, Number(e.target.value) || 0) })}
                         style={{ maxWidth: 70 }} />
                </div>
              ))}
            </div>
          )}
          <div className="row">
            {!running
              ? <button onClick={start}>Simulation starten</button>
              : <button onClick={stop}>Simulation stoppen</button>}
            <span className={`pill ${running ? 'in' : 'out'}`}>{running ? 'läuft' : 'aus'}</span>
            {err && <span className="small" style={{ color: 'var(--red)' }}>{err}</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Status</h3>
        {!status && <p className="muted small">lade…</p>}
        {status && (
          <div className="small">
            <div>aktive simulierte User: <strong>{status.activeUsers.filter(u => u.inChannel).length}</strong> / Ziel {status.config?.targetUsers ?? 0}</div>
            <div>insgesamt seit Start: <strong>{status.joinedSinceStart}</strong> Joins, <strong>{status.leftSinceStart}</strong> Leaves, <strong>{status.messagesSinceStart}</strong> Nachrichten</div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Was passiert wann?</h3>
        <ul className="small muted" style={{ marginTop: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>
            <strong>Beim Start:</strong> Sim-User werden mit eindeutigen Nicks gespawnt (neue
            User-IDs ab <code>world.nextUserId</code>), erhalten eine Persönlichkeit und triggern{' '}
            <code>onUserJoined</code> in allen geladenen Apps.
          </li>
          <li>
            <strong>Im laufenden Betrieb:</strong> Jede Sekunde tickt die Simulation. Sim-User
            schreiben zufällig (Persönlichkeit steuert Frequenz und Wortlaut) und können nach
            mindestens 15 s den Channel verlassen. Beim Verlassen bleibt der User-Record in{' '}
            <code>world.users</code> &mdash; Apps können ihn weiter via{' '}
            <code>getUserId(nick)</code> auflösen, <code>isInChannel</code> ist dann{' '}
            <code>false</code>.
          </li>
          <li>
            <strong>Beim Stoppen:</strong> Alle aktiven Sim-User leaven (<code>onUserLeft</code>),
            werden danach pro App als gelöscht gemeldet (<code>onUserDeleted</code>) und ihre
            zugehörigen <code>user:&lt;id&gt;:*</code>-Persistence-Keys werden zwangsweise
            bereinigt &mdash; auch wenn die App das nicht selbst tut. Anschließend bleibt nur der
            Default-User-Bestand übrig.
          </li>
        </ul>
      </div>

      <div className="card">
        <h3>Aktive Sim-User ({status?.activeUsers.length ?? 0})</h3>
        {(!status || status.activeUsers.length === 0) && (
          <p className="muted small">Keine simulierten User.</p>
        )}
        {status && status.activeUsers.length > 0 && (
          <table>
            <thead>
              <tr><th>ID</th><th>Nick</th><th>Persönlichkeit</th><th>im Channel</th></tr>
            </thead>
            <tbody>
              {status.activeUsers.map(u => {
                const sim = users.find(s => s.userId === u.userId);
                return (
                  <tr key={u.userId}>
                    <td className="muted">{u.userId}</td>
                    <td><strong>{sim?.nick ?? u.nick}</strong></td>
                    <td>{personalityLabel(u.personality)}</td>
                    <td>
                      <span className={`pill ${u.inChannel ? 'in' : 'out'}`}>
                        {u.inChannel ? 'drin' : 'draussen'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
