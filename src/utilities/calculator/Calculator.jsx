import React, { useEffect, useState } from 'react';

const INIT = { display: '0', acc: null, op: null, reset: false };
const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function compute(a, op, b) {
  let r;
  if (op === '+') r = a + b;
  else if (op === '-') r = a - b;
  else if (op === '*') r = a * b;
  else r = b === 0 ? NaN : a / b;
  return Number.isFinite(r) ? String(parseFloat(r.toPrecision(12))) : 'Error';
}

function reduce(prev, key) {
  let s = prev.display === 'Error' ? INIT : prev;
  if (/^\d$/.test(key)) {
    if (s.reset) return { ...s, display: key, reset: false };
    return { ...s, display: s.display === '0' ? key : s.display + key };
  }
  switch (key) {
    case '.':
      if (s.reset) return { ...s, display: '0.', reset: false };
      return s.display.includes('.') ? s : { ...s, display: s.display + '.' };
    case 'C':
      return INIT;
    case 'B':
      if (s.reset) return s;
      return { ...s, display: s.display.length > 1 && s.display !== '-0' ? s.display.slice(0, -1) : '0' };
    case '±':
      return s.display === '0' ? s : { ...s, display: s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display };
    case '%':
      return { ...s, display: String(parseFloat((parseFloat(s.display) / 100).toPrecision(12))) };
    case '=': {
      if (!s.op || s.acc === null) return s;
      const res = compute(s.acc, s.op, parseFloat(s.display));
      return { display: res, acc: null, op: null, reset: true };
    }
    default: {
      if (!OPS[key]) return s;
      if (s.op && !s.reset) {
        const res = compute(s.acc, s.op, parseFloat(s.display));
        return { display: res, acc: res === 'Error' ? null : parseFloat(res), op: res === 'Error' ? null : key, reset: true };
      }
      return { ...s, acc: parseFloat(s.display), op: key, reset: true };
    }
  }
}

const KEYS = [
  ['C', '±', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', 'B', '='],
];

export function Calculator() {
  const [s, setS] = useState(INIT);
  const press = (k) => setS((p) => reduce(p, k));

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA') return;
      let k = null;
      if (/^[0-9.+\-*/%]$/.test(e.key)) k = e.key;
      else if (e.key === 'x' || e.key === 'X') k = '*';
      else if (e.key === 'Enter' || e.key === '=') k = '=';
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') k = 'C';
      else if (e.key === 'Backspace') k = 'B';
      if (k) {
        e.preventDefault();
        press(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const label = (k) => (OPS[k] ? OPS[k] : k === 'B' ? '⌫' : k);

  return (
    <div className="calc-container">
      <h2 className="calc-title">🧮 Calculator</h2>
      <div className="calc-body">
        <div className="calc-screen">
          <div className="calc-expr">{s.op && s.acc !== null ? `${s.acc} ${OPS[s.op]}` : ' '}</div>
          <div className="calc-display">{s.display}</div>
        </div>
        <div className="calc-keys">
          {KEYS.flat().map((k) => (
            <button
              key={k}
              type="button"
              className={`calc-key ${OPS[k] || k === '=' ? 'op' : ''} ${s.op === k ? 'active' : ''}`}
              onClick={() => press(k)}
            >
              {label(k)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
