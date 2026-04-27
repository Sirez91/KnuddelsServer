export async function postJson<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) {
    const msg = json?.error ?? r.statusText;
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return json;
}

export async function getJson<T = any>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
