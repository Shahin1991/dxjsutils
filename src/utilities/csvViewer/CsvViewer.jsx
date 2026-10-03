import React, { useMemo, useState } from 'react';
import { detectDelimiter, parseCsv } from './utils/csv';

const SAMPLE = 'name,city,age\nAlice,Dubai,30\nBob,London,25\n"Carol, Jr.",Paris,41\n';
const DELIMS = [['auto', 'Auto-detect'], [',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']];

export function CsvViewer() {
  const [text, setText] = useState(SAMPLE);
  const [delim, setDelim] = useState('auto');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ col: null, dir: 1 });

  const used = delim === 'auto' ? detectDelimiter(text) : delim;
  const rows = useMemo(() => parseCsv(text, used), [text, used]);
  const header = rows[0] || [];
  const body = useMemo(() => {
    let data = rows.slice(1);
    const f = filter.trim().toLowerCase();
    if (f) data = data.filter((r) => r.some((c) => c.toLowerCase().includes(f)));
    if (sort.col !== null) {
      data = [...data].sort((a, b) => {
        const x = a[sort.col] ?? '';
        const y = b[sort.col] ?? '';
        const nx = parseFloat(x);
        const ny = parseFloat(y);
        const cmp = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y);
        return cmp * sort.dir;
      });
    }
    return data;
  }, [rows, filter, sort]);

  const onFile = (e) => {
    const file = e.target.files[0];
    if (file) file.text().then(setText);
  };

  const clickHeader = (i) => setSort((s) => (s.col === i ? { col: i, dir: -s.dir } : { col: i, dir: 1 }));

  return (
    <div className="cv-container">
      <h2 className="cv-title">📋 CSV Viewer</h2>
      <div className="cv-panel">
        <textarea className="cv-textarea" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div className="cv-row cv-gap">
          <input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={onFile} />
          <select value={delim} onChange={(e) => setDelim(e.target.value)}>{DELIMS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select>
          <input type="search" placeholder="Filter rows…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <span className="cv-muted">{body.length} of {Math.max(rows.length - 1, 0)} rows · delimiter: {used === '\t' ? 'tab' : used}</span>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="cv-panel cv-scroll">
          <table className="cv-table">
            <thead>
              <tr>{header.map((h, i) => <th key={i} className="cv-th" onClick={() => clickHeader(i)}>{h} {sort.col === i ? (sort.dir === 1 ? '▲' : '▼') : ''}</th>)}</tr>
            </thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{header.map((_, ci) => <td key={ci}>{r[ci]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
