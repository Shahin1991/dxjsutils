import React, { useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { ENCODERS } from './utils/encoders';

export function TextEncoders() {
  const [kind, setKind] = useToolState('kind', 'html');
  const [direction, setDirection] = useToolState('direction', 'encode');
  const [input, setInput] = useToolState('input', ENCODERS.html.sample);
  const enc = ENCODERS[kind];

  const result = useMemo(() => {
    try {
      return { out: input ? enc[direction](input) : '' };
    } catch (e) {
      return { error: e.message };
    }
  }, [enc, direction, input]);

  const pick = (k) => {
    setKind(k);
    setDirection('encode');
    setInput(ENCODERS[k].sample);
  };
  const swap = () => {
    if (result.error) return;
    setInput(result.out);
    setDirection((d) => (d === 'encode' ? 'decode' : 'encode'));
  };

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔡 Text Encoders</h2>
      <p className="tl-desc">HTML entities, Unicode and JSON escapes, hex, binary, ROT13, Morse code and the NATO phonetic alphabet.</p>
      <div className="tl-panel">
        <div className="tl-row fc-tabs" role="tablist" aria-label="Encoding">
          {Object.entries(ENCODERS).map(([id, e]) => (
            <button key={id} type="button" role="tab" aria-selected={kind === id} className={`tl-btn ${kind === id ? '' : 'secondary'}`} onClick={() => pick(id)}>{e.label}</button>
          ))}
        </div>
        <div className="tl-row">
          {[['encode', 'Encode'], ['decode', 'Decode']].map(([id, label]) => (
            <label key={id} className="tl-check"><input type="radio" name="te-dir" checked={direction === id} onChange={() => setDirection(id)} /> {label}</label>
          ))}
        </div>
        <label className="tl-label" htmlFor="te-in">Input</label>
        <ClearableTextarea id="te-in" className="tl-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <div className="tl-label tl-gap">Output</div>
        {result.error ? <div className="tl-err">⚠ {result.error}</div> : <pre className="tl-out">{result.out}</pre>}
        <div className="tl-row tl-gap">
          <CopyButton text={result.out} label="Copy output" />
          <button type="button" className="tl-btn secondary" onClick={swap} disabled={Boolean(result.error) || !result.out}>⇅ Use output as input &amp; flip</button>
        </div>
      </div>
    </div>
  );
}
