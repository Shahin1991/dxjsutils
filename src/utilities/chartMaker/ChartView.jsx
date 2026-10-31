import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FONT, THEMES, hitTest, layoutChart, seriesColor } from './utils/layout';
import { formatNumber } from './utils/scale';

// Follows the app's light/dark switch (a class on <html>).
function useTheme() {
  const read = () => (document.documentElement.classList.contains('light') ? 'light' : 'dark');
  const [name, setName] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setName(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return name;
}

function useWidth(ref) {
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const T = { fontSize: 12, fontFamily: FONT };

function Tooltip({ model, scene, active, theme, wrapW }) {
  if (!active) return null;
  let title;
  let items;
  let ax;
  let ay;
  if (active.dot != null) {
    const d = scene.dots[active.dot];
    title = String(d.p.label);
    items = [{ s: d.s, v: d.p.y }];
    [ax, ay] = [d.x, d.y];
  } else {
    const r = model.rows[active.row];
    title = String(r.label);
    items = r.values.map((v, s) => ({ s, v })).filter((it) => it.v != null);
    if (scene.chart === 'stacked' && items.length > 1) items.push({ total: true, v: items.reduce((a, it) => a + it.v, 0) });
    if (scene.horizontal) [ax, ay] = [scene.plot.x + scene.plot.w * 0.6, scene.catTicks[active.row].pos];
    else [ax, ay] = [scene.px(active.row), active.py ?? scene.plot.y + scene.plot.h / 2];
  }
  const flip = ax > wrapW * 0.6;
  const style = { top: ay, [flip ? 'right' : 'left']: flip ? wrapW - ax + 14 : ax + 14 };
  return (
    <div className="cmk-tip" style={style} role="status">
      <div className="cmk-tip-title">{title}</div>
      {items.map((it, i) => (
        <div className="cmk-tip-row" key={i}>
          {it.total ? <span className="cmk-key" /> : <span className="cmk-key" style={{ background: seriesColor(theme, model.series[it.s].slot) }} />}
          <strong>{formatNumber(it.v)}</strong>
          <span className="cmk-tip-name">{it.total ? 'Total' : model.series[it.s].name}</span>
        </div>
      ))}
    </div>
  );
}

// The chart itself. `ref.svg()` returns the chart as a standalone SVG string (no hover layer) for export.
export const ChartView = forwardRef(function ChartView({ model, chart, zero, labels, title, subtitle, description }, ref) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(wrapRef);
  const themeName = useTheme();
  const theme = THEMES[themeName];
  const [active, setActive] = useState(null);
  const scene = useMemo(() => layoutChart(model, { chart, width, zero, labels, title, subtitle, theme }), [model, chart, width, zero, labels, title, subtitle, theme]);

  useEffect(() => setActive(null), [model, chart]);

  useImperativeHandle(ref, () => ({
    svg() {
      const clone = svgRef.current.cloneNode(true);
      clone.querySelectorAll('.cmk-hover').forEach((n) => n.remove());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return new XMLSerializer().serializeToString(clone);
    },
    background: theme.surface,
  }));

  const toLocal = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) * scene.W) / (r.width || scene.W), ((e.clientY - r.top) * scene.H) / (r.height || scene.H)];
  };
  const onMove = (e) => {
    const [x, y] = toLocal(e);
    const hit = hitTest(scene, model, x, y);
    setActive(hit && { ...hit, py: Math.max(scene.plot.y + 40, y) });
  };

  // Arrow keys walk through the data with the same readout as hover.
  const onKey = (e) => {
    const count = scene.chart === 'scatter' ? scene.dots.length : model.rows.length;
    if (!count) return;
    const key = scene.chart === 'scatter' ? 'dot' : 'row';
    const cur = active?.[key];
    const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let i;
    if (next) i = cur == null ? (next > 0 ? 0 : count - 1) : Math.max(0, Math.min(count - 1, cur + next));
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = count - 1;
    else if (e.key === 'Escape') {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive({ [key]: i });
  };

  const { plot } = scene;
  const empty = !(model.rows?.length || model.points?.some((p) => p.length));

  return (
    <div
      className="cmk-chart"
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
      aria-label={`${description}. Use the arrow keys to read values.`}
    >
      <svg
        ref={svgRef}
        width={scene.W}
        height={scene.H}
        viewBox={`0 0 ${scene.W} ${scene.H}`}
        role="img"
        aria-label={description}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        style={{ display: 'block', fontFamily: FONT }}
      >
        <rect width={scene.W} height={scene.H} fill={theme.surface} />
        {scene.header.map((h) => (
          <text key={h.kind} x={h.x} y={h.y} fill={h.kind === 'title' ? theme.ink : theme.muted} fontSize={h.kind === 'title' ? 16 : 12} fontWeight={h.kind === 'title' ? 700 : 400} fontFamily={FONT}>
            {h.text}
          </text>
        ))}
        {scene.legend.map((l) => (
          <g key={l.i}>
            {chart === 'line' ? (
              <line x1={l.x} x2={l.x + 14} y1={l.y} y2={l.y} stroke={l.color} strokeWidth={2} strokeLinecap="round" />
            ) : chart === 'scatter' ? (
              <circle cx={l.x + 7} cy={l.y} r={4} fill={l.color} />
            ) : (
              <rect x={l.x} y={l.y - 5} width={14} height={10} rx={2} fill={l.color} />
            )}
            <text x={l.x + 20} y={l.y + 4} fill={theme.ink2} {...T}>{l.text}</text>
          </g>
        ))}

        {/* Grid and axes: solid hairlines, one step off the surface */}
        {scene.horizontal ? (
          <g>
            {scene.valueTicks.map((t, i) => (
              <g key={i}>
                <line x1={t.pos} x2={t.pos} y1={plot.y} y2={plot.y + plot.h} stroke={theme.grid} strokeWidth={1} />
                <text x={t.pos} y={plot.y + plot.h + 18} textAnchor="middle" fill={theme.muted} {...T} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.label}</text>
              </g>
            ))}
            <line x1={scene.zeroPos} x2={scene.zeroPos} y1={plot.y} y2={plot.y + plot.h} stroke={theme.axis} strokeWidth={1} />
            {scene.catTicks.map((t, i) => (
              <text key={i} x={plot.x - 10} y={t.pos + 4} textAnchor="end" fill={theme.ink2} {...T}>
                <title>{t.full}</title>
                {t.label}
              </text>
            ))}
          </g>
        ) : (
          <g>
            {scene.yTicks.map((t, i) => (
              <g key={i}>
                <line x1={plot.x} x2={plot.x + plot.w} y1={t.pos} y2={t.pos} stroke={theme.grid} strokeWidth={1} />
                <text x={plot.x - 8} y={t.pos + 4} textAnchor="end" fill={theme.muted} {...T} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.label}</text>
              </g>
            ))}
            <line x1={plot.x} x2={plot.x + plot.w} y1={scene.zeroPos} y2={scene.zeroPos} stroke={theme.axis} strokeWidth={1} />
            {scene.xTicks.map((t, i) =>
              scene.rotate ? (
                <text key={i} x={t.pos} y={plot.y + plot.h + 14} textAnchor="end" transform={`rotate(-40 ${t.pos} ${plot.y + plot.h + 14})`} fill={theme.muted} {...T}>
                  {t.full != null && <title>{t.full}</title>}
                  {t.label}
                </text>
              ) : (
                <text key={i} x={t.pos} y={plot.y + plot.h + 18} textAnchor="middle" fill={theme.muted} {...T}>
                  {t.full != null && <title>{t.full}</title>}
                  {t.label}
                </text>
              )
            )}
            {scene.xTitle && (
              <text x={plot.x + plot.w / 2} y={plot.y + plot.h + scene.xBottom + 14} textAnchor="middle" fill={theme.ink2} {...T}>{scene.xTitle}</text>
            )}
          </g>
        )}

        {/* Hover band behind the marks (removed from exports) */}
        {active?.row != null && (scene.band || scene.horizontal) && (
          <rect
            className="cmk-hover"
            x={scene.horizontal ? plot.x : scene.px(active.row) - scene.bandSize / 2}
            y={scene.horizontal ? plot.y + scene.bandSize * active.row : plot.y}
            width={scene.horizontal ? plot.w : scene.bandSize}
            height={scene.horizontal ? scene.bandSize : plot.h}
            fill={theme.ink}
            opacity={0.06}
          />
        )}

        {scene.areas.map((a, i) => <path key={`a${i}`} d={a.d} fill={a.fill} opacity={0.1} />)}
        {scene.bars.map((b, i) => <path key={`b${i}`} d={b.d} fill={b.fill} />)}
        {scene.lines.map((l, i) => <path key={`l${i}`} d={l.d} fill="none" stroke={l.stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {active?.row != null && !scene.band && !scene.horizontal && (
          <line className="cmk-hover" x1={scene.px(active.row)} x2={scene.px(active.row)} y1={plot.y} y2={plot.y + plot.h} stroke={theme.ink2} strokeWidth={1} opacity={0.6} />
        )}
        {scene.dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.x} cy={d.y} r={5} fill={d.fill} stroke={theme.surface} strokeWidth={2} opacity={scene.dense ? 0.75 : 1} />
        ))}
        {scene.valueLabels.map((l, i) => (
          <text key={`v${i}`} x={l.x} y={l.y} textAnchor={l.anchor} fill={theme.ink2} {...T}>{l.text}</text>
        ))}
        {scene.endLabels.map((l) => (
          <text key={`e${l.s}`} x={l.x} y={l.y} fill={theme.ink2} {...T}>{l.text}</text>
        ))}

        {/* Hover markers on lines, and the focused scatter dot */}
        {active?.row != null && (chart === 'line' || chart === 'area') &&
          model.rows[active.row].values.map((v, s) =>
            v == null ? null : <circle key={`h${s}`} className="cmk-hover" cx={scene.px(active.row)} cy={scene.sy(v)} r={6} fill={seriesColor(theme, model.series[s].slot)} stroke={theme.surface} strokeWidth={2} />
          )}
        {active?.dot != null && (
          <circle className="cmk-hover" cx={scene.dots[active.dot].x} cy={scene.dots[active.dot].y} r={8} fill="none" stroke={theme.ink} strokeWidth={2} />
        )}
        {empty && (
          <text x={scene.W / 2} y={plot.y + plot.h / 2} textAnchor="middle" fill={theme.muted} {...T}>No numeric values to plot with these settings.</text>
        )}
      </svg>
      <Tooltip model={model} scene={scene} active={active} theme={theme} wrapW={scene.W} />
    </div>
  );
});

// The numbers behind the chart, always reachable without hovering.
export function DataTable({ table, max = 1000 }) {
  return (
    <div className="cmk-table-wrap">
      <table className="tl-table cmk-table">
        <thead>
          <tr>{table.head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.body.slice(0, max).map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : ''}>{typeof c === 'number' ? formatNumber(c) : c ?? '–'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {table.body.length > max && <p className="tl-muted">Showing the first {max.toLocaleString()} of {table.body.length.toLocaleString()} rows. Download CSV for all of them.</p>}
    </div>
  );
}
