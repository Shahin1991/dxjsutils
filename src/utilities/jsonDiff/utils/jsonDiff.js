const IDENT = /^[A-Za-z_$][\w$]*$/;
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isObj = (v) => typeOf(v) === 'object';
export const joinPath = (base, key) => (typeof key === 'number' ? `${base}[${key}]` : IDENT.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`);

// Structural diff. Returns [{ op: 'added'|'removed'|'changed', path, before?, after? }].
// opts.arrayKey: match array items that are objects by this field (e.g. "id") instead of by position.
// opts.ignoreCase: compare strings case-insensitively.
export function diffJson(a, b, opts = {}, path = '$', out = []) {
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) {
    out.push({ op: 'changed', path, before: a, after: b });
    return out;
  }
  if (ta === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((k) => {
      const p = joinPath(path, k);
      if (!(k in b)) out.push({ op: 'removed', path: p, before: a[k] });
      else if (!(k in a)) out.push({ op: 'added', path: p, after: b[k] });
      else diffJson(a[k], b[k], opts, p, out);
    });
    return out;
  }
  if (ta === 'array') {
    const key = opts.arrayKey;
    if (key && [...a, ...b].every((x) => isObj(x) && key in x)) {
      const mapB = new Map(b.map((x, i) => [JSON.stringify(x[key]), [x, i]]));
      const seen = new Set();
      a.forEach((x, i) => {
        const id = JSON.stringify(x[key]);
        const label = `${path}[${key}=${x[key]}]`;
        if (mapB.has(id)) {
          seen.add(id);
          diffJson(x, mapB.get(id)[0], opts, label, out);
        } else out.push({ op: 'removed', path: label, before: x, index: i });
      });
      b.forEach((x) => {
        const id = JSON.stringify(x[key]);
        if (!seen.has(id)) out.push({ op: 'added', path: `${path}[${key}=${x[key]}]`, after: x });
      });
      return out;
    }
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i += 1) {
      const p = joinPath(path, i);
      if (i >= b.length) out.push({ op: 'removed', path: p, before: a[i] });
      else if (i >= a.length) out.push({ op: 'added', path: p, after: b[i] });
      else diffJson(a[i], b[i], opts, p, out);
    }
    return out;
  }
  const same = ta === 'string' && opts.ignoreCase ? a.toLowerCase() === b.toLowerCase() : a === b;
  if (!same) out.push({ op: 'changed', path, before: a, after: b });
  return out;
}

export function parseSide(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label}: ${e.message}`);
  }
}

export const preview = (v) => (v === undefined ? '' : JSON.stringify(v));
