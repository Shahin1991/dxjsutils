import React, { useMemo, useState } from 'react';
import { TreeNode } from '../../components/TreeNode';

const SAMPLE = '{"name":"EK","active":true,"count":42,"tags":["a","b"],"nested":{"x":null,"y":[1,2,{"z":"deep"}]}}';

export function JsonViewer() {
  const [text, setText] = useState(SAMPLE);
  const [signal, setSignal] = useState({ mode: 'expand', n: 0 });

  const { value, error } = useMemo(() => {
    if (!text.trim()) return { value: undefined, error: '' };
    try {
      return { value: JSON.parse(text), error: '' };
    } catch (e) {
      return { value: undefined, error: e.message };
    }
  }, [text]);

  return (
    <div className="jv-container">
      <h2 className="jv-title">🌳 JSON Viewer</h2>
      <div className="jv-panel">
        <textarea className="jv-textarea" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="Paste JSON here" />
        <div className="jv-row jv-gap">
          <button type="button" className="jv-btn secondary" onClick={() => setSignal((s) => ({ mode: 'expand', n: s.n + 1 }))}>Expand all</button>
          <button type="button" className="jv-btn secondary" onClick={() => setSignal((s) => ({ mode: 'collapse', n: s.n + 1 }))}>Collapse all</button>
          <button type="button" className="jv-btn secondary" onClick={() => value !== undefined && setText(JSON.stringify(value, null, 2))}>Format</button>
          {error ? <span className="jv-err">⚠ {error}</span> : value !== undefined && <span className="jv-ok">✓ Valid JSON</span>}
        </div>
      </div>
      {value !== undefined && (
        <div className="jv-panel"><TreeNode value={value} signal={signal} /></div>
      )}
    </div>
  );
}
