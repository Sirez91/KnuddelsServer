import React, { useState } from 'react';
import { useStore } from '../store.js';
import { postJson } from '../api/http.js';

export function UserManager() {
  const users = useStore(s => s.snapshot.users);
  const defaultBotId = useStore(s => s.snapshot.defaultBotUserId);
  const [nick, setNick] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Unknown'>('Unknown');
  const [age, setAge] = useState(25);
  const [err, setErr] = useState<string | null>(null);

  async function addUser() {
    setErr(null);
    if (!nick.trim()) return;
    try {
      await postJson('/api/debug/createUser', { nick: nick.trim(), gender, age });
      setNick('');
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function joinLeave(userId: number, isInChannel: boolean) {
    const path = isInChannel ? '/api/debug/userLeft' : '/api/debug/userJoined';
    await postJson(path, { userId });
  }
  async function deleteUser(userId: number) {
    if (userId === defaultBotId) return;
    if (!confirm('User wirklich löschen? Triggert onUserDeleted in allen Apps.')) return;
    await postJson('/api/debug/deleteUser', { userId });
  }
  async function setFlag(userId: number, flag: 'isChannelOwner' | 'isAppManager', value: boolean) {
    await postJson('/api/debug/setUserFlags', { userId, [flag]: value });
  }

  return (
    <div>
      <div className="card">
        <h3>Neuen User anlegen</h3>
        <div className="row">
          <input placeholder="Nick" value={nick} onChange={e => setNick(e.target.value)} />
          <select value={gender} onChange={e => setGender(e.target.value as any)}>
            <option value="Unknown">Unknown</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>
          <input type="number" min={1} max={120} value={age} onChange={e => setAge(Number(e.target.value))} style={{ maxWidth: 80 }} />
          <button onClick={addUser}>Anlegen</button>
        </div>
        {err && <p className="small" style={{ color: 'var(--red)', marginTop: 6 }}>{err}</p>}
      </div>

      <div className="card">
        <h3>Users ({users.length})</h3>
        <table>
          <thead>
            <tr><th>ID</th><th>Nick</th><th>Type</th><th>Status</th><th>Gender</th><th>Age</th><th>Rollen</th><th>im Channel</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.userId}>
                <td className="muted">{u.userId}</td>
                <td><strong>{u.nick}</strong></td>
                <td>{u.userType}</td>
                <td>{u.status}</td>
                <td>{u.gender}</td>
                <td>{u.age}</td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    <label className="row small" style={{ gap: 4 }}>
                      <input type="checkbox"
                             checked={u.isChannelOwner}
                             onChange={e => setFlag(u.userId, 'isChannelOwner', e.target.checked)}
                             style={{ width: 'auto' }} />
                      <span>Owner</span>
                    </label>
                    <label className="row small" style={{ gap: 4 }}>
                      <input type="checkbox"
                             checked={u.isAppManager}
                             onChange={e => setFlag(u.userId, 'isAppManager', e.target.checked)}
                             style={{ width: 'auto' }} />
                      <span>AppMgr</span>
                    </label>
                  </div>
                </td>
                <td>
                  <span className={`pill ${u.isInChannel ? 'in' : 'out'}`}>
                    {u.isInChannel ? 'drin' : 'draussen'}
                  </span>
                </td>
                <td>
                  <div className="row">
                    {u.userType === 'Human' && (
                      <button onClick={() => joinLeave(u.userId, u.isInChannel)}>
                        {u.isInChannel ? 'Leave' : 'Join'}
                      </button>
                    )}
                    {u.userId !== defaultBotId && u.userType === 'Human' && (
                      <button onClick={() => deleteUser(u.userId)}>Löschen</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
