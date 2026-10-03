export function luhn(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = parseInt(num[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return num.length > 0 && sum % 10 === 0;
}

export function brand(num) {
  const n = (len) => parseInt(num.slice(0, len), 10);
  if (/^4/.test(num)) return 'Visa';
  if ((n(2) >= 51 && n(2) <= 55) || (n(6) >= 222100 && n(6) <= 272099)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'American Express';
  if (/^(6011|65|64[4-9])/.test(num) || (n(6) >= 622126 && n(6) <= 622925)) return 'Discover';
  if (/^35(2[89]|[3-8])/.test(num)) return 'JCB';
  if (/^3(0[0-5]|[68])/.test(num)) return 'Diners Club';
  if (/^62/.test(num)) return 'UnionPay';
  if (/^(5018|5020|5038|5893|6304|6759|676[1-3])/.test(num)) return 'Maestro';
  return 'Unknown';
}

export function cardLengths(b) {
  return { Visa: [13, 16, 19], Mastercard: [16], 'American Express': [15], Discover: [16, 19], JCB: [16, 19], 'Diners Club': [14, 16, 19], UnionPay: [16, 17, 18, 19], Maestro: [12, 13, 14, 15, 16, 17, 18, 19] }[b];
}

// country -> [total length, BBAN pattern description]
export const IBAN_LENGTHS = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

export function validateIban(raw) {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!iban) return null;
  const res = { iban, country: iban.slice(0, 2), checks: [] };
  const fmtOk = /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban);
  res.checks.push(['Format (2 letters, 2 digits, alphanumerics)', fmtOk]);
  const expected = IBAN_LENGTHS[res.country];
  res.checks.push([expected ? `Length for ${res.country} is ${expected}` : `Country code ${res.country} is known`, !!expected && iban.length === expected]);
  let ok = false;
  if (fmtOk) {
    const rearranged = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let rem = 0;
    for (let i = 0; i < rearranged.length; i += 7) rem = parseInt(`${rem}${rearranged.slice(i, i + 7)}`, 10) % 97;
    ok = rem === 1;
  }
  res.checks.push(['MOD-97 checksum (ISO 7064)', ok]);
  res.valid = res.checks.every(([, v]) => v);
  res.formatted = iban.replace(/(.{4})/g, '$1 ').trim();
  return res;
}
