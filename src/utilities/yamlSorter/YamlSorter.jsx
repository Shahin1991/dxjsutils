import React, { useMemo, useState } from 'react';
import { sortEnvSections, sortTopLevel } from './utils/sortYaml';
import { copyText } from '../../utils/clipboard';

const SAMPLE = '# service config\nname: demo\nenv:\n  - name: ZED\n    value: "1"\n  # database\n  - name: ALPHA\n    value: "2"\n  - name: MID\n    value: "3"\nreplicas: 2\n';

export function YamlSorter() {
  const [input, setInput] = useState(SAMPLE);
  const [mode, setMode] = useState('env');

  const output = useMemo(() => {
    try {
      return mode === 'env' ? sortEnvSections(input) : sortTopLevel(input);
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }, [input, mode]);

  return (
    <div className="ys-container">
      <h2 className="ys-title">🔀 YAML Key Sorter</h2>
      <p className="ys-desc">Sorts keys alphabetically while keeping comments attached to their keys.</p>
      <div className="ys-panel ys-row">
        <label><input type="radio" checked={mode === 'env'} onChange={() => setMode('env')} /> env / environment sections only</label>
        <label><input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> all top-level keys</label>
        <button type="button" className="ys-btn" onClick={() => copyText(output)}>Copy result</button>
      </div>
      <div className="ys-split">
        <div><label className="ys-label">Input</label><textarea className="ys-textarea ys-tall" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} /></div>
        <div><label className="ys-label">Sorted</label><pre className="ys-out ys-tall">{output}</pre></div>
      </div>
    </div>
  );
}
