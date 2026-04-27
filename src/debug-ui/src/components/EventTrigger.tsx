import React, { useState, useMemo } from 'react';
import { useStore, type AppSnap, type SimUser } from '../store.js';
import { postJson } from '../api/http.js';

export function EventTrigger() {
  const apps = useStore(s => s.snapshot.apps);
  const users = useStore(s => s.snapshot.users);
  const humans = useMemo(() => users.filter(u => u.userType === 'Human'), [users]);

  return (
    <div>
      <AppEventCard apps={apps} />
      <DiceCard humans={humans} />
      <KnuddelCard humans={humans} />
    </div>
  );
}

function AppEventCard({ apps }: { apps: AppSnap[] }) {
  const [appId, setAppId] = useState<string>('');
  const [type, setType] = useState('exampleEvent');
  const [dataText, setDataText] = useState('{}');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  React.useEffect(() => { if (!appId && apps[0]) setAppId(apps[0].appId); }, [apps, appId]);

  async function trigger() {
    setErr(null); setOk(false);
    let data: unknown = null;
    try { data = dataText.trim() ? JSON.parse(dataText) : null; }
    catch { setErr('data ist kein gültiges JSON'); return; }
    try {
      await postJson('/api/debug/appEvent', { appId, type, data });
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="card">
      <h3>App-Event triggern</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Ruft <code>App.onAppEventReceived(appInstance, type, data)</code>.
      </p>
      <div className="grid">
        <div className="row">
          <label className="muted small" style={{ minWidth: 60 }}>App</label>
          <select value={appId} onChange={e => setAppId(e.target.value)}>
            {apps.map(a => <option key={a.appId} value={a.appId}>{a.appId}</option>)}
          </select>
        </div>
        <div className="row">
          <label className="muted small" style={{ minWidth: 60 }}>Type</label>
          <input value={type} onChange={e => setType(e.target.value)} />
        </div>
        <div>
          <label className="muted small">data (JSON)</label>
          <textarea rows={4} value={dataText} onChange={e => setDataText(e.target.value)} />
        </div>
        <div className="row">
          <button onClick={trigger} disabled={!appId}>Senden</button>
          {ok && <span className="small" style={{ color: 'var(--green)' }}>gesendet</span>}
          {err && <span className="small" style={{ color: 'var(--red)' }}>{err}</span>}
        </div>
      </div>
    </div>
  );
}

function DiceCard({ humans }: { humans: SimUser[] }) {
  const [userId, setUserId] = useState<number>(humans[0]?.userId ?? 100);
  const [value, setValue] = useState(6);
  const [last, setLast] = useState<number | null>(null);
  React.useEffect(() => { if (!humans.find(h => h.userId === userId) && humans[0]) setUserId(humans[0].userId); }, [humans, userId]);
  async function roll() {
    const r = await postJson<{ ok: boolean; result: number }>('/api/debug/dice', { userId, value });
    setLast(r.result);
  }
  return (
    <div className="card">
      <h3>Dice</h3>
      <p className="small muted" style={{ marginTop: 0 }}>Triggert <code>App.onUserDiced</code>.</p>
      <div className="row">
        <select value={userId} onChange={e => setUserId(Number(e.target.value))} style={{ maxWidth: 220 }}>
          {humans.map(u => <option key={u.userId} value={u.userId}>{u.nick}</option>)}
        </select>
        <select value={value} onChange={e => setValue(Number(e.target.value))} style={{ maxWidth: 120 }}>
          {[2, 4, 6, 10, 20, 100].map(v => <option key={v} value={v}>1w{v}</option>)}
        </select>
        <button onClick={roll}>Würfeln</button>
        {last != null && <span className="small">Ergebnis: <strong>{last}</strong></span>}
      </div>
    </div>
  );
}

function KnuddelCard({ humans }: { humans: SimUser[] }) {
  const [userId, setUserId] = useState<number>(humans[0]?.userId ?? 100);
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState('');
  React.useEffect(() => { if (!humans.find(h => h.userId === userId) && humans[0]) setUserId(humans[0].userId); }, [humans, userId]);
  async function transfer() {
    await postJson('/api/debug/knuddelTransfer', { userId, amount, reason });
  }
  return (
    <div className="card">
      <h3>Knuddel-Transfer (User → Bot)</h3>
      <p className="small muted" style={{ marginTop: 0 }}>Triggert <code>App.onKnuddelReceived</code>.</p>
      <div className="row">
        <select value={userId} onChange={e => setUserId(Number(e.target.value))} style={{ maxWidth: 220 }}>
          {humans.map(u => <option key={u.userId} value={u.userId}>{u.nick}</option>)}
        </select>
        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ maxWidth: 120 }} />
        <input placeholder="Grund (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        <button onClick={transfer}>Senden</button>
      </div>
    </div>
  );
}
