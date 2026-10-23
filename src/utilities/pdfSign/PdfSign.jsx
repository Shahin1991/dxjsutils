import React, { useEffect, useRef, useState } from 'react';
import { FileDrop } from '../../components/FileDrop';
import { downloadFile } from '../../utils/clipboard';
import { applyToPdf, readForm } from './utils/sign';
import { imageFileToPng, textPng, trimmedPng } from './utils/ink';

const SIG_FONT = '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Lucida Handwriting", cursive';
const TEXT_FONT = 'Helvetica, Arial, sans-serif';
let nextId = 1;

function SignaturePad({ onUse }) {
  const [tab, setTab] = useState('draw');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const drawing = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (tab !== 'draw') return;
    const c = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1f5c';
    setHasInk(false);
  }, [tab]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = point(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const [x, y] = point(e);
    const [px, py] = drawing.current;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawing.current = [x, y];
    setHasInk(true);
  };
  const up = () => { drawing.current = null; };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const use = async (fileList) => {
    setError('');
    try {
      let sig;
      if (tab === 'draw') sig = trimmedPng(canvasRef.current, 6);
      else if (tab === 'type') sig = textPng(typed.trim(), `96px ${SIG_FONT}`, '#0b1f5c');
      else sig = await imageFileToPng(fileList[0]);
      if (!sig) throw new Error('Draw your signature first');
      onUse(sig);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="tl-row">
        {[['draw', '✍️ Draw'], ['type', '⌨️ Type'], ['upload', '🖼️ Upload image']].map(([id, label]) => (
          <button key={id} type="button" className={`tl-btn ${tab === id ? '' : 'secondary'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'draw' && (
        <>
          <canvas ref={canvasRef} className="ps-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            aria-label="Signature drawing area: draw with your mouse, finger or pen" />
          <div className="tl-row tl-gap">
            <button type="button" className="tl-btn" onClick={() => use()} disabled={!hasInk}>Use this signature</button>
            <button type="button" className="tl-btn secondary" onClick={clear} disabled={!hasInk}>Clear</button>
          </div>
        </>
      )}
      {tab === 'type' && (
        <>
          <input type="text" className="ps-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your name" style={{ fontFamily: SIG_FONT }} aria-label="Type your name" />
          <div className="tl-row tl-gap"><button type="button" className="tl-btn" onClick={() => use()} disabled={!typed.trim()}>Use this signature</button></div>
        </>
      )}
      {tab === 'upload' && <FileDrop accept="image/png,image/jpeg,image/webp" onFiles={use} hint="Drop a signature image (PNG with a transparent background works best) or" />}
      {error && <div className="tl-err">⚠ {error}</div>}
    </div>
  );
}

function PageView({ pdf, index, items, selected, onSelect, onMove }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState(null); // CSS px of the rendered page
  const drag = useRef(null);

  useEffect(() => {
    let task;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      const cssWidth = Math.min(wrapRef.current.clientWidth || 800, 900);
      const scale = cssWidth / base.width;
      const ratio = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: scale * ratio });
      const c = canvasRef.current;
      if (cancelled || !c) return;
      c.width = vp.width;
      c.height = vp.height;
      setSize({ width: cssWidth, height: base.height * scale });
      task = page.render({ canvasContext: c.getContext('2d'), viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, index]);

  const startDrag = (e, it) => {
    e.stopPropagation();
    onSelect(it.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: it.id, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y };
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d || !size) return;
    onMove(d.id, d.x + (e.clientX - d.sx) / size.width, d.y + (e.clientY - d.sy) / size.height);
  };

  return (
    <div ref={wrapRef} className="ps-page-wrap">
      <div className="ps-page" style={size ? { width: size.width, height: size.height } : undefined} onPointerDown={() => onSelect(null)}>
        <canvas ref={canvasRef} style={size ? { width: size.width, height: size.height } : undefined} />
        {size && items.map((it) => (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            aria-label={it.kind === 'text' ? `Text: ${it.text}` : 'Signature'}
            className={`ps-item ${selected === it.id ? 'selected' : ''}`}
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, ...(it.kind === 'text' ? { fontSize: it.size * size.height, fontFamily: TEXT_FONT } : { width: `${it.w * 100}%`, height: `${it.h * 100}%` }) }}
            onPointerDown={(e) => startDrag(e, it)}
            onPointerMove={moveDrag}
            onPointerUp={() => { drag.current = null; }}
            onFocus={() => onSelect(it.id)}
          >
            {it.kind === 'text' ? it.text : <img src={it.src} alt="" draggable={false} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PdfSign() {
  const [file, setFile] = useState(null); // { name, bytes, pages }
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(0);
  const [fields, setFields] = useState([]);
  const [flatten, setFlatten] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [signature, setSignature] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => () => pdf?.destroy(), [pdf]);

  const open = async ([f]) => {
    setMsg(null);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const form = await readForm(bytes);
      const { openPdf } = await import('./utils/render');
      const doc = await openPdf(bytes);
      setFile({ name: f.name, bytes, pages: form.pages });
      setFields(form.fields);
      setPdf(doc);
      setPage(0);
      setItems([]);
      setSelected(null);
    } catch (e) {
      setMsg({ error: `${f.name}: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  // Width/height of the displayed page, so image boxes keep their aspect ratio.
  const pageAspect = () => {
    const el = document.querySelector('.ps-page');
    return el ? el.clientWidth / el.clientHeight : 1 / 1.414;
  };
  const add = (item) => {
    // Offset each new item a little so they don't land exactly on top of each other.
    const n = items.filter((i) => i.page === page).length % 8;
    const it = { id: nextId++, page, x: 0.35 + n * 0.02, y: 0.45 + n * 0.04, ...item };
    setItems((cur) => [...cur, it]);
    setSelected(it.id);
  };
  const addSignature = () => {
    const w = 0.28;
    add({ kind: 'image', src: signature.src, aspect: signature.aspect, w, h: (w / signature.aspect) * pageAspect() });
  };
  const addText = (t) => {
    if (!t.trim()) return;
    add({ kind: 'text', text: t, size: 0.016 });
  };

  const update = (id, patch) => setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const move = (id, x, y) => {
    const it = items.find((i) => i.id === id);
    const w = it.kind === 'text' ? 0.05 : it.w;
    const h = it.kind === 'text' ? it.size : it.h;
    update(id, { x: Math.min(1 - w, Math.max(0, x)), y: Math.min(1 - h, Math.max(0, y)) });
  };
  const remove = (id) => {
    setItems((cur) => cur.filter((it) => it.id !== id));
    setSelected(null);
  };
  const sel = items.find((it) => it.id === selected);

  useEffect(() => {
    const onKey = (e) => {
      if (!sel || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const step = e.shiftKey ? 0.02 : 0.004;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        move(sel.id, sel.x + d[0], sel.y + d[1]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove(sel.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const resize = (v) => {
    if (sel.kind === 'text') update(sel.id, { size: v });
    else update(sel.id, { w: v, h: (v / sel.aspect) * pageAspect() });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const prepared = items.map((it) => {
        if (it.kind !== 'text') return it;
        const png = textPng(it.text, `64px ${TEXT_FONT}`);
        const h = it.size * 0.78;
        return { ...it, fallbackSrc: png.src, h, w: h * png.aspect * (1 / pageAspect()) };
      });
      const changed = fields.filter((f) => f.dirty);
      const out = await applyToPdf(file.bytes, { items: prepared, fields: changed, flatten });
      const name = `${file.name.replace(/\.pdf$/i, '')}-signed.pdf`;
      downloadFile(name, new Blob([out], { type: 'application/pdf' }));
      setMsg({ ok: `Saved ${name}` });
    } catch (e) {
      setMsg({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const setField = (name, value) => setFields((cur) => cur.map((f) => (f.name === name ? { ...f, value, dirty: true } : f)));
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="tl-container ps-container">
      <h2 className="tl-title">✒️ Sign &amp; Fill PDF</h2>
      <p className="tl-desc">Add your signature, text and dates to a PDF, and fill in its form fields. The file never leaves your device.</p>
      <div className="tl-panel">
        <FileDrop accept=".pdf,application/pdf" onFiles={open} hint={file ? `${file.name} · drop another PDF or` : 'Drop a PDF here or'} />
        {busy && !pdf && <span className="tl-muted">Opening…</span>}
        {msg?.error && <div className="tl-err">⚠ {msg.error}</div>}
        {msg?.ok && <div className="tl-ok">✓ {msg.ok}</div>}
      </div>
      {pdf && (
        <div className="ps-layout">
          <div className="ps-side">
            <div className="tl-panel">
              <strong>Signature</strong>
              {signature ? (
                <div className="tl-gap">
                  <img src={signature.src} alt="Your signature" className="ps-sig-preview" />
                  <div className="tl-row tl-gap">
                    <button type="button" className="tl-btn" onClick={addSignature}>+ Add to page {page + 1}</button>
                    <button type="button" className="tl-btn secondary" onClick={() => setSignature(null)}>Change</button>
                  </div>
                </div>
              ) : <div className="tl-gap"><SignaturePad onUse={setSignature} /></div>}
            </div>
            <div className="tl-panel">
              <strong>Text</strong>
              <div className="tl-row tl-gap">
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, title…" onKeyDown={(e) => e.key === 'Enter' && addText(text)} style={{ flex: 1 }} aria-label="Text to add" />
                <button type="button" className="tl-btn" onClick={() => addText(text)} disabled={!text.trim()}>+ Add</button>
              </div>
              <div className="tl-row">
                <button type="button" className="tl-btn secondary" onClick={() => addText(today)}>+ Today’s date</button>
                <button type="button" className="tl-btn secondary" onClick={() => addText('✓')}>+ ✓</button>
                <button type="button" className="tl-btn secondary" onClick={() => addText('X')}>+ X</button>
              </div>
            </div>
            {sel && (
              <div className="tl-panel">
                <strong>Selected {sel.kind === 'text' ? 'text' : 'signature'}</strong>
                <div className="tl-gap" />
                <label className="tl-check">Size
                  <input type="range" min={sel.kind === 'text' ? 0.006 : 0.08} max={sel.kind === 'text' ? 0.06 : 0.7} step="0.001"
                    value={sel.kind === 'text' ? sel.size : sel.w} onChange={(e) => resize(Number(e.target.value))} aria-label="Size" />
                </label>
                <div className="tl-row tl-gap"><button type="button" className="tl-btn secondary" onClick={() => remove(sel.id)}>🗑 Remove</button></div>
                <p className="tl-muted">Drag to move. Arrow keys nudge (Shift for bigger steps), Delete removes.</p>
              </div>
            )}
            {fields.length > 0 && (
              <div className="tl-panel">
                <strong>Form fields ({fields.length})</strong>
                <div className="ps-fields tl-gap">
                  {fields.map((f) => (
                    <label key={f.name} className={f.type === 'checkbox' ? 'tl-check' : ''}>
                      {f.type === 'checkbox' ? (
                        <><input type="checkbox" checked={f.value} onChange={(e) => setField(f.name, e.target.checked)} /> {f.name}</>
                      ) : (
                        <>
                          <span className="tl-label">{f.name}</span>
                          {f.type === 'select' ? (
                            <select value={f.value} onChange={(e) => setField(f.name, e.target.value)}>
                              <option value="">—</option>
                              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : <input type="text" value={f.value} onChange={(e) => setField(f.name, e.target.value)} />}
                        </>
                      )}
                    </label>
                  ))}
                </div>
                <label className="tl-check tl-gap" title="Turns the fields into plain content so they can no longer be edited">
                  <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> Flatten (lock) the form
                </label>
              </div>
            )}
            <div className="tl-panel">
              <button type="button" className="tl-btn" onClick={save} disabled={busy || (!items.length && !fields.some((f) => f.dirty))}>
                {busy ? 'Saving…' : '⬇ Save signed PDF'}
              </button>
              <p className="tl-muted tl-gap">{items.length} item{items.length === 1 ? '' : 's'} placed.</p>
            </div>
          </div>
          <div className="tl-panel ps-main">
            <div className="tl-row">
              <button type="button" className="tl-btn secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">◀</button>
              <span>Page {page + 1} of {file.pages}</span>
              <button type="button" className="tl-btn secondary" disabled={page >= file.pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">▶</button>
            </div>
            <PageView pdf={pdf} index={page} items={items.filter((it) => it.page === page)} selected={selected} onSelect={setSelected} onMove={move} />
          </div>
        </div>
      )}
    </div>
  );
}

