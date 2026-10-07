import React, { useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { decode, encodeComponent, encodeFull, parseUrl } from './utils/url';

export function UrlTools() {
  const [mode, setMode] = useState('encode');
  const [full, setFull] = useState(false);
  const [input, setInput] = useState('https://example.com/search?q=hello world&lang=en');

  const result = useMemo(() => {
    try {
      if (mode === 'parse') return { parsed: parseUrl(input) };
      if (!input) return { out: '' };
      return { out: mode === 'decode' ? decode(input) : full ? encodeFull(input) : encodeComponent(input) };
    } catch (e) {
      return { error: e.message };
    }
  }, [input, mode, full]);

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔗 URL Encode / Decode</h2>
      <p className="tl-desc">Percent-encode text, decode it back, or break a URL into its parts.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['encode', 'Encode'], ['decode', 'Decode'], ['parse', 'Parse URL']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => setMode(id)}>{label}</button>
          ))}
          {mode === 'encode' && (
            <label className="tl-check" title="Keeps characters like : / ? & # so a whole URL stays usable">
              <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Keep URL characters (encode whole URL)
            </label>
          )}
        </div>
        <label className="tl-label" htmlFor="url-in">Input</label>
        <textarea id="url-in" className="tl-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        {result.error && <div className="tl-err tl-gap">⚠ {result.error}</div>}
        {result.out !== undefined && !result.error && (
          <>
            <label className="tl-label tl-gap">Output</label>
            <pre className="tl-out">{result.out}</pre>
            <div className="tl-gap"><CopyButton text={result.out} label="Copy output" /></div>
          </>
        )}
      </div>
      {result.parsed && (
        <>
          <div className="tl-panel">
            <table className="tl-table">
              <tbody>
                {Object.entries(result.parsed.parts).filter(([, v]) => v).map(([k, v]) => (
                  <tr key={k}><th>{k}</th><td><code>{v}</code></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.parsed.params.length > 0 && (
            <div className="tl-panel">
              <strong>Query parameters</strong>
              <table className="tl-table tl-gap">
                <tbody>
                  {result.parsed.params.map(([k, v], i) => <tr key={`${k}-${i}`}><th>{k}</th><td><code>{v}</code></td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
