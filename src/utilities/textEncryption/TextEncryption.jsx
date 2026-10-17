import React, { useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { decryptText, encryptText } from './utils/aes';

// Nothing here uses useToolState: plaintext and passphrases should not linger after you leave the tool.
export function TextEncryption() {
  const [mode, setMode] = useState('encrypt');
  const [input, setInput] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState({});

  const run = async () => {
    setBusy(true);
    setResult({});
    try {
      setResult({ out: mode === 'encrypt' ? await encryptText(input, pass) : await decryptText(input, pass) });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (m) => {
    setMode(m);
    setResult({});
  };

  return (
    <div className="tl-container">
      <h2 className="tl-title">🛡️ Text Encryption</h2>
      <p className="tl-desc">Encrypt a note with a passphrase (AES-256-GCM) and decrypt it later. Everything happens on your device.</p>
      <div className="tl-panel">
        <div className="tl-row">
          {[['encrypt', '🔒 Encrypt'], ['decrypt', '🔓 Decrypt']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} onClick={() => changeMode(id)}>{label}</button>
          ))}
        </div>
        <label className="tl-label" htmlFor="enc-in">{mode === 'encrypt' ? 'Text to encrypt' : 'Encrypted text (Base64)'}</label>
        <ClearableTextarea id="enc-in" className="tl-textarea" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false}
          placeholder={mode === 'encrypt' ? 'Type the secret note…' : 'Paste text that was encrypted with this tool'} />
        <div className="tl-row tl-gap">
          <label className="tl-check">Passphrase
            <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" style={{ width: 260 }}
              onKeyDown={(e) => { if (e.key === 'Enter' && input && pass) run(); }} />
          </label>
          <label className="tl-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show</label>
          <button type="button" className="tl-btn" onClick={run} disabled={busy || !input || !pass}>{busy ? 'Working…' : mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}</button>
        </div>
        {result.error && <div className="tl-err">⚠ {result.error}</div>}
        {result.out !== undefined && (
          <>
            <div className="tl-label tl-gap">{mode === 'encrypt' ? 'Encrypted (safe to paste anywhere)' : 'Decrypted text'}</div>
            <pre className="tl-out">{result.out}</pre>
            <div className="tl-gap"><CopyButton text={result.out} label="Copy" /></div>
          </>
        )}
        <p className="tl-muted tl-gap">There is no way to recover the text if you forget the passphrase. Use a long, unique passphrase and share it separately from the encrypted text.</p>
      </div>
    </div>
  );
}
