import { read, utils, write } from 'xlsx';

export const ACCEPT = '.xlsx,.xlsm,.xlsb,.xls,.ods,.csv,.tsv,.txt';

export function readWorkbook(data) {
  try {
    return read(data, { type: 'array', cellDates: true, dense: true });
  } catch (e) {
    if (/password|encrypt/i.test(e.message)) throw new Error('This file is password-protected. Remove the password in Excel first.');
    throw new Error('This file could not be read as a spreadsheet');
  }
}

// Rows as arrays of display strings (what Excel shows, not raw serial numbers).
export function sheetRows(wb, name) {
  return utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false });
}

// 0 -> A, 25 -> Z, 26 -> AA
export function columnName(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function exportSheet(wb, name, format) {
  const ws = wb.Sheets[name];
  if (format === 'csv') return { data: utils.sheet_to_csv(ws), type: 'text/csv', ext: 'csv' };
  if (format === 'json') return { data: JSON.stringify(utils.sheet_to_json(ws, { defval: null }), null, 2), type: 'application/json', ext: 'json' };
  const out = utils.book_new();
  utils.book_append_sheet(out, ws, name.slice(0, 31));
  return { data: write(out, { type: 'array', bookType: 'xlsx' }), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
}

// Pasted JSON (array of objects / array of arrays) or CSV/TSV -> workbook with one sheet.
export function workbookFromText(text, sheetName = 'Sheet1') {
  const t = text.trim();
  if (!t) throw new Error('Paste CSV or JSON first');
  let ws;
  if (t[0] === '[' || t[0] === '{') {
    let v;
    try {
      v = JSON.parse(t);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    const arr = Array.isArray(v) ? v : [v];
    if (arr.length && arr.every(Array.isArray)) ws = utils.aoa_to_sheet(arr);
    else if (arr.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      // Flatten nested values so every cell holds a primitive.
      ws = utils.json_to_sheet(arr.map((o) => Object.fromEntries(Object.entries(o).map(([k, val]) => [k, val && typeof val === 'object' ? JSON.stringify(val) : val]))));
    } else throw new Error('JSON must be an array of objects or an array of rows');
  } else {
    const wb = read(t, { type: 'string', raw: false });
    ws = wb.Sheets[wb.SheetNames[0]];
  }
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

export function workbookToXlsx(wb) {
  return write(wb, { type: 'array', bookType: 'xlsx' });
}
