import React, { useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { OPERATIONS, applyOperation, joinLines, splitLines, splitToLines, wrapLines } from './utils/lines';

const SAMPLE = 'banana\nApple\ncherry\n\napple\n  date  \nbanana\nitem10\nitem2';
const QUOTES = [['', 'none'], ["'", "' '"], ['"', '" "']];

export function LineTools() {
  const [input, setInput] = useToolState('input', SAMPLE);
  const [output, setOutput] = useToolState('output', '');
  const [ignoreCase, setIgnoreCase] = useToolState('ignoreCase', true);
  const [prefix, setPrefix] = useToolState('prefix', '');
  const [suffix, setSuffix] = useToolState('suffix', '');
  const [delimiter, setDelimiter] = useToolState('delimiter', ', ');
  const [quote, setQuote] = useToolState('quote', "'");

  const count = useMemo(() => {
    const lines = splitLines(input);
    return { lines: lines.length, unique: new Set(lines.map((l) => (ignoreCase ? l.toLowerCase() : l))).size };
  }, [input, ignoreCase]);

  const run = (fn) => setOutput(fn(input));

  return (
    <div className="tl-container">
      <h2 className="tl-title">🧾 Line Tools</h2>
      <p className="tl-desc">Sort, de-duplicate, shuffle and clean up lists, or join lines into one delimited string.</p>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="lt-in">Input (one item per line) · {count.lines} lines, {count.unique} unique</label>
        <ClearableTextarea id="lt-in" className="tl-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <div className="tl-row tl-gap">
          {Object.entries(OPERATIONS).map(([id, op]) => (
            <button key={id} type="button" className="tl-btn secondary" onClick={() => run((t) => applyOperation(t, id, { ignoreCase }))}>{op.label}</button>
          ))}
          <label className="tl-check"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> Ignore case for duplicates</label>
        </div>
        <div className="tl-row">
          <label className="tl-check">Prefix <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} style={{ width: 90 }} /></label>
          <label className="tl-check">Suffix <input type="text" value={suffix} onChange={(e) => setSuffix(e.target.value)} style={{ width: 90 }} /></label>
          <button type="button" className="tl-btn secondary" onClick={() => run((t) => wrapLines(t, { prefix, suffix }))}>Add prefix / suffix</button>
        </div>
        <div className="tl-row">
          <label className="tl-check">Delimiter <input type="text" value={delimiter} onChange={(e) => setDelimiter(e.target.value)} style={{ width: 70 }} /></label>
          <label className="tl-check">Quote
            <select value={quote} onChange={(e) => setQuote(e.target.value)}>
              {QUOTES.map(([q, l]) => <option key={l} value={q}>{l}</option>)}
            </select>
          </label>
          <button type="button" className="tl-btn secondary" onClick={() => run((t) => joinLines(t, { delimiter, quote }))}>Join lines</button>
          <button type="button" className="tl-btn secondary" onClick={() => run((t) => splitToLines(t, delimiter.trim() || delimiter))}>Split into lines</button>
        </div>
      </div>
      <div className="tl-panel">
        <div className="tl-row">
          <strong>Output</strong>
          <CopyButton text={output} label="Copy output" />
          <button type="button" className="tl-btn secondary" disabled={!output} onClick={() => setInput(output)}>↑ Use as input</button>
        </div>
        <pre className="tl-out">{output || <span className="tl-muted">Pick an operation above.</span>}</pre>
      </div>
    </div>
  );
}
