import React, { useMemo, useState } from 'react';
import { brand, cardLengths, luhn, validateIban } from './utils/validate';

export function CardValidator() {
  const [card, setCard] = useState('4111 1111 1111 1111');
  const [ibanText, setIbanText] = useState('AE07 0331 2345 6789 0123 456');

  const cardRes = useMemo(() => {
    const num = card.replace(/[\s-]/g, '');
    if (!num) return null;
    if (!/^\d+$/.test(num)) return { error: 'Only digits, spaces and dashes are allowed' };
    const b = brand(num);
    const lens = cardLengths(b);
    return { num, brand: b, luhn: luhn(num), lengthOk: lens ? lens.includes(num.length) : num.length >= 12 && num.length <= 19 };
  }, [card]);

  const ibanRes = useMemo(() => validateIban(ibanText), [ibanText]);

  return (
    <div className="cv2-container">
      <h2 className="cv2-title">💳 Card / IBAN Validator</h2>
      <p className="cv2-desc">Checks run entirely offline. Nothing is sent anywhere.</p>
      <div className="cv2-panel">
        <strong>Credit card (Luhn)</strong>
        <input className="cv2-input cv2-wide" value={card} onChange={(e) => setCard(e.target.value)} placeholder="Card number" autoComplete="off" />
        {cardRes?.error && <div className="cv2-err">⚠ {cardRes.error}</div>}
        {cardRes && !cardRes.error && (
          <div className="cv2-grid cv2-gap">
            <div className="cv2-stat"><b>Network</b>{cardRes.brand}</div>
            <div className="cv2-stat"><b>Luhn checksum</b><span className={cardRes.luhn ? 'cv2-ok' : 'cv2-err'}>{cardRes.luhn ? 'Valid' : 'Invalid'}</span></div>
            <div className="cv2-stat"><b>Length ({cardRes.num.length})</b><span className={cardRes.lengthOk ? 'cv2-ok' : 'cv2-err'}>{cardRes.lengthOk ? 'OK for network' : 'Unexpected'}</span></div>
          </div>
        )}
      </div>
      <div className="cv2-panel">
        <strong>IBAN (ISO 7064 MOD-97)</strong>
        <input className="cv2-input cv2-wide" value={ibanText} onChange={(e) => setIbanText(e.target.value)} placeholder="IBAN" autoComplete="off" />
        {ibanRes && (
          <div className="cv2-gap">
            <div className={ibanRes.valid ? 'cv2-ok' : 'cv2-err'}><b>{ibanRes.valid ? '✓ Valid IBAN' : '✗ Invalid IBAN'}</b> <span className="cv2-muted">{ibanRes.formatted}</span></div>
            {ibanRes.checks.map(([label, ok]) => <div key={label} className={ok ? 'cv2-ok' : 'cv2-err'}>{ok ? '✓' : '✗'} {label}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
