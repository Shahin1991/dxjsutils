import React, { useEffect, useRef, useState } from 'react';
import { useToolState } from '../../utils/toolState';
import { downloadFile } from '../../utils/clipboard';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { SAMPLES } from './utils/samples';
import { svgToPng } from '../../utils/svgExport';

let renderSeq = 0;
let mermaidPromise;
const isLight = () => document.documentElement.classList.contains('light');

// Mermaid is ~1 MB, so it is fetched only when this tool is opened.
function loadMermaid() {
  if (!mermaidPromise) mermaidPromise = import('mermaid').then((m) => m.default);
  return mermaidPromise;
}

async function renderDiagram(code) {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: isLight() ? 'default' : 'dark',
    htmlLabels: false, // plain SVG text, so PNG export works
    flowchart: { htmlLabels: false },
  });
  await mermaid.parse(code);
  renderSeq += 1;
  const { svg } = await mermaid.render(`dx-mermaid-${renderSeq}`, code);
  return svg;
}

export function DiagramEditor() {
  const [code, setCode] = useToolState('code', SAMPLES.Flowchart);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  useEffect(() => {
    const id = setTimeout(async () => {
      const mine = ++latest.current;
      try {
        const out = code.trim() ? await renderDiagram(code) : '';
        if (mine === latest.current) {
          setSvg(out);
          setError('');
        }
      } catch (e) {
        if (mine === latest.current) setError(String(e?.message || e).split('\n').slice(0, 6).join('\n'));
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [code]);

  const png = async () => {
    try {
      downloadFile('diagram.png', await svgToPng(svg, { background: isLight() ? '#ffffff' : '#0d1117' }));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="tl-container dg-container">
      <h2 className="tl-title">📈 Diagram Editor</h2>
      <p className="tl-desc">Write diagrams as text (Mermaid syntax): flowcharts, sequence, Gantt, class, state, ER, pie, mind maps and timelines.</p>
      <div className="tl-panel">
        <div className="tl-row">
          <span className="tl-muted">Start from:</span>
          {Object.keys(SAMPLES).map((k) => <button key={k} type="button" className="tl-btn secondary" onClick={() => setCode(SAMPLES[k])}>{k}</button>)}
        </div>
      </div>
      <div className="tl-split dg-split">
        <div className="tl-panel">
          <label className="tl-label" htmlFor="dg-code">Diagram code</label>
          <ClearableTextarea id="dg-code" className="tl-textarea dg-code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
          <p className="tl-muted tl-gap">Syntax help: <a href="https://mermaid.js.org/intro/syntax-reference.html" target="_blank" rel="noreferrer noopener">mermaid.js.org</a></p>
        </div>
        <div className="tl-panel">
          <div className="tl-row">
            <strong>Preview</strong>
            <button type="button" className="tl-btn secondary" disabled={!svg} onClick={() => downloadFile('diagram.svg', new Blob([svg], { type: 'image/svg+xml' }))}>⬇ SVG</button>
            <button type="button" className="tl-btn secondary" disabled={!svg} onClick={png}>⬇ PNG</button>
          </div>
          {error && <pre className="tl-err dg-error">⚠ {error}</pre>}
          {loading && !svg && !error && <span className="tl-muted">Loading the diagram engine…</span>}
          {/* Mermaid output is generated with securityLevel 'strict', which sanitises labels and disables scripts and click handlers. */}
          {/* eslint-disable-next-line react/no-danger */}
          <div className={`dg-preview ${error ? 'stale' : ''}`} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
    </div>
  );
}
