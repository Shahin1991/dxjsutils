import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToolState } from '../../utils/toolState';
import { downloadFile } from '../../utils/clipboard';
import { buildSrcdoc } from './utils/srcdoc';

const SAMPLE = {
  html: '<h1>Hello, dxjsutils 👋</h1>\n<button id="btn">Click me</button>\n<p id="out"></p>',
  css: 'body { font-family: system-ui, sans-serif; padding: 16px; }\nh1 { color: #af0e20; }\nbutton { padding: 8px 14px; }',
  js: "let clicks = 0;\ndocument.getElementById('btn').addEventListener('click', () => {\n  clicks += 1;\n  document.getElementById('out').textContent = 'Clicked ' + clicks + ' time(s)';\n  console.log('click', { clicks });\n});\nconsole.log('Ready');",
};

export function CodePlayground() {
  const [code, setCode] = useToolState('code', SAMPLE);
  const [tab, setTab] = useToolState('tab', 'html');
  const [auto, setAuto] = useToolState('auto', true);
  const [run, setRun] = useState({ code, n: 0 });
  const [logs, setLogs] = useState([]);
  const token = useMemo(() => `pg-${run.n}-${Math.random().toString(36).slice(2)}`, [run]);
  const frameRef = useRef(null);

  // Debounced auto-run.
  useEffect(() => {
    if (!auto) return undefined;
    const id = setTimeout(() => setRun((r) => ({ code, n: r.n + 1 })), 600);
    return () => clearTimeout(id);
  }, [code, auto]);

  useEffect(() => {
    setLogs([]);
    const onMsg = (e) => {
      if (e.source !== frameRef.current?.contentWindow || !e.data || e.data.__pg !== token) return;
      setLogs((l) => [...l.slice(-199), { level: e.data.level, text: String(e.data.text) }]);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [token]);

  const srcdoc = useMemo(() => buildSrcdoc(run.code, token), [run, token]);
  const set = (k, v) => setCode((c) => ({ ...c, [k]: v }));
  const onKeyDown = (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const t = e.target;
      const { selectionStart: s, selectionEnd: en } = t;
      set(tab, `${t.value.slice(0, s)}  ${t.value.slice(en)}`);
      requestAnimationFrame(() => { t.selectionStart = s + 2; t.selectionEnd = s + 2; });
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      setRun((r) => ({ code, n: r.n + 1 }));
    }
  };

  return (
    <div className="tl-container pg-container">
      <h2 className="tl-title">🧑‍💻 Code Playground</h2>
      <p className="tl-desc">Write HTML, CSS and JavaScript and see the result live. Code runs in an isolated sandbox with no access to this app.</p>
      <div className="pg-layout">
        <div className="tl-panel pg-editor">
          <div className="tl-row">
            {[['html', 'HTML'], ['css', 'CSS'], ['js', 'JavaScript']].map(([id, label]) => (
              <button key={id} type="button" className={`tl-btn ${tab === id ? '' : 'secondary'}`} onClick={() => setTab(id)}>{label}</button>
            ))}
            <label className="tl-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-run</label>
            <button type="button" className="tl-btn" onClick={() => setRun((r) => ({ code, n: r.n + 1 }))} title="Ctrl/Cmd+Enter">▶ Run</button>
          </div>
          <textarea className="tl-textarea pg-code" value={code[tab]} onChange={(e) => set(tab, e.target.value)} onKeyDown={onKeyDown} spellCheck={false} aria-label={`${tab.toUpperCase()} code`} />
          <div className="tl-row tl-gap">
            <button type="button" className="tl-btn secondary" onClick={() => downloadFile('playground.html', new Blob([buildSrcdoc(code, 'export')], { type: 'text/html' }))}>⬇ Download as HTML</button>
            <button type="button" className="tl-btn secondary" onClick={() => setCode(SAMPLE)}>↺ Sample</button>
            <button type="button" className="tl-btn secondary" onClick={() => setCode({ html: '', css: '', js: '' })}>Clear all</button>
          </div>
        </div>
        <div className="pg-right">
          <div className="tl-panel pg-preview-panel">
            <iframe ref={frameRef} key={token} title="Preview" className="pg-frame" sandbox="allow-scripts allow-modals" srcDoc={srcdoc} />
          </div>
          <div className="tl-panel pg-console">
            <div className="tl-row"><strong>Console</strong><button type="button" className="tl-btn secondary" onClick={() => setLogs([])}>Clear</button></div>
            <div className="pg-logs" aria-live="polite">
              {logs.length === 0 ? <span className="tl-muted">console.log output appears here.</span> : logs.map((l, i) => <pre key={i} className={`pg-log pg-${l.level}`}>{l.text}</pre>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
