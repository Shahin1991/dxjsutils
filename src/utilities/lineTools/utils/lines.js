const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Operations on a list of lines. Each returns a new array.
export const OPERATIONS = {
  sortAsc: { label: 'Sort A→Z', run: (l) => [...l].sort(collator.compare) },
  sortDesc: { label: 'Sort Z→A', run: (l) => [...l].sort((a, b) => collator.compare(b, a)) },
  sortLength: { label: 'Sort by length', run: (l) => [...l].sort((a, b) => a.length - b.length || collator.compare(a, b)) },
  unique: { label: 'Remove duplicates', run: (l, o) => {
    const seen = new Set();
    return l.filter((x) => {
      const k = o.ignoreCase ? x.toLowerCase() : x;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } },
  duplicates: { label: 'Only duplicates', run: (l, o) => {
    const key = (x) => (o.ignoreCase ? x.toLowerCase() : x);
    const counts = new Map();
    l.forEach((x) => counts.set(key(x), (counts.get(key(x)) || 0) + 1));
    const seen = new Set();
    return l.filter((x) => counts.get(key(x)) > 1 && !seen.has(key(x)) && seen.add(key(x)));
  } },
  reverse: { label: 'Reverse order', run: (l) => [...l].reverse() },
  shuffle: { label: 'Shuffle', run: (l, o, rand = Math.random) => {
    const a = [...l];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  } },
  trim: { label: 'Trim spaces', run: (l) => l.map((x) => x.trim()) },
  removeEmpty: { label: 'Remove empty lines', run: (l) => l.filter((x) => x.trim() !== '') },
  number: { label: 'Number lines', run: (l) => l.map((x, i) => `${i + 1}. ${x}`) },
};

export function splitLines(text) {
  return text === '' ? [] : text.split(/\r?\n/);
}

export function applyOperation(text, op, opts = {}) {
  return OPERATIONS[op].run(splitLines(text), opts).join('\n');
}

export function wrapLines(text, { prefix = '', suffix = '', skipEmpty = true } = {}) {
  return splitLines(text).map((x) => (skipEmpty && x === '' ? x : `${prefix}${x}${suffix}`)).join('\n');
}

// Turn lines into one delimited string, e.g. for a SQL IN (...) list.
export function joinLines(text, { delimiter = ', ', quote = '' } = {}) {
  return splitLines(text).filter((x) => x.trim() !== '').map((x) => `${quote}${x.trim()}${quote}`).join(delimiter);
}

export function splitToLines(text, delimiter) {
  if (!delimiter) return text;
  return text.split(delimiter).map((x) => x.trim()).filter(Boolean).join('\n');
}
