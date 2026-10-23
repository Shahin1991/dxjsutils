// Sign and verify JWTs with the Web Crypto API (no libraries).
const enc = new TextEncoder();

export const ALGORITHMS = {
  HS256: { kind: 'hmac', hash: 'SHA-256' }, HS384: { kind: 'hmac', hash: 'SHA-384' }, HS512: { kind: 'hmac', hash: 'SHA-512' },
  RS256: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, RS384: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }, RS512: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
  PS256: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 }, PS384: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-384', saltLength: 48 }, PS512: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-512', saltLength: 64 },
  ES256: { kind: 'ec', name: 'ECDSA', hash: 'SHA-256', curve: 'P-256' }, ES384: { kind: 'ec', name: 'ECDSA', hash: 'SHA-384', curve: 'P-384' }, ES512: { kind: 'ec', name: 'ECDSA', hash: 'SHA-512', curve: 'P-521' },
};

export function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const pemBody = (pem, label) => {
  const m = pem.match(new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`));
  if (!m) return null;
  return Uint8Array.from(atob(m[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
};

export function toPem(buffer, label) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
}

function params(alg) {
  const a = ALGORITHMS[alg];
  if (!a) throw new Error(`Unsupported algorithm "${alg}"`);
  if (a.kind === 'hmac') return { import: { name: 'HMAC', hash: a.hash }, sign: { name: 'HMAC' } };
  if (a.kind === 'rsa') return { import: { name: a.name, hash: a.hash }, sign: a.name === 'RSA-PSS' ? { name: a.name, saltLength: a.saltLength } : { name: a.name } };
  return { import: { name: 'ECDSA', namedCurve: a.curve }, sign: { name: 'ECDSA', hash: a.hash } };
}

// key: HMAC secret text, a PEM (PKCS#8 private / SPKI public), or a JWK JSON string.
async function importKey(alg, key, usage) {
  const a = ALGORITHMS[alg];
  const p = params(alg);
  const k = String(key).trim();
  if (!k) throw new Error(a.kind === 'hmac' ? 'Enter the secret' : `Paste a ${usage === 'sign' ? 'private' : 'public'} key`);
  try {
    if (a.kind === 'hmac') return await crypto.subtle.importKey('raw', enc.encode(key), p.import, false, [usage]);
    if (k.startsWith('{')) return await crypto.subtle.importKey('jwk', JSON.parse(k), p.import, false, [usage]);
    const der = usage === 'sign' ? pemBody(k, 'PRIVATE KEY') : pemBody(k, 'PUBLIC KEY');
    if (!der) {
      if (/BEGIN RSA PRIVATE KEY|BEGIN EC PRIVATE KEY/.test(k)) throw new Error('Convert the key to PKCS#8 first: openssl pkcs8 -topk8 -nocrypt -in key.pem');
      throw new Error(usage === 'sign' ? 'Expected a "BEGIN PRIVATE KEY" PEM or a JWK' : 'Expected a "BEGIN PUBLIC KEY" PEM or a JWK');
    }
    return await crypto.subtle.importKey(usage === 'sign' ? 'pkcs8' : 'spki', der, p.import, false, [usage]);
  } catch (e) {
    if (/Convert|Expected/.test(e.message)) throw e;
    throw new Error(`The key does not fit ${alg}: ${e.message}`);
  }
}

export async function signJwt(header, payload, key) {
  const alg = header.alg;
  const signingInput = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const k = await importKey(alg, key, 'sign');
  const sig = await crypto.subtle.sign(params(alg).sign, k, enc.encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

export function decodeJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('A JWT has three parts separated by dots');
  const dec = new TextDecoder();
  try {
    return { header: JSON.parse(dec.decode(fromB64url(parts[0]))), payload: JSON.parse(dec.decode(fromB64url(parts[1]))), parts };
  } catch (e) {
    throw new Error('The header or payload is not valid Base64URL JSON');
  }
}

export async function verifyJwt(token, key) {
  const { header, payload, parts } = decodeJwt(token);
  if (header.alg === 'none') return { valid: false, header, payload, reason: 'alg "none" is never trusted' };
  const k = await importKey(header.alg, key, 'verify');
  const valid = await crypto.subtle.verify(params(header.alg).sign, k, fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  return { valid, header, payload };
}

// Time claims check, separate from the signature.
export function claimStatus(payload, now = Date.now() / 1000) {
  if (typeof payload.exp === 'number' && now >= payload.exp) return { ok: false, text: `Expired ${new Date(payload.exp * 1000).toLocaleString()}` };
  if (typeof payload.nbf === 'number' && now < payload.nbf) return { ok: false, text: `Not valid until ${new Date(payload.nbf * 1000).toLocaleString()}` };
  if (typeof payload.exp === 'number') return { ok: true, text: `Valid until ${new Date(payload.exp * 1000).toLocaleString()}` };
  return { ok: true, text: 'No expiry (exp) claim' };
}

export async function generateKeyPair(alg) {
  const a = ALGORITHMS[alg];
  if (a.kind === 'hmac') {
    const bytes = crypto.getRandomValues(new Uint8Array(a.hash === 'SHA-256' ? 32 : a.hash === 'SHA-384' ? 48 : 64));
    return { secret: b64url(bytes) };
  }
  const gen = a.kind === 'ec'
    ? { name: 'ECDSA', namedCurve: a.curve }
    : { name: a.name, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: a.hash };
  const pair = await crypto.subtle.generateKey(gen, true, ['sign', 'verify']);
  return {
    privateKey: toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY'),
    publicKey: toPem(await crypto.subtle.exportKey('spki', pair.publicKey), 'PUBLIC KEY'),
  };
}
