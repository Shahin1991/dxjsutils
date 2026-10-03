import React, { useMemo, useState } from 'react';

const FLAGS = ['g', 'i', 'm', 's', 'u'];

export function RegexTester() {
  const [pattern, setPattern] = useState('(\\w+)@(\\w+)\\.com');
  const [flags, setFlags] = useState(['g', 'i']);
  const [text, setText] = useState('Contact: alice@example.com, bob@test.com');

  const { matches, error } = useMemo(() => {
    if (!pattern) return { matches: [], error: '' };
    try {
      const re = new RegExp(pattern, flags.includes('g') ? flags.join('') : flags.join('') + 'g');
      let all = [...text.matchAll(re)];
      if (!flags.includes('g')) all = all.slice(0, 1);
      return { matches: all, error: '' };
    } catch (e) {
      return { matches: [], error: e.message };
    }
  }, [pattern, flags, text]);

  const segments = useMemo(() => {
    const out = [];
    let last = 0;
    matches.forEach((m) => {
      if (m[0] === '') return;
      if (m.index > last) out.push({ t: text.slice(last, m.index), hit: false });
      out.push({ t: m[0], hit: true });
      last = m.index + m[0].length;
    });
    out.push({ t: text.slice(last), hit: false });
    return out;
  }, [matches, text]);

  const toggle = (f) => setFlags((fl) => (fl.includes(f) ? fl.filter((x) => x !== f) : [...fl, f]));

  return (
    <div className="rt-container">
      <h2 className="rt-title">🔍 Regex Tester</h2>
      <div className="rt-panel">
        <label className="rt-label">Pattern</label>
        <div className="rt-row">
          <span>/</span>
          <input className="rt-input rt-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} />
          <span>/{flags.join('')}</span>
        </div>
        <div className="rt-row">
          {FLAGS.map((f) => (
            <label key={f} className="rt-flag"><input type="checkbox" checked={flags.includes(f)} onChange={() => toggle(f)} /> {f}</label>
          ))}
        </div>
        {error && <div className="rt-err">⚠ {error}</div>}
      </div>
      <div className="rt-panel">
        <label className="rt-label">Test text</label>
        <textarea className="rt-textarea" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <label className="rt-label rt-gap">Highlighted ({matches.length} match{matches.length === 1 ? '' : 'es'})</label>
        <pre className="rt-out">{segments.map((s, i) => (s.hit ? <mark key={i} className="rt-mark">{s.t}</mark> : <span key={i}>{s.t}</span>))}</pre>
      </div>
      {matches.length > 0 && (
        <div className="rt-panel">
          <table className="rt-table">
            <thead><tr><th>#</th><th>Match</th><th>Index</th><th>Groups</th></tr></thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><code>{m[0] === '' ? '(empty)' : m[0]}</code></td>
                  <td>{m.index}</td>
                  <td>
                    {m.slice(1).map((g, gi) => <div key={gi}>${gi + 1}: <code>{g === undefined ? 'undefined' : g}</code></div>)}
                    {m.groups && Object.entries(m.groups).map(([k, v]) => <div key={k}>{k}: <code>{v}</code></div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
