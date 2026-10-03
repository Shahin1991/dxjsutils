import React, { useMemo, useState } from 'react';
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInSeconds,
  differenceInWeeks,
  differenceInYears,
  intervalToDuration,
} from 'date-fns';

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function DateDiffCalculator() {
  const [start, setStart] = useState(nowLocal);
  const [end, setEnd] = useState(nowLocal);

  const result = useMemo(() => {
    const a = new Date(start);
    const b = new Date(end);
    if (isNaN(a) || isNaN(b)) return null;
    const [from, to] = a <= b ? [a, b] : [b, a];
    const dur = intervalToDuration({ start: from, end: to });
    return {
      negative: a > b,
      parts: {
        Years: dur.years || 0,
        Months: dur.months || 0,
        Weeks: Math.floor((dur.days || 0) / 7),
        Days: (dur.days || 0) % 7,
        Hours: dur.hours || 0,
        Minutes: dur.minutes || 0,
        Seconds: dur.seconds || 0,
      },
      totals: {
        'Total years': differenceInYears(to, from),
        'Total months': differenceInMonths(to, from),
        'Total weeks': differenceInWeeks(to, from),
        'Total days': differenceInDays(to, from),
        'Total hours': differenceInHours(to, from),
        'Total minutes': differenceInMinutes(to, from),
        'Total seconds': differenceInSeconds(to, from),
      },
    };
  }, [start, end]);

  return (
    <div className="dd-container">
      <h2 className="dd-title">📅 Date Difference Calculator</h2>
      <p className="dd-desc">Find the difference between two dates and times.</p>
      <div className="dd-panel dd-row">
        <div>
          <label className="dd-label">From</label>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="dd-label">To</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button type="button" className="dd-btn secondary" onClick={() => { setStart(nowLocal()); setEnd(nowLocal()); }}>
          Reset to now
        </button>
      </div>
      {!result && <p className="dd-err">Enter two valid dates.</p>}
      {result && (
        <>
          <div className="dd-panel">
            <strong>Breakdown{result.negative ? ' (end is before start)' : ''}</strong>
            <div className="dd-grid dd-spaced">
              {Object.entries(result.parts).map(([k, v]) => (
                <div key={k} className="dd-stat"><b>{k}</b>{v}</div>
              ))}
            </div>
          </div>
          <div className="dd-panel">
            <strong>Totals</strong>
            <div className="dd-grid dd-spaced">
              {Object.entries(result.totals).map(([k, v]) => (
                <div key={k} className="dd-stat"><b>{k}</b>{v.toLocaleString()}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
