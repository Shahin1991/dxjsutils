import MD5 from 'crypto-js/md5';
import WordArray from 'crypto-js/lib-typedarrays';

export const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'CRC32'];

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

let crcTable;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export async function checksums(buffer, algos = ALGOS) {
  const bytes = new Uint8Array(buffer);
  const out = {};
  for (const a of algos) {
    if (a === 'MD5') out[a] = MD5(WordArray.create(bytes)).toString();
    else if (a === 'CRC32') out[a] = crc32(bytes);
    // eslint-disable-next-line no-await-in-loop
    else out[a] = toHex(await crypto.subtle.digest(a, bytes));
  }
  return out;
}

// Accepts hex (any case, optional spaces/colons) or Base64; returns lowercase hex or null.
export function normalizeHash(text) {
  const t = text.trim();
  if (!t) return null;
  const hex = t.replace(/[\s:]/g, '').toLowerCase();
  if (/^[0-9a-f]+$/.test(hex) && hex.length % 2 === 0) return hex;
  try {
    const bin = atob(t);
    return [...bin].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
  }
}
