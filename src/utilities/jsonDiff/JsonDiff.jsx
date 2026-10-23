import React, { useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { diffJson, parseSide, preview } from './utils/jsonDiff';

const LEFT = '{\n  "flight": "XX202",\n  "status": "scheduled",\n  "gate": "B12",\n  "crew": [{ "id": 1, "role": "captain" }, { "id": 2, "role": "fo" }],\n  "meals": ["VGML", "KSML"]\n}';
const RIGHT = '{\n  "flight": "XX202",\n  "status": "boarding",\n  "crew": [{ "id": 2, "role": "fo" }, { "id": 1, "role": "Captain" }],\n  "meals": ["VGML", "KSML", "DBML"],\n  "terminal": 3\n}';
const SIGN = { added: '+', removed: '−', changed: '~' };

export function JsonDiff() {
  const [left, setLeft] = useToolState('left', LEFT);
  const [right, setRight] = useToolState('right', RIGHT);
  const [arrayKey, setArrayKey] = useToolState('arrayKey', 'id');
  const [ignoreCase, setIgnoreCase] = useToolState('ignoreCase', false);
  const [filter, setFilter] = useToolState('filter', 'all');

  const result = useMemo(() => {
    try {
      const changes = diffJson(parseSide(left, 'Original'), parseSide(right, 'Changed'), { arrayKey: arrayKey.trim(), ignoreCase });
      return { changes };
    } catch (e) {
      return { error: e.message };
    }
  }, [left, right, arrayKey, ignoreCase]);

  const counts = result.changes ? result.changes.reduce((c, x) => ({ ...c, [x.op]: (c[x.op] || 0) + 1 }), {}) : {};
  const shown = result.changes ? result.changes.filter((c) => filter === 'all' || c.op === filter) : [];
  const report = () => shown.map((c) => `${SIGN[c.op]} ${c.path}: ${c.op === 'changed' ? `${preview(c.before)} → ${preview(c.after)}` : preview(c.op === 'added' ? c.after : c.before)}`).join('\n');

  return (
    <div className="tl-container">
      <h2 className="tl-title">🧮 JSON Diff</h2>
      <p className="tl-desc">Compare two JSON documents by structure and see exactly which fields were added, removed or changed.</p>
      <div className="tl-panel">
        <div className="tl-split">
          <div>
            <label className="tl-label" htmlFor="jd-left">Original</label>
            <ClearableTextarea id="jd-left" className="tl-textarea jd-area" value={left} onChange={(e) => setLeft(e.target.value)} spellCheck={false} />
          </div>
          <div>
            <label className="tl-label" htmlFor="jd-right">Changed</label>
            <ClearableTextarea id="jd-right" className="tl-textarea jd-area" value={right} onChange={(e) => setRight(e.target.value)} spellCheck={false} />
          </div>
        </div>
        <div className="tl-row tl-gap">
          <label className="tl-check" title="Match objects inside arrays by this field instead of by position. Leave empty to compare by position.">
            Match array items by key <input type="text" value={arrayKey} onChange={(e) => setArrayKey(e.target.value)} placeholder="e.g. id" style={{ width: 90 }} />
          </label>
          <label className="tl-check"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> Ignore case in text</label>
          <button type="button" className="tl-btn secondary" onClick={() => { setLeft(right); setRight(left); }}>⇄ Swap</button>
        </div>
      </div>
      <div className="tl-panel">
        {result.error ? <div className="tl-err">⚠ {result.error}</div> : (
          <>
            <div className="tl-row">
              {[['all', `All (${result.changes.length})`], ['added', `Added (${counts.added || 0})`], ['removed', `Removed (${counts.removed || 0})`], ['changed', `Changed (${counts.changed || 0})`]].map(([id, label]) => (
                <button key={id} type="button" className={`tl-btn ${filter === id ? '' : 'secondary'}`} onClick={() => setFilter(id)}>{label}</button>
              ))}
              <CopyButton text={report} label="Copy report" />
            </div>
            {result.changes.length === 0 ? <p className="tl-ok">✓ The documents are identical{ignoreCase ? ' (ignoring case)' : ''}.</p> : (
              <table className="tl-table">
                <tbody>
                  {shown.map((c) => (
                    <tr key={`${c.op}${c.path}`} className={`jd-${c.op}`}>
                      <td className="jd-sign" aria-label={c.op}>{SIGN[c.op]}</td>
                      <td><code>{c.path}</code></td>
                      <td>
                        {c.op === 'changed' ? (
                          <><code className="jd-before">{preview(c.before)}</code> → <code className="jd-after">{preview(c.after)}</code></>
                        ) : <code>{preview(c.op === 'added' ? c.after : c.before)}</code>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
