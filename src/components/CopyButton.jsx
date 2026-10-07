import React, { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';

// Copy-to-clipboard button with inline "Copied!" feedback.
export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [state, setState] = useState('idle'); // idle | copied | failed
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(typeof text === 'function' ? text() : text);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1500);
  };

  return (
    <button type="button" className={`copy-btn ${className}`} onClick={onClick} disabled={!text} aria-live="polite">
      {state === 'copied' ? '✓ Copied!' : state === 'failed' ? 'Copy failed' : `📋 ${label}`}
    </button>
  );
}

export default CopyButton;
