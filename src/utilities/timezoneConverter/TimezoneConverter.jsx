import React, { useMemo, useState } from 'react';
import { COMMON_ZONES, formatInZone, offsetLabel, toLocalInputValue, zonedToUtc } from '../../utils/timezone';

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function TimezoneConverter() {
  const zones = useMemo(
    () => (COMMON_ZONES.some((z) => z.tz === LOCAL_TZ) ? COMMON_ZONES : [{ tz: LOCAL_TZ, label: `Local (${LOCAL_TZ})` }, ...COMMON_ZONES]),
    []
  );
  const [source, setSource] = useState(LOCAL_TZ);
  const [value, setValue] = useState(() => toLocalInputValue(new Date(), LOCAL_TZ));
  const [targets, setTargets] = useState(['UTC', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Kolkata', 'Asia/Tokyo']);

  const instant = useMemo(() => (value ? zonedToUtc(value, source) : null), [value, source]);

  const changeSource = (tz) => {
    if (instant) setValue(toLocalInputValue(instant, tz));
    setSource(tz);
  };

  const toggle = (tz) => setTargets((t) => (t.includes(tz) ? t.filter((x) => x !== tz) : [...t, tz]));

  return (
    <div className="tz-container">
      <h2 className="tz-title">🌐 Timezone Converter</h2>
      <p className="tz-desc">Convert a date/time from one timezone to many others at once.</p>
      <div className="tz-panel tz-row">
        <div>
          <label className="tz-label">Date &amp; time</label>
          <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <label className="tz-label">Source timezone</label>
          <select value={source} onChange={(e) => changeSource(e.target.value)}>
            {zones.map((z) => <option key={z.tz} value={z.tz}>{z.label}</option>)}
          </select>
        </div>
        <button type="button" className="tz-btn secondary" onClick={() => setValue(toLocalInputValue(new Date(), source))}>Now</button>
      </div>
      <div className="tz-panel">
        <strong>Target timezones</strong>
        <div className="tz-chips">
          {zones.map((z) => (
            <label key={z.tz} className={`tz-chip ${targets.includes(z.tz) ? 'on' : ''}`}>
              <input type="checkbox" checked={targets.includes(z.tz)} onChange={() => toggle(z.tz)} />
              {z.label}
            </label>
          ))}
        </div>
      </div>
      {instant && !isNaN(instant) && (
        <div className="tz-panel">
          <table className="tz-table">
            <thead><tr><th>Zone</th><th>Date &amp; time</th><th>Offset</th></tr></thead>
            <tbody>
              {zones.filter((z) => targets.includes(z.tz)).map((z) => (
                <tr key={z.tz}>
                  <td>{z.label}</td>
                  <td>{formatInZone(instant, z.tz)}</td>
                  <td>{offsetLabel(instant, z.tz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
