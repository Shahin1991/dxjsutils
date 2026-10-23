import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CopyButton } from '../../components/CopyButton';
import { base32Decode, buildOtpauth, parseOtpauth, randomSecret, totp } from './utils/totp';

// Nothing here is kept between tool switches: OTP secrets are as sensitive as passwords.
export function TotpGenerator() {
  const [secret, setSecret] = useState('');
  const [issuer, setIssuer] = useState('dxjsutils');
  const [account, setAccount] = useState('test@example.com');
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [algorithm, setAlgorithm] = useState('SHA-1');
  const [uri, setUri] = useState('');
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const step = Math.floor(now / 1000 / period);
  useEffect(() => {
    let cancelled = false;
    if (!secret.trim()) {
      setCodes(null);
      setError('');
      return undefined;
    }
    (async () => {
      try {
        const key = base32Decode(secret);
        const opts = { digits, algorithm };
        const [prev, cur, next] = await Promise.all([-1, 0, 1].map((d) => totp(key, { ...opts, period, time: (step + d) * period * 1000 })));
        if (!cancelled) {
          setCodes({ prev, cur, next });
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setCodes(null);
          setError(e.message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [secret, digits, period, algorithm, step]);

  const otpauth = secret.trim() && !error ? buildOtpauth({ secret: secret.replace(/\s+/g, '').toUpperCase(), issuer, account, digits, period, algorithm }) : '';
  useEffect(() => {
    if (!otpauth) {
      setQr('');
      return;
    }
    QRCode.toDataURL(otpauth, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(''));
  }, [otpauth]);

  const importUri = () => {
    try {
      const p = parseOtpauth(uri);
      setSecret(p.secret);
      setIssuer(p.issuer);
      setAccount(p.account);
      setDigits(p.digits);
      setPeriod(p.period);
      setAlgorithm(p.algorithm);
      setUri('');
    } catch (e) {
      setError(e.message);
    }
  };

  const left = period - (Math.floor(now / 1000) % period);
  const group = (c) => (c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c);

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔢 2FA Code Generator</h2>
      <p className="tl-desc">Generate time-based one-time codes (TOTP, like Google Authenticator) to test login flows. Works offline; secrets are not saved.</p>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check">Secret (Base32)
            <input type="text" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="JBSWY3DPEHPK3PXP" autoComplete="off" spellCheck={false} style={{ width: 280 }} />
          </label>
          <button type="button" className="tl-btn secondary" onClick={() => setSecret(randomSecret())}>🎲 New test secret</button>
        </div>
        <div className="tl-row">
          <label className="tl-check">Digits <select value={digits} onChange={(e) => setDigits(Number(e.target.value))}>{[6, 7, 8].map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="tl-check">Period <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>{[30, 60].map((d) => <option key={d} value={d}>{d} s</option>)}</select></label>
          <label className="tl-check">Algorithm <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>{['SHA-1', 'SHA-256', 'SHA-512'].map((a) => <option key={a}>{a}</option>)}</select></label>
        </div>
        <div className="tl-row">
          <label className="tl-check">Or import an otpauth:// URI
            <input type="text" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="otpauth://totp/Issuer:user?secret=…" spellCheck={false} style={{ width: 320 }} />
          </label>
          <button type="button" className="tl-btn secondary" onClick={importUri} disabled={!uri.trim()}>Import</button>
        </div>
        {error && <div className="tl-err">⚠ {error}</div>}
      </div>
      {codes && (
        <div className="tl-panel">
          <div className="tl-row">
            <div className="totp-code" aria-live="polite">{group(codes.cur)}</div>
            <CopyButton text={codes.cur} label="Copy code" />
          </div>
          <div className="totp-bar" aria-hidden="true"><span style={{ width: `${(left / period) * 100}%` }} className={left <= 5 ? 'low' : ''} /></div>
          <p className="tl-muted">{left} s left · previous <code>{codes.prev}</code> · next <code>{codes.next}</code></p>
        </div>
      )}
      {otpauth && (
        <div className="tl-panel">
          <strong>Set up an authenticator app (test accounts only)</strong>
          <div className="tl-row tl-gap">
            <label className="tl-check">Issuer <input type="text" value={issuer} onChange={(e) => setIssuer(e.target.value)} style={{ width: 140 }} /></label>
            <label className="tl-check">Account <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} style={{ width: 200 }} /></label>
          </div>
          <div className="totp-setup">
            {qr && <img src={qr} alt="QR code for authenticator apps" width="200" height="200" />}
            <div>
              <pre className="tl-out">{otpauth}</pre>
              <div className="tl-gap"><CopyButton text={otpauth} label="Copy URI" /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
