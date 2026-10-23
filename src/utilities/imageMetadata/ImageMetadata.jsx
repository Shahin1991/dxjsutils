import React, { useEffect, useState } from 'react';
import { FileDrop } from '../../components/FileDrop';
import { downloadFile } from '../../utils/clipboard';
import { readMetadata, stripMetadata } from './utils/exif';
import { formatBytes } from '../pdfTools/utils/pages';

// Formats without a lossless stripper are re-drawn on a canvas, which drops all metadata.
async function reencode(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This image format cannot be opened here'));
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const type = file.type === 'image/webp' ? 'image/webp' : 'image/png';
    return await new Promise((resolve) => c.toBlob(resolve, type, 0.95));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageMetadata() {
  const [item, setItem] = useState(null); // { file, bytes, info, url }
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => () => item && URL.revokeObjectURL(item.url), [item]);

  const open = async ([file]) => {
    setError('');
    setDone('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let info;
      try {
        info = readMetadata(bytes);
      } catch (e) {
        info = { format: file.type, rows: [], blocks: [], warning: `Could not read metadata: ${e.message}` };
      }
      setItem({ file, bytes, info: info || { format: file.type || 'Unknown', rows: [], blocks: [], unsupported: true }, url: URL.createObjectURL(file) });
    } catch (e) {
      setError(e.message);
    }
  };

  const clean = async () => {
    setError('');
    try {
      const name = item.file.name.replace(/(\.[^.]+)?$/, (ext) => `-clean${ext || ''}`);
      const stripped = !item.info.unsupported && stripMetadata(item.bytes);
      if (stripped) {
        downloadFile(name, new Blob([stripped], { type: item.file.type }));
        setDone(`Saved ${name} (${formatBytes(stripped.length)}, was ${formatBytes(item.bytes.length)}). Image quality is unchanged.`);
      } else {
        const blob = await reencode(item.file);
        const ext = blob.type === 'image/webp' ? '.webp' : '.png';
        const n = item.file.name.replace(/\.[^.]+$/, '') + `-clean${ext}`;
        downloadFile(n, blob);
        setDone(`Saved ${n}. This format was re-drawn, which removes all metadata.`);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const info = item?.info;
  const sensitive = info?.rows.some((r) => r.sensitive);

  return (
    <div className="tl-container">
      <h2 className="tl-title">🕵️ Image Metadata</h2>
      <p className="tl-desc">See the hidden data in a photo (GPS location, camera, dates) and download a clean copy before you share it.</p>
      <div className="tl-panel">
        <FileDrop accept="image/*" onFiles={open} hint="Drop a photo here or" />
        {error && <div className="tl-err">⚠ {error}</div>}
      </div>
      {item && (
        <div className="tl-panel">
          <div className="im-head">
            <img src={item.url} alt="Preview" className="im-preview" />
            <div>
              <strong>{item.file.name}</strong>
              <p className="tl-muted">{info.format} · {formatBytes(item.bytes.length)}</p>
              {info.blocks.length > 0 && <p>Contains: {[...new Set(info.blocks)].join(', ')}</p>}
              {sensitive && <p className="tl-warn">⚠ This image contains personal data such as location or serial numbers.</p>}
              {!info.unsupported && !info.rows.length && !info.blocks.filter((b) => !b.includes('kept')).length && <p className="tl-ok">✓ No metadata found.</p>}
              {info.unsupported && <p className="tl-muted">Metadata can only be listed for JPEG and PNG. A clean copy can still be made.</p>}
              {info.warning && <p className="tl-warn">{info.warning}</p>}
              <div className="tl-row tl-gap">
                <button type="button" className="tl-btn" onClick={clean}>🧹 Download clean copy</button>
                {info.location && (
                  <a className="tl-btn secondary" href={`https://www.openstreetmap.org/?mlat=${info.location.lat}&mlon=${info.location.lon}#map=15/${info.location.lat}/${info.location.lon}`} target="_blank" rel="noreferrer noopener" title="Opens OpenStreetMap in your browser (sends these coordinates to openstreetmap.org)">
                    🗺 Show on map
                  </a>
                )}
              </div>
              {done && <div className="tl-ok">✓ {done}</div>}
            </div>
          </div>
          {info.rows.length > 0 && (
            <table className="tl-table tl-gap">
              <tbody>
                {info.rows.map((r, i) => (
                  <tr key={`${r.label}-${i}`} className={r.sensitive ? 'im-sensitive' : ''}><th>{r.sensitive ? '⚠ ' : ''}{r.label}</th><td>{r.value}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
