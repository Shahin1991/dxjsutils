import React, { useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { MODES } from './utils/convert';

const SAMPLES = {
  'json-csv': '[{"name":"Ada","role":{"title":"Engineer"}},{"name":"Linus","role":{"title":"Maintainer"}}]',
  'csv-json': 'name,age\nAda,36\nLinus,54',
  'json-yaml': '{"name":"app","ports":[80,443],"debug":false}',
  'yaml-json': 'name: app\nports:\n  - 80\n  - 443\ndebug: false',
};

export function JsonConverter() {
  const [mode, setMode] = useState('json-csv');
  const [input, setInput] = useState(SAMPLES['json-csv']);
  const m = MODES[mode];

  const result = useMemo(() => {
    if (!input.trim()) return { out: '' };
    try {
      return { out: m.run(input) };
    } catch (e) {
      return { error: `Could not read the ${m.from}: ${e.message}` };
    }
  }, [input, m]);

  const changeMode = (id) => {
    setMode(id);
    setInput(SAMPLES[id]);
  };

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔁 JSON Converter</h2>
      <p className="tl-desc">Convert between JSON, CSV and YAML.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {Object.entries(MODES).map(([id, x]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => changeMode(id)}>{x.label}</button>
          ))}
        </div>
        <label className="tl-label" htmlFor="jc-in">{m.from} input</label>
        <textarea id="jc-in" className="tl-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <label className="tl-label tl-gap">{m.to} output</label>
        {result.error ? <div className="tl-err">⚠ {result.error}</div> : <pre className="tl-out">{result.out}</pre>}
        <div className="tl-gap"><CopyButton text={result.out} label="Copy output" /></div>
        {mode === 'json-csv' && <p className="tl-muted tl-gap">Nested objects become dotted columns (e.g. <code>role.title</code>). Arrays are kept as JSON text.</p>}
      </div>
    </div>
  );
}
