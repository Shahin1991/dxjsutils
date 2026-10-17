import React, { useState } from 'react';
import { FileDrop } from '../../components/FileDrop';
import { downloadFile } from '../../utils/clipboard';
import { useToolState } from '../../utils/toolState';
import { extractPages, mergePdfs, pdfInfo, removePages, rotatePages } from './utils/pdf';
import { formatBytes, parsePageRanges } from './utils/pages';

const MODES = [
  ['merge', 'Merge PDFs'],
  ['extract', 'Extract / reorder pages'],
  ['remove', 'Remove pages'],
  ['rotate', 'Rotate pages'],
];

const baseName = (name) => name.replace(/\.pdf$/i, '');

export function PdfTools() {
  const [mode, setMode] = useToolState('mode', 'merge');
  const [files, setFiles] = useState([]); // { id, name, size, bytes, pages }
  const [pages, setPages] = useState('1');
  const [angle, setAngle] = useState(90);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok | error }

  const single = mode !== 'merge';
  const file = files[0];

  const add = async (list) => {
    setMsg(null);
    const loaded = [];
    for (const f of list) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const bytes = new Uint8Array(await f.arrayBuffer());
        // eslint-disable-next-line no-await-in-loop
        const info = await pdfInfo(bytes);
        loaded.push({ id: `${f.name}-${Date.now()}-${Math.random()}`, name: f.name, size: f.size, bytes, pages: info.pages });
      } catch (e) {
        setMsg({ error: `${f.name}: ${e.message}` });
      }
    }
    setFiles((cur) => (single ? loaded.slice(0, 1) : [...cur, ...loaded]));
    if (single && loaded[0]) setPages(mode === 'extract' ? `1-${loaded[0].pages}` : '1');
  };

  const changeMode = (m) => {
    setMode(m);
    setMsg(null);
    if (m !== 'merge') setFiles((cur) => cur.slice(0, 1));
  };

  const move = (i, d) => setFiles((cur) => {
    const next = [...cur];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let out;
      let name;
      if (mode === 'merge') {
        out = await mergePdfs(files.map((f) => f.bytes));
        name = 'merged.pdf';
      } else {
        const idx = parsePageRanges(pages, file.pages);
        if (mode === 'extract') {
          out = await extractPages(file.bytes, idx);
          name = `${baseName(file.name)}-pages.pdf`;
        } else if (mode === 'remove') {
          out = await removePages(file.bytes, idx);
          name = `${baseName(file.name)}-edited.pdf`;
        } else {
          out = await rotatePages(file.bytes, idx, angle);
          name = `${baseName(file.name)}-rotated.pdf`;
        }
      }
      downloadFile(name, new Blob([out], { type: 'application/pdf' }));
      setMsg({ ok: `Saved ${name} (${formatBytes(out.length)})` });
    } catch (e) {
      setMsg({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const ready = mode === 'merge' ? files.length >= 2 : Boolean(file);

  return (
    <div className="tl-container">
      <h2 className="tl-title">📄 PDF Tools</h2>
      <p className="tl-desc">Merge PDFs, pull out or reorder pages, remove pages and rotate them. Files never leave your device.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {MODES.map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => changeMode(id)}>{label}</button>
          ))}
        </div>
        <FileDrop key={mode} accept=".pdf,application/pdf" multiple={!single} onFiles={add} hint={single ? 'Drop a PDF here or' : 'Drop PDFs here (in any order) or'} />
        {files.length > 0 && (
          <table className="tl-table">
            <thead><tr><th>#</th><th>File</th><th>Pages</th><th>Size</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={f.id}>
                  <td>{i + 1}</td>
                  <td>{f.name}</td>
                  <td>{f.pages}</td>
                  <td>{formatBytes(f.size)}</td>
                  <td className="pdf-actions">
                    {!single && <button type="button" className="tl-btn secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.name} up`}>↑</button>}
                    {!single && <button type="button" className="tl-btn secondary" disabled={i === files.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.name} down`}>↓</button>}
                    <button type="button" className="tl-btn secondary" onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {single && file && (
          <div className="tl-row tl-gap">
            <label className="tl-check">
              {mode === 'extract' ? 'Pages to keep, in order' : mode === 'remove' ? 'Pages to remove' : 'Pages to rotate'}
              <input type="text" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="e.g. 1-3, 5, 8-" style={{ width: 200 }} />
            </label>
            {mode === 'rotate' && (
              <select value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label="Rotation">
                <option value={90}>90° clockwise</option>
                <option value={180}>180°</option>
                <option value={-90}>90° anticlockwise</option>
              </select>
            )}
            <span className="tl-muted">of {file.pages}</span>
          </div>
        )}
        <div className="tl-row tl-gap">
          <button type="button" className="tl-btn" disabled={!ready || busy} onClick={run}>
            {busy ? 'Working…' : mode === 'merge' ? `Merge ${files.length || ''} PDFs & download` : 'Apply & download'}
          </button>
          {mode === 'merge' && files.length < 2 && <span className="tl-muted">Add at least two PDFs.</span>}
        </div>
        {msg?.error && <div className="tl-err">⚠ {msg.error}</div>}
        {msg?.ok && <div className="tl-ok">✓ {msg.ok}</div>}
      </div>
    </div>
  );
}
