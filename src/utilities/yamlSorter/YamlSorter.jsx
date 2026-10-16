import React, { useMemo } from 'react';
import { sortEnvSections, sortTopLevel } from './utils/sortYaml';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { ClearableTextarea } from '../../components/ClearableTextarea';

const SAMPLE = '# service config\nname: demo\nenv:\n  - name: ZED\n    value: "1"\n  # database\n  - name: ALPHA\n    value: "2"\n  - name: MID\n    value: "3"\nreplicas: 2\n';

export function YamlSorter() {
  const [input, setInput] = useToolState('input', SAMPLE);
  const [mode, setMode] = useToolState('mode', 'env');

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
        <CopyButton text={output} label="Copy result" className="ys-btn" />
      </div>
      <div className="ys-split">
        <div><label className="ys-label" htmlFor="ys-in">Input</label><ClearableTextarea id="ys-in" className="ys-textarea ys-tall" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} /></div>
        <div><div className="ys-label">Sorted</div><pre className="ys-out ys-tall">{output}</pre></div>
      </div>
    </div>
  );
}
