import React, { useMemo, useState } from 'react';
import { parseCurl } from './utils/parseCurl';

const SAMPLE = `curl -X POST 'https://api.example.com/v1/users?active=true&page=2' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer abc123' \\
  -d '{"name":"Alice"}' \\
  --compressed -L`;

function Section({ title, children }) {
  return <div className="cd-panel"><strong>{title}</strong><div className="cd-body">{children}</div></div>;
}

export function CurlDecoder() {
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { parsed: parseCurl(input) };
    } catch (e) {
      return { error: e.message };
    }
  }, [input]);

  const p = result?.parsed;

  return (
    <div className="cd-container">
      <h2 className="cd-title">🔁 cURL Decoder</h2>
      <div className="cd-panel">
        <textarea className="cd-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="Paste a curl command" />
        {result?.error && <div className="cd-err cd-body">⚠ {result.error}</div>}
      </div>
      {p && (
        <>
          <Section title="Request">
            <div className="cd-grid">
              <div className="cd-stat"><b>Method</b>{p.method}</div>
              <div className="cd-stat"><b>URL</b>{p.baseUrl}</div>
              {p.host && <div className="cd-stat"><b>Host</b>{p.host}</div>}
              {p.path && <div className="cd-stat"><b>Path</b>{p.path}</div>}
            </div>
          </Section>
          {p.query.length > 0 && (
            <Section title="Query parameters">
              <table className="cd-table"><tbody>{p.query.map((q, i) => <tr key={i}><td>{q.key}</td><td>{q.value}</td></tr>)}</tbody></table>
            </Section>
          )}
          {p.headers.length > 0 && (
            <Section title="Headers">
              <table className="cd-table"><tbody>{p.headers.map((h, i) => <tr key={i}><td>{h.key}</td><td>{h.value}</td></tr>)}</tbody></table>
            </Section>
          )}
          {p.auth && <Section title="Authentication"><pre className="cd-out">{p.auth.type}: {p.auth.value}</pre></Section>}
          {p.data.length > 0 && (
            <Section title="Body">
              {p.data.map((d, i) => <pre key={i} className="cd-out"><span className="cd-muted">{d.flag}</span>{'\n'}{d.value}</pre>)}
            </Section>
          )}
          {p.forms.length > 0 && <Section title="Form fields"><pre className="cd-out">{p.forms.join('\n')}</pre></Section>}
          {p.options.length > 0 && (
            <Section title="Other options">
              <table className="cd-table"><tbody>{p.options.map(([f, d, v], i) => <tr key={i}><td><code>{f}</code></td><td>{d}</td><td>{v}</td></tr>)}</tbody></table>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
