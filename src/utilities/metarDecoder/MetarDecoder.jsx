import React, { useMemo } from 'react';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { decodeMetar } from './utils/metar';

const SAMPLES = [
  ['METAR OMDB', 'METAR OMDB 170600Z 32012KT 280V350 6000 HZ FEW035 BKN100 33/18 Q1008 NOSIG'],
  ['METAR with fog', 'METAR EGLL 170520Z 00000KT 0300 R27L/0450U FG VV001 08/08 Q1021 BECMG 1500'],
  ['US METAR', 'METAR KJFK 170551Z 21016G24KT 1 1/2SM -TSRA BR BKN008 OVC025CB 22/21 A2981 RMK AO2 TSB45'],
  ['TAF OMDB', 'TAF OMDB 170500Z 1706/1812 34010KT 6000 NSC BECMG 1709/1711 30015G25KT 4000 DU TEMPO 1712/1716 2000 BLSA PROB30 TEMPO 1801/1805 1500 BR FM180800 10008KT 9999 FEW040'],
];

function Rows({ rows }) {
  return (
    <table className="tl-table">
      <tbody>
        {rows.map(([k, v], i) => <tr key={`${k}-${i}`} className={k === 'Not decoded' ? 'md-unknown' : ''}><th>{k}</th><td>{v}</td></tr>)}
      </tbody>
    </table>
  );
}

export function MetarDecoder() {
  const [input, setInput] = useToolState('input', SAMPLES[0][1]);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { data: decodeMetar(input) };
    } catch (e) {
      return { error: e.message };
    }
  }, [input]);
  const d = result?.data;

  return (
    <div className="tl-container">
      <h2 className="tl-title">🌦️ METAR / TAF Decoder</h2>
      <p className="tl-desc">Turn aviation weather reports (METAR, SPECI) and forecasts (TAF) into plain English.</p>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="md-in">Paste a METAR or TAF</label>
        <ClearableTextarea id="md-in" className="tl-textarea md-input" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <div className="tl-row tl-gap">
          <span className="tl-muted">Examples:</span>
          {SAMPLES.map(([label, s]) => <button key={label} type="button" className="tl-btn secondary" onClick={() => setInput(s)}>{label}</button>)}
        </div>
      </div>
      {result?.error && <div className="tl-panel tl-err">⚠ {result.error}</div>}
      {d && (
        <>
          <div className="tl-panel">
            <div className="tl-row">
              <strong className="md-station">{d.type} · {d.station}</strong>
              {d.category && <span className={`md-cat md-${d.category.code}`} title="Flight category from visibility and ceiling">{d.category.text}</span>}
            </div>
            {d.time && <p className="tl-muted">{d.type === 'TAF' ? 'Issued' : 'Observed'}: {d.time}</p>}
            <Rows rows={d.rows} />
          </div>
          {d.groups.map((g, i) => (
            <div key={`${g.title}-${i}`} className="tl-panel">
              <code className="md-group">{g.title}</code>
              <div className="tl-gap"><Rows rows={g.rows} /></div>
            </div>
          ))}
          {d.remarks && (
            <div className="tl-panel">
              <strong>Remarks (RMK)</strong>
              <p className="tl-gap"><code>{d.remarks}</code></p>
              <p className="tl-muted">Remarks are national and free-form, so they are shown as received.</p>
            </div>
          )}
          <p className="tl-muted">For information and training only. Always use official briefing sources for flight planning.</p>
        </>
      )}
    </div>
  );
}
