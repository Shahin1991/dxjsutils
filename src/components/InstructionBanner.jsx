import React, { useEffect, useMemo, useState } from 'react';
import { HELP } from '../config/help';
import { readJSON, writeJSON } from '../utils/storage';

const WORD_MS = 90; // delay between words
const HOLD_MS = 2600; // pause once a line is fully typed

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Lines to type out: the summary, then each step.
export function buildLines(help) {
  return [help.summary, ...help.howTo.map((s, i) => `Step ${i + 1}: ${s}`)];
}

// Types the tool's instructions word by word, looping through every line.
export function InstructionBanner({ utilityId }) {
  const help = HELP[utilityId];
  const lines = useMemo(() => (help ? buildLines(help) : []), [help]);
  const [hidden, setHidden] = useState(() => readJSON('hideInstructions', false));
  const [line, setLine] = useState(0);
  const [words, setWords] = useState(0);
  const reduced = useMemo(prefersReducedMotion, []);

  const tokens = useMemo(() => (lines[line] || '').split(' '), [lines, line]);

  useEffect(() => {
    if (hidden || reduced || lines.length === 0) return undefined;
    const done = words >= tokens.length;
    const t = setTimeout(() => {
      if (!done) setWords((w) => w + 1);
      else {
        setLine((l) => (l + 1) % lines.length);
        setWords(0);
      }
    }, done ? HOLD_MS : WORD_MS);
    return () => clearTimeout(t);
  }, [hidden, reduced, lines, tokens, words]);

  if (!help) return null;

  const toggle = (value) => {
    setHidden(value);
    writeJSON('hideInstructions', value);
  };

  if (hidden) {
    return (
      <button type="button" className="instr-show" onClick={() => toggle(false)}>
        💡 Show instructions
      </button>
    );
  }

  return (
    <section className="instr" aria-label="How to use this tool">
      <span className="instr-icon" aria-hidden="true">✨</span>
      <div className="instr-body">
        {reduced ? (
          <>
            <p className="instr-line">{help.summary}</p>
            <ol className="instr-steps">
              {help.howTo.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </>
        ) : (
          <>
            {/* Screen readers get the full text at once instead of a stream of fragments. */}
            <span className="sr-only">{lines.join(' ')}</span>
            <p className="instr-line" aria-hidden="true">
              {tokens.slice(0, words).join(' ')}
              <span className="instr-caret" />
            </p>
            <div className="instr-dots" aria-hidden="true">
              {lines.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  className={`instr-dot ${i === line ? 'on' : ''}`}
                  onClick={() => { setLine(i); setWords(0); }}
                  title={i === 0 ? 'Overview' : `Step ${i}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <button type="button" className="instr-hide" onClick={() => toggle(true)} aria-label="Hide instructions" title="Hide instructions">
        ✕
      </button>
    </section>
  );
}

export default InstructionBanner;
