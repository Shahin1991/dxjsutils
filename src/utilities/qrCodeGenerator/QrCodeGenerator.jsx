import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { downloadFile } from '../../utils/clipboard';

const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');

export function QrCodeGenerator() {
  const [type, setType] = useState('url');
  const [url, setUrl] = useState('https://www.emirates.com');
  const [text, setText] = useState('Hello from EK');
  const [ssid, setSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [security, setSecurity] = useState('WPA');
  const [hidden, setHidden] = useState(false);
  const [size, setSize] = useState(256);
  const [fg, setFg] = useState('#000000');
  const [bg, setBg] = useState('#ffffff');
  const [ecl, setEcl] = useState('M');
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');

  const content = type === 'url' ? url : type === 'text' ? text : `WIFI:T:${security};S:${esc(ssid)};P:${esc(wifiPass)};H:${hidden};;`;

  useEffect(() => {
    let cancelled = false;
    if (!content || (type === 'wifi' && !ssid)) {
      setDataUrl('');
      setError('');
      return undefined;
    }
    QRCode.toDataURL(content, { width: size, margin: 2, errorCorrectionLevel: ecl, color: { dark: fg, light: bg } })
      .then((u) => {
        if (!cancelled) {
          setDataUrl(u);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDataUrl('');
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [content, type, ssid, size, ecl, fg, bg]);

  const download = async () => {
    const blob = await (await fetch(dataUrl)).blob();
    downloadFile('qrcode.png', blob);
  };

  return (
    <div className="qr-container">
      <h2 className="qr-title">🔳 QR Code Generator</h2>
      <div className="qr-split">
        <div className="qr-panel">
          <div className="qr-row">
            {[['url', 'URL'], ['text', 'Text'], ['wifi', 'Wi-Fi']].map(([k, l]) => <button key={k} type="button" className={`qr-btn ${type === k ? '' : 'secondary'}`} onClick={() => setType(k)}>{l}</button>)}
          </div>
          {type === 'url' && <input className="qr-input qr-wide" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}
          {type === 'text' && <textarea className="qr-textarea" value={text} onChange={(e) => setText(e.target.value)} />}
          {type === 'wifi' && (
            <div className="qr-row">
              <input className="qr-input" placeholder="Network name (SSID)" value={ssid} onChange={(e) => setSsid(e.target.value)} />
              <input className="qr-input" placeholder="Password" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} />
              <select value={security} onChange={(e) => setSecurity(e.target.value)}><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">None</option></select>
              <label><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden</label>
            </div>
          )}
          <div className="qr-row qr-gap">
            <label>Size {size}px <input type="range" min="128" max="1024" step="32" value={size} onChange={(e) => setSize(+e.target.value)} /></label>
            <label>Foreground <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} /></label>
            <label>Background <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></label>
            <label>Error correction <select value={ecl} onChange={(e) => setEcl(e.target.value)}>{['L', 'M', 'Q', 'H'].map((l) => <option key={l}>{l}</option>)}</select></label>
          </div>
        </div>
        <div className="qr-panel qr-preview">
          {error && <div className="qr-err">⚠ {error}</div>}
          {dataUrl ? <img src={dataUrl} alt="QR code" className="qr-img" /> : !error && <span className="qr-muted">Enter content to generate a QR code</span>}
          {dataUrl && <button type="button" className="qr-btn qr-gap" onClick={download}>Download PNG</button>}
        </div>
      </div>
    </div>
  );
}
