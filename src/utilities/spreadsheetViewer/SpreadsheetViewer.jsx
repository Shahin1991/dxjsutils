import React, { useMemo, useState } from 'react';
import { FileDrop } from '../../components/FileDrop';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { downloadFile } from '../../utils/clipboard';
import { ACCEPT, columnName, exportSheet, readWorkbook, sheetRows, workbookFromText, workbookToXlsx } from './utils/sheet';

const MAX_ROWS = 1000;
const SAMPLE = '[{"flight":"XX202","from":"DXB","to":"JFK","pax":489},{"flight":"XX001","from":"DXB","to":"LHR","pax":517}]';

function SheetTable({ rows, headerRow, query }) {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const head = headerRow && rows.length ? rows[0] : null;
  const body = head ? rows.slice(1) : rows;
  const q = query.trim().toLowerCase();
  const filtered = q ? body.filter((r) => r.some((c) => String(c).toLowerCase().includes(q))) : body;
  const shown = filtered.slice(0, MAX_ROWS);
  return (
    <>
      <p className="tl-muted">
        {filtered.length.toLocaleString()} row{filtered.length === 1 ? '' : 's'}{q ? ' match' : ''} · {width} column{width === 1 ? '' : 's'}
        {filtered.length > MAX_ROWS && ` · showing the first ${MAX_ROWS.toLocaleString()} (export to get all)`}
      </p>
      <div className="ss-wrap">
        <table className="tl-table ss-table">
          <thead>
            <tr>
              <th className="ss-rownum">#</th>
              {Array.from({ length: width }, (_, i) => <th key={i}>{head ? head[i] || columnName(i) : columnName(i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                <td className="ss-rownum">{i + 1 + (head ? 1 : 0)}</td>
                {Array.from({ length: width }, (_, j) => <td key={j}>{r[j]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function SpreadsheetViewer() {
  const [mode, setMode] = useState('open');
  const [file, setFile] = useState(null); // { name, wb }
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [text, setText] = useState(SAMPLE);

  const rows = useMemo(() => (file && sheet ? sheetRows(file.wb, sheet) : []), [file, sheet]);

  const open = async ([f]) => {
    setError('');
    try {
      const wb = readWorkbook(new Uint8Array(await f.arrayBuffer()));
      setFile({ name: f.name, wb });
      setSheet(wb.SheetNames[0]);
      setQuery('');
    } catch (e) {
      setFile(null);
      setError(`${f.name}: ${e.message}`);
    }
  };

  const save = (format) => {
    const out = exportSheet(file.wb, sheet, format);
    const base = file.name.replace(/\.[^.]+$/, '');
    downloadFile(`${base}${file.wb.SheetNames.length > 1 ? `-${sheet}` : ''}.${out.ext}`, new Blob([out.data], { type: out.type }));
  };

  const create = () => {
    setError('');
    try {
      const wb = workbookFromText(text);
      downloadFile('data.xlsx', new Blob([workbookToXlsx(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="tl-container ss-container">
      <h2 className="tl-title">📗 Spreadsheet Viewer</h2>
      <p className="tl-desc">Open Excel, ODS and CSV files, and convert sheets to CSV, JSON or XLSX. Files never leave your device.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['open', 'Open a spreadsheet'], ['create', 'Create XLSX from CSV / JSON']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => { setMode(id); setError(''); }}>{label}</button>
          ))}
        </div>
        {mode === 'open' ? (
          <>
            <FileDrop accept={ACCEPT} onFiles={open} hint="Drop an .xlsx, .xls, .ods or .csv file here or" />
            {file && (
              <>
                <div className="tl-row">
                  <strong>{file.name}</strong>
                  {file.wb.SheetNames.length > 1 && (
                    <select value={sheet} onChange={(e) => setSheet(e.target.value)} aria-label="Sheet">
                      {file.wb.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                  <label className="tl-check"><input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} /> First row is a header</label>
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter rows…" aria-label="Filter rows" />
                </div>
                <div className="tl-row">
                  <span className="tl-muted">Download this sheet as</span>
                  {['csv', 'json', 'xlsx'].map((f) => <button key={f} type="button" className="tl-btn secondary" onClick={() => save(f)}>{f.toUpperCase()}</button>)}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <label className="tl-label" htmlFor="ss-text">Paste CSV, TSV or a JSON array</label>
            <ClearableTextarea id="ss-text" className="tl-textarea" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            <div className="tl-row tl-gap"><button type="button" className="tl-btn" onClick={create} disabled={!text.trim()}>Download as XLSX</button></div>
          </>
        )}
        {error && <div className="tl-err">⚠ {error}</div>}
      </div>
      {mode === 'open' && file && (
        <div className="tl-panel">
          {rows.length ? <SheetTable rows={rows} headerRow={headerRow} query={query} /> : <span className="tl-muted">This sheet is empty.</span>}
        </div>
      )}
    </div>
  );
}
