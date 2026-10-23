import React, { useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { bcryptHash, bcryptVerify, parseBcrypt, tooLong } from './utils/bcrypt';

function Anatomy({ value }) {
  const p = parseBcrypt(value);
  if (!p) return null;
  return (
    <table className="tl-table tl-gap">
      <tbody>
        <tr><th>Version</th><td><code>${p.version}$</code></td></tr>
        <tr><th>Cost</th><td><code>{String(p.cost).padStart(2, '0')}</code> = 2<sup>{p.cost}</sup> = {p.rounds.toLocaleString()} rounds</td></tr>
        <tr><th>Salt</th><td><code>{p.salt}</code></td></tr>
        <tr><th>Hash</th><td><code>{p.hash}</code></td></tr>
      </tbody>
    </table>
  );
}

// Passwords use plain state so nothing lingers after you leave the tool.
export function BcryptTool() {
  const [tab, setTab] = useState('hash');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [cost, setCost] = useState(10);
  const [hashInput, setHashInput] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);

  const run = async () => {
    setResult(null);
    setProgress(0);
    const started = performance.now();
    try {
      if (tab === 'hash') {
        const h = await bcryptHash(password, cost, setProgress);
        setResult({ hash: h, ms: Math.round(performance.now() - started) });
      } else {
        const ok = await bcryptVerify(password, hashInput, setProgress);
        setResult({ match: ok });
      }
    } catch (e) {
      setResult({ error: e.message || String(e) });
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <div className="tl-container">
      <h2 className="tl-title">🧂 Bcrypt Hash &amp; Verify</h2>
      <p className="tl-desc">Hash a password with bcrypt, or check a password against an existing bcrypt hash.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['hash', 'Hash'], ['verify', 'Verify']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${tab === id ? '' : 'secondary'}`} onClick={() => { setTab(id); setResult(null); }}>{label}</button>
          ))}
        </div>
        <div className="tl-row">
          <label className="tl-check">Password
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={{ width: 260 }}
              onKeyDown={(e) => e.key === 'Enter' && !busy && run()} />
          </label>
          <label className="tl-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show</label>
          {tab === 'hash' && (
            <label className="tl-check">Cost <b>{cost}</b>
              <input type="range" min="4" max="15" value={cost} onChange={(e) => setCost(Number(e.target.value))} aria-label="Cost factor" />
            </label>
          )}
        </div>
        {tooLong(password) && <p className="tl-warn">⚠ bcrypt only uses the first 72 bytes of a password; the rest is ignored.</p>}
        {tab === 'verify' && (
          <>
            <label className="tl-label" htmlFor="bc-hash">Bcrypt hash</label>
            <input id="bc-hash" type="text" value={hashInput} onChange={(e) => { setHashInput(e.target.value); setResult(null); }} placeholder="$2b$10$…" spellCheck={false} style={{ width: '100%' }} />
            <Anatomy value={hashInput} />
          </>
        )}
        <div className="tl-row tl-gap">
          <button type="button" className="tl-btn" onClick={run} disabled={busy || (tab === 'verify' && !hashInput.trim())}>
            {busy ? `Working… ${Math.round(progress * 100)}%` : tab === 'hash' ? 'Hash password' : 'Check password'}
          </button>
          {tab === 'hash' && <span className="tl-muted">Cost 10–12 is typical. Each +1 doubles the time.</span>}
        </div>
      </div>
      {result && (
        <div className="tl-panel" aria-live="polite">
          {result.error && <div className="tl-err">⚠ {result.error}</div>}
          {result.hash && (
            <>
              <pre className="tl-out">{result.hash}</pre>
              <div className="tl-row tl-gap"><CopyButton text={result.hash} label="Copy hash" /><span className="tl-muted">Took {result.ms} ms</span></div>
              <Anatomy value={result.hash} />
              <p className="tl-muted">Each hash uses a new random salt, so hashing the same password twice gives different results. That is expected.</p>
            </>
          )}
          {result.match !== undefined && (
            <p className={result.match ? 'tl-ok' : 'tl-err'}><b>{result.match ? '✓ The password matches this hash' : '✗ The password does not match'}</b></p>
          )}
        </div>
      )}
    </div>
  );
}
