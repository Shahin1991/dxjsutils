const NAMES = {
  month: { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 },
  dow: { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 },
};
const FIELDS = [
  { key: 'second', min: 0, max: 59 },
  { key: 'minute', min: 0, max: 59 },
  { key: 'hour', min: 0, max: 23 },
  { key: 'dom', min: 1, max: 31 },
  { key: 'month', min: 1, max: 12, names: NAMES.month },
  { key: 'dow', min: 0, max: 7, names: NAMES.dow },
];

function toNum(tok, def) {
  const u = tok.toUpperCase();
  if (def.names && u in def.names) return def.names[u];
  if (!/^\d+$/.test(tok)) throw new Error(`Invalid value "${tok}" in ${def.key} field`);
  return parseInt(tok, 10);
}

function parseField(text, def) {
  const set = new Set();
  text.split(',').forEach((part) => {
    const [range, stepStr] = part.split('/');
    const step = stepStr === undefined ? 1 : parseInt(stepStr, 10);
    if (!(step > 0)) throw new Error(`Invalid step in ${def.key} field`);
    let lo;
    let hi;
    if (range === '*' || range === '?') {
      lo = def.min;
      hi = def.key === 'dow' ? 6 : def.max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-');
      lo = toNum(a, def);
      hi = toNum(b, def);
    } else {
      lo = toNum(range, def);
      hi = stepStr === undefined ? lo : def.max;
    }
    if (lo < def.min || hi > def.max || lo > hi) throw new Error(`Value out of range in ${def.key} field (${def.min}-${def.max})`);
    for (let v = lo; v <= hi; v += step) set.add(def.key === 'dow' && v === 7 ? 0 : v);
  });
  return set;
}

export function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) throw new Error('Expected 5 or 6 fields');
  const hasSeconds = parts.length === 6;
  const defs = hasSeconds ? FIELDS : FIELDS.slice(1);
  const fields = {};
  defs.forEach((d, i) => {
    fields[d.key] = parseField(parts[i], d);
  });
  if (!hasSeconds) fields.second = new Set([0]);
  const star = (i) => /^[*?]/.test(parts[i]) && !parts[i].includes(',');
  const off = hasSeconds ? 1 : 0;
  return { raw: parts, hasSeconds, fields, domStar: star(2 + off), dowStar: star(4 + off) };
}

const pad = (n) => String(n).padStart(2, '0');
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function list(values, fmt) {
  const v = [...values].sort((a, b) => a - b).map(fmt);
  return v.length <= 1 ? v.join('') : `${v.slice(0, -1).join(', ')} and ${v[v.length - 1]}`;
}

export function describeCron(p) {
  const { raw, hasSeconds, fields } = p;
  const o = hasSeconds ? 1 : 0;
  const bits = [];
  const full = (f, n) => fields[f].size === n;
  if (hasSeconds) {
    bits.push(raw[0] === '*' ? 'Every second' : /^\*\/\d+$/.test(raw[0]) ? `Every ${raw[0].slice(2)} seconds` : `At second ${list(fields.second, String)}`);
  }
  const minRaw = raw[o];
  const hourRaw = raw[o + 1];
  if (minRaw === '*' && hourRaw === '*') bits.push(hasSeconds ? 'of every minute' : 'Every minute');
  else if (/^\*\/\d+$/.test(minRaw) && hourRaw === '*') bits.push(`Every ${minRaw.slice(2)} minutes`);
  else if (full('hour', 24) || hourRaw === '*') bits.push(`At minute ${list(fields.minute, String)} past every hour`);
  else if (fields.minute.size === 1 && fields.hour.size === 1) bits.push(`At ${pad([...fields.hour][0])}:${pad([...fields.minute][0])}`);
  else bits.push(`At minute ${list(fields.minute, String)} past hour ${list(fields.hour, String)}`);
  if (/^\*\/\d+$/.test(minRaw) && hourRaw !== '*') bits[bits.length - 1] = `Every ${minRaw.slice(2)} minutes, during hour ${list(fields.hour, String)}`;
  if (!p.domStar) bits.push(`on day-of-month ${list(fields.dom, String)}`);
  if (!full('month', 12)) bits.push(`in ${list(fields.month, (m) => MONTH_NAMES[m - 1])}`);
  if (!p.dowStar) bits.push(`on ${list(fields.dow, (d) => DOW_NAMES[d])}`);
  return bits.join(', ');
}

export function nextRuns(p, count, from = new Date()) {
  const { fields } = p;
  const out = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = from.getTime() + 4 * 366 * 86400000;
  const seconds = [...fields.second].sort((a, b) => a - b);
  while (out.length < count && d.getTime() < limit) {
    const domOk = fields.dom.has(d.getDate());
    const dowOk = fields.dow.has(d.getDay());
    const dayOk = p.domStar || p.dowStar ? domOk && dowOk : domOk || dowOk;
    if (!fields.month.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayOk) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.hour.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (fields.minute.has(d.getMinutes())) {
      for (const s of seconds) {
        if (out.length < count) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), s));
      }
    }
    d.setMinutes(d.getMinutes() + 1, 0, 0);
  }
  return out;
}
