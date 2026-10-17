import React, { useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { PERMS, WHO, fromOctal, fromSymbolic, toOctal, toSymbolic } from './utils/chmod';

const SPECIAL = [['setuid', 'Set UID', 'Run as the file owner'], ['setgid', 'Set GID', 'Run as the group / new files inherit the group'], ['sticky', 'Sticky', 'Only owners can delete their files (e.g. /tmp)']];
const COMMON = ['644', '755', '600', '700', '775', '664', '777', '1777'];

export function ChmodCalculator() {
  const [state, setState] = useToolState('state', () => fromOctal('755'));
  const [octalText, setOctalText] = useState(null); // text being typed, null when in sync
  const [symText, setSymText] = useState(null);
  const [error, setError] = useState('');

  const octal = toOctal(state.perms, state.special);
  const symbolic = toSymbolic(state.perms, state.special);

  const applyFrom = (fn, text, setText) => {
    setText(text);
    try {
      setState(fn(text));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  const sync = () => {
    setOctalText(null);
    setSymText(null);
    setError('');
  };
  const toggle = (w, p) => {
    sync();
    setState((s) => ({ ...s, perms: { ...s.perms, [w]: { ...s.perms[w], [p]: !s.perms[w][p] } } }));
  };
  const toggleSpecial = (k) => {
    sync();
    setState((s) => ({ ...s, special: { ...s.special, [k]: !s.special[k] } }));
  };

  return (
    <div className="tl-container">
      <h2 className="tl-title">🗝️ Chmod Calculator</h2>
      <p className="tl-desc">Work out Unix file permissions: tick boxes, or type an octal (755) or symbolic (rwxr-xr-x) value.</p>
      <div className="tl-panel">
        <table className="tl-table cm-grid">
          <thead>
            <tr><th aria-label="Who" />{PERMS.map(([p, label, bit]) => <th key={p}>{label} ({bit})</th>)}</tr>
          </thead>
          <tbody>
            {WHO.map(([w, label]) => (
              <tr key={w}>
                <th>{label}</th>
                {PERMS.map(([p, plabel]) => (
                  <td key={p}><input type="checkbox" checked={state.perms[w][p]} onChange={() => toggle(w, p)} aria-label={`${label} ${plabel}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tl-row tl-gap">
          {SPECIAL.map(([k, label, title]) => (
            <label key={k} className="tl-check" title={title}><input type="checkbox" checked={state.special[k]} onChange={() => toggleSpecial(k)} /> {label}</label>
          ))}
        </div>
      </div>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check">Octal
            <input type="text" className="cm-input" value={octalText ?? octal} onChange={(e) => applyFrom(fromOctal, e.target.value, setOctalText)} onBlur={() => !error && setOctalText(null)} spellCheck={false} />
          </label>
          <label className="tl-check">Symbolic
            <input type="text" className="cm-input" value={symText ?? symbolic} onChange={(e) => applyFrom(fromSymbolic, e.target.value, setSymText)} onBlur={() => !error && setSymText(null)} spellCheck={false} />
          </label>
        </div>
        {error && <div className="tl-err">⚠ {error}</div>}
        <div className="tl-row tl-gap">
          <code className="tl-password cm-cmd">chmod {octal} filename</code>
          <CopyButton text={`chmod ${octal} `} label="Copy command" />
        </div>
        <div className="tl-row">
          <span className="tl-muted">Common:</span>
          {COMMON.map((c) => (
            <button key={c} type="button" className={`tl-btn ${c === octal ? '' : 'secondary'}`} onClick={() => { sync(); setState(fromOctal(c)); }}>{c}</button>
          ))}
        </div>
        <p className="tl-muted">644 files and 755 folders/scripts are typical. 600 suits private keys. Avoid 777.</p>
      </div>
    </div>
  );
}
