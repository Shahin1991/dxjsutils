// AES-256-GCM with a key derived from the passphrase by PBKDF2-SHA256.
// Output: base64 of [version 1 byte | salt 16 | iv 12 | ciphertext+tag]. Uses the Web Crypto API only.
const VERSION = 1;
const ITERATIONS = 310000;
const enc = new TextEncoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
function fromB64(s) {
  const bin = atob(s.replace(/\s+/g, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase, salt, usage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export async function encryptText(plain, passphrase) {
  if (!passphrase) throw new Error('Enter a passphrase');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, 'encrypt');
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
  const out = new Uint8Array(1 + 16 + 12 + ct.length);
  out.set([VERSION]);
  out.set(salt, 1);
  out.set(iv, 17);
  out.set(ct, 29);
  // Chunk to avoid call-stack limits on String.fromCharCode(...bigArray)
  let b64 = '';
  for (let i = 0; i < out.length; i += 3 * 8192) b64 += toB64(out.subarray(i, i + 3 * 8192));
  return b64;
}

export async function decryptText(b64, passphrase) {
  if (!passphrase) throw new Error('Enter a passphrase');
  let data;
  try {
    data = fromB64(b64.trim());
  } catch (e) {
    throw new Error('The encrypted text is not valid Base64');
  }
  if (data.length < 29 + 16 || data[0] !== VERSION) throw new Error('This does not look like text encrypted by this tool');
  const key = await deriveKey(passphrase, data.subarray(1, 17), 'decrypt');
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(17, 29) }, key, data.subarray(29));
    return new TextDecoder().decode(plain);
  } catch (e) {
    throw new Error('Wrong passphrase, or the text was changed');
  }
}
