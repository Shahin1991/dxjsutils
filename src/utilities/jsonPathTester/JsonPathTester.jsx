import React, { useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { queryJson, queryXml } from './utils/query';

const SAMPLES = {
  json: {
    doc: JSON.stringify({ store: { book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ], bicycle: { color: 'red', price: 19.95 } } }, null, 2),
    expr: '$.store.book[?(@.price < 15)].title',
    examples: ['$.store.book[*].author', '$..price', '$.store.book[-1:]', '$..book[?(@.isbn)]', '$.store.*'],
  },
  xml: {
    doc: '<flights>\n  <flight no="XX202" from="DXB" to="JFK"><status>On time</status><pax>489</pax></flight>\n  <flight no="XX001" from="DXB" to="LHR"><status>Delayed</status><pax>517</pax></flight>\n</flights>',
    expr: '//flight[status="Delayed"]/@no',
    examples: ['//flight/@no', '//flight[pax > 500]', 'count(//flight)', 'sum(//pax)', '//flight[1]/status/text()'],
  },
};

const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

export function JsonPathTester() {
  const [mode, setMode] = useToolState('mode', 'json');
  const [doc, setDoc] = useToolState('doc', SAMPLES.json.doc);
  const [expr, setExpr] = useToolState('expr', SAMPLES.json.expr);
  const s = SAMPLES[mode];

  const result = useMemo(() => {
    try {
      return { matches: mode === 'json' ? queryJson(doc, expr) : queryXml(doc, expr) };
    } catch (e) {
      return { error: e.message };
    }
  }, [mode, doc, expr]);

  const changeMode = (m) => {
    setMode(m);
    setDoc(SAMPLES[m].doc);
    setExpr(SAMPLES[m].expr);
  };

  return (
    <div className="tl-container">
      <h2 className="tl-title">🎯 JSONPath &amp; XPath Tester</h2>
      <p className="tl-desc">Try JSONPath queries on JSON, or XPath on XML, and see every match with its path.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['json', 'JSONPath'], ['xml', 'XPath (XML)']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => changeMode(id)}>{label}</button>
          ))}
        </div>
        <label className="tl-label" htmlFor="jp-expr">Expression</label>
        <input id="jp-expr" type="text" className="jp-expr" value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} />
        <div className="tl-row tl-gap">
          <span className="tl-muted">Try:</span>
          {s.examples.map((x) => <button key={x} type="button" className="tl-btn secondary jp-example" onClick={() => setExpr(x)}><code>{x}</code></button>)}
        </div>
        <label className="tl-label" htmlFor="jp-doc">{mode === 'json' ? 'JSON' : 'XML'}</label>
        <ClearableTextarea id="jp-doc" className="tl-textarea" value={doc} onChange={(e) => setDoc(e.target.value)} spellCheck={false} />
      </div>
      <div className="tl-panel">
        {result.error ? <div className="tl-err">⚠ {result.error}</div> : (
          <>
            <div className="tl-row">
              <strong>{result.matches.length} match{result.matches.length === 1 ? '' : 'es'}</strong>
              <CopyButton text={() => (mode === 'json' ? JSON.stringify(result.matches.map((m) => m.value), null, 2) : result.matches.map((m) => show(m.value)).join('\n'))} label="Copy values" />
            </div>
            {result.matches.length > 0 && (
              <table className="tl-table">
                <tbody>
                  {result.matches.map((m, i) => (
                    <tr key={`${m.path}-${i}`}><th><code>{m.path}</code></th><td><pre className="jp-value">{show(m.value)}</pre></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
