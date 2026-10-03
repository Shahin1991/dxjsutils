import React, { useMemo, useState } from 'react';
import { copyText } from '../../utils/clipboard';

function words(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const CONVERTERS = [
  ['camelCase', (w) => w.map((x, i) => (i ? cap(x) : x.toLowerCase())).join('')],
  ['PascalCase', (w) => w.map(cap).join('')],
  ['snake_case', (w) => w.map((x) => x.toLowerCase()).join('_')],
  ['kebab-case', (w) => w.map((x) => x.toLowerCase()).join('-')],
  ['CONSTANT_CASE', (w) => w.map((x) => x.toUpperCase()).join('_')],
  ['Title Case', (w) => w.map(cap).join(' ')],
  ['Sentence case', (w) => { const j = w.map((x) => x.toLowerCase()).join(' '); return j.charAt(0).toUpperCase() + j.slice(1); }],
];

export function StringTools() {
  const [input, setInput] = useState('hello world_example-text');

  const converted = useMemo(() => {
    const w = words(input);
    return CONVERTERS.map(([name, fn]) => [name, fn(w)]);
  }, [input]);

  const stats = useMemo(
    () => ({
      Characters: input.length,
      'Characters (no spaces)': input.replace(/\s/g, '').length,
      Words: input.trim() ? input.trim().split(/\s+/).length : 0,
      Lines: input ? input.split('\n').length : 0,
    }),
    [input]
  );

  const utilities = [
    ['Trim', (s) => s.trim()],
    ['Reverse', (s) => [...s].reverse().join('')],
    ['UPPERCASE', (s) => s.toUpperCase()],
    ['lowercase', (s) => s.toLowerCase()],
    ['Collapse spaces', (s) => s.replace(/\s+/g, ' ')],
    ['Remove line breaks', (s) => s.replace(/\r?\n/g, ' ')],
  ];

  return (
    <div className="st-container">
      <h2 className="st-title">🔤 String Tools</h2>
      <div className="st-panel">
        <textarea className="st-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <div className="st-row st-gap">
          {utilities.map(([name, fn]) => <button key={name} type="button" className="st-btn secondary" onClick={() => setInput(fn(input))}>{name}</button>)}
        </div>
        <div className="st-grid">
          {Object.entries(stats).map(([k, v]) => <div key={k} className="st-stat"><b>{k}</b>{v}</div>)}
        </div>
      </div>
      <div className="st-panel">
        <table className="st-table">
          <tbody>
            {converted.map(([name, val]) => (
              <tr key={name}>
                <td>{name}</td>
                <td><code>{val}</code></td>
                <td><button type="button" className="st-btn secondary" onClick={() => copyText(val)}>Copy</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
