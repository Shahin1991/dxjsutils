import React, { useState } from 'react';

const TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'PTR'];

function renderRecord(type, r) {
  if (type === 'MX') return `${r.priority} ${r.exchange}`;
  if (type === 'TXT') return Array.isArray(r) ? r.join('') : String(r);
  if (type === 'SOA') return `${r.nsname} ${r.hostmaster} serial=${r.serial} refresh=${r.refresh} retry=${r.retry} expire=${r.expire} minttl=${r.minttl}`;
  return String(r);
}

function DnsLookupInner() {
  const [host, setHost] = useState('emirates.com');
  const [types, setTypes] = useState(['A', 'AAAA', 'MX', 'TXT', 'NS']);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = (t) => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));

  const run = async () => {
    if (!host.trim() || !types.length) return;
    setLoading(true);
    try {
      setResults(await window.electron.dnsLookup(host.trim(), types));
    } catch (e) {
      setResults({ ERROR: { error: e.message } });
    }
    setLoading(false);
  };

  return (
    <div className="dl-container">
      <h2 className="dl-title">🔎 DNS Lookup</h2>
      <div className="dl-panel">
        <div className="dl-row">
          <input className="dl-input dl-host" value={host} onChange={(e) => setHost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="example.com" />
          <button type="button" className="dl-btn" onClick={run} disabled={loading}>{loading ? 'Resolving…' : 'Lookup'}</button>
        </div>
        <div className="dl-row">
          {TYPES.map((t) => <label key={t}><input type="checkbox" checked={types.includes(t)} onChange={() => toggle(t)} /> {t}</label>)}
        </div>
      </div>
      {results && Object.entries(results).map(([type, res]) => (
        <div key={type} className="dl-panel">
          <strong>{type}</strong>
          {res.error ? <div className="dl-muted">No records ({res.error})</div> : (
            <table className="dl-table"><tbody>{(Array.isArray(res.records) ? res.records : [res.records]).map((r, i) => <tr key={i}><td><code>{renderRecord(type, r)}</code></td></tr>)}</tbody></table>
          )}
        </div>
      ))}
    </div>
  );
}

export function DnsLookup() {
  if (!window.electron?.isElectron) {
    return (
      <div className="dl-container">
        <h2 className="dl-title">🔎 DNS Lookup</h2>
        <p className="dl-notice">This utility requires the desktop app.</p>
      </div>
    );
  }
  return <DnsLookupInner />;
}
