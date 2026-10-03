import React, { useState } from 'react';

const fmtName = (o) => (o ? Object.entries(o).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(', ') : v}`).join(', ') : '—');

function CertInspectorInner() {
  const [host, setHost] = useState('emirates.com');
  const [port, setPort] = useState('443');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await window.electron.certInspect(host.trim(), parseInt(port, 10) || 443);
      if (res?.error) setError(res.error);
      else setData(res);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const c = data?.certificate;
  const expiry = c?.valid_to ? new Date(c.valid_to) : null;
  const days = expiry ? Math.floor((expiry - new Date()) / 86400000) : null;
  const sans = c?.subjectaltname ? c.subjectaltname.split(/,\s*/).map((s) => s.replace(/^DNS:/, '')) : [];

  return (
    <div className="cert-container">
      <h2 className="cert-title">📜 Certificate Inspector</h2>
      <div className="cert-panel cert-row">
        <input className="cert-input cert-host" value={host} onChange={(e) => setHost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="host" />
        <input className="cert-input cert-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" />
        <button type="button" className="cert-btn" onClick={run} disabled={loading}>{loading ? 'Connecting…' : 'Inspect'}</button>
      </div>
      {error && <p className="cert-err">⚠ {error}</p>}
      {c && (
        <div className="cert-panel">
          <div className="cert-grid">
            <div className="cert-stat"><b>Subject</b>{fmtName(c.subject)}</div>
            <div className="cert-stat"><b>Issuer</b>{fmtName(c.issuer)}</div>
            <div className="cert-stat"><b>Valid from</b>{c.valid_from}</div>
            <div className="cert-stat"><b>Valid to</b>{c.valid_to}</div>
            <div className="cert-stat"><b>Expiry</b><span className={days < 0 ? 'cert-err' : days < 30 ? 'cert-warn' : 'cert-ok'}>{days < 0 ? `Expired ${-days} days ago` : `${days} days remaining`}</span></div>
            <div className="cert-stat"><b>Protocol</b>{data.protocol}</div>
            <div className="cert-stat"><b>Cipher</b>{data.cipher}</div>
            <div className="cert-stat"><b>Trusted by system</b>{data.authorized ? 'Yes' : 'No'}</div>
            <div className="cert-stat"><b>Serial number</b>{c.serialNumber}</div>
            <div className="cert-stat"><b>Key size</b>{c.bits ? `${c.bits} bits` : '—'}</div>
          </div>
          <div className="cert-stat cert-gap"><b>SHA-1 fingerprint</b><code>{c.fingerprint}</code></div>
          <div className="cert-stat cert-gap"><b>SHA-256 fingerprint</b><code>{c.fingerprint256}</code></div>
          <div className="cert-stat cert-gap"><b>Subject alternative names ({sans.length})</b>{sans.join(', ') || '—'}</div>
          {c.chain?.length > 0 && (
            <div className="cert-stat cert-gap"><b>Chain</b>{c.chain.map((x, i) => <div key={i}>{i + 1}. {fmtName(x.subject)}</div>)}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function CertInspector() {
  if (!window.electron?.isElectron) {
    return (
      <div className="cert-container">
        <h2 className="cert-title">📜 Certificate Inspector</h2>
        <p className="cert-notice">This utility requires the desktop app.</p>
      </div>
    );
  }
  return <CertInspectorInner />;
}
