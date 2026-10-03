import React, { useMemo, useState } from 'react';
import { describeCron, nextRuns, parseCron } from './utils/cron';

export function CronParser() {
  const [expr, setExpr] = useState('*/15 9-17 * * MON-FRI');

  const result = useMemo(() => {
    try {
      const parsed = parseCron(expr);
      return { description: describeCron(parsed), runs: nextRuns(parsed, 10) };
    } catch (e) {
      return { error: e.message };
    }
  }, [expr]);

  return (
    <div className="cp-container">
      <h2 className="cp-title">⏰ Cron Parser</h2>
      <p className="cp-desc">5 fields (min hour day month weekday) or 6 fields (sec min hour day month weekday).</p>
      <div className="cp-panel">
        <input className="cp-input cp-expr" value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} />
        {result.error && <div className="cp-err cp-gap">⚠ {result.error}</div>}
        {result.description && <div className="cp-gap"><strong>{result.description}</strong></div>}
      </div>
      {result.runs && (
        <div className="cp-panel">
          <strong>Next executions</strong>
          {result.runs.length === 0 && <p className="cp-muted">No execution found within the next 4 years.</p>}
          <table className="cp-table">
            <tbody>
              {result.runs.map((d, i) => <tr key={i}><td>{i + 1}</td><td>{d.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' })}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
