import React, { useMemo, useState } from 'react';
import { diffLines, summarize } from './utils/diff';

const SAMPLE_A = 'apple\nbanana\ncherry\ndate';
const SAMPLE_B = 'apple\nblueberry\ncherry\ndate\nelderberry';

export function TextDiff() {
  const [a, setA] = useState(SAMPLE_A);
  const [b, setB] = useState(SAMPLE_B);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [onlyChanges, setOnlyChanges] = useState(false);

  const rows = useMemo(() => diffLines(a, b, { ignoreCase, ignoreWhitespace }), [a, b, ignoreCase, ignoreWhitespace]);
  const stats = summarize(rows);
  const shown = onlyChanges ? rows.filter((r) => r.type !== 'same') : rows;

  return (
    <div className="tl-container">
      <h2 className="tl-title">↔️ Text Diff</h2>
      <p className="tl-desc">Compare two texts line by line. Nothing leaves your device.</p>
      <div className="tl-split">
        <div>
          <label className="tl-label" htmlFor="diff-a">Original</label>
          <textarea id="diff-a" className="tl-textarea" value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} />
        </div>
        <div>
          <label className="tl-label" htmlFor="diff-b">Changed</label>
          <textarea id="diff-b" className="tl-textarea" value={b} onChange={(e) => setB(e.target.value)} spellCheck={false} />
        </div>
      </div>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check"><input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> Ignore case</label>
          <label className="tl-check"><input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} /> Ignore whitespace</label>
          <label className="tl-check"><input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} /> Only differences</label>
          <button type="button" className="tl-btn secondary" onClick={() => { setA(b); setB(a); }}>⇅ Swap</button>
          <span className="tl-ok">+{stats.add} added</span>
          <span className="tl-err">−{stats.del} removed</span>
          <span className="tl-muted">{stats.same} unchanged</span>
        </div>
        {stats.add + stats.del === 0 && (a || b) ? (
          <p className="tl-ok">✓ The texts are identical.</p>
        ) : (
          <div className="tl-diff" role="table" aria-label="Diff result">
            {shown.map((r, i) => (
              <div key={i} className={`tl-diff-row ${r.type}`} role="row">
                <span className="tl-diff-num">{r.left ?? ''}</span>
                <span className="tl-diff-num">{r.right ?? ''}</span>
                <span>{r.type === 'add' ? '+' : r.type === 'del' ? '−' : ''}</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
