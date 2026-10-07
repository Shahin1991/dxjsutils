import React, { useCallback, useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { SETS, entropyBits, generatePassword, strengthLabel } from './utils/password';

export function PasswordGenerator() {
  const [opts, setOpts] = useState({ length: 20, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false });
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState(0); // bump to regenerate

  const result = useMemo(() => {
    try {
      return { list: Array.from({ length: count }, () => generatePassword(opts)) };
    } catch (e) {
      return { error: e.message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, count, seed]);

  const set = useCallback((k, v) => setOpts((o) => ({ ...o, [k]: v })), []);
  const pool = ['lower', 'upper', 'digits', 'symbols'].filter((k) => opts[k]).reduce((n, k) => n + SETS[k].length, 0);
  const bits = entropyBits(pool, opts.length);
  const [label, cls] = strengthLabel(bits);

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔑 Password Generator</h2>
      <p className="tl-desc">Random passwords from your browser's secure random number generator. They are never sent anywhere.</p>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check">Length: <b>{opts.length}</b>
            <input type="range" min="4" max="64" value={opts.length} onChange={(e) => set('length', Number(e.target.value))} aria-label="Password length" />
          </label>
          <label className="tl-check">Count
            <input type="number" min="1" max="20" value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 70 }} />
          </label>
        </div>
        <div className="tl-row">
          {[['lower', 'a–z'], ['upper', 'A–Z'], ['digits', '0–9'], ['symbols', '!@#$']].map(([k, l]) => (
            <label key={k} className="tl-check"><input type="checkbox" checked={opts[k]} onChange={(e) => set(k, e.target.checked)} /> {l}</label>
          ))}
          <label className="tl-check"><input type="checkbox" checked={opts.avoidAmbiguous} onChange={(e) => set('avoidAmbiguous', e.target.checked)} /> Avoid look-alikes (0 O 1 l I)</label>
        </div>
        <button type="button" className="tl-btn" onClick={() => setSeed((s) => s + 1)}>🔄 Generate</button>
        {result.error ? (
          <div className="tl-err tl-gap">⚠ {result.error}</div>
        ) : (
          <>
            <p className="tl-gap">Strength: <b className={cls}>{label}</b> <span className="tl-muted">(~{bits} bits)</span></p>
            <div className="tl-pw-list">
              {result.list.map((p, i) => (
                <div key={`${seed}-${i}`} className="tl-pw-item">
                  <div className="tl-password">{p}</div>
                  <CopyButton text={p} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
