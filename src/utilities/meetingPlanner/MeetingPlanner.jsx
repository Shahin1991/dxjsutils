import React, { useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { readJSON, writeJSON } from '../../utils/storage';
import { allZones, buildGrid, cityOf } from './utils/zones';

const DEFAULT_ZONES = ['Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Kolkata'];
const today = () => new Date().toISOString().slice(0, 10);
const hh = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export function MeetingPlanner() {
  // The zone list is a preference, so it is remembered on this device.
  const [zones, setZonesState] = useState(() => readJSON('meetingPlannerZones', DEFAULT_ZONES));
  const [day, setDay] = useToolState('day', today);
  const [start, setStart] = useToolState('start', 9);
  const [end, setEnd] = useToolState('end', 18);
  const [adding, setAdding] = useState('');
  const options = useMemo(allZones, []);

  const setZones = (z) => {
    setZonesState(z);
    writeJSON('meetingPlannerZones', z);
  };
  const add = (z) => {
    if (z && !zones.includes(z)) setZones([...zones, z]);
    setAdding('');
  };
  const moveFirst = (z) => setZones([z, ...zones.filter((x) => x !== z)]);

  const grid = useMemo(() => (zones.length && day ? buildGrid(day, zones, { start, end }) : []), [day, zones, start, end]);
  const best = grid.filter((r) => r.allWork);
  // With no perfect hour, the rows with the most people in (or near) working hours are the best compromise.
  const topScore = best.length ? null : Math.max(...grid.map((r) => r.score));
  const isAlt = (r) => topScore !== null && topScore > 0 && r.score === topScore;
  const summary = (row) => row.cells.map((c, i) => `${cityOf(zones[i])} ${hh(c.hour, c.minute)} ${c.weekday}`).join(' · ');

  return (
    <div className="tl-container mp-container">
      <h2 className="tl-title">🤝 Meeting Planner</h2>
      <p className="tl-desc">Find a meeting time that works across time zones. Green is working hours, amber is early or late, grey is night or weekend.</p>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check">Date <input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label className="tl-check">Working hours
            <select value={start} onChange={(e) => setStart(Number(e.target.value))} aria-label="Start of working day">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h, 0)}</option>)}
            </select>
            –
            <select value={end} onChange={(e) => setEnd(Number(e.target.value))} aria-label="End of working day">
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{hh(h % 24, 0)}</option>)}
            </select>
          </label>
          <label className="tl-check">Add a city / zone
            <input list="mp-zones" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(options.find((z) => z.toLowerCase() === adding.trim().toLowerCase() || cityOf(z).toLowerCase() === adding.trim().toLowerCase()))} placeholder="e.g. Tokyo" style={{ width: 180 }} />
          </label>
          <datalist id="mp-zones">{options.map((z) => <option key={z} value={z}>{cityOf(z)}</option>)}</datalist>
          <button type="button" className="tl-btn secondary" onClick={() => add(options.find((z) => z === adding.trim() || cityOf(z).toLowerCase() === adding.trim().toLowerCase()))}>+ Add</button>
        </div>
        <p className="tl-muted">
          {best.length ? `✓ ${best.length} hour${best.length === 1 ? '' : 's'} inside everyone’s working hours (★).` : 'No hour is inside everyone’s working hours; ☆ marks the best compromise.'}
          {' '}Rows follow {cityOf(zones[0] || '')} time; click a zone header to make it the reference.
        </p>
      </div>
      {zones.length > 0 && (
        <div className="tl-panel mp-wrap">
          <table className="mp-grid">
            <thead>
              <tr>
                {zones.map((z, i) => (
                  <th key={z}>
                    <button type="button" className="mp-zone" onClick={() => moveFirst(z)} title={i ? 'Use as reference' : 'Reference zone'}>{i === 0 ? '📍 ' : ''}{cityOf(z)}</button>
                    {zones.length > 1 && <button type="button" className="mp-remove" onClick={() => setZones(zones.filter((x) => x !== z))} aria-label={`Remove ${cityOf(z)}`}>✕</button>}
                  </th>
                ))}
                <th aria-label="Copy" />
              </tr>
            </thead>
            <tbody>
              {grid.map((row) => (
                <tr key={row.at.getTime()} className={row.allWork ? 'mp-best' : isAlt(row) ? 'mp-alt' : ''}>
                  {row.cells.map((c, i) => (
                    <td key={zones[i]} className={`mp-${c.kind}`}>
                      {i === 0 && row.allWork ? '★ ' : i === 0 && isAlt(row) ? '☆ ' : ''}{hh(c.hour, c.minute)}
                      {c.day !== row.cells[0].day && <span className="mp-day"> {c.weekday}</span>}
                    </td>
                  ))}
                  <td><CopyButton text={summary(row)} label="" className="mp-copy" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
