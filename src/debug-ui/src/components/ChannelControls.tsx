import React, { useState } from 'react';
import { useStore } from '../store.js';
import { postJson } from '../api/http.js';

export function ChannelControls() {
  const channelName = useStore(s => s.snapshot.channelName);
  const topic = useStore(s => s.snapshot.topic);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(channelName);
  const [draftTopic, setDraftTopic] = useState(topic);

  function open() {
    setDraftName(channelName); setDraftTopic(topic); setEditing(true);
  }
  async function save() {
    await postJson('/api/debug/topicChange', { channelName: draftName, topic: draftTopic });
    setEditing(false);
  }

  return (
    <div>
      <h2>Channel</h2>
      {!editing ? (
        <div className="grid">
          <div><strong>{channelName}</strong></div>
          <div className="small muted">{topic || <em>kein Topic</em>}</div>
          <button onClick={open}>Bearbeiten</button>
        </div>
      ) : (
        <div className="grid">
          <input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Name" />
          <input value={draftTopic} onChange={e => setDraftTopic(e.target.value)} placeholder="Topic" />
          <div className="row">
            <button onClick={save}>Speichern</button>
            <button onClick={() => setEditing(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}
