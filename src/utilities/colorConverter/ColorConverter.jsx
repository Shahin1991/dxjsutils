import React, { useMemo, useState } from 'react';
import { contrast, fmt, hexToRgb, hslToRgb, hsvToRgb, parseFn, rgbToHex } from './utils/color';

const KEYS = ['hex', 'rgb', 'hsl', 'hsv'];

export function ColorConverter() {
  const [rgb, setRgb] = useState({ r: 175, g: 14, b: 32 });
  const [fields, setFields] = useState(() => fmt({ r: 175, g: 14, b: 32 }));
  const [other, setOther] = useState('#ffffff');

  const apply = (next) => {
    setRgb(next);
    setFields(fmt(next));
  };

  const onField = (key, value) => {
    setFields((f) => ({ ...f, [key]: value }));
    let parsed = null;
    if (key === 'hex') parsed = hexToRgb(value);
    else if (key === 'rgb') {
      const n = parseFn(value, 'rgb', [255, 255, 255]);
      parsed = n && { r: n[0], g: n[1], b: n[2] };
    } else if (key === 'hsl') {
      const n = parseFn(value, 'hsl', [360, 100, 100]);
      parsed = n && hslToRgb(n[0], n[1], n[2]);
    } else {
      const n = parseFn(value, 'hsv', [360, 100, 100]);
      parsed = n && hsvToRgb(n[0], n[1], n[2]);
    }
    if (parsed) {
      setRgb(parsed);
      setFields((f) => ({ ...fmt(parsed), [key]: f[key] }));
    }
  };

  const hex = rgbToHex(rgb);
  const otherRgb = hexToRgb(other) || { r: 255, g: 255, b: 255 };
  const rows = useMemo(
    () => [['vs White', { r: 255, g: 255, b: 255 }], ['vs Black', { r: 0, g: 0, b: 0 }], [`vs ${other}`, otherRgb]].map(([label, c]) => [label, contrast(rgb, c)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rgb, other]
  );

  return (
    <div className="co-container">
      <h2 className="co-title">🎨 Color Converter</h2>
      <div className="co-panel co-top">
        <div className="co-swatch" style={{ background: hex }} />
        <div className="co-fields">
          {KEYS.map((k) => (
            <div key={k}>
              <label className="co-label">{k.toUpperCase()}</label>
              <input className="co-input co-field" value={fields[k]} onChange={(e) => onField(k, e.target.value)} spellCheck={false} />
            </div>
          ))}
          <div>
            <label className="co-label">Picker</label>
            <input type="color" value={hex} onChange={(e) => apply(hexToRgb(e.target.value))} />
          </div>
        </div>
      </div>
      <div className="co-panel">
        {['r', 'g', 'b'].map((ch) => (
          <div key={ch} className="co-row">
            <label className="co-ch">{ch.toUpperCase()}</label>
            <input type="range" min="0" max="255" value={rgb[ch]} onChange={(e) => apply({ ...rgb, [ch]: +e.target.value })} className="co-slider" />
            <span>{rgb[ch]}</span>
          </div>
        ))}
      </div>
      <div className="co-panel">
        <strong>WCAG contrast</strong>
        <div className="co-row co-gap">
          <label>Compare with <input type="color" value={otherRgb ? other : '#ffffff'} onChange={(e) => setOther(e.target.value)} /></label>
        </div>
        <table className="co-table">
          <thead><tr><th>Background</th><th>Ratio</th><th>AA</th><th>AA large</th><th>AAA</th></tr></thead>
          <tbody>
            {rows.map(([label, r]) => (
              <tr key={label}>
                <td>{label}</td><td>{r.toFixed(2)}:1</td>
                <td className={r >= 4.5 ? 'co-ok' : 'co-err'}>{r >= 4.5 ? 'Pass' : 'Fail'}</td>
                <td className={r >= 3 ? 'co-ok' : 'co-err'}>{r >= 3 ? 'Pass' : 'Fail'}</td>
                <td className={r >= 7 ? 'co-ok' : 'co-err'}>{r >= 7 ? 'Pass' : 'Fail'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="co-preview co-gap" style={{ background: other, color: hex }}>Sample text on {other}</div>
      </div>
    </div>
  );
}
