import React, { useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { jsonToTs } from './utils/toTs';

const SAMPLE = `{
  "flightNumber": "XX202",
  "departure": { "airport": "DXB", "time": "2026-10-17T02:30:00Z" },
  "passengers": [
    { "name": "Ada", "seat": "12A", "meal": "VGML" },
    { "name": "Linus", "seat": "12B", "meal": null }
  ],
  "onTime": true
}`;

export function JsonToTypescript() {
  const [input, setInput] = useToolState('input', SAMPLE);
  const [rootName, setRootName] = useToolState('rootName', 'Root');
  const [opts, setOpts] = useToolState('opts', { useType: false, optionalNulls: false, readonly: false });

  const result = useMemo(() => {
    if (!input.trim()) return { out: '' };
    try {
      return { out: jsonToTs(input, { rootName: rootName.trim() || 'Root', ...opts }) };
    } catch (e) {
      return { error: `Invalid JSON: ${e.message}` };
    }
  }, [input, rootName, opts]);

  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="tl-container">
      <h2 className="tl-title">🟦 JSON to TypeScript</h2>
      <p className="tl-desc">Paste a JSON sample (e.g. an API response) and get TypeScript interfaces for it.</p>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check">Root name <input type="text" value={rootName} onChange={(e) => setRootName(e.target.value)} style={{ width: 140 }} /></label>
          <label className="tl-check"><input type="checkbox" checked={opts.useType} onChange={(e) => set('useType', e.target.checked)} /> Use <code>type</code> instead of <code>interface</code></label>
          <label className="tl-check"><input type="checkbox" checked={opts.optionalNulls} onChange={(e) => set('optionalNulls', e.target.checked)} /> Make null fields optional</label>
          <label className="tl-check"><input type="checkbox" checked={opts.readonly} onChange={(e) => set('readonly', e.target.checked)} /> readonly</label>
        </div>
        <div className="tl-split">
          <div>
            <label className="tl-label" htmlFor="j2t-in">JSON</label>
            <ClearableTextarea id="j2t-in" className="tl-textarea j2t-area" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
          </div>
          <div>
            <div className="tl-label">TypeScript</div>
            {result.error ? <div className="tl-err">⚠ {result.error}</div> : <pre className="tl-out j2t-area">{result.out}</pre>}
          </div>
        </div>
        <div className="tl-gap"><CopyButton text={result.out} label="Copy TypeScript" /></div>
        <p className="tl-muted tl-gap">Items in an array are merged into one type; a key that is missing from some items becomes optional (<code>?</code>).</p>
      </div>
    </div>
  );
}
