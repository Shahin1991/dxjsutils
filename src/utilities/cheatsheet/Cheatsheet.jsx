import React, { useMemo, useState } from 'react';
import { CHEATSHEET } from './utils/data';
import { copyText } from '../../utils/clipboard';

export function Cheatsheet() {
  const [query, setQuery] = useState('');
  const [tool, setTool] = useState('All');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(CHEATSHEET)
      .filter(([name]) => tool === 'All' || tool === name)
      .map(([name, items]) => [name, items.filter(([c, d]) => !q || c.toLowerCase().includes(q) || d.toLowerCase().includes(q) || name.toLowerCase().includes(q))])
      .filter(([, items]) => items.length);
  }, [query, tool]);

  return (
    <div className="cs-container">
      <h2 className="cs-title">📚 Cheatsheet</h2>
      <div className="cs-panel cs-row">
        <input type="search" className="cs-input cs-search" placeholder="Search commands…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={tool} onChange={(e) => setTool(e.target.value)}><option>All</option>{Object.keys(CHEATSHEET).map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {groups.length === 0 && <p className="cs-muted">No commands match.</p>}
      {groups.map(([name, items]) => (
        <div key={name} className="cs-panel">
          <strong>{name}</strong>
          <table className="cs-table">
            <tbody>
              {items.map(([cmd, desc]) => (
                <tr key={cmd}>
                  <td><code>{cmd}</code></td>
                  <td>{desc}</td>
                  <td><button type="button" className="cs-btn secondary" onClick={() => copyText(cmd)}>Copy</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
