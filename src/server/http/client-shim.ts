/**
 * Returns the JS source of the `Client` shim that gets injected into every
 * iframe rendering an UserApp's www/ HTML. Mirrors the surface of
 * knuddels-webapp-frontend-api.d.ts.
 */
export function clientShimSource(opts: {
  sessionId: string;
  appId: string;
  nick: string;
  pageData: Record<string, unknown>;
  wsUrl: string;
}): string {
  const json = JSON.stringify(opts);
  return `
;(function() {
  const opts = ${json};
  const listeners = Object.create(null);
  let ws = null;
  let queued = [];
  let connected = false;

  function connect() {
    ws = new WebSocket(opts.wsUrl);
    ws.addEventListener('open', () => {
      connected = true;
      ws.send(JSON.stringify({ type: '__hello', sessionId: opts.sessionId }));
      for (const m of queued.splice(0)) ws.send(m);
    });
    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg && msg.kind === 'event' && msg.type) dispatch(msg.type, msg.data);
    });
    ws.addEventListener('close', () => {
      connected = false;
      setTimeout(connect, 500);
    });
    ws.addEventListener('error', () => {});
  }
  connect();

  function dispatch(type, data) {
    const arr = listeners[type] || [];
    for (const cb of arr.slice()) {
      try { cb({ type: type, data: data }); } catch (e) { console.error('[Client] listener threw', e); }
    }
  }

  const ClientType = {
    Applet: { name: 'Applet' }, Browser: { name: 'Browser' }, Android: { name: 'Android' },
    IOS: { name: 'IOS' }, Offline: { name: 'Offline' }, Web: { name: 'Web' }, MobileWeb: { name: 'MobileWeb' },
  };

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/app/' + opts.appId + '/' + src;
      s.onload = () => res();
      s.onerror = e => rej(e);
      document.head.appendChild(s);
    });
  }
  function loadCss(src) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/app/' + opts.appId + '/' + src;
    document.head.appendChild(l);
  }

  const HostFrame = {
    setBackgroundColor: () => {},
    setSize: () => {},
    setMinSize: () => {},
    setMaxSize: () => {},
    setResizable: () => {},
    setTitle: t => { document.title = t; },
    setIcons: () => {},
    focus: () => {},
    getAppViewMode: () => 'Popup',
    getBrowserType: () => 'WebView',
    getBrowserVersion: () => '1.0',
  };

  const Client = {
    pageData: opts.pageData,
    addEventListener: (type, cb) => {
      (listeners[type] = listeners[type] || []).push(cb);
    },
    removeEventListener: (type, cb) => {
      if (!listeners[type]) return;
      const idx = listeners[type].indexOf(cb);
      if (idx >= 0) listeners[type].splice(idx, 1);
    },
    dispatchEvent: ev => dispatch(ev.type, ev.data),
    sendEvent: (type, data) => {
      const payload = JSON.stringify({ kind: 'event', type: type, data: data });
      if (connected && ws.readyState === 1) ws.send(payload);
      else queued.push(payload);
    },
    getNick: () => opts.nick,
    getClientType: () => ClientType.Web,
    getCacheInvalidationId: () => 'test-env-' + Date.now(),
    isK3Client: () => true,
    includeJS: function() {
      const args = Array.prototype.slice.call(arguments);
      args.forEach(loadScript);
    },
    includeCSS: function() {
      const args = Array.prototype.slice.call(arguments);
      args.forEach(loadCss);
    },
    playSound: () => {},
    prefetchSound: () => {},
    freeSound: () => {},
    getDirectConnection: () => Promise.resolve(),
    getHostFrame: () => HostFrame,
    addConnectionTypeChangeListener: () => {},
    removeConnectionTypeChangeListener: () => {},
    executeSlashCommand: cmd => {
      ws && ws.readyState === 1 && ws.send(JSON.stringify({ kind: 'slash', command: cmd }));
    },
    close: () => {
      ws && ws.readyState === 1 && ws.send(JSON.stringify({ kind: 'close' }));
      window.parent && window.parent.postMessage({ kind: 'close', sessionId: opts.sessionId }, '*');
    },
  };

  // Knuddels-style classes that some apps reference inside the iframe.
  function Event(type, data) { this.type = type; this.data = data; }
  Client.Event = Event;
  function Color(r, g, b) { this.r = r; this.g = g; this.b = b; }
  Color.fromRGB = (r, g, b) => new Color(r, g, b);
  Color.fromHexString = hex => {
    const m = hex.replace('#', '');
    return new Color(parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16));
  };
  Color.prototype.getRed = function() { return this.r; };
  Color.prototype.getGreen = function() { return this.g; };
  Color.prototype.getBlue = function() { return this.b; };
  Color.prototype.asHexString = function() {
    return '#' + [this.r, this.g, this.b].map(v => v.toString(16).padStart(2, '0')).join('');
  };
  Client.Color = Color;
  Client.HostFrame = HostFrame;
  Client.ClientType = ClientType;

  window.Client = Client;
  window.ClientType = ClientType;
})();
`;
}
