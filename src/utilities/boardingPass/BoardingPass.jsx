import React, { useMemo, useState } from 'react';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { decodeBcbp } from './utils/bcbp';

export const SAMPLE = 'M1SMITH/JOHN MR       EABC123 DXBLHRXX 0001 290Y034A0047 13B>60B0WW6289BXX 2A176212345678900XX XX XX123456789      30KN';

function Fields({ rows }) {
  return (
    <table className="tl-table">
      <tbody>
        {rows.map((f) => (
          <tr key={f.label}><th>{f.label}</th><td>{f.text}</td><td className="tl-muted"><code>{JSON.stringify(f.raw)}</code></td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function BoardingPass() {
  // Boarding pass data is personal, so it is not kept between tool switches.
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { data: decodeBcbp(input) };
    } catch (e) {
      return { error: e.message };
    }
  }, [input]);
  const d = result?.data;

  return (
    <div className="tl-container">
      <h2 className="tl-title">🎫 Boarding Pass Decoder</h2>
      <p className="tl-desc">Decode the text inside a boarding pass barcode (IATA BCBP): passenger, flights, seats, PNR and more.</p>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="bp-in">Barcode text</label>
        <ClearableTextarea id="bp-in" className="tl-textarea bp-input" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <p className="tl-muted tl-gap">
          Scan the PDF417, Aztec or QR code on a boarding pass with any barcode-scanner app and paste the text here. Spaces matter: paste it exactly.
          The sample is made up.
        </p>
      </div>
      {result?.error && <div className="tl-panel tl-err">⚠ {result.error}</div>}
      {d && (
        <>
          <div className="tl-panel">
            <strong>Passenger</strong>
            <div className="tl-gap"><Fields rows={[...d.header, ...(d.unique || [])]} /></div>
            {d.version && <p className="tl-muted">BCBP version {d.version}</p>}
          </div>
          {d.legs.map((leg, i) => {
            const get = (l) => leg.find((f) => f.label === l)?.text;
            return (
              <div key={i} className="tl-panel">
                <div className="bp-leg-head">
                  <span className="bp-route">{get('From')} ✈ {get('To')}</span>
                  <span>{get('Flight')} · Seat <b>{get('Seat')}</b> · PNR <b>{get('Booking reference (PNR)')}</b></span>
                </div>
                <div className="tl-gap"><Fields rows={leg} /></div>
              </div>
            );
          })}
          {d.security && (
            <div className="tl-panel">
              <strong>Security data</strong>
              <p className="tl-muted tl-gap">Type {d.security.type}, {d.security.length} characters. This is the airline’s digital signature and cannot be decoded here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
