import { formatNumber, niceTicks } from './scale';
import { barPath, headerLayout, seriesColor, textWidth, truncate } from './layout';

/*
 Animated charts. The model's rows are frames in time order; `pos` is a fractional frame index
 (2.5 = halfway between the third and fourth frame). Everything here is pure, so the same scene
 is drawn on screen and, frame by frame, into an exported video.
*/

const P = 16;
const MAX_STEP_SECONDS = 1.5;

// Values per frame. Gaps carry the last known value forward (an entry doesn't vanish because one
// period is missing); with `cumulative`, each frame holds the running total so far.
export function raceFrames(model, { cumulative = false } = {}) {
  const k = model.series.length;
  const last = new Array(k).fill(null);
  const run = new Array(k).fill(0);
  return model.rows.map((r) => ({
    label: r.label,
    values: r.values.map((v, s) => {
      if (cumulative) {
        run[s] += v || 0;
        return run[s];
      }
      if (v != null) last[s] = v;
      return last[s];
    }),
  }));
}

// Decimal places worth showing for this data (0–2), so values sliding between frames don't print
// more precision than the data has.
export function valueDecimals(frames) {
  let d = 0;
  for (let q = 0; q < frames.length && d < 2; q += 1) {
    for (const v of frames[q].values) {
      if (v != null && !Number.isInteger(v)) d = Math.max(d, Number.isInteger(v * 10) ? 1 : 2);
    }
  }
  return d;
}

const fixed = (v, d) => v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });

// Milliseconds per frame: "auto" aims for a 15–20 second run, between 0.15 s and 1.5 s per step.
export function stepDuration(stepMs, frameCount) {
  if (stepMs !== 'auto') return Number(stepMs);
  return Math.round(Math.min(MAX_STEP_SECONDS, Math.max(0.15, 18 / Math.max(1, frameCount - 1))) * 1000);
}

// Largest value without spreading into Math.max (long races exceed the argument limit).
const maxOf = (arr, init = -Infinity) => arr.reduce((m, v) => (v > m ? v : m), init);

const smooth = (f) => f * f * (3 - 2 * f);
const lerp = (a, b, f) => (a == null ? (b == null ? null : b * f) : b == null ? a * (1 - f) : a + (b - a) * f);

function split(frames, pos) {
  const n = frames.length;
  const p = Math.max(0, Math.min(n - 1, pos));
  const i = Math.min(n - 1, Math.floor(p));
  return { i, j: Math.min(n - 1, i + 1), f: p - i, p };
}

// Rank of each entry in one frame: 0 = largest. Entries with no value sort last.
export function ranks(values) {
  const order = values.map((v, s) => s).sort((a, b) => (values[b] ?? -Infinity) - (values[a] ?? -Infinity) || a - b);
  const r = new Array(values.length);
  order.forEach((s, i) => {
    r[s] = i;
  });
  return r;
}

export const frameLabel = (frames, pos) => frames[Math.max(0, Math.min(frames.length - 1, Math.round(pos)))]?.label ?? '';

/*
 Bar race: the top N entries at this moment, as horizontal bars that slide when they swap places.
 Bars are labelled by name and value, so identity never rests on colour. With more than 8 entries,
 colours would have to repeat, so every bar takes the first series colour instead.
*/
export function barRaceScene(model, frames, pos, { width, topN = 10, theme, title, subtitle, decimals = valueDecimals(frames) }) {
  const W = Math.max(320, Math.round(width || 800));
  const { header, top } = headerLayout(model.series, { W, title, subtitle, theme, legend: false });
  const { i, j, f } = split(frames, pos);
  const a = frames[i].values;
  const b = frames[j].values;
  const ra = ranks(a);
  const rb = ranks(b);
  const fr = smooth(f);
  const k = model.series.length;
  const N = Math.min(topN, k);
  const oneColour = k > 8;

  // Layout stays fixed for the whole run so nothing jumps between frames.
  const names = model.series.map((s) => truncate(s.name, 24));
  const allMax = maxOf(frames.flatMap((fm) => fm.values.map((v) => v ?? 0)), 0);
  const left = P + Math.min(190, Math.max(40, ...names.map((t) => textWidth(t)))) + 10;
  const right = P + textWidth(formatNumber(allMax)) + 12;
  const band = 32;
  const barT = 22;
  const plot = { x: left, y: top + 4, w: Math.max(80, W - left - right), h: N * band };

  const items = model.series.map((s, idx) => ({
    s: idx,
    v: lerp(a[idx], b[idx], f),
    rank: ra[idx] + (rb[idx] - ra[idx]) * fr,
  }));
  // Rank N and below sits under the clip edge; bars between N-1 and N are sliding in or out.
  const shown = items.filter((it) => it.v != null && it.rank < N);
  const vMax = Math.max(0, ...shown.filter((it) => it.rank <= N - 1).map((it) => it.v));
  const vMin = Math.min(0, ...shown.map((it) => it.v));
  const domainMax = vMax > 0 ? vMax : 1;
  const sx = (v) => plot.x + ((v - vMin) / (domainMax - vMin)) * plot.w;
  const nt = niceTicks(vMin, domainMax, Math.max(2, Math.floor(plot.w / 110)));
  const compact = Math.max(Math.abs(nt.min), Math.abs(nt.max)) >= 10000;
  const ticks = nt.ticks.filter((t) => t >= vMin - 1e-9 && t <= domainMax + 1e-9).map((t) => ({ pos: sx(t), label: formatNumber(t, { step: nt.step, compact }) }));

  const bars = shown.map((it) => {
    const y = plot.y + it.rank * band + (band - barT) / 2;
    const x0 = sx(0);
    const x1 = sx(it.v);
    return {
      key: it.s,
      d: barPath(Math.min(x0, x1), y, Math.abs(x1 - x0), barT, it.v >= 0 ? 'right' : 'left'),
      fill: seriesColor(theme, oneColour ? 0 : model.series[it.s].slot),
      name: names[it.s],
      full: model.series[it.s].name,
      nameY: y + barT / 2 + 4,
      valueX: it.v >= 0 ? x1 + 6 : x1 - 6,
      anchor: it.v >= 0 ? 'start' : 'end',
      value: fixed(it.v, decimals),
    };
  });

  return {
    kind: 'bar-race',
    W,
    H: plot.y + plot.h + 26 + P,
    header,
    legend: [],
    plot,
    ticks,
    zeroPos: sx(0),
    bars,
    period: { text: frameLabel(frames, pos), x: plot.x + plot.w, y: plot.y + plot.h - 14, size: Math.min(44, Math.max(24, plot.h / 6)) },
  };
}

/*
 Line race: lines draw left to right across the full time range while the value axis grows to fit
 what has been revealed so far. Each line's head carries its name and current value when the heads
 are far enough apart; otherwise the legend identifies the lines.
*/
export function lineRaceScene(model, frames, pos, { width, theme, title, subtitle, zero = true, decimals = valueDecimals(frames) }) {
  const W = Math.max(320, Math.round(width || 800));
  const k = model.series.length;
  const { header, legend, top } = headerLayout(model.series, { W, title, subtitle, theme, legend: k >= 2 });
  const { i, j, f, p } = split(frames, pos);
  const n = frames.length;

  // Values revealed so far, including the moving head.
  const head = frames[i].values.map((v, s) => lerp(v, frames[j].values[s], f));
  let lo = Infinity;
  let hi = -Infinity;
  const seen = [...frames.slice(0, i + 1).flatMap((fm) => fm.values), ...head].filter((v) => v != null);
  // reduce, not Math.min(...seen): long races can exceed the engine's argument limit.
  if (seen.length) {
    lo = seen.reduce((m, v) => (v < m ? v : m), Infinity);
    hi = seen.reduce((m, v) => (v > m ? v : m), -Infinity);
  }
  if (lo === Infinity) [lo, hi] = [0, 1];
  if (zero) [lo, hi] = [Math.min(0, lo), Math.max(0, hi)];
  if (lo === hi) hi = lo + 1;
  // A continuous (un-snapped) domain grows smoothly; ticks are the round values inside it.
  const pad = (hi - lo) * 0.08;
  const yLo = zero && lo >= 0 ? lo : lo - pad;
  const yHi = hi + pad;
  const nt = niceTicks(yLo, yHi, 5);
  const compact = Math.max(Math.abs(nt.min), Math.abs(nt.max)) >= 10000;
  const yTicksRaw = nt.ticks.filter((t) => t >= yLo - 1e-9 && t <= yHi + 1e-9);
  const yLabels = yTicksRaw.map((t) => formatNumber(t, { step: nt.step, compact }));

  // Fixed horizontal layout for the whole run.
  const allMax = maxOf(frames.flatMap((fm) => fm.values.map((v) => Math.abs(v ?? 0))), 0);
  const headText = (s, v) => (k === 1 ? fixed(v, decimals) : `${truncate(model.series[s].name, 14)}  ${fixed(v, decimals)}`);
  const longest = k === 1 ? formatNumber(allMax) : `${'x'.repeat(Math.min(14, Math.max(...model.series.map((s) => s.name.length))))}  ${formatNumber(allMax)}`;
  const left = P + Math.max(textWidth('00,000'), ...yLabels.map((l) => textWidth(l))) + 10;
  const right = P + textWidth(longest) + 12;
  // A row above the plot holds the current period, clear of the lines.
  const plot = { x: left, y: top + 30, w: Math.max(80, W - left - right), h: 300 };
  const sx = (q) => plot.x + (n > 1 ? (q / (n - 1)) * plot.w : plot.w / 2);
  const sy = (v) => plot.y + plot.h - ((v - yLo) / (yHi - yLo)) * plot.h;

  // X labels: every k-th frame so they never overlap.
  const labW = maxOf(frames.map((fm) => textWidth(truncate(fm.label, 14))), 0) + 16;
  const every = Math.max(1, Math.ceil((labW * n) / plot.w));
  const xTicks = frames.map((fm, q) => ({ pos: sx(q), label: truncate(fm.label, 14) })).filter((_, q) => q % every === 0);

  const fx = (x) => +x.toFixed(2);
  const lines = [];
  const heads = [];
  model.series.forEach((s, si) => {
    let d = '';
    let pen = false;
    for (let q = 0; q <= i; q += 1) {
      const v = frames[q].values[si];
      if (v == null) {
        pen = false;
      } else {
        d += `${pen ? 'L' : 'M'}${fx(sx(q))},${fx(sy(v))}`;
        pen = true;
      }
    }
    const hv = head[si];
    if (hv != null && p > i) d += `${pen ? 'L' : 'M'}${fx(sx(p))},${fx(sy(hv))}`;
    const color = seriesColor(theme, s.slot);
    if (d) lines.push({ key: si, d, stroke: color });
    if (hv != null) heads.push({ key: si, x: sx(p), y: sy(hv), fill: color, text: headText(si, hv) });
  });
  const sorted = [...heads].sort((x, y) => x.y - y.y);
  const clash = sorted.some((h, q) => q && h.y - sorted[q - 1].y < 14);

  return {
    kind: 'line-race',
    W,
    H: plot.y + plot.h + 26 + P,
    header,
    legend,
    plot,
    yTicks: yTicksRaw.map((t, q) => ({ pos: sy(t), label: yLabels[q] })),
    zeroPos: sy(Math.min(Math.max(0, yLo), yHi)),
    xTicks,
    lines,
    heads,
    headLabels: !clash,
    period: { text: frameLabel(frames, pos), x: plot.x + plot.w, y: top + 18, size: 22 },
  };
}

// Pick a recorder format the browser supports: MP4 shares most easily, WebM is the fallback.
export function videoFormat(MR = typeof MediaRecorder === 'undefined' ? null : MediaRecorder) {
  if (!MR || typeof MR.isTypeSupported !== 'function') return null;
  const options = [
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm', 'webm'],
  ];
  const hit = options.find(([m]) => MR.isTypeSupported(m));
  return hit ? { mime: hit[0], ext: hit[1] } : null;
}
