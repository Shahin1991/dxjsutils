import React, { useMemo } from 'react';
import { useToolState } from '../../utils/toolState';
import { CLASSES, MIME_TYPES, STATUS_CODES } from './utils/data';

const match = (q, ...fields) => fields.some((f) => String(f).toLowerCase().includes(q));

export function HttpStatusCodes() {
  const [tab, setTab] = useToolState('tab', 'status');
  const [query, setQuery] = useToolState('query', '');
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const rows = STATUS_CODES.filter(([code, name, desc]) => !q || match(q, code, name, desc));
    return Object.entries(CLASSES).map(([k, label]) => [k, label, rows.filter(([code]) => String(code)[0] === k)]).filter(([, , r]) => r.length);
  }, [q]);
  const mimes = useMemo(() => MIME_TYPES.filter((r) => !q || match(q, ...r)), [q]);

  return (
    <div className="tl-container">
      <h2 className="tl-title">🚦 HTTP Status Codes &amp; MIME Types</h2>
      <p className="tl-desc">What every HTTP status code means, and the right Content-Type for common file types.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['status', 'Status codes'], ['mime', 'MIME types']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${tab === id ? '' : 'secondary'}`} onClick={() => setTab(id)}>{label}</button>
          ))}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search"
            placeholder={tab === 'status' ? 'Search e.g. 404, redirect, rate limit' : 'Search e.g. pdf, image, xlsx'} style={{ flex: 1, minWidth: 200 }} />
        </div>
      </div>
      {tab === 'status' ? (
        <>
          {groups.map(([k, label, rows]) => (
            <div key={k} className="tl-panel">
              <strong className={`hs-class hs-${k}`}>{k}xx · {label}</strong>
              <table className="tl-table tl-gap">
                <tbody>
                  {rows.map(([code, name, desc]) => (
                    <tr key={code}>
                      <th className={`hs-code hs-${k}`}>{code}</th>
                      <td><b>{name}</b><div className="tl-muted">{desc}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {groups.length === 0 && <div className="tl-panel tl-muted">No status code matches “{query}”.</div>}
        </>
      ) : (
        <div className="tl-panel">
          {mimes.length ? (
            <table className="tl-table">
              <thead><tr><th>Extension</th><th>MIME type</th><th>Kind</th></tr></thead>
              <tbody>
                {mimes.map(([ext, type, desc]) => (
                  <tr key={type}><td>{ext}</td><td><code>{type}</code></td><td>{desc}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <span className="tl-muted">No MIME type matches “{query}”.</span>}
        </div>
      )}
    </div>
  );
}
