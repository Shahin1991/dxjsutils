import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { FileDrop } from '../../components/FileDrop';
import { downloadFile } from '../../utils/clipboard';
import { readJSON, writeJSON } from '../../utils/storage';
import { svgToPng } from '../../utils/svgExport';
import {
  addChild, addSibling, approxWidth, countNodes, createMap, edgePath, findNode, fromJson, fromOutline, layoutMap,
  moveNode, neighbour, newId, removeNode, shiftNode, toJson, toMarkdown, toSvg, updateNode,
} from './utils/mindmap';

const STORE = 'mindMaps';
const FONT = 'Inter Variable, Inter, "Segoe UI", Arial, sans-serif';
const SIZES = [17, 14.5, 13];

function loadStore() {
  const s = readJSON(STORE, null);
  if (s && Array.isArray(s.maps) && s.maps.length) return s;
  const first = { id: newId(), tree: createMap('My mind map'), updated: Date.now() };
  return { maps: [first], current: first.id };
}

// Text widths measured with a canvas so nodes fit their labels; falls back to an estimate.
function useMeasure() {
  return useMemo(() => {
    let ctx = null;
    try {
      if (!/jsdom/i.test(navigator.userAgent)) ctx = document.createElement('canvas').getContext('2d');
    } catch (e) {
      ctx = null;
    }
    if (!ctx) return approxWidth;
    const cache = new Map();
    return (text, depth) => {
      const key = `${Math.min(depth, 2)}|${text}`;
      if (!cache.has(key)) {
        ctx.font = `${depth <= 1 ? 600 : 400} ${SIZES[Math.min(depth, 2)]}px ${FONT}`;
        cache.set(key, Math.min(320, Math.max(depth === 0 ? 120 : 56, Math.ceil(ctx.measureText(text).width) + (depth === 0 ? 40 : 28))));
      }
      return cache.get(key);
    };
  }, []);
}

export function MindMap() {
  const [store, setStore] = useState(loadStore);
  const current = store.maps.find((m) => m.id === store.current) || store.maps[0];
  const [tree, setTree] = useState(current.tree);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [selected, setSelected] = useState(current.tree.id);
  const [editing, setEditingState] = useState(null); // { id, draft, isNew }
  // Live copy of `editing`, so a blur that fires after Enter cannot commit the same edit twice.
  const editRef = useRef(null);
  const setEditing = (v) => {
    editRef.current = v;
    setEditingState(v);
  };
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState(null); // { id, x, y, target }
  const [panel, setPanel] = useState(null); // 'import' | 'export' | 'delete'
  const [outline, setOutline] = useState('');
  const [error, setError] = useState('');
  const stageRef = useRef(null);
  const pointer = useRef(null);
  const lastClick = useRef(null); // manual double-click detection (pointer capture swallows dblclick)
  const measure = useMeasure();

  const layout = useMemo(() => layoutMap(tree, measure), [tree, measure]);

  // Autosave the current map.
  useEffect(() => {
    const id = setTimeout(() => {
      setStore((s) => {
        const next = { ...s, maps: s.maps.map((m) => (m.id === s.current ? { ...m, tree, updated: Date.now() } : m)) };
        writeJSON(STORE, next);
        return next;
      });
    }, 400);
    return () => clearTimeout(id);
  }, [tree]);

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const { minX, maxX, minY, maxY } = layout.bounds;
    const W = el.clientWidth || 800;
    const H = el.clientHeight || 500;
    const k = Math.max(0.25, Math.min(1.2, Math.min((W - 60) / (maxX - minX), (H - 60) / (maxY - minY))));
    setView({ k, x: W / 2 - ((minX + maxX) / 2) * k, y: H / 2 - ((minY + maxY) / 2) * k });
  }, [layout]);

  // Fit once when a map is opened.
  const fittedFor = useRef(null);
  useLayoutEffect(() => {
    if (fittedFor.current !== store.current) {
      fittedFor.current = store.current;
      fit();
    }
  }, [store.current, fit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the selected node on screen. Uses the latest view so it never undoes a fit made in the same render.
  useEffect(() => {
    const n = layout.nodes.find((x) => x.id === selected);
    const el = stageRef.current;
    if (!n || !el) return;
    setView((v) => {
      const m = 40;
      const left = v.x + (n.x - n.w / 2) * v.k;
      const right = v.x + (n.x + n.w / 2) * v.k;
      const top = v.y + (n.y - n.h / 2) * v.k;
      const bottom = v.y + (n.y + n.h / 2) * v.k;
      let { x, y } = v;
      if (left < m) x += m - left;
      else if (right > el.clientWidth - m) x -= right - (el.clientWidth - m);
      if (top < m) y += m - top;
      else if (bottom > el.clientHeight - m) y -= bottom - (el.clientHeight - m);
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
  }, [selected, layout]);

  const apply = (next, sel = selected) => {
    if (next === tree) return;
    setHistory((h) => ({ past: [...h.past.slice(-99), tree], future: [] }));
    setTree(next);
    setSelected(sel);
  };
  const undo = () => {
    if (!history.past.length) return;
    const prev = history.past[history.past.length - 1];
    setHistory((h) => ({ past: h.past.slice(0, -1), future: [tree, ...h.future] }));
    setTree(prev);
    if (!findNode(prev, selected)) setSelected(prev.id);
  };
  const redo = () => {
    if (!history.future.length) return;
    const [next, ...rest] = history.future;
    setHistory((h) => ({ past: [...h.past, tree], future: rest }));
    setTree(next);
    if (!findNode(next, selected)) setSelected(next.id);
  };

  const focusStage = () => requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }));
  const startEdit = (id, draft, isNew = false) => {
    const f = findNode(tree, id);
    setSelected(id);
    setEditing({ id, draft: draft ?? f?.node.text ?? '', isNew });
  };
  const commitEdit = (then) => {
    const ed = editRef.current;
    if (!ed) return tree;
    const text = ed.draft.trim();
    let next = tree;
    let sel = ed.id;
    if (!text && ed.isNew) {
      const r = removeNode(tree, ed.id);
      next = r.tree;
      sel = findNode(tree, ed.id)?.parent?.id || r.id;
    } else if (text) next = updateNode(tree, ed.id, { text });
    setEditing(null);
    if (then) then(next, sel);
    else {
      apply(next, sel);
      focusStage();
    }
    return next;
  };
  const cancelEdit = () => {
    const ed = editRef.current;
    if (!ed) return;
    if (ed.isNew) {
      const parent = findNode(tree, ed.id)?.parent?.id;
      setTree(removeNode(tree, ed.id).tree);
      setHistory((h) => ({ past: h.past.slice(0, -1), future: h.future }));
      setSelected(parent || tree.id);
    }
    setEditing(null);
    focusStage();
  };

  const add = (kind, base = tree, from = selected) => {
    const r = kind === 'child' ? addChild(base, from) : addSibling(base, from);
    if (base !== tree) {
      setHistory((h) => ({ past: [...h.past.slice(-99), tree], future: [] }));
      setTree(r.tree);
    } else apply(r.tree, r.id);
    setSelected(r.id);
    setEditing({ id: r.id, draft: '', isNew: true });
  };

  const onKeyDown = (e) => {
    if (editing || panel) return;
    const mod = e.metaKey || e.ctrlKey;
    const go = (dir) => {
      const n = neighbour(layout, selected, dir);
      if (n) setSelected(n);
    };
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (e.key === 'Tab' || e.key === 'Insert') {
      e.preventDefault();
      add('child');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      add(selected === tree.id ? 'child' : 'sibling');
    } else if (e.key === 'F2') {
      e.preventDefault();
      startEdit(selected);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const r = removeNode(tree, selected);
      apply(r.tree, r.id);
    } else if (e.key === ' ') {
      e.preventDefault();
      const f = findNode(tree, selected);
      if (f?.node.children.length) apply(updateNode(tree, selected, { collapsed: !f.node.collapsed }));
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      apply(shiftNode(tree, selected, e.key === 'ArrowUp' ? -1 : 1));
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      go(e.key.slice(5).toLowerCase());
    } else if (e.key === 'Escape') {
      setSelected(tree.id);
    } else if (e.key.length === 1 && !mod && !e.altKey) {
      // Start typing to replace the label, like most mind-map apps.
      e.preventDefault();
      startEdit(selected, e.key);
    } else return;
    e.stopPropagation(); // keep keys like ? from also opening the app's help
  };

  // Wheel pans; Ctrl/Cmd + wheel or a trackpad pinch zooms around the cursor (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      if (!e.ctrlKey && !e.metaKey) {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
        return;
      }
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setView((v) => {
        const k = Math.max(0.2, Math.min(3, v.k * Math.exp(-e.deltaY * 0.01)));
        return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (f) => {
    const el = stageRef.current;
    const cx = (el?.clientWidth || 800) / 2;
    const cy = (el?.clientHeight || 500) / 2;
    setView((v) => {
      const k = Math.max(0.2, Math.min(3, v.k * f));
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });
  };

  // Pointer: drag the background to pan; drag a node onto another to move it there.
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const nodeEl = e.target.closest('[data-id]');
    if (e.target.closest('input, button')) return;
    if (editing) commitEdit();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, id: nodeEl?.dataset.id || null, moved: false };
    if (nodeEl) setSelected(nodeEl.dataset.id);
    stageRef.current.focus({ preventScroll: true });
  };
  const onPointerMove = (e) => {
    const p = pointer.current;
    if (!p) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    if (!p.moved && Math.hypot(dx, dy) < 5) return;
    p.moved = true;
    if (p.id && p.id !== tree.id) {
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]')?.dataset.id;
      const r = stageRef.current.getBoundingClientRect();
      p.target = over && over !== p.id ? over : null; // kept on the ref so a quick drop still sees it
      setDrag({ id: p.id, x: e.clientX - r.left, y: e.clientY - r.top, target: p.target });
    } else if (!p.id) setView((v) => ({ ...v, x: p.vx + dx, y: p.vy + dy }));
  };
  const onPointerUp = () => {
    const p = pointer.current;
    pointer.current = null;
    if (p?.moved && p.id && p.target) apply(moveNode(tree, p.id, p.target), p.id);
    setDrag(null);
    if (p && !p.moved && p.id) {
      if (lastClick.current?.id === p.id && Date.now() - lastClick.current.t < 350) startEdit(p.id);
      lastClick.current = { id: p.id, t: Date.now() };
    }
  };

  const toggle = (id) => {
    const f = findNode(tree, id);
    apply(updateNode(tree, id, { collapsed: !f.node.collapsed }), id);
  };

  // ---- maps ----
  const switchMap = (id) => {
    if (editing) commitEdit();
    const m = store.maps.find((x) => x.id === id);
    const next = { ...store, current: id, maps: store.maps.map((x) => (x.id === store.current ? { ...x, tree } : x)) };
    setStore(next);
    writeJSON(STORE, next);
    setTree(m.tree);
    setSelected(m.tree.id);
    setHistory({ past: [], future: [] });
    setPanel(null);
  };
  const newMap = (t = createMap()) => {
    const m = { id: newId(), tree: t, updated: Date.now() };
    const next = { maps: [...store.maps.map((x) => (x.id === store.current ? { ...x, tree } : x)), m], current: m.id };
    setStore(next);
    writeJSON(STORE, next);
    setTree(t);
    setSelected(t.id);
    setHistory({ past: [], future: [] });
    setPanel(null);
    focusStage();
  };
  const deleteMap = () => {
    const rest = store.maps.filter((m) => m.id !== store.current);
    if (!rest.length) {
      const t = createMap();
      const m = { id: newId(), tree: t, updated: Date.now() };
      setStore({ maps: [m], current: m.id });
      writeJSON(STORE, { maps: [m], current: m.id });
      setTree(t);
      setSelected(t.id);
    } else {
      const next = { maps: rest, current: rest[0].id };
      setStore(next);
      writeJSON(STORE, next);
      setTree(rest[0].tree);
      setSelected(rest[0].tree.id);
    }
    setHistory({ past: [], future: [] });
    setPanel(null);
  };

  const importOutline = () => {
    try {
      newMap(fromOutline(outline));
      setOutline('');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  const importFile = async ([f]) => {
    try {
      const text = await f.text();
      newMap(/\.json$/i.test(f.name) ? fromJson(text) : fromOutline(text));
      setError('');
    } catch (e) {
      setError(`${f.name}: ${e.message}`);
    }
  };

  const svgFor = () => {
    const light = document.documentElement.classList.contains('light');
    const accent = getComputedStyle(stageRef.current || document.body).getPropertyValue('--color-primary').trim() || '#af0e20';
    return toSvg(layoutMap(tree, measure), light ? { accent } : { background: '#0d1117', text: '#f0f6fc', node: '#161b22', accent });
  };
  const fileBase = (tree.text || 'mind-map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'mind-map';
  const exportAs = async (kind) => {
    try {
      if (kind === 'png') {
        const light = document.documentElement.classList.contains('light');
        downloadFile(`${fileBase}.png`, await svgToPng(svgFor(), { background: light ? '#ffffff' : '#0d1117' }));
      } else if (kind === 'svg') downloadFile(`${fileBase}.svg`, new Blob([svgFor()], { type: 'image/svg+xml' }));
      else if (kind === 'md') downloadFile(`${fileBase}.md`, new Blob([toMarkdown(tree)], { type: 'text/markdown' }));
      else downloadFile(`${fileBase}.mindmap.json`, new Blob([toJson(tree)], { type: 'application/json' }));
    } catch (e) {
      setError(e.message);
    }
  };

  const sel = findNode(tree, selected);
  const dragNode = drag && layout.nodes.find((n) => n.id === drag.id);

  return (
    <div className="tl-container mm-container">
      <h2 className="tl-title">🧠 Mind Map</h2>
      <p className="tl-desc">Brainstorm and organise ideas visually. Maps are saved automatically on this device.</p>
      <div className="tl-panel mm-toolbar">
        <div className="tl-row">
          <select value={store.current} onChange={(e) => switchMap(e.target.value)} aria-label="Open a mind map" className="mm-select">
            {store.maps.map((m) => <option key={m.id} value={m.id}>{(m.id === store.current ? tree : m.tree).text || 'Untitled'}</option>)}
          </select>
          <button type="button" className="tl-btn secondary" onClick={() => newMap()}>+ New map</button>
          <button type="button" className={`tl-btn secondary ${panel === 'import' ? 'active' : ''}`} onClick={() => setPanel(panel === 'import' ? null : 'import')}>Import</button>
          <button type="button" className={`tl-btn secondary ${panel === 'export' ? 'active' : ''}`} onClick={() => setPanel(panel === 'export' ? null : 'export')}>Export</button>
          <button type="button" className="tl-btn secondary" onClick={() => setPanel(panel === 'delete' ? null : 'delete')}>🗑 Delete map</button>
        </div>
        <div className="tl-row mm-actions">
          <button type="button" className="tl-btn" onClick={() => add('child')} title="Tab">+ Child</button>
          <button type="button" className="tl-btn secondary" onClick={() => add('sibling')} disabled={selected === tree.id} title="Enter">+ Sibling</button>
          <button type="button" className="tl-btn secondary" onClick={() => startEdit(selected)} title="F2 or double-click">✎ Rename</button>
          <button type="button" className="tl-btn secondary" onClick={() => { const r = removeNode(tree, selected); apply(r.tree, r.id); }} disabled={selected === tree.id} title="Delete">✕ Delete</button>
          <button type="button" className="tl-btn secondary" onClick={() => toggle(selected)} disabled={!sel?.node.children.length} title="Space">{sel?.node.collapsed ? '⊞ Expand' : '⊟ Collapse'}</button>
          <span className="mm-sep" />
          <button type="button" className="tl-btn secondary" onClick={undo} disabled={!history.past.length} title="Ctrl/Cmd+Z" aria-label="Undo">↶</button>
          <button type="button" className="tl-btn secondary" onClick={redo} disabled={!history.future.length} title="Ctrl/Cmd+Shift+Z" aria-label="Redo">↷</button>
          <span className="mm-sep" />
          <button type="button" className="tl-btn secondary" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">−</button>
          <span className="tl-muted mm-zoom">{Math.round(view.k * 100)}%</span>
          <button type="button" className="tl-btn secondary" onClick={() => zoom(1.2)} aria-label="Zoom in">+</button>
          <button type="button" className="tl-btn secondary" onClick={fit}>Fit</button>
          <span className="tl-muted">{countNodes(tree)} ideas</span>
        </div>
        {panel === 'delete' && (
          <div className="tl-row mm-confirm">
            <span>Delete “{tree.text}” permanently?</span>
            <button type="button" className="tl-btn" onClick={deleteMap}>Delete</button>
            <button type="button" className="tl-btn secondary" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        )}
        {panel === 'export' && (
          <div className="tl-row">
            <button type="button" className="tl-btn secondary" onClick={() => exportAs('png')}>PNG image</button>
            <button type="button" className="tl-btn secondary" onClick={() => exportAs('svg')}>SVG image</button>
            <button type="button" className="tl-btn secondary" onClick={() => exportAs('md')}>Markdown outline</button>
            <button type="button" className="tl-btn secondary" onClick={() => exportAs('json')}>Mind map file (.json)</button>
            <CopyButton text={() => toMarkdown(tree)} label="Copy outline" />
          </div>
        )}
        {panel === 'import' && (
          <div className="mm-import">
            <FileDrop accept=".json,.md,.txt" onFiles={importFile} hint="Drop a .mindmap.json, .md or .txt outline, or" />
            <label className="tl-label" htmlFor="mm-outline">…or paste an outline (Markdown headings / bullets, or indented lines)</label>
            <textarea id="mm-outline" className="tl-textarea" value={outline} onChange={(e) => setOutline(e.target.value)} placeholder={'# Project\n- Goals\n  - Faster check-in\n- Risks'} />
            <div className="tl-row tl-gap"><button type="button" className="tl-btn" onClick={importOutline} disabled={!outline.trim()}>Create map from outline</button></div>
          </div>
        )}
        {error && <div className="tl-err">⚠ {error}</div>}
      </div>

      <div
        ref={stageRef}
        className="mm-stage"
        tabIndex={0}
        role="application"
        aria-label="Mind map canvas. Arrow keys move between ideas, Tab adds a child, Enter adds a sibling, F2 renames, Delete removes, Space collapses."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mm-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="mm-edges" width="1" height="1" aria-hidden="true">
            {layout.edges.map((e) => <path key={e.to} d={edgePath(e)} stroke={e.color} strokeWidth={e.depth === 1 ? 3 : 2} fill="none" strokeLinecap="round" />)}
          </svg>
          {layout.nodes.map((n) => (
            <div
              key={n.id}
              data-id={n.id}
              className={`mm-node d${Math.min(n.depth, 2)} ${n.id === selected ? 'sel' : ''} ${drag?.target === n.id ? 'drop' : ''} ${drag?.id === n.id ? 'dragging' : ''}`}
              style={{ left: n.x - n.w / 2, top: n.y - n.h / 2, width: n.w, height: n.h, '--branch': n.color || 'var(--color-primary)' }}
              title={n.text}
            >
              {editing?.id === n.id ? (
                <input
                  className="mm-edit"
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                  value={editing.draft}
                  aria-label="Idea text"
                  onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                  onFocus={(e) => { if (editing.draft.length > 1) e.target.select(); else e.target.setSelectionRange(1, 1); }}
                  onBlur={() => commitEdit()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (editing.isNew && editing.draft.trim() && n.id !== tree.id) commitEdit((t, s) => add('sibling', t, s));
                      else commitEdit();
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      if (editing.draft.trim()) commitEdit((t, s) => add('child', t, s));
                    } else if (e.key === 'Escape') cancelEdit();
                  }}
                />
              ) : <span className="mm-text">{n.text || ' '}</span>}
              {n.childCount > 0 && n.depth > 0 && (
                <button type="button" className={`mm-toggle ${n.side < 0 ? 'left' : 'right'}`} onClick={() => toggle(n.id)} aria-label={n.collapsed ? `Expand ${n.text}` : `Collapse ${n.text}`}>
                  {n.collapsed ? n.childCount : '−'}
                </button>
              )}
            </div>
          ))}
        </div>
        {dragNode && <div className="mm-ghost" style={{ left: drag.x + 12, top: drag.y + 8 }}>{dragNode.text}{drag.target ? ' → drop to move here' : ''}</div>}
      </div>
      <p className="tl-muted tl-gap mm-help">
        <kbd>Tab</kbd> child · <kbd>Enter</kbd> sibling · <kbd>F2</kbd> or double-click rename · type to replace · <kbd>Del</kbd> delete · <kbd>Space</kbd> collapse ·
        arrows move · <kbd>Alt</kbd>+<kbd>↑↓</kbd> reorder · drag an idea onto another to move it · drag the background or scroll to pan · <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+scroll or pinch to zoom
      </p>
    </div>
  );
}
