import React, { useMemo, useState } from 'react';
import { compareYaml } from './utils/envParse';

const A = 'env:\n  - name: DB_HOST\n    value: localhost\n  - name: DB_PORT\n    value: "5432"\n  - name: LOG_LEVEL\n    value: info\n';
const B = 'env:\n  - name: DB_HOST\n    value: db.prod.internal\n  - name: DB_PORT\n    value: "5432"\n  - name: FEATURE_X\n    value: "true"\n';

export function YamlComparator() {
  const [left, setLeft] = useState(A);
  const [right, setRight] = useState(B);
  const [onlyDiff, setOnlyDiff] = useState(false);

  const { rows, mode } = useMemo(() => compareYaml(left, right), [left, right]);
  const counts = useMemo(() => rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}), [rows]);
  const visible = onlyDiff ? rows.filter((r) => r.status !== 'same') : rows;

  return (
    <div className="yc-container">
      <h2 className="yc-title">🔄 YAML Comparator</h2>
      <p className="yc-desc">Compares <code>env:</code>/<code>environment:</code> sections (falls back to top-level keys).</p>
      <div className="yc-split">
        <div><label className="yc-label">Left (A)</label><textarea className="yc-textarea" value={left} onChange={(e) => setLeft(e.target.value)} spellCheck={false} /></div>
        <div><label className="yc-label">Right (B)</label><textarea className="yc-textarea" value={right} onChange={(e) => setRight(e.target.value)} spellCheck={false} /></div>
      </div>
      <div className="yc-panel">
        <div className="yc-row">
          <span>Mode: <b>{mode}</b></span>
          <span className="yc-ok">{counts.added || 0} added</span>
          <span className="yc-err">{counts.removed || 0} removed</span>
          <span className="yc-warn">{counts.changed || 0} changed</span>
          <span className="yc-muted">{counts.same || 0} same</span>
          <label><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only differences</label>
        </div>
        <table className="yc-table">
          <thead><tr><th>Key</th><th>A</th><th>B</th><th>Status</th></tr></thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.key} className={`yc-${r.status}`}>
                <td><code>{r.key}</code></td>
                <td>{r.left === undefined ? '—' : r.left}</td>
                <td>{r.right === undefined ? '—' : r.right}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
