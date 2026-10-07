import { dump, load } from 'js-yaml';
import { detectDelimiter, parseCsv } from '../../csvViewer/utils/csv';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function flatten(obj, prefix = '', out = {}) {
  Object.entries(obj).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) flatten(v, key, out);
    else out[key] = v;
  });
  return out;
}

function csvCell(v, delimiter) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.includes(delimiter) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function jsonToCsv(text, delimiter = ',') {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : [data];
  if (list.length === 0) return '';
  const rows = list.map((item) => (isObj(item) ? flatten(item) : { value: item }));
  const headers = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => headers.includes(k) || headers.push(k)));
  const lines = [headers.map((h) => csvCell(h, delimiter)).join(delimiter)];
  rows.forEach((r) => lines.push(headers.map((h) => csvCell(r[h], delimiter)).join(delimiter)));
  return lines.join('\n');
}

const coerce = (s) => {
  if (s === '') return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  return /^-?(0|[1-9]\d*)(\.\d+)?$/.test(s) ? Number(s) : s;
};

export function csvToJson(text, indent = 2) {
  const rows = parseCsv(text, detectDelimiter(text));
  if (rows.length === 0) return '[]';
  const [headers, ...body] = rows;
  const objs = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, coerce(r[i] ?? '')])));
  return JSON.stringify(objs, null, indent);
}

export const jsonToYaml = (text) => dump(JSON.parse(text), { lineWidth: -1 });
export const yamlToJson = (text, indent = 2) => JSON.stringify(load(text), null, indent);

export const MODES = {
  'json-csv': { label: 'JSON → CSV', run: (t) => jsonToCsv(t), from: 'JSON', to: 'CSV' },
  'csv-json': { label: 'CSV → JSON', run: (t) => csvToJson(t), from: 'CSV', to: 'JSON' },
  'json-yaml': { label: 'JSON → YAML', run: jsonToYaml, from: 'JSON', to: 'YAML' },
  'yaml-json': { label: 'YAML → JSON', run: (t) => yamlToJson(t), from: 'YAML', to: 'JSON' },
};
