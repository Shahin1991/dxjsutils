// Axis ticks and number/date formatting. Dates are UTC milliseconds throughout.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');

export const isDateOnly = (t) => t % DAY === 0;

export function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

// Round tick values covering [min, max]; the domain is widened to the outer ticks.
export function niceTicks(min, max, count = 5) {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : 1;
  if (lo === hi) {
    const d = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= d;
    hi += d;
  }
  const step = niceStep((hi - lo) / Math.max(1, count));
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0, v = start; v <= end + step * 1e-6 && i < 50; i += 1, v = start + i * step) ticks.push(+v.toPrecision(12));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

function decimals(step) {
  const s = String(+(+step).toPrecision(12));
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

// Axis ticks pass `step` (fixed decimals, compact from 10,000); tooltips and tables pass nothing (full value).
export function formatNumber(n, { step, compact, year } = {}) {
  if (n == null || !Number.isFinite(n)) return '–';
  if (year) return String(Math.round(n));
  const a = Math.abs(n);
  if (compact) return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  if (step != null) {
    const d = Math.min(decimals(step), 10);
    return n.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  if (a !== 0 && a < 1) return n.toLocaleString('en', { maximumSignificantDigits: 3 });
  return n.toLocaleString('en', { maximumFractionDigits: 2 });
}

export function formatDate(t, unit) {
  const d = new Date(t);
  const Y = d.getUTCFullYear();
  const M = MONTHS[d.getUTCMonth()];
  const D = d.getUTCDate();
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  switch (unit) {
    case 'year':
      return String(Y);
    case 'month':
      return `${M} ${Y}`;
    case 'day':
      return `${D} ${M}`;
    case 'dayhour':
      return `${D} ${M} ${hm}`;
    case 'hour':
    case 'minute':
      return hm;
    case 'fulltime':
      return `${D} ${M} ${Y} ${hm}`;
    default:
      return `${D} ${M} ${Y}`;
  }
}

const APPROX = { minute: 6e4, hour: 36e5, day: DAY, week: 7 * DAY, month: 30.44 * DAY, year: 365.25 * DAY };
const STEPS = [
  ['minute', 1], ['minute', 5], ['minute', 15], ['minute', 30],
  ['hour', 1], ['hour', 3], ['hour', 6], ['hour', 12],
  ['day', 1], ['day', 2], ['week', 1], ['week', 2],
  ['month', 1], ['month', 3], ['month', 6],
  ['year', 1], ['year', 2], ['year', 5], ['year', 10], ['year', 25], ['year', 50], ['year', 100],
];

function floorTo(t, unit, step) {
  const d = new Date(t);
  if (unit === 'month') return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / step) * step, 1);
  if (unit === 'year') return Date.UTC(Math.floor(d.getUTCFullYear() / step) * step, 0, 1);
  if (unit === 'week') {
    const day = Math.floor(t / DAY) * DAY;
    return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY; // Monday
  }
  const size = APPROX[unit] * step;
  return Math.floor(t / size) * size;
}

function addTo(t, unit, step) {
  const d = new Date(t);
  if (unit === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + step, 1);
  if (unit === 'year') return Date.UTC(d.getUTCFullYear() + step, 0, 1);
  return t + APPROX[unit] * step;
}

// Calendar-aligned ticks (whole days, months, years...) inside [min, max].
export function dateTicks(min, max, maxCount = 6) {
  const span = Math.max(max - min, 1);
  const [unit, step] = STEPS.find(([u, s]) => span / (APPROX[u] * s) <= maxCount) || ['year', niceStep(span / APPROX.year / maxCount)];
  const ticks = [];
  let t = floorTo(min, unit, step);
  if (t < min) t = addTo(t, unit, step);
  for (; t <= max && ticks.length < 60; t = addTo(t, unit, step)) ticks.push(t);
  const fmt = unit === 'week' ? 'day' : unit === 'hour' && span > DAY ? 'dayhour' : unit;
  return { unit, step, ticks, format: (v) => formatDate(v, fmt) };
}
