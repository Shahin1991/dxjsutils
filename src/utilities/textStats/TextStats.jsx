import React, { useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { formatMinutes, lorem, textStats } from './utils/stats';

export function TextStats() {
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog. Paste or type your own text here!');
  const [kind, setKind] = useState('paragraphs');
  const [count, setCount] = useState(2);
  const [classic, setClassic] = useState(true);

  const s = useMemo(() => textStats(text), [text]);
  const generated = useMemo(() => lorem(kind, count, classic), [kind, count, classic]);
  const cards = [
    ['Words', s.words], ['Characters', s.characters], ['No spaces', s.charactersNoSpaces],
    ['Sentences', s.sentences], ['Paragraphs', s.paragraphs], ['Lines', s.lines],
    ['Reading time', formatMinutes(s.readingMinutes)], ['Speaking time', formatMinutes(s.speakingMinutes)],
  ];

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔢 Word Counter &amp; Lorem Ipsum</h2>
      <p className="tl-desc">Count words and characters, and generate placeholder text.</p>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="ts-in">Your text</label>
        <textarea id="ts-in" className="tl-textarea" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="tl-grid tl-gap">
          {cards.map(([k, v]) => <div key={k} className="tl-stat"><b>{k}</b><span>{v}</span></div>)}
        </div>
        <div className="tl-row tl-gap">
          <button type="button" className="tl-btn secondary" onClick={() => setText('')}>Clear</button>
        </div>
      </div>
      <div className="tl-panel">
        <strong>Lorem Ipsum generator</strong>
        <div className="tl-row tl-gap">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Unit">
            <option value="paragraphs">Paragraphs</option>
            <option value="sentences">Sentences</option>
            <option value="words">Words</option>
          </select>
          <input type="number" min="1" max="100" value={count} aria-label="Amount" style={{ width: 80 }}
            onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
          <label className="tl-check"><input type="checkbox" checked={classic} onChange={(e) => setClassic(e.target.checked)} /> Start with “Lorem ipsum”</label>
          <CopyButton text={generated} label="Copy" />
        </div>
        <pre className="tl-out">{generated}</pre>
      </div>
    </div>
  );
}
