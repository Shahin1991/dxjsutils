const IDENT = /^[A-Za-z_$][\w$]*$/;

const pascal = (s) => {
  const p = String(s).replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());
  return /^[A-Za-z_$]/.test(p) ? p : `T${p}`;
};
const singular = (s) => (/ies$/i.test(s) ? s.replace(/ies$/i, 'y') : /ses$/i.test(s) ? s.slice(0, -2) : /s$/i.test(s) && !/ss$/i.test(s) ? s.slice(0, -1) : `${s}Item`);

// Generate TypeScript interfaces from a JSON sample.
// Arrays of objects are merged: a key missing from some items becomes optional.
export function jsonToTs(json, { rootName = 'Root', useType = false, optionalNulls = false, readonly = false } = {}) {
  const value = JSON.parse(json);
  const decls = [];
  const used = new Set();

  const unique = (name) => {
    let n = name;
    for (let i = 2; used.has(n); i += 1) n = `${name}${i}`;
    used.add(n);
    return n;
  };

  const typeOf = (v, name) => {
    if (v === null) return 'null';
    if (Array.isArray(v)) return arrayType(v, singular(name));
    if (typeof v === 'object') return objectType([v], name);
    return typeof v;
  };

  function union(types) {
    const set = [...new Set(types)];
    return set.length === 1 ? set[0] : set.join(' | ');
  }

  function arrayType(arr, name) {
    if (arr.length === 0) return 'unknown[]';
    const objects = arr.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
    const others = arr.filter((x) => !(x && typeof x === 'object' && !Array.isArray(x))).map((x) => typeOf(x, name));
    const types = objects.length ? [objectType(objects, name), ...others] : others;
    const t = union(types);
    return t.includes(' | ') ? `(${t})[]` : `${t}[]`;
  }

  function objectType(objs, name) {
    const iname = unique(pascal(name));
    const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
    const lines = keys.map((k) => {
      const present = objs.filter((o) => k in o);
      const values = present.map((o) => o[k]);
      const objValues = values.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
      const types = [];
      if (objValues.length) types.push(objectType(objValues, k));
      values.filter((x) => !(x && typeof x === 'object' && !Array.isArray(x))).forEach((x) => types.push(typeOf(x, k)));
      let t = union(types);
      let optional = present.length < objs.length;
      if (optionalNulls && t !== 'null' && t.split(' | ').includes('null')) {
        t = t.split(' | ').filter((x) => x !== 'null').join(' | ');
        optional = true;
      }
      const key = IDENT.test(k) ? k : JSON.stringify(k);
      return `  ${readonly ? 'readonly ' : ''}${key}${optional ? '?' : ''}: ${t};`;
    });
    const body = lines.length ? `{\n${lines.join('\n')}\n}` : 'Record<string, unknown>';
    decls.push(useType || !lines.length ? `export type ${iname} = ${body};` : `export interface ${iname} ${body}`);
    return iname;
  }

  if (Array.isArray(value)) {
    decls.push(`export type ${unique(`${pascal(rootName)}List`)} = ${arrayType(value, rootName)};`);
  } else if (value && typeof value === 'object') {
    objectType([value], rootName);
  } else {
    decls.push(`export type ${unique(pascal(rootName))} = ${typeOf(value, rootName)};`);
  }
  // Nested declarations were pushed first; show the root first for readability.
  return decls.reverse().join('\n\n');
}
