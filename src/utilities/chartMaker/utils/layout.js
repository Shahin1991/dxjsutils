import { dateTicks, formatNumber, niceTicks } from './scale';

// Chart colours per app theme. Surfaces match --bg-card; the series order is a validated
// colour-blind-safe categorical palette (adjacent pairs CVD ΔE ≥ 8.4 on both surfaces).
export const THEMES = {
  dark: {
    surface: '#25292c',
    ink: '#eeefe9',
    ink2: '#c7cac6',
    muted: '#969b9a',
    grid: '#33383c',
    axis: '#5a6064',
    other: '#7d8386',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  },
  light: {
    surface: '#f7f8f7',
    ink: '#16191a',
    ink2: '#363b3d',
    muted: '#5c6366',
    grid: '#e2e4e3',
    axis: '#a9b0b0',
    other: '#8a9092',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  },
};

export const seriesColor = (theme, slot) => (slot === 'other' ? theme.other : theme.series[slot % theme.series.length]);

export const FONT = "'Atkinson Hyperlegible Next Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
// Text is measured by estimate (12px Atkinson averages ~0.56em per character) so layout works without a canvas.
export const textWidth = (s, size = 12) => String(s).length * size * 0.56;
export const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));

const P = 16;
const PLOT_H = 300;
const BAR_MAX = 24;
const GAP = 2;
const R = 4;

// A bar with only its data end rounded (r = 4) and a square end at the baseline.
export function barPath(x, y, w, h, end) {
  if (w <= 0 || h <= 0) return '';
  const vertical = end === 'top' || end === 'bottom';
  const r = Math.max(0, Math.min(R, vertical ? w / 2 : h / 2, vertical ? h : w));
  const f = (n) => +n.toFixed(2);
  const [x0, y0, x1, y1] = [f(x), f(y), f(x + w), f(y + h)];
  if (end === 'top') return `M${x0},${y1}V${f(y + r)}Q${x0},${y0} ${f(x + r)},${y0}H${f(x + w - r)}Q${x1},${y0} ${x1},${f(y + r)}V${y1}Z`;
  if (end === 'bottom') return `M${x0},${y0}V${f(y + h - r)}Q${x0},${y1} ${f(x + r)},${y1}H${f(x + w - r)}Q${x1},${y1} ${x1},${f(y + h - r)}V${y0}Z`;
  if (end === 'right') return `M${x0},${y0}H${f(x + w - r)}Q${x1},${y0} ${x1},${f(y + r)}V${f(y + h - r)}Q${x1},${y1} ${f(x + w - r)},${y1}H${x0}Z`;
  if (end === 'left') return `M${x1},${y0}H${f(x + r)}Q${x0},${y0} ${x0},${f(y + r)}V${f(y + h - r)}Q${x0},${y1} ${f(x + r)},${y1}H${x1}Z`;
  return `M${x0},${y0}H${x1}V${y1}H${x0}Z`;
}

function valueExtent(model, chart) {
  let lo = Infinity;
  let hi = -Infinity;
  const take = (v) => {
    if (v == null) return;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  };
  if (model.points) model.points.forEach((ps) => ps.forEach((p) => take(p.y)));
  else if (chart === 'stacked') {
    model.rows.forEach((r) => {
      take(r.values.reduce((a, v) => a + (v > 0 ? v : 0), 0));
      take(r.values.reduce((a, v) => a + (v < 0 ? v : 0), 0));
    });
  } else model.rows.forEach((r) => r.values.forEach(take));
  if (lo === Infinity) return [0, 1];
  return [lo, hi];
}

/*
 Pure geometry for one chart: positions of every mark, tick and label, in SVG user units.
 The renderer draws this as-is; hover maths reuses its scales.
*/
export function layoutChart(model, { chart, width, zero = true, labels = false, title = '', subtitle = '', theme }) {
  const W = Math.max(320, Math.round(width || 800));
  const horizontal = chart === 'bar';
  const band = model.kind === 'band';
  const k = model.series.length;
  const color = (s) => seriesColor(theme, model.series[s].slot);
  const fmtFull = (v) => formatNumber(v);

  // ---- Header: title, subtitle and (for 2+ series) the legend ----
  let top = P;
  const header = [];
  if (title) {
    header.push({ text: truncate(title, Math.floor((W - 2 * P) / 9)), x: P, y: top + 14, kind: 'title' });
    top += 24;
  }
  if (subtitle) {
    header.push({ text: truncate(subtitle, Math.floor((W - 2 * P) / 6.8)), x: P, y: top + 12, kind: 'sub' });
    top += 20;
  }
  const legend = [];
  if (k >= 2) {
    let lx = P;
    let ly = top + 8;
    model.series.forEach((s, i) => {
      const text = truncate(s.name, 28);
      const w = 22 + textWidth(text) + 18;
      if (lx + w > W - P && lx > P) {
        lx = P;
        ly += 20;
      }
      legend.push({ i, x: lx, y: ly, text, color: color(i) });
      lx += w;
    });
    top = ly + 14;
  }
  top += 12;

  // ---- Value scale ----
  let [vMin, vMax] = valueExtent(model, chart);
  const forceZero = chart !== 'line' && chart !== 'scatter';
  if (forceZero || zero) {
    vMin = Math.min(0, vMin);
    vMax = Math.max(0, vMax);
  }
  const n = model.points ? model.categories.length : model.rows.length;
  const rowsOf = model.rows || [];

  const scene = { W, header, legend, horizontal, chart, bars: [], lines: [], areas: [], dots: [], valueLabels: [], endLabels: [] };

  if (horizontal) {
    const catLabels = rowsOf.map((r) => truncate(r.label, 26));
    const left = P + Math.min(190, Math.max(30, ...catLabels.map((l) => textWidth(l)))) + 10;
    const barT = k === 1 ? 20 : Math.max(8, Math.min(14, Math.floor(60 / k)));
    const bandH = k * barT + (k - 1) * GAP + 14;
    const plotH = Math.max(40, n * bandH);
    const vt0 = niceTicks(vMin, vMax, 5);
    const compact = Math.max(Math.abs(vt0.min), Math.abs(vt0.max)) >= 10000;
    const tipW = Math.max(...rowsOf.flatMap((r) => r.values.map((v) => (v == null ? 0 : textWidth(fmtFull(v))))), 0) + 10;
    const right = P + tipW;
    const plotW = Math.max(60, W - left - right);
    const vt = niceTicks(vMin, vMax, Math.max(2, Math.floor(plotW / 90)));
    const sx = (v) => left + ((v - vt.min) / (vt.max - vt.min)) * plotW;
    const plot = { x: left, y: top, w: plotW, h: plotH };
    const bottom = 26;
    Object.assign(scene, {
      H: top + plotH + bottom + P,
      plot,
      bandSize: bandH,
      sx,
      valueTicks: vt.ticks.map((v) => ({ pos: sx(v), label: formatNumber(v, { step: vt.step, compact }) })),
      catTicks: catLabels.map((label, i) => ({ pos: top + bandH * (i + 0.5), label, full: rowsOf[i].label })),
      zeroPos: sx(Math.min(Math.max(0, vt.min), vt.max)),
    });
    let maxAt = null;
    rowsOf.forEach((r, i) => {
      const g0 = top + bandH * (i + 0.5) - (k * barT + (k - 1) * GAP) / 2;
      r.values.forEach((v, s) => {
        if (v == null) return;
        const y = g0 + s * (barT + GAP);
        const a = sx(0);
        const b = sx(v);
        scene.bars.push({ d: barPath(Math.min(a, b), y, Math.abs(b - a), barT, v >= 0 ? 'right' : 'left'), fill: color(s), row: i, s });
        const lab = { x: v >= 0 ? b + 6 : b - 6, y: y + barT / 2 + 4, text: fmtFull(v), anchor: v >= 0 ? 'start' : 'end', v };
        if (labels) scene.valueLabels.push(lab);
        else if (k === 1 && (!maxAt || v > maxAt.v)) maxAt = lab;
      });
    });
    if (maxAt) scene.valueLabels.push(maxAt);
    return scene;
  }

  // ---- Vertical charts: line, area, column, stacked, scatter ----
  const yt0 = niceTicks(vMin, vMax, 5);
  const compact = Math.max(Math.abs(yt0.min), Math.abs(yt0.max)) >= 10000;
  const yLabels = yt0.ticks.map((v) => formatNumber(v, { step: yt0.step, compact }));
  const left = P + Math.max(...yLabels.map((l) => textWidth(l))) + 10;

  // Direct labels at line ends: the value for one series, names for 2–4.
  const lineLike = chart === 'line' || chart === 'area';
  const ends = [];
  if (lineLike && k <= 4) {
    model.series.forEach((s, i) => {
      for (let j = rowsOf.length - 1; j >= 0; j -= 1) {
        const v = rowsOf[j].values[i];
        if (v != null) {
          ends.push({ s: i, j, v, text: k === 1 ? fmtFull(v) : truncate(s.name, 16) });
          break;
        }
      }
    });
  }
  const right = P + (ends.length ? Math.max(...ends.map((e) => textWidth(e.text))) + 12 : 6);
  const plotW = Math.max(80, W - left - right);
  const capRoom = chart === 'column' || chart === 'stacked' ? 14 : 0;
  const plot = { x: left, y: top + capRoom, w: plotW, h: PLOT_H };
  const sy = (v) => plot.y + plot.h - ((v - yt0.min) / (yt0.max - yt0.min)) * plot.h;
  const zeroVal = Math.min(Math.max(0, yt0.min), yt0.max);

  // X scale
  let sx;
  let xTicks;
  let bandSize = 0;
  let rotate = false;
  if (band) {
    bandSize = plotW / Math.max(1, n);
    sx = (i) => left + bandSize * (i + 0.5);
    const raw = model.points ? model.categories : rowsOf.map((r) => r.label);
    const labs = raw.map((l) => truncate(l, 18));
    const maxW = Math.max(0, ...labs.map((l) => textWidth(l)));
    rotate = maxW > bandSize - 8;
    const every = rotate ? Math.max(1, Math.ceil(16 / bandSize)) : 1;
    xTicks = labs.map((label, i) => ({ pos: sx(i), label, full: raw[i] })).filter((_, i) => i % every === 0);
    scene.xBottom = rotate ? Math.min(110, maxW * 0.72 + 20) : 26;
  } else {
    const xs = model.points ? model.points.flatMap((ps) => ps.map((p) => p.x)) : rowsOf.map((r) => r.x);
    let lo = Math.min(...xs);
    let hi = Math.max(...xs);
    if (!xs.length) [lo, hi] = [0, 1];
    const count = Math.max(2, Math.floor(plotW / (model.kind === 'date' ? 110 : 80)));
    if (model.kind === 'date') {
      if (lo === hi) [lo, hi] = [lo - 864e5, hi + 864e5];
      if (chart === 'scatter') {
        const padX = (hi - lo) * 0.03;
        [lo, hi] = [lo - padX, hi + padX];
      }
      const dt = dateTicks(lo, hi, count);
      sx = (v) => left + ((v - lo) / (hi - lo)) * plotW;
      xTicks = dt.ticks.map((t) => ({ pos: sx(t), label: dt.format(t) }));
    } else {
      const xt = niceTicks(lo, hi, count);
      if (chart === 'scatter' || lo === hi) [lo, hi] = [xt.min, xt.max];
      sx = (v) => left + ((v - lo) / (hi - lo)) * plotW;
      const xCompact = Math.max(Math.abs(xt.min), Math.abs(xt.max)) >= 10000;
      xTicks = xt.ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9).map((v) => ({ pos: sx(v), label: formatNumber(v, { step: xt.step, compact: xCompact, year: model.xCol.year }) }));
    }
    scene.xBottom = 26;
  }
  const xTitle = model.xCol ? truncate(model.xCol.name, 60) : '';

  Object.assign(scene, {
    H: plot.y + plot.h + scene.xBottom + (xTitle ? 20 : 0) + P,
    plot,
    sx,
    sy,
    band,
    bandSize,
    rotate,
    xTicks,
    xTitle,
    yTicks: yt0.ticks.map((v, i) => ({ pos: sy(v), label: yLabels[i] })),
    zeroPos: sy(zeroVal),
  });

  // Where row j sits along X.
  const px = (j) => (band ? sx(j) : sx(rowsOf[j].x));
  scene.px = px;

  if (chart === 'column') {
    const barW = Math.min(BAR_MAX, Math.max(2, (bandSize * 0.72 - (k - 1) * GAP) / k));
    const groupW = k * barW + (k - 1) * GAP;
    let maxAt = null;
    rowsOf.forEach((r, j) => {
      r.values.forEach((v, s) => {
        if (v == null) return;
        const x = sx(j) - groupW / 2 + s * (barW + GAP);
        const a = sy(zeroVal);
        const b = sy(v);
        scene.bars.push({ d: barPath(x, Math.min(a, b), barW, Math.abs(a - b), v >= 0 ? 'top' : 'bottom'), fill: color(s), row: j, s });
        const text = fmtFull(v);
        const lab = { x: x + barW / 2, y: v >= 0 ? b - 5 : b + 14, text, anchor: 'middle', v };
        const fits = textWidth(text) <= (k === 1 ? bandSize : barW + GAP) - 2;
        if (labels && fits) scene.valueLabels.push(lab);
        else if (!labels && k === 1 && fits && (!maxAt || v > maxAt.v)) maxAt = lab;
      });
    });
    if (maxAt) scene.valueLabels.push(maxAt);
  } else if (chart === 'stacked') {
    const barW = Math.min(BAR_MAX, Math.max(2, bandSize * 0.6));
    rowsOf.forEach((r, j) => {
      const x = sx(j) - barW / 2;
      [1, -1].forEach((sign) => {
        let acc = 0;
        const segs = [];
        r.values.forEach((v, s) => {
          if (v == null || v === 0 || Math.sign(v) !== sign) return;
          segs.push({ s, from: acc, to: acc + v });
          acc += v;
        });
        segs.forEach((g, i) => {
          let a = sy(g.from);
          const b = sy(g.to);
          if (i > 0) a += sign > 0 ? -GAP : GAP; // 2px surface gap between segments
          const outer = i === segs.length - 1;
          const h = Math.abs(a - b);
          if (h <= 0.5) return;
          scene.bars.push({ d: barPath(x, Math.min(a, b), barW, h, outer ? (sign > 0 ? 'top' : 'bottom') : 'none'), fill: color(g.s), row: j, s: g.s });
        });
        if (labels && segs.length && sign > 0) {
          const text = fmtFull(acc);
          if (textWidth(text) <= bandSize - 2) scene.valueLabels.push({ x: sx(j), y: sy(acc) - 5, text, anchor: 'middle' });
        }
      });
    });
  } else if (chart === 'line' || chart === 'area') {
    const showDots = rowsOf.length <= 40;
    model.series.forEach((_, s) => {
      const segs = [];
      let cur = [];
      rowsOf.forEach((r, j) => {
        const v = r.values[s];
        if (v == null) {
          if (cur.length) segs.push(cur);
          cur = [];
        } else cur.push([px(j), sy(v), j]);
      });
      if (cur.length) segs.push(cur);
      const lastJ = segs.length ? segs[segs.length - 1][segs[segs.length - 1].length - 1][2] : -1;
      const f = (n2) => +n2.toFixed(2);
      segs.forEach((seg) => {
        const d = seg.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join('');
        if (chart === 'area' && seg.length > 1) {
          const base = f(sy(zeroVal));
          scene.areas.push({ d: `${d}L${f(seg[seg.length - 1][0])},${base}L${f(seg[0][0])},${base}Z`, fill: color(s) });
        }
        if (seg.length > 1) scene.lines.push({ d, stroke: color(s) });
        seg.forEach(([x, y, j]) => {
          if (showDots || j === lastJ || seg.length === 1) scene.dots.push({ x, y, fill: color(s) });
        });
      });
    });
    // End labels only when they don't collide; otherwise the legend and tooltip carry identity.
    const placed = ends.map((e) => ({ ...e, x: px(e.j) + 9, y: sy(e.v) + 4 })).sort((a, b) => a.y - b.y);
    const clash = placed.some((e, i) => i && e.y - placed[i - 1].y < 14);
    if (!clash) scene.endLabels = placed;
  } else if (chart === 'scatter') {
    model.points.forEach((ps, s) => ps.forEach((p) => scene.dots.push({ x: sx(p.x), y: sy(p.y), fill: color(s), s, p })));
    scene.dense = scene.dots.length > 600;
  }
  return scene;
}

// Hover target for a pointer at (x, y) in SVG units: a row index (bars and lines) or a scatter dot.
export function hitTest(scene, model, x, y) {
  const { plot } = scene;
  if (scene.horizontal) {
    if (!model.rows.length || y < plot.y || y > plot.y + plot.h) return null;
    return { row: Math.min(model.rows.length - 1, Math.floor((y - plot.y) / scene.bandSize)) };
  }
  if (x < plot.x - 12 || x > plot.x + plot.w + 12 || y < plot.y - 16 || y > plot.y + plot.h + 8) return null;
  if (scene.chart === 'scatter') {
    let best = null;
    let bestD = 24 * 24; // a 24px reach: nobody has to land on an 8px dot
    scene.dots.forEach((d, i) => {
      const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    return best == null ? null : { dot: best };
  }
  if (!model.rows.length) return null;
  if (scene.band) return { row: Math.max(0, Math.min(model.rows.length - 1, Math.floor((x - plot.x) / scene.bandSize))) };
  // Continuous X: snap to the nearest row (rows are sorted by x).
  let lo = 0;
  let hi = model.rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (scene.px(mid) < x) lo = mid;
    else hi = mid;
  }
  return { row: Math.abs(scene.px(lo) - x) <= Math.abs(scene.px(hi) - x) ? lo : hi };
}
