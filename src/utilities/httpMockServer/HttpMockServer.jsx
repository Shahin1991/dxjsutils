import React, { useEffect, useRef, useState } from 'react';

const METHODS = ['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
let nextId = 1;

const newRoute = () => ({
  id: nextId++,
  name: 'New route',
  method: 'GET',
  path: '/api/hello',
  enabled: true,
  status: 200,
  contentType: 'application/json',
  body: '{"message":"hello"}',
  delay: 0,
  headers: [],
});

function HttpMockServerInner() {
  const [port, setPort] = useState(4000);
  const [routes, setRoutes] = useState(() => [newRoute()]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);
  const runningRef = useRef(false);

  useEffect(() => {
    window.electron.onMockRequest((entry) => setLog((l) => [entry, ...l].slice(0, 200)));
    return () => {
      window.electron.offMockRequest();
      if (runningRef.current) window.electron.stopMockServer();
    };
  }, []);

  const update = (id, patch) => setRoutes((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const start = async () => {
    setError('');
    const res = await window.electron.startMockServer(port, routes);
    if (res?.error) setError(res.error);
    else {
      setRunning(true);
      runningRef.current = true;
    }
  };

  const stop = async () => {
    await window.electron.stopMockServer();
    setRunning(false);
    runningRef.current = false;
  };

  // push route edits to a running server
  const restart = async () => {
    await stop();
    await start();
  };

  return (
    <div className="ms-container">
      <h2 className="ms-title">🎭 HTTP Mock Server</h2>
      <div className="ms-panel ms-row">
        <label>Port <input type="number" value={port} disabled={running} onChange={(e) => setPort(+e.target.value)} /></label>
        {!running ? <button type="button" className="ms-btn" onClick={start}>▶ Start</button> : (
          <>
            <button type="button" className="ms-btn secondary" onClick={stop}>■ Stop</button>
            <button type="button" className="ms-btn" onClick={restart}>↻ Apply route changes</button>
          </>
        )}
        <span className={running ? 'ms-ok' : 'ms-muted'}>{running ? `Listening on http://localhost:${port}` : 'Stopped'}</span>
        {error && <span className="ms-err">⚠ {error}</span>}
      </div>
      {routes.map((r) => (
        <div key={r.id} className="ms-panel">
          <div className="ms-row">
            <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked })} title="Enabled" />
            <input className="ms-input" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="Name" />
            <select value={r.method} onChange={(e) => update(r.id, { method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            <input className="ms-input ms-path" value={r.path} onChange={(e) => update(r.id, { path: e.target.value })} placeholder="/path, /prefix/* or *" />
            <button type="button" className="ms-btn secondary" onClick={() => setRoutes((rs) => rs.filter((x) => x.id !== r.id))}>Delete</button>
          </div>
          <div className="ms-row">
            <label>Status <input type="number" value={r.status} onChange={(e) => update(r.id, { status: +e.target.value })} /></label>
            <label>Content-Type <input className="ms-input" value={r.contentType} onChange={(e) => update(r.id, { contentType: e.target.value })} /></label>
            <label>Delay (ms) <input type="number" value={r.delay} onChange={(e) => update(r.id, { delay: +e.target.value })} /></label>
          </div>
          <textarea className="ms-textarea" value={r.body} onChange={(e) => update(r.id, { body: e.target.value })} spellCheck={false} />
          <div className="ms-gap">
            <strong>Headers</strong>
            {r.headers.map((h, i) => (
              <div key={i} className="ms-row ms-gap">
                <input type="checkbox" checked={h.enabled} onChange={(e) => update(r.id, { headers: r.headers.map((x, xi) => (xi === i ? { ...x, enabled: e.target.checked } : x)) })} />
                <input className="ms-input" placeholder="Key" value={h.key} onChange={(e) => update(r.id, { headers: r.headers.map((x, xi) => (xi === i ? { ...x, key: e.target.value } : x)) })} />
                <input className="ms-input" placeholder="Value" value={h.value} onChange={(e) => update(r.id, { headers: r.headers.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)) })} />
                <button type="button" className="ms-btn secondary" onClick={() => update(r.id, { headers: r.headers.filter((_, xi) => xi !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="ms-btn secondary ms-gap" onClick={() => update(r.id, { headers: [...r.headers, { key: '', value: '', enabled: true }] })}>+ Header</button>
          </div>
        </div>
      ))}
      <button type="button" className="ms-btn" onClick={() => setRoutes((rs) => [...rs, newRoute()])}>+ Add route</button>
      <div className="ms-panel">
        <div className="ms-row"><strong>Request log ({log.length})</strong><button type="button" className="ms-btn secondary" onClick={() => setLog([])}>Clear</button></div>
        {log.length === 0 && <p className="ms-muted">No requests yet.</p>}
        {log.map((e, i) => (
          <details key={i} className="ms-log">
            <summary><code>{new Date(e.time).toLocaleTimeString()}</code> <b>{e.method}</b> {e.url} <span className={e.matched ? 'ms-ok' : 'ms-err'}>{e.matched ? `→ ${e.matched}` : '→ no match'}</span></summary>
            <pre className="ms-out">{JSON.stringify(e.headers, null, 2)}{e.body ? `\n\n${e.body}` : ''}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}

export function HttpMockServer() {
  if (!window.electron?.isElectron) {
    return (
      <div className="ms-container">
        <h2 className="ms-title">🎭 HTTP Mock Server</h2>
        <p className="ms-notice">This utility requires the desktop app.</p>
      </div>
    );
  }
  return <HttpMockServerInner />;
}
