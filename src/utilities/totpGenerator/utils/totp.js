// RFC 6238 TOTP / RFC 4226 HOTP using Web Crypto.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!s) throw new Error('Enter a secret');
  if (!/^[A-Z2-7]+$/.test(s)) throw new Error('The secret must be Base32 (letters A–Z and digits 2–7)');
  const out = [];
  let bits = 0;
  let value = 0;
  for (const c of s) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let out = '';
  let bits = 0;
  let value = 0;
  bytes.forEach((b) => {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export async function hotp(keyBytes, counter, { digits = 6, algorithm = 'SHA-1' } = {}) {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i -= 1) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: algorithm }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totp(keyBytes, { time = Date.now(), period = 30, ...opts } = {}) {
  return hotp(keyBytes, Math.floor(time / 1000 / period), opts);
}

export function parseOtpauth(uri) {
  let u;
  try {
    u = new URL(uri.trim());
  } catch (e) {
    throw new Error('Not a valid otpauth:// URI');
  }
  if (u.protocol !== 'otpauth:') throw new Error('The URI must start with otpauth://');
  if (u.host !== 'totp') throw new Error('Only time-based (totp) URIs are supported');
  const p = u.searchParams;
  const label = decodeURIComponent(u.pathname.replace(/^\//, ''));
  const algo = (p.get('algorithm') || 'SHA1').toUpperCase().replace('SHA', 'SHA-');
  return {
    secret: p.get('secret') || '',
    issuer: p.get('issuer') || (label.includes(':') ? label.split(':')[0] : ''),
    account: label.includes(':') ? label.split(':').slice(1).join(':') : label,
    digits: Number(p.get('digits') || 6),
    period: Number(p.get('period') || 30),
    algorithm: ['SHA-1', 'SHA-256', 'SHA-512'].includes(algo) ? algo : 'SHA-1',
  };
}

export function buildOtpauth({ secret, issuer, account, digits = 6, period = 30, algorithm = 'SHA-1' }) {
  const label = encodeURIComponent(issuer ? `${issuer}:${account || 'user'}` : account || 'user');
  const p = new URLSearchParams({ secret, ...(issuer ? { issuer } : {}), algorithm: algorithm.replace('-', ''), digits: String(digits), period: String(period) });
  return `otpauth://totp/${label}?${p.toString()}`;
}

export function randomSecret(bytes = 20) {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)));
}
