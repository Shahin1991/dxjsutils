import React, { useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, getISOWeek, startOfMonth } from 'date-fns';

const NOTES_KEY = 'calendarNotes';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const FIXED_HOLIDAYS = { '1-1': "New Year's Day", '12-2': 'UAE National Day', '12-3': 'UAE National Day' };

const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric' });

// UAE Islamic holidays derived from the Umm al-Qura calendar (dates may shift by a day with moon sighting).
function islamicHoliday(date) {
  const p = {};
  hijriFmt.formatToParts(date).forEach((x) => {
    p[x.type] = parseInt(x.value, 10);
  });
  const { month: m, day: d } = p;
  if (m === 1 && d === 1) return 'Islamic New Year';
  if (m === 3 && d === 12) return "Prophet's Birthday";
  if (m === 10 && d <= 3) return 'Eid Al Fitr';
  if (m === 12 && d === 9) return 'Arafat Day';
  if (m === 12 && d >= 10 && d <= 12) return 'Eid Al Adha';
  return null;
}

function holidayFor(date) {
  return FIXED_HOLIDAYS[`${date.getMonth() + 1}-${date.getDate()}`] || islamicHoliday(date);
}

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
  } catch (e) {
    return {};
  }
}

export function Calendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState(loadNotes);

  const weeks = useMemo(() => {
    const first = startOfMonth(month);
    const lead = (first.getDay() + 6) % 7;
    const days = endOfMonth(month).getDate();
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= days; d += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [month]);

  const setNote = (text) => {
    const next = { ...notes };
    if (text) next[selected] = text;
    else delete next[selected];
    setNotes(next);
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(next));
    } catch (e) {
      // storage unavailable
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const selDate = new Date(`${selected}T00:00:00`);
  const selHoliday = holidayFor(selDate);

  return (
    <div className="cal-container">
      <h2 className="cal-title">📆 Calendar</h2>
      <p className="cal-desc">UAE weekends (Sat–Sun), public holidays, ISO week numbers and personal notes.</p>
      <div className="cal-panel">
        <div className="cal-row">
          <button type="button" className="cal-btn secondary" onClick={() => setMonth((m) => addMonths(m, -12))}>«</button>
          <button type="button" className="cal-btn secondary" onClick={() => setMonth((m) => addMonths(m, -1))}>‹</button>
          <strong className="cal-month">{format(month, 'MMMM yyyy')}</strong>
          <button type="button" className="cal-btn secondary" onClick={() => setMonth((m) => addMonths(m, 1))}>›</button>
          <button type="button" className="cal-btn secondary" onClick={() => setMonth((m) => addMonths(m, 12))}>»</button>
          <button
            type="button"
            className="cal-btn"
            onClick={() => {
              setMonth(startOfMonth(new Date()));
              setSelected(today);
            }}
          >
            Today
          </button>
        </div>
        <table className="cal-month-grid">
          <thead>
            <tr>
              <th className="cal-wk">Wk</th>
              {WEEKDAYS.map((d) => (
                <th key={d} className={d === 'Sat' || d === 'Sun' ? 'cal-weekend-h' : ''}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row, i) => {
              const firstDay = row.find(Boolean);
              return (
                <tr key={i}>
                  <td className="cal-wk">{firstDay ? getISOWeek(firstDay) : ''}</td>
                  {row.map((d, j) => {
                    if (!d) return <td key={j} className="cal-empty" />;
                    const key = format(d, 'yyyy-MM-dd');
                    const h = holidayFor(d);
                    const cls = ['cal-day', j >= 5 ? 'weekend' : '', h ? 'holiday' : '', key === today ? 'today' : '', key === selected ? 'selected' : '']
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <td key={j} className={cls} onClick={() => setSelected(key)} title={h || ''}>
                        <span className="cal-num">{d.getDate()}</span>
                        {h && <span className="cal-hol">{h}</span>}
                        {notes[key] && <span className="cal-dot">●</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="cal-panel">
        <strong>{format(selDate, 'EEEE, d MMMM yyyy')}</strong>
        {selHoliday && <span className="cal-ok"> — {selHoliday}</span>}
        <textarea
          className="cal-textarea"
          placeholder="Add a note for this day…"
          value={notes[selected] || ''}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </div>
  );
}
