const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function htmlDecode(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', euro: '€', pound: '£' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return named[e.toLowerCase()] ?? m;
  });
}

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export const NATO = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo',
  L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform',
  V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
  0: 'Zero', 1: 'One', 2: 'Two', 3: 'Tree', 4: 'Four', 5: 'Fife', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Niner',
};
const NATO_REV = Object.fromEntries(Object.entries(NATO).map(([k, v]) => [v.toLowerCase(), k]));
Object.assign(NATO_REV, { alpha: 'A', juliet: 'J', xray: 'X', three: '3', five: '5', nine: '9' });

const utf8 = (s) => [...new TextEncoder().encode(s)];
const fromBytes = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));

function parseBytes(s, re, radix, width, name) {
  const clean = s.replace(/0x|\\x/gi, '').replace(/[\s,:]+/g, radix === 16 ? '' : ' ').trim();
  if (!clean) return '';
  const parts = radix === 16 ? clean.match(/.{1,2}/g) : clean.split(' ');
  if (!parts.every((p) => re.test(p) && p.length <= width) || (radix === 16 && clean.length % 2)) throw new Error(`Not valid ${name}`);
  try {
    return fromBytes(parts.map((p) => parseInt(p, radix)));
  } catch (e) {
    throw new Error(`The ${name} is not valid UTF-8 text`);
  }
}

// Each encoder: encode(text) and decode(text). Both throw on invalid input.
export const ENCODERS = {
  html: {
    label: 'HTML entities',
    encode: (s) => s.replace(/[&<>"']/g, (c) => HTML_ESC[c]),
    decode: htmlDecode,
    sample: '<a href="/x?a=1&b=2">Tom & Jerry\'s</a>',
  },
  unicode: {
    label: 'Unicode escapes',
    encode: (s) => [...s].map((c) => {
      const cp = c.codePointAt(0);
      if (cp < 128) return c;
      return cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`;
    }).join(''),
    decode: (s) => s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (m, a, b) => String.fromCodePoint(parseInt(a || b, 16))),
    sample: 'Café ☕ مرحبا 🚀',
  },
  json: {
    label: 'JSON string',
    encode: (s) => JSON.stringify(s).slice(1, -1),
    decode: (s) => {
      try {
        return JSON.parse(`"${s}"`);
      } catch (e) {
        throw new Error('Not a valid JSON string escape');
      }
    },
    sample: 'Line 1\nLine 2\t"quoted" \\ backslash',
  },
  hex: {
    label: 'Hex (UTF-8)',
    encode: (s) => utf8(s).map((b) => b.toString(16).padStart(2, '0')).join(' '),
    decode: (s) => parseBytes(s, /^[0-9a-f]{1,2}$/i, 16, 2, 'hex'),
    sample: 'Hello, world!',
  },
  binary: {
    label: 'Binary (UTF-8)',
    encode: (s) => utf8(s).map((b) => b.toString(2).padStart(8, '0')).join(' '),
    decode: (s) => parseBytes(s, /^[01]{1,8}$/, 2, 8, 'binary'),
    sample: 'Hi!',
  },
  rot13: {
    label: 'ROT13',
    encode: (s) => s.replace(/[a-z]/gi, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    }),
    decode: (s) => ENCODERS.rot13.encode(s),
    sample: 'Why did the chicken cross the road?',
  },
  morse: {
    label: 'Morse code',
    encode: (s) => s.toUpperCase().trim().split(/\s+/).filter(Boolean)
      .map((w) => [...w].map((c) => MORSE[c] || '').filter(Boolean).join(' ')).join(' / '),
    decode: (s) => s.trim().split(/\s*\/\s*|\s{3,}/).map((w) => w.split(/\s+/).filter(Boolean).map((code) => {
      if (!MORSE_REV[code]) throw new Error(`Unknown Morse code "${code}"`);
      return MORSE_REV[code];
    }).join('')).join(' '),
    sample: 'SOS Emirates 2026',
  },
  nato: {
    label: 'NATO phonetic',
    encode: (s) => s.toUpperCase().trim().split(/\s+/).filter(Boolean)
      .map((w) => [...w].map((c) => NATO[c] || c).join(' ')).join(' / '),
    decode: (s) => s.trim().split(/\s*\/\s*/).map((w) => w.split(/\s+/).filter(Boolean)
      .map((word) => NATO_REV[word.toLowerCase().replace(/-/g, '')] ?? NATO_REV[word.toLowerCase()] ?? word).join('')).join(' '),
    sample: 'EK202 DXB',
  },
};
