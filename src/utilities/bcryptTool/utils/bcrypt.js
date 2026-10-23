import { compare, genSalt, hash, truncates } from 'bcryptjs';

export const BCRYPT_RE = /^\$2[abxy]\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;

export async function bcryptHash(password, cost, onProgress) {
  const salt = await genSalt(cost);
  return hash(password, salt, undefined, onProgress);
}

export async function bcryptVerify(password, hashValue, onProgress) {
  const h = hashValue.trim();
  if (!BCRYPT_RE.test(h)) throw new Error('That is not a bcrypt hash ($2a$/$2b$/$2y$ followed by 53 characters)');
  return compare(password, h.replace(/^\$2y\$/, '$2b$'), undefined, onProgress);
}

export function parseBcrypt(h) {
  const m = h.trim().match(BCRYPT_RE);
  if (!m) return null;
  return { version: h.slice(1, 3), cost: Number(m[1]), salt: m[2], hash: m[3], rounds: 2 ** Number(m[1]) };
}

export const tooLong = (password) => truncates(password);
