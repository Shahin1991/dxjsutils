import React, { useMemo, useState } from 'react';
import { COMMON_ZONES, formatInZone, toLocalInputValue, zonedToUtc } from '../../utils/timezone';
import { copyText } from '../../utils/clipboard';

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const SHOW = ['UTC', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo'];

export function UnixTimestamp() {
  const [epoch, setEpoch] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [tz, setTz] = useState(LOCAL_TZ);
  const [dateVal, setDateVal] = useState(() => toLocalInputValue(new Date(), LOCAL_TZ));

  const parsed = useMemo(() => {
    const n = Number(epoch.trim());
    if (!epoch.trim() || !Number.isFinite(n)) return null;
    const ms = Math.abs(n) >= 1e11 ? n : n * 1000;
    const d = new Date(ms);
    return isNaN(d) ? null : { date: d, unit: Math.abs(n) >= 1e11 ? 'milliseconds' : 'seconds' };
  }, [epoch]);

  const fromDate = useMemo(() => {
    if (!dateVal) return null;
    const d = zonedToUtc(dateVal, tz);
    return isNaN(d) ? null : d;
  }, [dateVal, tz]);

  const zones = COMMON_ZONES.some((z) => z.tz === LOCAL_TZ) ? COMMON_ZONES : [{ tz: LOCAL_TZ, label: `Local (${LOCAL_TZ})` }, ...COMMON_ZONES];

  return (
    <div className="ut-container">
      <h2 className="ut-title">⏱️ Unix Timestamp</h2>
      <div className="ut-panel">
        <strong>Epoch → date</strong>
        <div className="ut-row ut-gap">
          <input className="ut-input" value={epoch} onChange={(e) => setEpoch(e.target.value)} placeholder="Seconds or milliseconds" />
          <button type="button" className="ut-btn secondary" onClick={() => setEpoch(String(Math.floor(Date.now() / 1000)))}>Now (s)</button>
          <button type="button" className="ut-btn secondary" onClick={() => setEpoch(String(Date.now()))}>Now (ms)</button>
        </div>
        {!parsed && epoch.trim() && <div className="ut-err">Invalid timestamp</div>}
        {parsed && (
          <>
            <div className="ut-muted">Interpreted as {parsed.unit} · ISO: {parsed.date.toISOString()}</div>
            <table className="ut-table ut-gap">
              <tbody>
                {[LOCAL_TZ, ...SHOW.filter((z) => z !== LOCAL_TZ)].map((z) => <tr key={z}><td>{z === LOCAL_TZ ? `${z} (local)` : z}</td><td>{formatInZone(parsed.date, z)}</td></tr>)}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="ut-panel">
        <strong>Date → epoch</strong>
        <div className="ut-row ut-gap">
          <input type="datetime-local" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          <select value={tz} onChange={(e) => setTz(e.target.value)}>{zones.map((z) => <option key={z.tz} value={z.tz}>{z.label}</option>)}</select>
        </div>
        {fromDate && (
          <div className="ut-grid ut-gap">
            <div className="ut-stat"><b>Seconds</b>{Math.floor(fromDate.getTime() / 1000)} <button type="button" className="ut-btn secondary" onClick={() => copyText(String(Math.floor(fromDate.getTime() / 1000)))}>Copy</button></div>
            <div className="ut-stat"><b>Milliseconds</b>{fromDate.getTime()} <button type="button" className="ut-btn secondary" onClick={() => copyText(String(fromDate.getTime()))}>Copy</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
