import React, { useMemo } from 'react';
import { format } from './utils/format';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { ClearableTextarea } from '../../components/ClearableTextarea';

const TYPES = ['auto', 'json', 'xml', 'html', 'css', 'sql'];

export function CodeFormatter() {
  const [input, setInput] = useToolState('input', '{"a":1,"b":[1,2,3],"c":{"d":"e"}}');
  const [type, setType] = useToolState('type', 'auto');

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
        <CopyButton text={result.out} label="Copy output" className="cf-btn" />
        <button type="button" className="cf-btn secondary" onClick={() => result.out && setInput(result.out)}>Use output as input</button>
      </div>
      <div className="cf-split">
        <ClearableTextarea className="cf-textarea cf-tall" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        {result.error ? <pre className="cf-out cf-tall cf-err">{result.error}</pre> : <pre className="cf-out cf-tall">{result.out}</pre>}
      </div>
    </div>
  );
}
