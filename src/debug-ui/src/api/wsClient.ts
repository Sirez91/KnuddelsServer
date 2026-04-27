export type WsMessage = { type: string; payload?: any };

type Listener = (msg: WsMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private connected = false;
  private reconnectTimer: number | null = null;

  constructor(private url: string) {}

  connect(): void {
    try { this.ws?.close(); } catch {}
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.connected = true;
      for (const l of this.statusListeners) l(true);
    });
    ws.addEventListener('message', ev => {
      let msg: WsMessage;
      try { msg = JSON.parse(ev.data); } catch { return; }
      for (const l of this.listeners) l(msg);
    });
    ws.addEventListener('close', () => {
      this.connected = false;
      for (const l of this.statusListeners) l(false);
      this.scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      try { ws.close(); } catch {}
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  }

  isConnected(): boolean { return this.connected; }

  onMessage(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  onStatus(cb: (connected: boolean) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }
}

export const wsClient = new WsClient(`ws://${location.host}/__ws?channel=debug`);
