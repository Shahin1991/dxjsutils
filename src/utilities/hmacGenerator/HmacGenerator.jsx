import React, { useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { useToolState } from '../../utils/toolState';
import { ALGOS, hmac } from './utils/hmac';

export function HmacGenerator() {
  const [message, setMessage] = useToolState('message', '{"orderId":1234,"amount":"99.00"}');
  // The secret key is deliberately not kept in the tool's session memory.
  const [key, setKey] = useState('my-secret-key');
  const [keyHex, setKeyHex] = useToolState('keyHex', false);
  const [output, setOutput] = useToolState('output', 'hex');
  const [verify, setVerify] = useState('');

  const result = useMemo(() => {
    try {
      return { rows: ALGOS.map(([name, fn]) => [name, hmac(fn, message, key, { keyHex, output })]) };
    } catch (e) {
      return { error: e.message };
    }
  }, [message, key, keyHex, output]);

  const v = verify.trim().toLowerCase();
  const match = v && result.rows ? result.rows.find(([, h]) => h.toLowerCase() === v || h === verify.trim()) : null;

  return (
    <div className="tl-container">
      <h2 className="tl-title">🔏 HMAC Generator</h2>
      <p className="tl-desc">Sign a message with a secret key, e.g. to check a webhook or API signature.</p>
      <div className="tl-panel">
        <label className="tl-label" htmlFor="hm-msg">Message</label>
        <ClearableTextarea id="hm-msg" className="tl-textarea" value={message} onChange={(e) => setMessage(e.target.value)} spellCheck={false} />
        <div className="tl-row tl-gap">
          <label className="tl-check">Secret key
            <input type="text" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} style={{ width: 260 }} />
          </label>
          <label className="tl-check"><input type="checkbox" checked={keyHex} onChange={(e) => setKeyHex(e.target.checked)} /> Key is hex</label>
          <label className="tl-check">Output
            <select value={output} onChange={(e) => setOutput(e.target.value)}>
              <option value="hex">Hex</option>
              <option value="base64">Base64</option>
            </select>
          </label>
        </div>
      </div>
      <div className="tl-panel">
        {result.error ? <div className="tl-err">⚠ {result.error}</div> : (
          <table className="tl-table">
            <tbody>
              {result.rows.map(([name, h]) => (
                <tr key={name} className={match && match[0] === name ? 'uc-hl' : ''}>
                  <th>{name}</th>
                  <td><code>{h}</code></td>
                  <td><CopyButton text={h} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="tl-row tl-gap">
          <label className="tl-check">Compare with a signature
            <input type="text" value={verify} onChange={(e) => setVerify(e.target.value)} placeholder="Paste the expected signature" spellCheck={false} style={{ width: 320 }} />
          </label>
          {v && (match ? <span className="tl-ok">✓ Matches {match[0]}</span> : <span className="tl-err">✗ No match</span>)}
        </div>
      </div>
    </div>
  );
}
