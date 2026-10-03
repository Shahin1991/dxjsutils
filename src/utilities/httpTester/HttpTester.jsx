import React, { useState } from 'react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function Kv({ rows, setRows, label }) {
  const upd = (i, k, v) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  return (
    <div className="ht-panel">
      <strong>{label}</strong>
      {rows.map((r, i) => (
        <div key={i} className="ht-row ht-gap">
          <input type="checkbox" checked={r.on} onChange={(e) => upd(i, 'on', e.target.checked)} />
          <input className="ht-input" placeholder="Key" value={r.key} onChange={(e) => upd(i, 'key', e.target.value)} />
          <input className="ht-input" placeholder="Value" value={r.value} onChange={(e) => upd(i, 'value', e.target.value)} />
          <button type="button" className="ht-btn secondary" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="ht-btn secondary ht-gap" onClick={() => setRows([...rows, { on: true, key: '', value: '' }])}>+ Add</button>
    </div>
  );
}

function prettify(body, headers) {
  const ct = String(headers?.['content-type'] || '');
  if (ct.includes('json') || /^\s*[[{]/.test(body)) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch (e) {
      return body;
    }
  }
  return body;
}

function HttpTesterInner() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [headers, setHeaders] = useState([{ on: true, key: 'Accept', value: '*/*' }]);
  const [auth, setAuth] = useState('none');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [token, setToken] = useState('');
  const [body, setBody] = useState('');
  const [follow, setFollow] = useState(true);
  const [timeout, setTimeoutMs] = useState(30000);
  const [pretty, setPretty] = useState(true);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setRes(null);
    const h = {};
    headers.filter((x) => x.on && x.key).forEach((x) => { h[x.key] = x.value; });
    if (auth === 'basic') h.Authorization = `Basic ${btoa(unescape(encodeURIComponent(`${user}:${pass}`)))}`;
    if (auth === 'bearer') h.Authorization = `Bearer ${token}`;
    const hasBody = body && !['GET', 'HEAD'].includes(method);
    if (hasBody && !Object.keys(h).some((k) => k.toLowerCase() === 'content-type') && /^\s*[[{]/.test(body)) h['Content-Type'] = 'application/json';
    try {
      setRes(await window.electron.httpRequest({ method, url: url.trim(), headers: h, body: hasBody ? body : undefined, followRedirects: follow, timeout }));
    } catch (e) {
      setRes({ error: e.message });
    }
    setLoading(false);
  };

  const statusClass = res && !res.error ? (res.status < 300 ? 'ht-ok' : res.status < 400 ? 'ht-warn' : 'ht-err') : '';

  return (
    <div className="ht-container">
      <h2 className="ht-title">🧪 HTTP Request Tester</h2>
      <div className="ht-panel ht-row">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        <input className="ht-input ht-url" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button type="button" className="ht-btn" onClick={send} disabled={loading}>{loading ? 'Sending…' : 'Send'}</button>
      </div>
      <Kv rows={headers} setRows={setHeaders} label="Headers" />
      <div className="ht-panel">
        <strong>Auth</strong>
        <div className="ht-row ht-gap">
          <select value={auth} onChange={(e) => setAuth(e.target.value)}><option value="none">None</option><option value="basic">Basic</option><option value="bearer">Bearer</option></select>
          {auth === 'basic' && (<><input className="ht-input" placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} /><input className="ht-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} /></>)}
          {auth === 'bearer' && <input className="ht-input ht-url" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} />}
        </div>
      </div>
      <div className="ht-panel">
        <strong>Body</strong>
        <textarea className="ht-textarea ht-gap" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} />
        <div className="ht-row ht-gap">
          <label><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow redirects</label>
          <label>Timeout (ms) <input type="number" value={timeout} onChange={(e) => setTimeoutMs(+e.target.value || 30000)} /></label>
        </div>
      </div>
      {res && (
        <div className="ht-panel">
          {res.error ? <div className="ht-err">⚠ {res.error}</div> : (
            <>
              <div className="ht-row">
                <strong className={statusClass}>{res.status} {res.statusText}</strong>
                <span className="ht-muted">{res.duration} ms · {res.size} bytes</span>
                <label><input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} /> Pretty-print</label>
              </div>
              <strong>Response headers</strong>
              <table className="ht-table ht-gap"><tbody>{Object.entries(res.headers || {}).map(([k, v]) => <tr key={k}><td>{k}</td><td>{Array.isArray(v) ? v.join(', ') : v}</td></tr>)}</tbody></table>
              <strong className="ht-gap ht-block">Body</strong>
              <pre className="ht-out ht-gap">{pretty ? prettify(res.body, res.headers) : res.body}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HttpTester() {
  if (!window.electron?.isElectron) {
    return (
      <div className="ht-container">
        <h2 className="ht-title">🧪 HTTP Request Tester</h2>
        <p className="ht-notice">This utility requires the desktop app.</p>
      </div>
    );
  }
  return <HttpTesterInner />;
}
