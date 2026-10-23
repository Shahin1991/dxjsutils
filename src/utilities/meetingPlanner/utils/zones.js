// Popular zones first; the full IANA list comes from the browser when available.
export const POPULAR_ZONES = [
  'Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'Europe/Paris', 'Asia/Tokyo',
  'America/Los_Angeles', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Manila', 'Africa/Johannesburg', 'Asia/Hong_Kong', 'America/Sao_Paulo', 'Europe/Moscow',
];

export function allZones() {
  try {
    const list = Intl.supportedValuesOf('timeZone');
    return [...new Set([...POPULAR_ZONES, ...list])];
  } catch (e) {
    return POPULAR_ZONES;
  }
}

export const cityOf = (zone) => zone.split('/').pop().replace(/_/g, ' ');

// Local wall-clock parts of an instant in a zone.
export function localParts(date, zone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute), weekday: p.weekday, day: `${p.year}-${p.month}-${p.day}` };
}

// Offset of a zone from UTC in minutes at an instant.
export function zoneOffset(date, zone) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(date);
  const v = Object.fromEntries(p.map((x) => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute);
  return Math.round((asUtc - (date.getTime() - (date.getTime() % 60000))) / 60000);
}

// The UTC instant for local midnight of `isoDay` in `zone` (handles DST).
export function zoneMidnight(isoDay, zone) {
  const [y, m, d] = isoDay.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const off = zoneOffset(guess, zone);
  const t = new Date(guess.getTime() - off * 60000);
  const off2 = zoneOffset(t, zone);
  return off2 === off ? t : new Date(guess.getTime() - off2 * 60000);
}

const FRI_SAT = ['Fri', 'Sat'];
const WEEKENDS = {
  'Asia/Riyadh': FRI_SAT, 'Asia/Qatar': FRI_SAT, 'Asia/Kuwait': FRI_SAT, 'Asia/Bahrain': FRI_SAT, 'Asia/Muscat': FRI_SAT,
  'Asia/Baghdad': FRI_SAT, 'Africa/Cairo': FRI_SAT, 'Asia/Amman': FRI_SAT, 'Asia/Jerusalem': FRI_SAT, 'Asia/Dhaka': FRI_SAT,
  'Asia/Tehran': ['Fri'], 'Asia/Kabul': ['Fri'],
};
// UAE moved to a Saturday–Sunday weekend in 2022, so Asia/Dubai uses the default.
export const weekendFor = (zone) => WEEKENDS[zone] || ['Sat', 'Sun'];

// 'work' (start–end), 'edge' (2 h either side), 'night'. Weekends are never 'work'.
export function classify(hour, weekday, { start = 9, end = 18, weekend = ['Sat', 'Sun'] } = {}) {
  if (weekend.includes(weekday)) return hour >= 8 && hour < 22 ? 'edge' : 'night';
  if (hour >= start && hour < end) return 'work';
  if (hour >= start - 2 && hour < end + 2) return 'edge';
  return 'night';
}

// 24 hourly slots starting at local midnight of `day` in the first zone.
export function buildGrid(day, zones, opts) {
  const start = zoneMidnight(day, zones[0]);
  return Array.from({ length: 24 }, (_, i) => {
    const at = new Date(start.getTime() + i * 3600000);
    const cells = zones.map((z) => {
      const p = localParts(at, z);
      return { ...p, kind: classify(p.hour, p.weekday, { ...opts, weekend: weekendFor(z) }) };
    });
    return { at, cells, allWork: cells.every((c) => c.kind === 'work'), score: cells.reduce((s, c) => s + (c.kind === 'work' ? 2 : c.kind === 'edge' ? 1 : 0), 0) };
  });
}
