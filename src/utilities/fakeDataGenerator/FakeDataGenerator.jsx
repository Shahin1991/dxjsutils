import React, { useMemo, useState } from 'react';
import { FIELDS, generate, toCsv } from './utils/generators';
import { copyText, downloadFile } from '../../utils/clipboard';

export function FakeDataGenerator() {
  const [count, setCount] = useState(10);
  const [fields, setFields] = useState(['name', 'email', 'phone', 'address']);
  const [seed, setSeed] = useState(42);
  const [format, setFormat] = useState('json');

  const rows = useMemo(() => generate(count, fields, seed), [count, fields, seed]);
  const output = useMemo(() => (format === 'json' ? JSON.stringify(rows, null, 2) : toCsv(rows)), [rows, format]);

  const toggle = (f) => setFields((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  return (
    <div className="fd-container">
      <h2 className="fd-title">🧑‍🤝‍🧑 Fake Data Generator</h2>
      <p className="fd-desc">Offline, seeded test data. Card numbers pass Luhn; IBANs pass MOD-97. Not real accounts.</p>
      <div className="fd-panel">
        <div className="fd-row">
          {FIELDS.map((f) => <label key={f}><input type="checkbox" checked={fields.includes(f)} onChange={() => toggle(f)} /> {f}</label>)}
        </div>
        <div className="fd-row">
          <label>Rows <input type="number" min="1" max="5000" value={count} onChange={(e) => setCount(Math.max(1, Math.min(5000, +e.target.value || 1)))} /></label>
          <label>Seed <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 0)} /></label>
          <button type="button" className="fd-btn secondary" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>🎲 Random seed</button>
          <select value={format} onChange={(e) => setFormat(e.target.value)}><option value="json">JSON</option><option value="csv">CSV</option></select>
          <button type="button" className="fd-btn" onClick={() => copyText(output)}>Copy</button>
          <button type="button" className="fd-btn" onClick={() => downloadFile(`fake-data.${format}`, output, format === 'json' ? 'application/json' : 'text/csv')}>Download</button>
        </div>
      </div>
      <div className="fd-panel"><pre className="fd-out fd-scroll">{output}</pre></div>
    </div>
  );
}
