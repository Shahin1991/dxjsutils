import React, { useEffect, useRef, useState } from 'react';
import { formatDuration, parseDuration } from './utils/time';

// Short beep via Web Audio, so no sound file is needed.
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {
    // no audio available
  }
}

function notify(text) {
  beep();
  try {
    if (window.Notification?.permission === 'granted') new Notification('dxjsutils timer', { body: text });
  } catch (e) {
    // notifications unavailable
  }
}

// Re-render about every 50 ms while running.
function useTicker(running) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [running]);
}

function StopwatchPanel() {
  const [startedAt, setStartedAt] = useState(null);
  const [carried, setCarried] = useState(0);
  const [laps, setLaps] = useState([]);
  useTicker(startedAt !== null);
  const elapsed = carried + (startedAt !== null ? Date.now() - startedAt : 0);

  const toggle = () => {
    if (startedAt === null) setStartedAt(Date.now());
    else {
      setCarried(elapsed);
      setStartedAt(null);
    }
  };
  const reset = () => {
    setStartedAt(null);
    setCarried(0);
    setLaps([]);
  };
  const lap = () => setLaps((l) => [elapsed, ...l]);

  return (
    <div className="tl-panel">
      <strong>Stopwatch</strong>
      <div className="sw-display" aria-live="off">{formatDuration(elapsed)}</div>
      <div className="tl-row">
        <button type="button" className="tl-btn" onClick={toggle}>{startedAt === null ? (elapsed ? '▶ Resume' : '▶ Start') : '⏸ Pause'}</button>
        <button type="button" className="tl-btn secondary" onClick={lap} disabled={startedAt === null}>⏱ Lap</button>
        <button type="button" className="tl-btn secondary" onClick={reset} disabled={!elapsed}>↺ Reset</button>
      </div>
      {laps.length > 0 && (
        <table className="tl-table tl-gap">
          <thead><tr><th>Lap</th><th>Lap time</th><th>Total</th></tr></thead>
          <tbody>
            {laps.map((t, i) => (
              <tr key={laps.length - i}>
                <td>{laps.length - i}</td>
                <td><code>{formatDuration(t - (laps[i + 1] || 0))}</code></td>
                <td><code>{formatDuration(t)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const PRESETS = [['Pomodoro 25', '25'], ['Break 5', '5'], ['Long break 15', '15'], ['1 min', '1']];

function TimerPanel() {
  const [input, setInput] = useState('25');
  const [endsAt, setEndsAt] = useState(null);
  const [left, setLeft] = useState(null); // remaining ms while paused
  const [done, setDone] = useState(false);
  const fired = useRef(false);
  const baseTitle = useRef(document.title);
  useTicker(endsAt !== null);

  const remaining = endsAt !== null ? Math.max(0, endsAt - Date.now()) : left;
  const parsed = parseDuration(input);

  useEffect(() => {
    if (endsAt !== null && remaining === 0 && !fired.current) {
      fired.current = true;
      setEndsAt(null);
      setLeft(null);
      setDone(true);
      notify(`Time is up (${input})`);
    }
  }, [endsAt, remaining, input]);

  useEffect(() => {
    document.title = endsAt !== null ? `⏳ ${formatDuration(remaining, { centis: false })} · ${baseTitle.current}` : baseTitle.current;
  }, [endsAt, remaining]);
  useEffect(() => {
    const title = baseTitle.current;
    return () => { document.title = title; };
  }, []);

  const start = (ms) => {
    if (!ms) return;
    fired.current = false;
    setDone(false);
    setEndsAt(Date.now() + ms);
    setLeft(null);
    if (window.Notification?.permission === 'default') window.Notification.requestPermission?.().catch?.(() => {});
  };
  const pause = () => {
    setLeft(remaining);
    setEndsAt(null);
  };
  const reset = () => {
    setEndsAt(null);
    setLeft(null);
    setDone(false);
  };

  const running = endsAt !== null;
  const shown = running || left !== null ? remaining : parsed || 0;

  return (
    <div className="tl-panel">
      <strong>Countdown timer</strong>
      <div className={`sw-display ${done ? 'sw-done' : ''}`} role="timer">{done ? "⏰ Time's up!" : formatDuration(shown, { centis: false, forceHours: shown >= 3600000 })}</div>
      <div className="tl-row">
        <label className="tl-check">Duration
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={running || left !== null} aria-invalid={!parsed} style={{ width: 110 }} placeholder="mm or h:mm:ss" />
        </label>
        {PRESETS.map(([label, v]) => (
          <button key={label} type="button" className="tl-btn secondary" disabled={running} onClick={() => { setInput(v); reset(); }}>{label}</button>
        ))}
      </div>
      {!parsed && <div className="tl-err">⚠ Use minutes (25), mm:ss (1:30) or h:mm:ss (1:00:00)</div>}
      <div className="tl-row">
        {running ? (
          <button type="button" className="tl-btn" onClick={pause}>⏸ Pause</button>
        ) : (
          <button type="button" className="tl-btn" disabled={!parsed && left === null} onClick={() => start(left ?? parsed)}>▶ {left !== null ? 'Resume' : 'Start'}</button>
        )}
        <button type="button" className="tl-btn secondary" onClick={reset}>↺ Reset</button>
      </div>
      <p className="tl-muted">You get a beep and, if allowed, a system notification when time is up. The remaining time also shows in the window title.</p>
    </div>
  );
}

export function Stopwatch() {
  return (
    <div className="tl-container">
      <h2 className="tl-title">⏲️ Stopwatch &amp; Timer</h2>
      <p className="tl-desc">A stopwatch with laps, and a countdown timer with Pomodoro presets.</p>
      <div className="tl-split">
        <StopwatchPanel />
        <TimerPanel />
      </div>
    </div>
  );
}
