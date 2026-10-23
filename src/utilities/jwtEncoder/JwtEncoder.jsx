import React, { useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { ALGORITHMS, claimStatus, generateKeyPair, signJwt, verifyJwt } from './utils/jwt';

const now = () => Math.floor(Date.now() / 1000);
const samplePayload = () => JSON.stringify({ sub: '1234567890', name: 'Test User', role: 'admin', iat: now(), exp: now() + 3600 }, null, 2);

// Secrets and keys use plain useState so they are dropped when you leave the tool.
function Encode() {
  const [alg, setAlg] = useToolState('alg', 'HS256');
  const [payload, setPayload] = useToolState('payload', samplePayload);
  const [kid, setKid] = useToolState('kid', '');
  const [key, setKey] = useState('your-256-bit-secret');
  const [publicKey, setPublicKey] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const hmac = ALGORITHMS[alg].kind === 'hmac';

  const sign = async () => {
    setError('');
    setToken('');
    try {
      let body;
      try {
        body = JSON.parse(payload);
      } catch (e) {
        throw new Error(`Payload is not valid JSON: ${e.message}`);
      }
      const header = { alg, typ: 'JWT', ...(kid.trim() ? { kid: kid.trim() } : {}) };
      setToken(await signJwt(header, body, key));
    } catch (e) {
      setError(e.message);
    }
  };

  const changeAlg = (a) => {
    setAlg(a);
    setToken('');
    if (ALGORITHMS[a].kind !== ALGORITHMS[alg].kind) {
      setKey(ALGORITHMS[a].kind === 'hmac' ? 'your-256-bit-secret' : '');
      setPublicKey('');
    }
  };

  const generate = async () => {
    setError('');
    const k = await generateKeyPair(alg);
    if (k.secret) setKey(k.secret);
    else {
      setKey(k.privateKey);
      setPublicKey(k.publicKey);
    }
  };

  const bump = (field, seconds) => {
    try {
      const o = JSON.parse(payload);
      o[field] = now() + seconds;
      setPayload(JSON.stringify(o, null, 2));
    } catch (e) {
      setError('Fix the payload JSON first');
    }
  };

  return (
    <>
      <div className="tl-panel">
        <div className="tl-row">
          <label className="tl-check">Algorithm
            <select value={alg} onChange={(e) => changeAlg(e.target.value)}>
              {Object.keys(ALGORITHMS).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="tl-check">Key ID (kid) <input type="text" value={kid} onChange={(e) => setKid(e.target.value)} placeholder="optional" style={{ width: 140 }} /></label>
        </div>
        <label className="tl-label" htmlFor="je-payload">Payload (JSON)</label>
        <ClearableTextarea id="je-payload" className="tl-textarea" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} />
        <div className="tl-row tl-gap">
          <span className="tl-muted">Set:</span>
          <button type="button" className="tl-btn secondary" onClick={() => bump('iat', 0)}>iat = now</button>
          <button type="button" className="tl-btn secondary" onClick={() => bump('exp', 3600)}>exp = +1 hour</button>
          <button type="button" className="tl-btn secondary" onClick={() => bump('exp', 86400)}>exp = +1 day</button>
          <button type="button" className="tl-btn secondary" onClick={() => bump('exp', -60)}>exp = expired</button>
        </div>
      </div>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="je-key">{hmac ? 'Secret' : 'Private key (PKCS#8 PEM or JWK)'}</label>
        {hmac ? (
          <input id="je-key" type="text" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} style={{ width: '100%' }} />
        ) : (
          <textarea id="je-key" className="tl-textarea" value={key} onChange={(e) => setKey(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" spellCheck={false} />
        )}
        <div className="tl-row tl-gap">
          <button type="button" className="tl-btn" onClick={sign}>Sign token</button>
          <button type="button" className="tl-btn secondary" onClick={generate}>🎲 Generate a test {hmac ? 'secret' : 'key pair'}</button>
        </div>
        {publicKey && (
          <>
            <div className="tl-label tl-gap">Matching public key (share this for verification)</div>
            <pre className="tl-out">{publicKey}</pre>
            <div className="tl-gap"><CopyButton text={publicKey} label="Copy public key" /></div>
          </>
        )}
        {error && <div className="tl-err tl-gap">⚠ {error}</div>}
      </div>
      {token && (
        <div className="tl-panel">
          <strong>Token</strong>
          <pre className="tl-out tl-gap je-token">
            {token.split('.').map((p, i) => <React.Fragment key={i}>{i > 0 && '.'}<span className={`je-part${i}`}>{p}</span></React.Fragment>)}
          </pre>
          <div className="tl-gap"><CopyButton text={token} label="Copy token" /></div>
        </div>
      )}
    </>
  );
}

function Verify() {
  const [token, setToken] = useState('');
  const [key, setKey] = useState('');
  const [result, setResult] = useState(null);

  const verify = async () => {
    try {
      const r = await verifyJwt(token, key);
      setResult({ ...r, claims: claimStatus(r.payload) });
    } catch (e) {
      setResult({ error: e.message });
    }
  };

  return (
    <>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="jv-token">Token</label>
        <ClearableTextarea id="jv-token" className="tl-textarea" value={token} onChange={(e) => { setToken(e.target.value); setResult(null); }} placeholder="eyJhbGciOi…" spellCheck={false} />
        <label className="tl-label tl-gap" htmlFor="jv-key">Secret (HS*) or public key (SPKI PEM or JWK)</label>
        <textarea id="jv-key" className="tl-textarea je-key" value={key} onChange={(e) => { setKey(e.target.value); setResult(null); }} spellCheck={false} />
        <div className="tl-row tl-gap"><button type="button" className="tl-btn" onClick={verify} disabled={!token.trim()}>Verify signature</button></div>
      </div>
      {result && (
        <div className="tl-panel" aria-live="polite">
          {result.error ? <div className="tl-err">⚠ {result.error}</div> : (
            <>
              <p className={result.valid ? 'tl-ok' : 'tl-err'}><b>{result.valid ? '✓ Signature is valid' : `✗ Signature is NOT valid${result.reason ? ` (${result.reason})` : ''}`}</b></p>
              <p className={result.claims.ok ? 'tl-ok' : 'tl-warn'}>{result.claims.ok ? '✓' : '⏰'} {result.claims.text}</p>
              <div className="tl-split tl-gap">
                <div><div className="tl-label">Header</div><pre className="tl-out">{JSON.stringify(result.header, null, 2)}</pre></div>
                <div><div className="tl-label">Payload</div><pre className="tl-out">{JSON.stringify(result.payload, null, 2)}</pre></div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export function JwtEncoder() {
  const [tab, setTab] = useToolState('tab', 'encode');
  return (
    <div className="tl-container">
      <h2 className="tl-title">🔐 JWT Encoder &amp; Verifier</h2>
      <p className="tl-desc">Create signed test tokens and check signatures (HS, RS, PS and ES algorithms) using your browser’s built-in crypto.</p>
      <div className="tl-row tl-gap">
        {[['encode', 'Create / sign'], ['verify', 'Verify']].map(([id, label]) => (
          <button key={id} type="button" className={`tl-btn ${tab === id ? '' : 'secondary'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'encode' ? <Encode /> : <Verify />}
    </div>
  );
}
