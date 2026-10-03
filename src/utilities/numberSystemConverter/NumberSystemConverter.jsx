import React, { useMemo, useState } from 'react';
import { copyText } from '../../utils/clipboard';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function parseBig(str, base) {
  let s = str.trim().toLowerCase().replace(/[\s_]/g, '');
  if (!s) throw new Error('Enter a number');
  let neg = false;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  }
  if (base === 16) s = s.replace(/^0x/, '');
  if (base === 2) s = s.replace(/^0b/, '');
  if (base === 8) s = s.replace(/^0o/, '');
  if (!s) throw new Error('Enter a number');
  let v = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new Error(`"${ch}" is not a valid base-${base} digit`);
    v = v * b + BigInt(d);
  }
  return neg ? -v : v;
}

export function NumberSystemConverter() {
  const [value, setValue] = useState('255');
  const [base, setBase] = useState(10);
  const [custom, setCustom] = useState(36);
  const [bits, setBits] = useState(16);

  const result = useMemo(() => {
    try {
      const n = parseBig(value, base);
      const min = -(1n << BigInt(bits - 1));
      const max = (1n << BigInt(bits)) - 1n;
      let twos = null;
      if (n < 0n) twos = n >= min ? n + (1n << BigInt(bits)) : null;
      else if (n <= max) twos = n;
      return { n, twos, fits: twos !== null, error: '' };
    } catch (e) {
      return { error: e.message };
    }
  }, [value, base, bits]);

  const conv = (n, b) => (n < 0n ? '-' : '') + (n < 0n ? -n : n).toString(b);
  const rows = result.n === undefined ? [] : [['Binary', conv(result.n, 2)], ['Octal', conv(result.n, 8)], ['Decimal', conv(result.n, 10)], ['Hexadecimal', conv(result.n, 16).toUpperCase()], [`Base ${custom}`, conv(result.n, custom).toUpperCase()]];

  return (
    <div className="ns-container">
      <h2 className="ns-title">🔢 Number System Converter</h2>
      <div className="ns-panel ns-row">
        <input className="ns-input ns-wide" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
        <label>Input base <select value={base} onChange={(e) => setBase(+e.target.value)}>{[2, 8, 10, 16].map((b) => <option key={b} value={b}>{b}</option>)}<option value={custom}>custom ({custom})</option></select></label>
        <label>Custom base <input type="number" min="2" max="36" value={custom} onChange={(e) => setCustom(Math.min(36, Math.max(2, +e.target.value || 2)))} /></label>
        <label>Width <select value={bits} onChange={(e) => setBits(+e.target.value)}>{[8, 16, 32, 64].map((b) => <option key={b} value={b}>{b}-bit</option>)}</select></label>
      </div>
      {result.error && <p className="ns-err">⚠ {result.error}</p>}
      {rows.length > 0 && (
        <div className="ns-panel">
          <table className="ns-table">
            <tbody>
              {rows.map(([name, v]) => <tr key={name}><td>{name}</td><td><code>{v}</code></td><td><button type="button" className="ns-btn secondary" onClick={() => copyText(v)}>Copy</button></td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {result.n !== undefined && (
        <div className="ns-panel">
          <strong>Two's complement ({bits}-bit)</strong>
          {result.fits ? (
            <table className="ns-table">
              <tbody>
                <tr><td>Binary</td><td><code>{result.twos.toString(2).padStart(bits, '0')}</code></td></tr>
                <tr><td>Hex</td><td><code>0x{result.twos.toString(16).toUpperCase().padStart(bits / 4, '0')}</code></td></tr>
              </tbody>
            </table>
          ) : <p className="ns-err">Value does not fit in {bits} bits.</p>}
        </div>
      )}
    </div>
  );
}
