import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { downloadFile } from '../../utils/clipboard';

const FORMATS = [['image/png', 'PNG', 'png'], ['image/jpeg', 'JPEG', 'jpg'], ['image/webp', 'WebP', 'webp']];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = url;
  });
}

async function render(file, mime, quality) {
  const { img, url } = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise((res) => canvas.toBlob(res, mime, quality));
  if (!blob) throw new Error(`Your browser can't encode ${mime}`);
  return { blob, width: canvas.width, height: canvas.height };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

export function ImageTools() {
  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(0.8);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const urls = useRef([]);

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  const ext = FORMATS.find((f) => f[0] === format)[2];

  const convert = async () => {
    setBusy(true);
    setError('');
    urls.current.forEach(URL.revokeObjectURL);
    urls.current = [];
    try {
      const out = [];
      for (const f of files) {
        const r = await render(f, format, quality);
        const url = URL.createObjectURL(r.blob);
        urls.current.push(url);
        out.push({ name: f.name.replace(/\.[^.]+$/, '') + '.' + ext, blob: r.blob, url, original: f.size, width: r.width, height: r.height });
      }
      setResults(out);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const toPdf = async () => {
    setBusy(true);
    setError('');
    try {
      const pdf = await PDFDocument.create();
      for (const f of files) {
        // normalise everything to PNG/JPEG which pdf-lib can embed
        const mime = f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const { blob } = await render(f, mime, quality);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const image = mime === 'image/jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      const data = await pdf.save();
      downloadFile('images.pdf', new Blob([data], { type: 'application/pdf' }));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const pick = (e) => {
    setFiles([...e.target.files]);
    setResults([]);
  };

  const lossy = format !== 'image/png';

  return (
    <div className="it-container">
      <h2 className="it-title">🖼️ Image Tools</h2>
      <p className="it-desc">Convert, compress and combine images into a PDF. Everything runs in your browser.</p>
      <div className="it-panel">
        <input type="file" accept="image/*" multiple onChange={pick} />
        {files.length > 0 && <div className="it-muted it-gap">{files.length} file(s): {files.map((f) => `${f.name} (${kb(f.size)})`).join(', ')}</div>}
      </div>
      <div className="it-panel it-row">
        <label>Format <select value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select></label>
        <label>Quality {Math.round(quality * 100)}% <input type="range" min="0.1" max="1" step="0.05" value={quality} disabled={!lossy} onChange={(e) => setQuality(+e.target.value)} /></label>
        <button type="button" className="it-btn" disabled={!files.length || busy} onClick={convert}>Convert / compress</button>
        <button type="button" className="it-btn secondary" disabled={!files.length || busy} onClick={toPdf}>Export as PDF</button>
      </div>
      {error && <p className="it-err">⚠ {error}</p>}
      {results.length > 0 && (
        <div className="it-panel">
          <table className="it-table">
            <thead><tr><th /><th>File</th><th>Size</th><th>Dimensions</th><th /></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.name}>
                  <td><img src={r.url} alt="" className="it-thumb" /></td>
                  <td>{r.name}</td>
                  <td>{kb(r.original)} → {kb(r.blob.size)}</td>
                  <td>{r.width}×{r.height}</td>
                  <td><button type="button" className="it-btn secondary" onClick={() => downloadFile(r.name, r.blob)}>Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
