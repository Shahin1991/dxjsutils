export const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
};
const AMBIGUOUS = /[O0oIl1|]/g;

// Unbiased random integer in [0, max) using rejection sampling.
export function randomInt(max, rng = (a) => crypto.getRandomValues(a)) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do rng(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

export function generatePassword({ length = 16, lower = true, upper = true, digits = true, symbols = false, avoidAmbiguous = false } = {}, rng) {
  const groups = Object.entries({ lower, upper, digits, symbols })
    .filter(([, on]) => on)
    .map(([k]) => (avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (groups.length === 0) throw new Error('Select at least one character type');
  if (length < groups.length) throw new Error(`Length must be at least ${groups.length}`);
  const pool = groups.join('');
  // Guarantee one character from each selected group, fill the rest from the pool, then shuffle.
  const chars = groups.map((g) => g[randomInt(g.length, rng)]);
  while (chars.length < length) chars.push(pool[randomInt(pool.length, rng)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1, rng);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Rough entropy in bits for a given pool size and length.
export function entropyBits(poolSize, length) {
  return poolSize > 1 ? Math.round(length * Math.log2(poolSize)) : 0;
}

export function strengthLabel(bits) {
  if (bits < 40) return ['Weak', 'tl-err'];
  if (bits < 60) return ['Fair', 'tl-warn'];
  if (bits < 80) return ['Good', 'tl-ok'];
  return ['Strong', 'tl-ok'];
}
