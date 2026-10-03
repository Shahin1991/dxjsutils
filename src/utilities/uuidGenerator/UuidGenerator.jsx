import React, { useState } from 'react';
import { copyText } from '../../utils/clipboard';

function uuidv4() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const b = window.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function generate(count) {
  return Array.from({ length: count }, uuidv4);
}

export function UuidGenerator() {
  const [count, setCount] = useState(5);
  const [upper, setUpper] = useState(false);
  const [noHyphens, setNoHyphens] = useState(false);
  const [uuids, setUuids] = useState(() => generate(5));
  const [copied, setCopied] = useState('');

  const fmt = (u) => {
    let s = noHyphens ? u.replace(/-/g, '') : u;
    if (upper) s = s.toUpperCase();
    return s;
  };

  const copy = async (text, key) => {
    await copyText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1200);
  };

  return (
    <div className="uu-container">
      <h2 className="uu-title">🆔 UUID Generator</h2>
      <p className="uu-desc">RFC 4122 version 4 UUIDs.</p>
      <div className="uu-panel uu-row">
        <label>Count <input type="number" min="1" max="1000" value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)))} /></label>
        <label><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase</label>
        <label><input type="checkbox" checked={noHyphens} onChange={(e) => setNoHyphens(e.target.checked)} /> No hyphens</label>
        <button type="button" className="uu-btn" onClick={() => setUuids(generate(count))}>Generate</button>
        <button type="button" className="uu-btn secondary" onClick={() => copy(uuids.map(fmt).join('\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy all'}</button>
      </div>
      <div className="uu-panel">
        {uuids.map((u, i) => (
          <div key={i} className="uu-item">
            <code>{fmt(u)}</code>
            <button type="button" className="uu-btn secondary" onClick={() => copy(fmt(u), i)}>{copied === i ? 'Copied!' : 'Copy'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
