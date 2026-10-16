import React, { useMemo } from 'react';
import MD5 from 'crypto-js/md5';
import SHA1 from 'crypto-js/sha1';
import SHA256 from 'crypto-js/sha256';
import SHA512 from 'crypto-js/sha512';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { ClearableTextarea } from '../../components/ClearableTextarea';

const ALGOS = [['MD5', MD5], ['SHA-1', SHA1], ['SHA-256', SHA256], ['SHA-512', SHA512]];

export function HashGenerator() {
  const [input, setInput] = useToolState('input', 'hello world');
  const [upper, setUpper] = useToolState('upper', false);

  const hashes = useMemo(
    () => ALGOS.map(([name, fn]) => {
      const h = fn(input).toString();
      return [name, upper ? h.toUpperCase() : h];
    }),
    [input, upper]
  );

  return (
    <div className="hg-container">
      <h2 className="hg-title">#️⃣ Hash Generator</h2>
      <div className="hg-panel">
        <ClearableTextarea className="hg-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <label className="hg-gap hg-row"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase</label>
      </div>
      <div className="hg-panel">
        {hashes.map(([name, h]) => (
          <div key={name} className="hg-item">
            <b>{name}</b>
            <code className="hg-hash">{h}</code>
            <CopyButton text={h} label="Copy" className="hg-btn secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
