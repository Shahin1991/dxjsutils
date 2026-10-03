const indentOf = (l) => l.match(/^\s*/)[0].length;
const isBlankOrComment = (l) => !l.trim() || l.trim().startsWith('#');

const unquote = (v) => {
  const t = v.trim();
  return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t;
};

function stripComment(v) {
  return v.replace(/\s+#.*$/, '');
}

// Extract env entries as a Map(key -> value). Supports `KEY: value`, `- KEY=value`, and k8s `- name: X / value: Y`.
export function parseEnv(text) {
  const lines = text.split(/\r?\n/);
  const out = new Map();
  let found = false;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*)(env|environment)\s*:\s*$/i);
    if (!m) continue;
    found = true;
    const base = m[1].length;
    let pendingName = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (isBlankOrComment(line)) continue;
      if (indentOf(line) <= base && !/^\s*-\s/.test(line)) break;
      if (indentOf(line) < base) break;
      let body = line.trim();
      if (body.startsWith('- ')) body = body.slice(2).trim();
      let kv = body.match(/^([^=:\s][^=:]*?)\s*=\s*(.*)$/);
      if (!kv) kv = body.match(/^([^:\s][^:]*?)\s*:\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1].trim();
      const val = unquote(stripComment(kv[2]));
      if (key === 'name' && /^\s*-\s/.test(line)) {
        pendingName = val;
      } else if (key === 'value' && pendingName !== null) {
        out.set(pendingName, val);
        pendingName = null;
      } else if (key === 'name' && pendingName === null) {
        pendingName = val;
      } else {
        if (pendingName !== null) {
          out.set(pendingName, '');
          pendingName = null;
        }
        out.set(key, val);
      }
    }
    if (pendingName !== null) out.set(pendingName, '');
  }
  return { entries: out, found };
}

// Fallback when there is no env section: top-level `key: value` pairs.
export function parseTopLevel(text) {
  const out = new Map();
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^\s#-][^:]*):\s*(.*)$/);
    if (m) out.set(m[1].trim(), unquote(stripComment(m[2])));
  });
  return out;
}

export function compareYaml(a, b) {
  const pa = parseEnv(a);
  const pb = parseEnv(b);
  const useEnv = pa.found || pb.found;
  const ma = useEnv ? pa.entries : parseTopLevel(a);
  const mb = useEnv ? pb.entries : parseTopLevel(b);
  const keys = [...new Set([...ma.keys(), ...mb.keys()])].sort((x, y) => x.localeCompare(y));
  const rows = keys.map((key) => {
    const inA = ma.has(key);
    const inB = mb.has(key);
    let status = 'same';
    if (inA && !inB) status = 'removed';
    else if (!inA && inB) status = 'added';
    else if (ma.get(key) !== mb.get(key)) status = 'changed';
    return { key, left: ma.get(key), right: mb.get(key), status };
  });
  return { rows, mode: useEnv ? 'env' : 'top-level' };
}
