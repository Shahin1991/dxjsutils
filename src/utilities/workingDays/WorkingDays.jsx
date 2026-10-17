import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { useToolState } from '../../utils/toolState';
import { WEEKEND_PRESETS, addWorkingDays, countWorkingDays, parseDate, parseExtraOff, toISO } from './utils/workdays';

const today = () => toISO(new Date());
const nice = (d) => format(d, 'EEE d MMM yyyy');

function HolidayList({ list }) {
  if (!list.length) return null;
  return (
    <details className="tl-gap">
      <summary>{list.length} public holiday{list.length === 1 ? '' : 's'} on working days</summary>
      <ul>{list.map(([d, name]) => <li key={d}>{nice(parseDate(d))}: {name}</li>)}</ul>
    </details>
  );
}

export function WorkingDays() {
  const [mode, setMode] = useToolState('mode', 'count');
  const [start, setStart] = useToolState('start', today);
  const [end, setEnd] = useToolState('end', () => toISO(new Date(new Date().getFullYear(), 11, 31)));
  const [days, setDays] = useToolState('days', '10');
  const [weekend, setWeekend] = useToolState('weekend', 'sat-sun');
  const [holidays, setHolidays] = useToolState('holidays', true);
  const [extra, setExtra] = useToolState('extra', '');

  const result = useMemo(() => {
    try {
      const a = parseDate(start);
      if (!a) throw new Error('Pick a start date');
      const opts = { weekend: WEEKEND_PRESETS[weekend].days, holidays, extraOff: parseExtraOff(extra) };
      if (mode === 'count') {
        const b = parseDate(end);
        if (!b) throw new Error('Pick an end date');
        return { count: countWorkingDays(a, b, opts) };
      }
      const n = Number(days);
      if (!Number.isInteger(n)) throw new Error('Number of days must be a whole number');
      return { add: addWorkingDays(a, n, opts) };
    } catch (e) {
      return { error: e.message };
    }
  }, [mode, start, end, days, weekend, holidays, extra]);

  return (
    <div className="tl-container">
      <h2 className="tl-title">🗓️ Working Days Calculator</h2>
      <p className="tl-desc">Count business days between two dates, or find the date N working days from now, skipping weekends and UAE public holidays.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['count', 'Count working days'], ['add', 'Add working days']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>
        <div className="tl-row">
          <label className="tl-check">{mode === 'count' ? 'From' : 'Start'} <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          {mode === 'count' ? (
            <label className="tl-check">To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          ) : (
            <label className="tl-check">Working days (negative to go back)
              <input type="number" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 100 }} />
            </label>
          )}
        </div>
        <div className="tl-row">
          <label className="tl-check">Weekend
            <select value={weekend} onChange={(e) => setWeekend(e.target.value)}>
              {Object.entries(WEEKEND_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
            </select>
          </label>
          <label className="tl-check"><input type="checkbox" checked={holidays} onChange={(e) => setHolidays(e.target.checked)} /> Skip UAE public holidays</label>
        </div>
        <label className="tl-label" htmlFor="wd-extra">Extra days off, e.g. your leave (YYYY-MM-DD, separated by commas or spaces)</label>
        <input id="wd-extra" type="text" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="2026-12-24, 2026-12-25" style={{ width: '100%' }} />
      </div>
      <div className="tl-panel" aria-live="polite">
        {result.error && <div className="tl-err">⚠ {result.error}</div>}
        {result.count && (
          <>
            <div className="tl-grid">
              <div className="tl-stat"><b>Working days</b><span>{result.count.working}</span></div>
              <div className="tl-stat"><b>Calendar days</b><span>{result.count.total}</span></div>
              <div className="tl-stat"><b>Weekend days</b><span>{result.count.weekend}</span></div>
              <div className="tl-stat"><b>Public holidays</b><span>{result.count.holidays.length}</span></div>
              {result.count.leave > 0 && <div className="tl-stat"><b>Extra days off</b><span>{result.count.leave}</span></div>}
            </div>
            <p className="tl-muted tl-gap">Both the start and end dates are included.</p>
            <HolidayList list={result.count.holidays} />
          </>
        )}
        {result.add && (
          <>
            <div className="tl-password">{nice(result.add.date)}</div>
            <p className="tl-muted tl-gap">{days} working day{Math.abs(Number(days)) === 1 ? '' : 's'} {Number(days) < 0 ? 'before' : 'after'} {nice(parseDate(start))} (the start day is not counted).</p>
            <HolidayList list={result.add.holidaysSkipped} />
          </>
        )}
        {holidays && <p className="tl-muted">Islamic holidays follow the Umm al-Qura calendar and can move by a day once the moon is sighted.</p>}
      </div>
    </div>
  );
}
