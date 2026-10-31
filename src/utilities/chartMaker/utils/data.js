import { detectDelimiter, parseCsv } from '../../csvViewer/utils/csv';
import { formatDate, formatNumber, isDateOnly } from './scale';

// Chart types. `band` = categories along X; the rest can use a continuous X (numbers or dates).
export const CHART_TYPES = [
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'column', label: 'Column', band: true },
  { id: 'stacked', label: 'Stacked column', band: true },
  { id: 'bar', label: 'Bar', band: true },
  { id: 'scatter', label: 'Scatter' },
  // Animated: one frame per X value (a date, period or step), played in order.
  { id: 'bar-race', label: 'Bar race', band: true, race: true },
  { id: 'line-race', label: 'Line race', band: true, race: true },
];

export const AGGREGATIONS = [
  { id: 'sum', label: 'Sum' },
  { id: 'avg', label: 'Average' },
  { id: 'min', label: 'Minimum' },
  { id: 'max', label: 'Maximum' },
  { id: 'count', label: 'Count rows' },
];

// Validated categorical order has 8 slots; scatter puts every pair side by side, and only the first 3 stay distinct.
export const MAX_SERIES = 8;
export const MAX_SCATTER_SERIES = 3;
// A bar race ranks many entries and labels every bar by name, so it can hold far more than 8.
export const MAX_RACE_ENTRIES = 100;
export const MAX_BARS = 60;
export const MAX_POINTS = 5000;
export const OTHER = 'Other';

export const seriesCap = (chart) => (chart === 'scatter' ? MAX_SCATTER_SERIES : chart === 'bar-race' ? MAX_RACE_ENTRIES : MAX_SERIES);
export const isRace = (chart) => Boolean(CHART_TYPES.find((t) => t.id === chart)?.race);

// ---------- Reading input ----------

// Pasted text or a .json file: a JSON array (of objects or of rows) or CSV/TSV.
export function tableFromText(text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('Paste some data first');
  if (t[0] === '[' || t[0] === '{') {
    let v;
    try {
      v = JSON.parse(t);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    const arr = Array.isArray(v) ? v : [v];
    if (!arr.length) throw new Error('The JSON array is empty');
    if (arr.every(Array.isArray)) return { header: true, rows: arr.map((r) => r.map(cell)) };
    if (arr.every((o) => o && typeof o === 'object')) {
      const keys = [];
      arr.forEach((o) => Object.keys(o).forEach((k) => !keys.includes(k) && keys.push(k)));
      return { header: true, rows: [keys, ...arr.map((o) => keys.map((k) => cell(o[k])))] };
    }
    throw new Error('JSON must be an array of objects or an array of rows');
  }
  return { header: true, rows: parseCsv(t, detectDelimiter(t)) };
}

const cell = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : v ?? null);

// Rows (array of arrays) -> { headers, rows } with every row padded to the same width.
export function toTable(aoa, headerRow = true) {
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = (r) => Array.from({ length: width }, (_, i) => (r[i] === '' || r[i] === undefined ? null : r[i]));
  const body = (headerRow ? aoa.slice(1) : aoa).map(pad);
  const seen = {};
  const headers = Array.from({ length: width }, (_, i) => {
    let h = headerRow && aoa[0] && aoa[0][i] != null && String(aoa[0][i]).trim() ? String(aoa[0][i]).trim() : `Column ${i + 1}`;
    if (seen[h]) h = `${h} (${(seen[h] += 1)})`;
    else seen[h] = 1;
    return h;
  });
  return { headers, rows: body.filter((r) => r.some((c) => c != null)) };
}

// ---------- Parsing values ----------

const CURRENCY = /^(?:AED|USD|EUR|GBP|SAR|INR|[$€£¥₹])\s*|\s*(?:AED|USD|EUR|GBP|SAR|INR)$/gi;

// Numbers as people type them: 1,234.5  -12%  $40  (1,200) for negatives  1e6
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(CURRENCY, '').replace(/%$/, '').trim();
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ISO = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;
const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const MON_Y = /^([a-z]{3})[a-z]*\.?[\s-]+(\d{2}|\d{4})$/i; // Jan 2024, January-24
const D_MON_Y = /^(\d{1,2})[\s-]([a-z]{3})[a-z]*\.?[\s-,]+(\d{2}|\d{4})$/i; // 5 Jan 2024, 05-Jan-24

const year4 = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y));

// Dates are kept as UTC milliseconds so the calendar day never shifts with the time zone.
// order: 'dmy' (UAE / UK default) or 'mdy' for slash dates like 03/04/2024.
export function toDate(v, order = 'dmy') {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // Spreadsheet dates arrive as local wall-clock time; keep that wall-clock reading.
    return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds());
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = ISO.exec(s);
  if (m) {
    const [, y, mo, d = '1', h = '0', mi = '0', sec = '0', tz] = m;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
    if (!tz || /z/i.test(tz)) return t;
    const sign = tz[0] === '-' ? -1 : 1;
    const digits = tz.replace(/[^\d]/g, '');
    return t - sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60000;
  }
  m = DMY.exec(s);
  if (m) {
    const [, a, b, y, h = '0', mi = '0', sec = '0'] = m;
    const [d, mo] = order === 'mdy' ? [b, a] : [a, b];
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    return Date.UTC(year4(y), +mo - 1, +d, +h, +mi, +sec);
  }
  m = MON_Y.exec(s);
  if (m && MONTHS.includes(m[1].toLowerCase())) return Date.UTC(year4(m[2]), MONTHS.indexOf(m[1].toLowerCase()), 1);
  m = D_MON_Y.exec(s);
  if (m && MONTHS.includes(m[2].toLowerCase())) return Date.UTC(year4(m[3]), MONTHS.indexOf(m[2].toLowerCase()), +m[1]);
  return null;
}

// Slash dates are ambiguous; any first part above 12 settles it as day-first, any second part above 12 as month-first.
function dateOrder(values) {
  let dmy = false;
  let mdy = false;
  values.forEach((v) => {
    const m = typeof v === 'string' && DMY.exec(v.trim());
    if (m) {
      if (+m[1] > 12) dmy = true;
      if (+m[2] > 12) mdy = true;
    }
  });
  return mdy && !dmy ? 'mdy' : 'dmy';
}

// Column types from their values: 'number', 'date' or 'text'. 80% of non-empty cells must agree.
export function inferColumns({ headers, rows }) {
  return headers.map((name, index) => {
    const vals = rows.map((r) => r[index]).filter((v) => v != null && String(v).trim() !== '');
    const order = dateOrder(vals);
    const col = { name, index, type: 'text', order, filled: vals.length };
    if (!vals.length) return col;
    const nums = vals.filter((v) => !(v instanceof Date) && toNumber(v) != null).length;
    const dates = vals.filter((v) => toDate(v, order) != null).length;
    if (nums / vals.length >= 0.8) col.type = 'number';
    else if (dates / vals.length >= 0.8) col.type = 'date';
    if (col.type === 'number') {
      const n = vals.map(toNumber).filter((x) => x != null);
      col.year = n.every((x) => Number.isInteger(x) && x >= 1000 && x <= 2999);
    }
    if (col.type === 'date') {
      const ts = vals.map((v) => toDate(v, order)).filter((t) => t != null);
      col.dateOnly = ts.every(isDateOnly);
      col.monthly = col.dateOnly && ts.every((t) => new Date(t).getUTCDate() === 1);
    }
    return col;
  });
}

// ---------- Defaults ----------

// The column that best reads as time: a date, else whole years (2019, 2020...).
export const timeColumn = (columns) => columns.find((c) => c.type === 'date') || columns.find((c) => c.type === 'number' && c.year);

/*
 "Long" data repeats each X once per group: Year, City, Passengers. When X repeats and a text
 column names the groups, return that column so each group becomes its own series.
*/
export function longGroupColumn(table, columns, x) {
  if (!table || !columns[x]) return null;
  const distinctX = new Set(table.rows.map((r) => String(r[x]))).size;
  if (distinctX >= table.rows.length) return null;
  const g = columns.find((c) => {
    if (c.type !== 'text' || c.index === x || !c.filled) return false;
    const n = new Set(table.rows.map((r) => r[c.index])).size;
    return n >= 2 && n <= MAX_RACE_ENTRIES && n * distinctX >= table.rows.length * 0.5;
  });
  return g ? g.index : null;
}

export function defaultConfig(columns, table = null) {
  const x = (timeColumn(columns) || columns.find((c) => c.type === 'text' && c.filled) || columns[0] || {}).index ?? 0;
  const groupBy = longGroupColumn(table, columns, x);
  const values = columns.filter((c) => c.type === 'number' && c.index !== x && !(c.year && columns[x]?.type === 'text'));
  const ys = (values.filter((c) => !c.year).length ? values.filter((c) => !c.year) : values).slice(0, groupBy != null ? 1 : 3).map((c) => c.index);
  const xType = columns[x]?.type;
  return {
    chart: xType === 'date' || xType === 'number' ? 'line' : 'column',
    x,
    ys,
    slots: Object.fromEntries(ys.map((c, i) => [c, i])),
    groupBy,
    agg: ys.length ? 'sum' : 'count',
    sort: 'natural',
    zero: true,
    labels: false,
    title: '',
    topN: 10,
    cumulative: false,
    stepMs: 'auto',
  };
}

// Give a newly picked Y column the lowest colour slot not in use, so existing series keep their colour.
export function toggleY(cfg, col, cap) {
  if (cfg.groupBy != null) return { ...cfg, ys: [col], slots: { [col]: 0 } };
  if (cfg.ys.includes(col)) {
    const slots = { ...cfg.slots };
    delete slots[col];
    return { ...cfg, ys: cfg.ys.filter((c) => c !== col), slots };
  }
  if (cfg.ys.length >= cap) return cfg;
  const used = new Set(cfg.ys.map((c) => cfg.slots[c]));
  let slot = 0;
  while (used.has(slot)) slot += 1;
  return { ...cfg, ys: [...cfg.ys, col], slots: { ...cfg.slots, [col]: slot } };
}

// ---------- Building the chart model ----------

function aggregate(values, agg, rowCount) {
  if (agg === 'count') return rowCount;
  if (!values.length) return null;
  if (agg === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (agg === 'min') return Math.min(...values);
  if (agg === 'max') return Math.max(...values);
  return values.reduce((a, b) => a + b, 0);
}

export function xLabel(col, v) {
  if (col.type === 'date') return formatDate(v, col.monthly ? 'month' : col.dateOnly ? 'full' : 'fulltime');
  if (col.type === 'number') return formatNumber(v, { year: col.year });
  return v;
}

/*
 Turns the table and the chosen settings into what the chart draws.
 Returns { kind: 'band'|'number'|'date', xCol, series: [{ name, slot }], rows | points, notes, yName }
   rows (everything but scatter): [{ x, label, values: [y per series] }] in draw order
   points (scatter): per series, [{ x, y, label, row }]
*/
export function buildModel(table, columns, cfg) {
  const xCol = columns[cfg.x];
  const chart = cfg.chart;
  const notes = [];
  if (!xCol) return { kind: 'band', series: [], rows: [], notes: ['Choose a column for the X axis.'] };
  const continuous = !CHART_TYPES.find((t) => t.id === chart).band && (xCol.type === 'number' || xCol.type === 'date');
  const kind = continuous ? xCol.type : 'band';
  const count = cfg.agg === 'count' && chart !== 'scatter';
  const ys = cfg.ys.filter((c) => columns[c]);
  if (!ys.length && !count) return { kind, xCol, series: [], rows: [], notes: ['Pick at least one column to plot.'] };

  const parseX = (v) => {
    if (xCol.type === 'date') return toDate(v, xCol.order);
    if (xCol.type === 'number') return toNumber(v);
    return v == null || String(v).trim() === '' ? null : String(v).trim();
  };
  const groupCol = cfg.groupBy != null && cfg.groupBy !== cfg.x ? columns[cfg.groupBy] : null;
  const groupName = (r) => {
    const g = r[groupCol.index];
    return g == null || String(g).trim() === '' ? '(blank)' : String(groupCol.type === 'date' ? xLabel(groupCol, toDate(g, groupCol.order)) : g).trim();
  };

  // Series definitions: one per Y column, or one per value of the "split by" column.
  let series;
  let seriesOf;
  const yCol = ys[0];
  const cap = seriesCap(chart);
  if (groupCol) {
    const totals = new Map();
    table.rows.forEach((r) => {
      const g = groupName(r);
      const y = count ? 1 : toNumber(r[yCol]);
      totals.set(g, (totals.get(g) || 0) + Math.abs(y || 0));
    });
    let names = [...totals.keys()];
    let keep = new Set(names);
    if (names.length > cap) {
      keep = new Set([...names].sort((a, b) => totals.get(b) - totals.get(a)).slice(0, cap - 1));
      notes.push(`${names.length - keep.size} smaller groups are combined into "${OTHER}" so every colour stays distinct.`);
      names = names.filter((n) => keep.has(n)).concat(OTHER);
    }
    series = names.map((name, i) => ({ name, slot: name === OTHER && !keep.has(OTHER) ? 'other' : i }));
    const idx = new Map(names.map((n, i) => [n, i]));
    seriesOf = (r) => {
      const g = groupName(r);
      return [[idx.get(keep.has(g) ? g : OTHER), count ? null : r[yCol]]];
    };
  } else if (count) {
    series = [{ name: 'Rows', slot: 0 }];
    seriesOf = () => [[0, null]];
  } else {
    series = ys.map((c) => ({ name: columns[c].name, slot: cfg.slots[c] ?? 0 }));
    seriesOf = (r) => ys.map((c, i) => [i, r[c]]);
  }
  const yName = count ? 'Number of rows' : groupCol ? columns[yCol].name : ys.length === 1 ? columns[ys[0]].name : '';

  if (chart === 'scatter') {
    const bandIdx = new Map();
    const points = series.map(() => []);
    let skipped = 0;
    let total = 0;
    table.rows.forEach((r, row) => {
      const xv = parseX(r[xCol.index]);
      if (xv == null) return;
      let x = xv;
      if (!continuous) {
        if (!bandIdx.has(xv)) bandIdx.set(xv, bandIdx.size);
        x = bandIdx.get(xv);
      }
      seriesOf(r).forEach(([s, raw]) => {
        const y = toNumber(raw);
        if (y == null) return;
        total += 1;
        if (total > MAX_POINTS) {
          skipped += 1;
          return;
        }
        points[s].push({ x, y, label: continuous ? xLabel(xCol, xv) : xv, row });
      });
    });
    if (skipped) notes.push(`Showing the first ${MAX_POINTS.toLocaleString()} points; ${skipped.toLocaleString()} more are not drawn.`);
    const categories = [...bandIdx.keys()];
    return { kind, xCol, series, points, categories, notes, yName, agg: null };
  }

  // Group rows by X (and series), then combine each group's values.
  const groups = new Map();
  let dupes = false;
  table.rows.forEach((r) => {
    const xv = parseX(r[xCol.index]);
    if (xv == null) return;
    let g = groups.get(xv);
    if (!g) {
      g = { x: xv, vals: series.map(() => []), counts: series.map(() => 0) };
      groups.set(xv, g);
    }
    seriesOf(r).forEach(([s, raw]) => {
      g.counts[s] += 1;
      if (g.counts[s] > 1) dupes = true; // two rows landed on the same point and were combined
      const y = toNumber(raw);
      if (y != null) g.vals[s].push(y);
    });
  });
  let rows = [...groups.values()].map((g) => ({
    x: g.x,
    label: xCol.type === 'text' ? g.x : xLabel(xCol, g.x),
    values: series.map((_, s) => (g.counts[s] ? aggregate(g.vals[s], cfg.agg, g.counts[s]) : null)),
  }));

  const total = (r) => r.values.reduce((a, v) => a + (v || 0), 0);
  const sort = isRace(chart) ? 'natural' : cfg.sort; // frames always play in time order
  if (continuous || (xCol.type !== 'text' && sort === 'natural')) rows.sort((a, b) => a.x - b.x);
  else if (sort === 'desc') rows.sort((a, b) => total(b) - total(a));
  else if (sort === 'asc') rows.sort((a, b) => total(a) - total(b));
  else if (sort === 'label') rows.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));

  if (!continuous && (chart === 'column' || chart === 'stacked' || chart === 'bar') && rows.length > MAX_BARS) {
    notes.push(`Showing ${MAX_BARS} of ${rows.length.toLocaleString()} categories. Order by value to see the largest, or pick a column with fewer distinct values.`);
    rows = rows.slice(0, MAX_BARS);
  }
  if (dupes && !count) {
    const a = AGGREGATIONS.find((x) => x.id === cfg.agg).label.toLowerCase();
    notes.push(`Rows that share the same ${xCol.name} are combined (${a}).`);
  }
  return { kind, xCol, series, rows, notes, yName, agg: dupes ? cfg.agg : null };
}

// The numbers behind the chart as a table (shown on screen and exported as CSV).
export function modelTable(model) {
  if (model.points) {
    const head = ['Series', model.xCol.name, model.yName || 'Value'];
    const body = [];
    model.series.forEach((s, i) => model.points[i].forEach((p) => body.push([s.name, p.label, p.y])));
    return { head, body };
  }
  return { head: [model.xCol.name, ...model.series.map((s) => s.name)], body: model.rows.map((r) => [r.label, ...r.values]) };
}

export function tableToCsv({ head, body }) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head, ...body].map((r) => r.map(esc).join(',')).join('\n');
}
