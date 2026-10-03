import React, { useMemo, useState } from 'react';
import { copyText } from '../../utils/clipboard';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function KvTable({ rows, setRows, label }) {
  const update = (i, k, v) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  return (
    <div className="cb-panel">
      <strong>{label}</strong>
      {rows.map((r, i) => (
        <div key={i} className="cb-row cb-gap">
          <input type="checkbox" checked={r.on} onChange={(e) => update(i, 'on', e.target.checked)} />
          <input className="cb-input" placeholder="Key" value={r.key} onChange={(e) => update(i, 'key', e.target.value)} />
          <input className="cb-input" placeholder="Value" value={r.value} onChange={(e) => update(i, 'value', e.target.value)} />
          <button type="button" className="cb-btn secondary" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="cb-btn secondary cb-gap" onClick={() => setRows([...rows, { on: true, key: '', value: '' }])}>+ Add</button>
    </div>
  );
}

export function CurlBuilder() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://api.example.com/users');
  const [params, setParams] = useState([{ on: true, key: 'page', value: '1' }]);
  const [headers, setHeaders] = useState([{ on: true, key: 'Accept', value: 'application/json' }]);
  const [body, setBody] = useState('');
  const [auth, setAuth] = useState('none');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [token, setToken] = useState('');
  const [opts, setOpts] = useState({ location: false, insecure: false, compressed: false, verbose: false });

  const command = useMemo(() => {
    let full = url.trim();
    const active = params.filter((p) => p.on && p.key);
    if (active.length) {
      const qs = active.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      full += (full.includes('?') ? '&' : '?') + qs;
    }
    const parts = ['curl'];
    if (method !== 'GET') parts.push(`-X ${method}`);
    parts.push(q(full));
    headers.filter((h) => h.on && h.key).forEach((h) => parts.push(`-H ${q(`${h.key}: ${h.value}`)}`));
    if (auth === 'basic') parts.push(`-u ${q(`${user}:${pass}`)}`);
    if (auth === 'bearer') parts.push(`-H ${q(`Authorization: Bearer ${token}`)}`);
    if (body && !['GET', 'HEAD'].includes(method)) parts.push(`-d ${q(body)}`);
    if (opts.location) parts.push('-L');
    if (opts.insecure) parts.push('-k');
    if (opts.compressed) parts.push('--compressed');
    if (opts.verbose) parts.push('-v');
    return parts.join(' \\\n  ');
  }, [method, url, params, headers, body, auth, user, pass, token, opts]);

  return (
    <div className="cb-container">
      <h2 className="cb-title">🔧 curl Builder</h2>
      <div className="cb-panel cb-row">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        <input className="cb-input cb-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </div>
      <KvTable rows={params} setRows={setParams} label="Query parameters" />
      <KvTable rows={headers} setRows={setHeaders} label="Headers" />
      <div className="cb-panel">
        <strong>Authentication</strong>
        <div className="cb-row cb-gap">
          <select value={auth} onChange={(e) => setAuth(e.target.value)}><option value="none">None</option><option value="basic">Basic</option><option value="bearer">Bearer token</option></select>
          {auth === 'basic' && (<><input className="cb-input" placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} /><input className="cb-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} /></>)}
          {auth === 'bearer' && <input className="cb-input cb-url" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} />}
        </div>
      </div>
      <div className="cb-panel">
        <strong>Body</strong>
        <textarea className="cb-textarea cb-gap" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Request body (ignored for GET/HEAD)" spellCheck={false} />
        <div className="cb-row cb-gap">
          {Object.keys(opts).map((k) => <label key={k}><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} /> {k}</label>)}
        </div>
      </div>
      <div className="cb-panel">
        <pre className="cb-out">{command}</pre>
        <button type="button" className="cb-btn cb-gap" onClick={() => copyText(command)}>Copy command</button>
      </div>
    </div>
  );
}
