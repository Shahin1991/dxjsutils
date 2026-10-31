import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FONT, THEMES } from './utils/layout';
import { barRaceScene, frameLabel, lineRaceScene, raceFrames, stepDuration, valueDecimals } from './utils/race';
import { useTheme, useWidth } from './ChartView';

const T = { fontSize: 12, fontFamily: FONT };

// One frame of an animated chart. Pure: the same element is shown on screen and rendered to
// markup for SVG, PNG and video export.
export function RaceSvg({ scene, theme, clipId }) {
  const { plot } = scene;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={scene.W} height={scene.H} viewBox={`0 0 ${scene.W} ${scene.H}`} style={{ display: 'block', fontFamily: FONT }}>
      <rect width={scene.W} height={scene.H} fill={theme.surface} />
      {scene.header.map((h) => (
        <text key={h.kind} x={h.x} y={h.y} fill={h.kind === 'title' ? theme.ink : theme.muted} fontSize={h.kind === 'title' ? 16 : 12} fontWeight={h.kind === 'title' ? 700 : 400} fontFamily={FONT}>{h.text}</text>
      ))}
      {scene.legend.map((l) => (
        <g key={l.i}>
          <line x1={l.x} x2={l.x + 14} y1={l.y} y2={l.y} stroke={l.color} strokeWidth={2} strokeLinecap="round" />
          <text x={l.x + 20} y={l.y + 4} fill={theme.ink2} {...T}>{l.text}</text>
        </g>
      ))}

      {scene.kind === 'bar-race' ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={plot.y - 2} width={scene.W} height={plot.h + 4} />
            </clipPath>
          </defs>
          {scene.ticks.map((t, i) => (
            <g key={i}>
              <line x1={t.pos} x2={t.pos} y1={plot.y} y2={plot.y + plot.h} stroke={theme.grid} strokeWidth={1} />
              <text x={t.pos} y={plot.y + plot.h + 18} textAnchor="middle" fill={theme.muted} {...T} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.label}</text>
            </g>
          ))}
          <text x={scene.period.x} y={scene.period.y} textAnchor="end" fill={theme.muted} fontSize={scene.period.size} fontWeight={700} fontFamily={FONT} opacity={0.55}>{scene.period.text}</text>
          <g clipPath={`url(#${clipId})`}>
            {scene.bars.map((b) => (
              <g key={b.key}>
                <path d={b.d} fill={b.fill} />
                <text x={plot.x - 10} y={b.nameY} textAnchor="end" fill={theme.ink2} {...T}>
                  <title>{b.full}</title>
                  {b.name}
                </text>
                <text x={b.valueX} y={b.nameY} textAnchor={b.anchor} fill={theme.ink2} {...T} style={{ fontVariantNumeric: 'tabular-nums' }}>{b.value}</text>
              </g>
            ))}
          </g>
          <line x1={scene.zeroPos} x2={scene.zeroPos} y1={plot.y} y2={plot.y + plot.h} stroke={theme.axis} strokeWidth={1} />
        </>
      ) : (
        <>
          {scene.yTicks.map((t, i) => (
            <g key={i}>
              <line x1={plot.x} x2={plot.x + plot.w} y1={t.pos} y2={t.pos} stroke={theme.grid} strokeWidth={1} />
              <text x={plot.x - 8} y={t.pos + 4} textAnchor="end" fill={theme.muted} {...T} style={{ fontVariantNumeric: 'tabular-nums' }}>{t.label}</text>
            </g>
          ))}
          <line x1={plot.x} x2={plot.x + plot.w} y1={scene.zeroPos} y2={scene.zeroPos} stroke={theme.axis} strokeWidth={1} />
          {scene.xTicks.map((t, i) => (
            <text key={i} x={t.pos} y={plot.y + plot.h + 18} textAnchor="middle" fill={theme.muted} {...T}>{t.label}</text>
          ))}
          <text x={scene.period.x} y={scene.period.y} textAnchor="end" fill={theme.ink2} fontSize={scene.period.size} fontWeight={700} fontFamily={FONT}>{scene.period.text}</text>
          {scene.lines.map((l) => <path key={l.key} d={l.d} fill="none" stroke={l.stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          {scene.heads.map((h) => <circle key={h.key} cx={h.x} cy={h.y} r={5} fill={h.fill} stroke={theme.surface} strokeWidth={2} />)}
          {scene.headLabels && scene.heads.map((h) => (
            <text key={`t${h.key}`} x={h.x + 10} y={h.y + 4} fill={theme.ink2} {...T} style={{ fontVariantNumeric: 'tabular-nums' }}>{h.text}</text>
          ))}
        </>
      )}
    </svg>
  );
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

// Plays the animation in real time onto a canvas and records it. Timing follows the clock, so a
// slow frame is skipped rather than slowing the video down.
async function recordVideo({ draw, W, H, durationMs, format, onProgress, cancelled }) {
  const scale = Math.min(2, 1920 / W);
  const canvas = document.createElement('canvas');
  canvas.width = even(W * scale);
  canvas.height = even(H * scale);
  const ctx = canvas.getContext('2d');
  const paint = async (pos) => {
    const url = URL.createObjectURL(new Blob([draw(pos)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  await paint(0);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => {
    rec.onstop = r;
  });
  rec.start(250);
  const lead = 600; // hold the first frame briefly
  const hold = 1500; // and the last one, so the result can be read
  const total = lead + durationMs + hold;
  const t0 = performance.now();
  for (;;) {
    const el = performance.now() - t0;
    if (cancelled() || el >= total) break;
    await paint(Math.max(0, Math.min(el - lead, durationMs)));
    onProgress(Math.min(1, el / total));
    await new Promise((r) => requestAnimationFrame(r));
  }
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return cancelled() ? null : new Blob(chunks, { type: format.mime.split(';')[0] });
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const RaceView = forwardRef(function RaceView({ model, chart, topN, cumulative, stepMs, zero, title, subtitle, description }, ref) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const theme = THEMES[useTheme()];
  const frames = useMemo(() => raceFrames(model, { cumulative }), [model, cumulative]);
  const decimals = useMemo(() => valueDecimals(frames), [frames]);
  const maxPos = Math.max(0, frames.length - 1);
  const step = stepDuration(stepMs, frames.length);
  const [pos, setPosState] = useState(0);
  const posRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const clipId = useMemo(() => `cmk-clip-${Math.random().toString(36).slice(2, 8)}`, []);
  const reduced = prefersReducedMotion();

  const setPos = (v) => {
    const c = Math.max(0, Math.min(maxPos, v));
    posRef.current = c;
    setPosState(c);
  };
  const cur = Math.min(pos, maxPos);

  useEffect(() => {
    if (!playing) return undefined;
    let id;
    let last = performance.now();
    const tick = (now) => {
      const next = Math.min(maxPos, posRef.current + (now - last) / step);
      last = now;
      posRef.current = next;
      setPosState(next);
      if (next >= maxPos) setPlaying(false);
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, maxPos, step]);

  // With reduced motion, playback steps from frame to frame instead of sliding.
  const sceneAt = (p, w = width) => {
    const opts = { width: w, topN, theme, title, subtitle, zero, decimals };
    return chart === 'bar-race' ? barRaceScene(model, frames, p, opts) : lineRaceScene(model, frames, p, opts);
  };
  const drawPos = reduced && playing ? Math.floor(cur) : cur;
  const scene = frames.length ? sceneAt(drawPos) : null;
  const markup = (p) => renderToStaticMarkup(<RaceSvg scene={sceneAt(p)} theme={theme} clipId="clip" />);

  useImperativeHandle(ref, () => ({
    svg: () => markup(cur),
    background: theme.surface,
    canRecord: frames.length > 1,
    video: (format, onProgress, cancelled) =>
      recordVideo({ draw: (ms) => markup(ms / step), W: scene.W, H: scene.H, durationMs: maxPos * step, format, onProgress, cancelled }),
  }));

  const toggle = () => {
    if (playing) setPlaying(false);
    else {
      if (posRef.current >= maxPos) setPos(0);
      setPlaying(true);
    }
  };

  const onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key === ' ' || e.key === 'k') toggle();
    else if (moves[e.key]) {
      setPlaying(false);
      setPos(Math.round(posRef.current) + moves[e.key]);
    } else if (e.key === 'Home' || e.key === 'End') {
      setPlaying(false);
      setPos(e.key === 'Home' ? 0 : maxPos);
    } else return;
    e.preventDefault();
  };

  const period = frameLabel(frames, cur);
  return (
    <div className="cmk-race" onKeyDown={onKey}>
      <div className="cmk-player">
        <button type="button" className="tl-btn" onClick={toggle} disabled={frames.length < 2} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚ Pause' : cur >= maxPos && maxPos > 0 ? '↺ Replay' : '▶ Play'}
        </button>
        <input
          type="range"
          className="cmk-scrub"
          min={0}
          max={maxPos}
          step="any"
          value={cur}
          disabled={frames.length < 2}
          onChange={(e) => {
            setPlaying(false);
            setPos(Number(e.target.value));
          }}
          onKeyDown={(e) => {
            // Arrow keys move one whole frame, not a sliver of one.
            const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
            if (d) {
              e.preventDefault();
              setPlaying(false);
              setPos(Math.round(posRef.current) + d);
            }
          }}
          aria-label="Time"
          aria-valuetext={period}
        />
        <span className="cmk-period">
          <strong>{period}</strong> <span className="tl-muted">{Math.round(cur) + 1} / {frames.length}</span>
        </span>
      </div>
      <div className="cmk-chart" ref={wrapRef} tabIndex={0} aria-label={`${description}. Press Space to play or pause, arrow keys to step.`}>
        {scene ? (
          <div role="img" aria-label={`${description}, showing ${period}`}>
            <RaceSvg scene={scene} theme={theme} clipId={clipId} />
          </div>
        ) : (
          <p className="tl-muted">No values to animate with these settings.</p>
        )}
      </div>
    </div>
  );
});
