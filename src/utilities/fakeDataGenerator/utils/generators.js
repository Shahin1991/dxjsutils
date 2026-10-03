// Seeded PRNG (mulberry32) so the same seed always yields the same data.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ahmed', 'Fatima', 'Mohammed', 'Aisha', 'Omar', 'Layla', 'Khalid', 'Noor', 'John', 'Emma', 'Liam', 'Olivia', 'Raj', 'Priya', 'Wei', 'Mei', 'Carlos', 'Sofia', 'Hans', 'Anna', 'Yusuf', 'Mariam', 'Sara', 'Daniel'];
const LAST = ['Al Maktoum', 'Hassan', 'Khan', 'Ali', 'Smith', 'Johnson', 'Patel', 'Sharma', 'Chen', 'Wang', 'Garcia', 'Müller', 'Ibrahim', 'Rahman', 'Brown', 'Taylor', 'Nasser', 'Farouk', 'Silva', 'Rossi'];
const STREETS = ['Sheikh Zayed Rd', 'Al Wasl Rd', 'Jumeirah St', 'Baker St', 'High St', 'Park Ave', 'Main St', 'King Rd', 'Marina Walk', 'Corniche Rd'];
const CITIES = [['Dubai', 'AE'], ['Abu Dhabi', 'AE'], ['Sharjah', 'AE'], ['London', 'GB'], ['Paris', 'FR'], ['Berlin', 'DE'], ['Mumbai', 'IN'], ['New York', 'US'], ['Singapore', 'SG'], ['Cairo', 'EG']];
const DOMAINS = ['example.com', 'test.org', 'mail.test', 'demo.net'];

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const digits = (r, n) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');

function luhnCheckDigit(partial) {
  let sum = 0;
  for (let i = 0; i < partial.length; i += 1) {
    let d = parseInt(partial[partial.length - 1 - i], 10);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function cardNumber(r) {
  const [prefix, len] = pick(r, [['4', 16], ['51', 16], ['55', 16], ['34', 15], ['37', 15]]);
  const body = prefix + digits(r, len - prefix.length - 1);
  return body + luhnCheckDigit(body);
}

function ibanMod97(numeric) {
  let rem = 0;
  for (let i = 0; i < numeric.length; i += 7) rem = parseInt(`${rem}${numeric.slice(i, i + 7)}`, 10) % 97;
  return rem;
}

const IBAN_FORMATS = { AE: [3, 16], GB: [4, 14], DE: [8, 10], FR: [10, 13] };

export function iban(r) {
  const country = pick(r, Object.keys(IBAN_FORMATS));
  const [bankLen, accLen] = IBAN_FORMATS[country];
  const bban = country === 'GB'
    ? Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(r() * 26))).join('') + digits(r, 14)
    : digits(r, bankLen + accLen);
  const rearranged = `${bban}${country}00`.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const check = String(98 - ibanMod97(rearranged)).padStart(2, '0');
  return `${country}${check}${bban}`;
}

export const FIELDS = ['name', 'email', 'phone', 'address', 'card', 'iban'];

export function generate(count, fields, seed) {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const first = pick(r, FIRST);
    const last = pick(r, LAST);
    const row = {};
    if (fields.includes('name')) row.name = `${first} ${last}`;
    if (fields.includes('email')) row.email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + Math.floor(r() * 100) + '@' + pick(r, DOMAINS);
    if (fields.includes('phone')) row.phone = `+971 5${Math.floor(r() * 10)} ${digits(r, 3)} ${digits(r, 4)}`;
    if (fields.includes('address')) {
      const [city, cc] = pick(r, CITIES);
      row.address = `${1 + Math.floor(r() * 200)} ${pick(r, STREETS)}, ${city}, ${cc}`;
    }
    if (fields.includes('card')) row.card = cardNumber(r);
    if (fields.includes('iban')) row.iban = iban(r);
    return row;
  });
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}
