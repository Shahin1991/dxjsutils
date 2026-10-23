import React, { useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { FileDrop } from '../../components/FileDrop';
import { ALGOS, checksums, normalizeHash } from './utils/checksum';
import { formatBytes } from '../pdfTools/utils/pages';

const MAX = 1024 ** 3; // 1 GB: files are read into memory

export function FileChecksum() {
  const [files, setFiles] = useState([]); // { id, name, size, hashes?, error? }
  const [expected, setExpected] = useState('');
  const [busy, setBusy] = useState(0);
  const want = normalizeHash(expected);

  const add = async (list) => {
    const entries = list.map((f) => ({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, size: f.size, file: f }));
    setFiles((cur) => [...entries.map(({ file, ...rest }) => rest), ...cur]);
    for (const e of entries) {
      setBusy((n) => n + 1);
      try {
        if (e.size > MAX) throw new Error('Files over 1 GB are not supported');
        // eslint-disable-next-line no-await-in-loop
        const hashes = await checksums(await e.file.arrayBuffer());
        setFiles((cur) => cur.map((x) => (x.id === e.id ? { ...x, hashes } : x)));
      } catch (err) {
        setFiles((cur) => cur.map((x) => (x.id === e.id ? { ...x, error: err.message } : x)));
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  const matchCount = want ? files.filter((f) => f.hashes && Object.values(f.hashes).includes(want)).length : 0;

  return (
    <div className="tl-container">
      <h2 className="tl-title">🧾 File Checksum</h2>
      <p className="tl-desc">Get MD5, SHA-1, SHA-256, SHA-512 and CRC32 checksums of files, and check them against a published value. Files never leave your device.</p>
      <div className="tl-panel">
        <FileDrop multiple onFiles={add} hint="Drop one or more files here or" />
        <label className="tl-label" htmlFor="fc-expected">Expected checksum (optional)</label>
        <input id="fc-expected" type="text" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Paste the checksum from the download page" spellCheck={false} style={{ width: '100%' }} />
        {expected.trim() && !want && <div className="tl-err tl-gap">⚠ That is not a hex or Base64 checksum</div>}
        {want && files.some((f) => f.hashes) && (
          <div className={`tl-gap ${matchCount ? 'tl-ok' : 'tl-err'}`}><b>{matchCount ? `✓ Matches ${matchCount} file${matchCount === 1 ? '' : 's'}` : '✗ No file matches this checksum'}</b></div>
        )}
        {busy > 0 && <p className="tl-muted tl-gap">Calculating…</p>}
      </div>
      {files.map((f) => (
        <div key={f.id} className="tl-panel">
          <div className="tl-row">
            <strong>{f.name}</strong>
            <span className="tl-muted">{formatBytes(f.size)}</span>
            <button type="button" className="tl-btn secondary" onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`}>✕</button>
          </div>
          {f.error && <div className="tl-err">⚠ {f.error}</div>}
          {!f.hashes && !f.error && <span className="tl-muted">Calculating…</span>}
          {f.hashes && (
            <table className="tl-table">
              <tbody>
                {ALGOS.map((a) => (
                  <tr key={a} className={want && f.hashes[a] === want ? 'uc-hl' : ''}>
                    <th>{a}{want && f.hashes[a] === want ? ' ✓' : ''}</th>
                    <td><code className="fc-hash">{f.hashes[a]}</code></td>
                    <td><CopyButton text={f.hashes[a]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
