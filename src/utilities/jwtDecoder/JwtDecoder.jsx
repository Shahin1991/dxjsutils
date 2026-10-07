import React, { useMemo, useState } from 'react';
import { TreeNode } from '../../components/TreeNode';
import { CopyButton } from '../../components/CopyButton';

const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.signature';

function b64urlDecode(part) {
  const s = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

const fmtTime = (s) => new Date(s * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');

export function JwtDecoder() {
  const [token, setToken] = useState(SAMPLE);

  const result = useMemo(() => {
    const t = token.trim().replace(/^Bearer\s+/i, '');
    if (!t) return null;
    try {
      const parts = t.split('.');
      if (parts.length < 2) throw new Error('A JWT has at least two dot-separated parts');
      return { header: b64urlDecode(parts[0]), payload: b64urlDecode(parts[1]), signature: parts[2] || '' };
    } catch (e) {
      return { error: `Invalid JWT: ${e.message}` };
    }
  }, [token]);

  const now = Math.floor(Date.now() / 1000);
  const claims = [];
  if (result?.payload) {
    const p = result.payload;
    if (typeof p.exp === 'number') claims.push(['exp', 'Expiration', p.exp, p.exp < now ? ['Expired', 'jwt-err'] : ['Valid', 'jwt-ok']]);
    if (typeof p.nbf === 'number') claims.push(['nbf', 'Not before', p.nbf, p.nbf > now ? ['Not yet valid', 'jwt-warn'] : ['Active', 'jwt-ok']]);
    if (typeof p.iat === 'number') claims.push(['iat', 'Issued at', p.iat, p.iat > now ? ['In the future', 'jwt-warn'] : ['Issued', 'jwt-ok']]);
  }

  return (
    <div className="jwt-container">
      <h2 className="jwt-title">🔓 JWT Decoder</h2>
      <p className="jwt-desc">Decoded locally; the signature is not verified.</p>
      <div className="jwt-panel">
        <textarea className="jwt-textarea" value={token} onChange={(e) => setToken(e.target.value)} spellCheck={false} placeholder="Paste a JWT" />
        {result?.error && <div className="jwt-err">⚠ {result.error}</div>}
      </div>
      {result?.header && (
        <>
          {claims.length > 0 && (
            <div className="jwt-panel">
              <table className="jwt-table">
                <tbody>
                  {claims.map(([k, label, v, [status, cls]]) => <tr key={k}><td>{label} (<code>{k}</code>)</td><td>{fmtTime(v)}</td><td className={cls}>{status}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          <div className="jwt-split">
            <div className="jwt-panel"><strong>Header</strong> <CopyButton text={JSON.stringify(result.header, null, 2)} /><TreeNode value={result.header} /></div>
            <div className="jwt-panel"><strong>Payload</strong> <CopyButton text={JSON.stringify(result.payload, null, 2)} /><TreeNode value={result.payload} /></div>
          </div>
        </>
      )}
    </div>
  );
}
