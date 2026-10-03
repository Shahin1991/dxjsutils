import React, { useEffect, useMemo, useState } from 'react';
import { formatInZone, offsetLabel } from '../../utils/timezone';

const CITIES = [
  ['Dubai', 'Asia/Dubai', 25.2, 55.27], ['London', 'Europe/London', 51.5, -0.12], ['Paris', 'Europe/Paris', 48.85, 2.35],
  ['Moscow', 'Europe/Moscow', 55.75, 37.62], ['Istanbul', 'Europe/Istanbul', 41.0, 28.97], ['Cairo', 'Africa/Cairo', 30.04, 31.23],
  ['Johannesburg', 'Africa/Johannesburg', -26.2, 28.04], ['Nairobi', 'Africa/Nairobi', -1.29, 36.82], ['Lagos', 'Africa/Lagos', 6.52, 3.38],
  ['Karachi', 'Asia/Karachi', 24.86, 67.0], ['Mumbai', 'Asia/Kolkata', 19.07, 72.88], ['Dhaka', 'Asia/Dhaka', 23.81, 90.41],
  ['Bangkok', 'Asia/Bangkok', 13.75, 100.5], ['Singapore', 'Asia/Singapore', 1.35, 103.82], ['Hong Kong', 'Asia/Hong_Kong', 22.32, 114.17],
  ['Shanghai', 'Asia/Shanghai', 31.23, 121.47], ['Tokyo', 'Asia/Tokyo', 35.68, 139.69], ['Seoul', 'Asia/Seoul', 37.57, 126.98],
  ['Sydney', 'Australia/Sydney', -33.87, 151.2], ['Auckland', 'Pacific/Auckland', -36.85, 174.76], ['Honolulu', 'Pacific/Honolulu', 21.31, -157.86],
  ['Los Angeles', 'America/Los_Angeles', 34.05, -118.24], ['Chicago', 'America/Chicago', 41.88, -87.63], ['New York', 'America/New_York', 40.71, -74.0],
  ['São Paulo', 'America/Sao_Paulo', -23.55, -46.63],
];

const W = 360;
const H = 180;
const rad = (d) => (d * Math.PI) / 180;

// Night polygon from the sun's position (equirectangular projection).
function nightPath(now) {
  const dayOfYear = Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000);
  let decl = -23.44 * Math.cos(rad((360 / 365) * (dayOfYear + 10)));
  if (Math.abs(decl) < 0.01) decl = 0.01;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const subLon = -15 * (utcHours - 12);
  const pts = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const lat = (Math.atan(-Math.cos(rad(lon - subLon)) / Math.tan(rad(decl))) * 180) / Math.PI;
    pts.push([lon + 180, 90 - lat]);
  }
  const poleY = decl > 0 ? H : 0;
  return `M0,${poleY} ` + pts.map(([x, y]) => `L${x},${y}`).join(' ') + ` L${W},${poleY} Z`;
}

export function WorldClock() {
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState('Dubai');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const night = useMemo(() => nightPath(now), [now]);
  const city = CITIES.find((c) => c[0] === selected);

  return (
    <div className="wc-container">
      <h2 className="wc-title">🌍 World Clock</h2>
      <div className="wc-panel">
        <svg viewBox={`0 0 ${W} ${H}`} className="wc-map" role="img" aria-label="World map with day and night">
          <rect width={W} height={H} className="wc-sea" />
          {[...Array(11)].map((_, i) => <line key={`v${i}`} x1={(i + 1) * 30} y1="0" x2={(i + 1) * 30} y2={H} className="wc-grid-line" />)}
          {[...Array(5)].map((_, i) => <line key={`h${i}`} x1="0" y1={(i + 1) * 30} x2={W} y2={(i + 1) * 30} className="wc-grid-line" />)}
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} className="wc-equator" />
          <path d={night} className="wc-night" />
          {CITIES.map(([name, , lat, lon]) => (
            <g key={name} onClick={() => setSelected(name)} className="wc-city">
              <circle cx={lon + 180} cy={90 - lat} r={name === selected ? 3.5 : 2.2} className={name === selected ? 'wc-dot sel' : 'wc-dot'} />
              <title>{name}</title>
            </g>
          ))}
        </svg>
        {city && (
          <div className="wc-detail">
            <strong>{city[0]}</strong> — {formatInZone(now, city[1], { weekday: 'long', year: 'numeric', month: 'long' })} · {offsetLabel(now, city[1])} · {city[1]}
            <div className="wc-big">{formatInZone(now, city[1], { weekday: undefined, year: undefined, month: undefined, day: undefined })}</div>
          </div>
        )}
      </div>
      <div className="wc-grid wc-cities">
        {CITIES.map(([name, tz]) => {
          const hour = parseInt(formatInZone(now, tz, { hour: '2-digit', minute: undefined, second: undefined, weekday: undefined, year: undefined, month: undefined, day: undefined }), 10);
          const day = hour >= 6 && hour < 18;
          return (
            <button key={name} type="button" className={`wc-card ${name === selected ? 'sel' : ''}`} onClick={() => setSelected(name)}>
              <span>{day ? '☀️' : '🌙'} {name}</span>
              <b>{formatInZone(now, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: undefined, year: undefined, month: undefined, day: undefined })}</b>
              <span className="wc-muted">{offsetLabel(now, tz)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
