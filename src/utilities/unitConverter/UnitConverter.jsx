import React, { useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { CATEGORIES, convert, formatNumber } from './utils/units';

const DEFAULTS = {
  length: ['km', 'mi'], mass: ['kg', 'lb'], temperature: ['c', 'f'], area: ['m2', 'ft2'], volume: ['l', 'gal'],
  speed: ['kn', 'kmh'], time: ['h', 'min'], data: ['GB', 'GiB'], pressure: ['hpa', 'inhg'], energy: ['kwh', 'kj'],
};

export function UnitConverter() {
  const [category, setCategory] = useToolState('category', 'length');
  const [value, setValue] = useToolState('value', '1');
  const [from, setFrom] = useToolState('from', 'km');
  const [to, setTo] = useToolState('to', 'mi');
  const units = CATEGORIES[category].units;

  const n = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(n);
  const result = valid ? formatNumber(convert(category, n, from, to)) : '';
  const all = useMemo(
    () => (valid ? Object.entries(units).map(([id, [name]]) => [id, name, formatNumber(convert(category, n, from, id))]) : []),
    [valid, units, category, n, from]
  );

  const pick = (c) => {
    setCategory(c);
    setFrom(DEFAULTS[c][0]);
    setTo(DEFAULTS[c][1]);
  };
  const swap = () => {
    setFrom(to);
    setTo(from);
    if (valid) setValue(result);
  };

  return (
    <div className="tl-container">
      <h2 className="tl-title">📏 Unit Converter</h2>
      <p className="tl-desc">Convert length, weight, temperature, speed, data size and more.</p>
      <div className="tl-panel">
        <div className="tl-row fc-tabs" role="tablist" aria-label="Category">
          {Object.entries(CATEGORIES).map(([id, c]) => (
            <button key={id} type="button" role="tab" aria-selected={category === id} className={`tl-btn ${category === id ? '' : 'secondary'}`} onClick={() => pick(id)}>{c.label}</button>
          ))}
        </div>
        <div className="uc-form">
          <label>
            <span className="tl-label">Value</span>
            <input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!valid} />
          </label>
          <label>
            <span className="tl-label">From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {Object.entries(units).map(([id, [name]]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <button type="button" className="tl-btn secondary uc-swap" onClick={swap} title="Swap units" aria-label="Swap units">⇄</button>
          <label>
            <span className="tl-label">To</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {Object.entries(units).map(([id, [name]]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
        {valid ? (
          <div className="tl-row tl-gap">
            <div className="tl-password uc-result">{value} {units[from][0]} = <b>{result}</b> {units[to][0]}</div>
            <CopyButton text={result} />
          </div>
        ) : (
          <div className="tl-err tl-gap">⚠ Enter a number</div>
        )}
      </div>
      {valid && (
        <div className="tl-panel">
          <strong>{value} {units[from][0]} in every unit</strong>
          <table className="tl-table tl-gap">
            <tbody>
              {all.map(([id, name, v]) => (
                <tr key={id} className={id === to ? 'uc-hl' : ''}><th>{name}</th><td><code>{v}</code></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
