import { holidayFor } from '../../../utils/uaeHolidays';

export const WEEKEND_PRESETS = {
  'sat-sun': { label: 'Saturday & Sunday (UAE since 2022)', days: [6, 0] },
  'fri-sat': { label: 'Friday & Saturday', days: [5, 6] },
  fri: { label: 'Friday only', days: [5] },
  sun: { label: 'Sunday only', days: [0] },
  none: { label: 'No weekend', days: [] },
};

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[3]) ? null : d;
}

export function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayInfo(d, weekend, holidays, extraOff) {
  if (weekend.includes(d.getDay())) return { off: true, reason: 'weekend' };
  const h = holidays ? holidayFor(d) : null;
  if (h) return { off: true, reason: 'holiday', name: h };
  if (extraOff.has(toISO(d))) return { off: true, reason: 'leave' };
  return { off: false };
}

// Count working days from start to end, both inclusive. Works in either direction.
export function countWorkingDays(start, end, { weekend = [6, 0], holidays = true, extraOff = [] } = {}) {
  const extra = new Set(extraOff);
  const [a, b] = start <= end ? [start, end] : [end, start];
  const res = { working: 0, weekend: 0, holidays: [], leave: 0, total: 0 };
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    res.total += 1;
    const info = dayInfo(d, weekend, holidays, extra);
    if (!info.off) res.working += 1;
    else if (info.reason === 'weekend') res.weekend += 1;
    else if (info.reason === 'holiday') res.holidays.push([toISO(d), info.name]);
    else res.leave += 1;
    if (res.total > 366 * 50) throw new Error('Range is too long (max 50 years)');
  }
  return res;
}

// Add (or subtract) N working days; the start day itself is not counted.
export function addWorkingDays(start, n, { weekend = [6, 0], holidays = true, extraOff = [] } = {}) {
  if (weekend.length >= 7) throw new Error('Every day is a weekend');
  if (Math.abs(n) > 20000) throw new Error('Use at most 20,000 days');
  const extra = new Set(extraOff);
  const step = n < 0 ? -1 : 1;
  const d = new Date(start);
  let left = Math.abs(n);
  const skipped = [];
  while (left > 0) {
    d.setDate(d.getDate() + step);
    const info = dayInfo(d, weekend, holidays, extra);
    if (info.off) {
      if (info.reason === 'holiday') skipped.push([toISO(d), info.name]);
    } else left -= 1;
  }
  return { date: d, holidaysSkipped: skipped };
}

export function parseExtraOff(text) {
  return String(text).split(/[\s,]+/).filter(Boolean).map((s) => {
    if (!parseDate(s)) throw new Error(`"${s}" is not a date in YYYY-MM-DD format`);
    return s;
  });
}
