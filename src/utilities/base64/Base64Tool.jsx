import React, { useMemo, useState } from 'react';
import { copyText } from '../../utils/clipboard';

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function decode(b64) {
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('Input is not valid Base64');
  const bin = atob(clean);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function Base64Tool() {
  const [mode, setMode] = useState('encode');
  const [input, setInput] = useState('Hello, EK! مرحبا');

  const result = useMemo(() => {
    if (!input) return { out: '' };
    try {
      return { out: mode === 'encode' ? encode(input) : decode(input) };
    } catch (e) {
      return { error: e.message === 'The encoded data was not valid for encoding utf-8' ? 'Decoded bytes are not valid UTF-8 text' : e.message };
    }
  }, [input, mode]);

  return (
    <div className="b64-container">
      <h2 className="b64-title">🔐 Base64 Tool</h2>
      <div className="b64-panel">
        <div className="b64-row">
          <button type="button" className={`b64-btn ${mode === 'encode' ? '' : 'secondary'}`} onClick={() => setMode('encode')}>Encode</button>
          <button type="button" className={`b64-btn ${mode === 'decode' ? '' : 'secondary'}`} onClick={() => setMode('decode')}>Decode</button>
          <button type="button" className="b64-btn secondary" onClick={() => { if (result.out !== undefined && !result.error) { setInput(result.out); setMode(mode === 'encode' ? 'decode' : 'encode'); } }}>⇅ Swap</button>
        </div>
        <label className="b64-label">Input</label>
        <textarea className="b64-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <label className="b64-label b64-gap">Output</label>
        {result.error ? <div className="b64-err">⚠ {result.error}</div> : <pre className="b64-out">{result.out}</pre>}
        <button type="button" className="b64-btn b64-gap" disabled={!result.out} onClick={() => copyText(result.out)}>Copy output</button>
      </div>
    </div>
  );
}
