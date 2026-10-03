import React, { useMemo, useState } from 'react';
import MD5 from 'crypto-js/md5';
import SHA1 from 'crypto-js/sha1';
import SHA256 from 'crypto-js/sha256';
import SHA512 from 'crypto-js/sha512';
import { copyText } from '../../utils/clipboard';

const ALGOS = [['MD5', MD5], ['SHA-1', SHA1], ['SHA-256', SHA256], ['SHA-512', SHA512]];

export function HashGenerator() {
  const [input, setInput] = useState('hello world');
  const [upper, setUpper] = useState(false);

  const hashes = useMemo(
    () => ALGOS.map(([name, fn]) => {
      const h = fn(input).toString();
      return [name, upper ? h.toUpperCase() : h];
    }),
    [input, upper]
  );

  return (
    <div className="hg-container">
      <h2 className="hg-title">🔐 Hash Generator</h2>
      <div className="hg-panel">
        <textarea className="hg-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <label className="hg-gap hg-row"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase</label>
      </div>
      <div className="hg-panel">
        {hashes.map(([name, h]) => (
          <div key={name} className="hg-item">
            <b>{name}</b>
            <code className="hg-hash">{h}</code>
            <button type="button" className="hg-btn secondary" onClick={() => copyText(h)}>Copy</button>
          </div>
        ))}
      </div>
    </div>
  );
}
