import React, { useMemo, useState } from 'react';
import { format } from './utils/format';
import { copyText } from '../../utils/clipboard';

const TYPES = ['auto', 'json', 'xml', 'html', 'css', 'sql'];

export function CodeFormatter() {
  const [input, setInput] = useState('{"a":1,"b":[1,2,3],"c":{"d":"e"}}');
  const [type, setType] = useState('auto');

  const result = useMemo(() => {
    if (!input.trim()) return { out: '', type: type === 'auto' ? '' : type };
    try {
      return format(input, type);
    } catch (e) {
      return { error: e.message };
    }
  }, [input, type]);

  return (
    <div className="cf-container">
      <h2 className="cf-title">✨ Code Formatter</h2>
      <div className="cf-panel cf-row">
        <label>Language <select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        {result.type && <span className="cf-muted">Detected: {result.type}</span>}
        <button type="button" className="cf-btn" onClick={() => result.out && copyText(result.out)}>Copy output</button>
        <button type="button" className="cf-btn secondary" onClick={() => result.out && setInput(result.out)}>Use output as input</button>
      </div>
      <div className="cf-split">
        <textarea className="cf-textarea cf-tall" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        {result.error ? <pre className="cf-out cf-tall cf-err">{result.error}</pre> : <pre className="cf-out cf-tall">{result.out}</pre>}
      </div>
    </div>
  );
}
