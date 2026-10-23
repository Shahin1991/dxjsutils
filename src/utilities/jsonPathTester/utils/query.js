import { JSONPath } from 'jsonpath-plus';

// Run a JSONPath expression. Returns [{ path, value }]. Script filters use jsonpath-plus's safe evaluator.
export function queryJson(text, expr) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  if (!expr.trim()) return [];
  try {
    return JSONPath({ path: expr.trim(), json, resultType: 'all', eval: 'safe' }).map((r) => ({ path: r.path, value: r.value }));
  } catch (e) {
    throw new Error(`Invalid JSONPath: ${e.message}`);
  }
}

// Run an XPath expression against XML using the browser's own parser and evaluator.
export function queryXml(text, expr) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`Invalid XML: ${err.textContent.split('\n').filter(Boolean)[0] || 'parse error'}`);
  if (!expr.trim()) return [];
  let res;
  try {
    const ns = doc.createNSResolver ? doc.createNSResolver(doc.documentElement) : null;
    res = doc.evaluate(expr.trim(), doc, ns, 0 /* ANY_TYPE */, null);
  } catch (e) {
    throw new Error(`Invalid XPath: ${e.message}`);
  }
  if (res.resultType === 1) return [{ path: 'number', value: res.numberValue }];
  if (res.resultType === 2) return [{ path: 'string', value: res.stringValue }];
  if (res.resultType === 3) return [{ path: 'boolean', value: res.booleanValue }];
  const out = [];
  const ser = new XMLSerializer();
  for (let n = res.iterateNext(); n; n = res.iterateNext()) {
    const text = n.nodeType === 1 ? ser.serializeToString(n) : n.nodeValue;
    out.push({ path: nodePath(n), value: text });
  }
  return out;
}

function nodePath(n) {
  const parts = [];
  for (let cur = n; cur && cur.nodeType !== 9; cur = cur.nodeType === 2 ? cur.ownerElement : cur.parentNode) {
    if (cur.nodeType === 2) parts.unshift(`@${cur.name}`);
    else if (cur.nodeType === 3) parts.unshift('text()');
    else {
      const same = [...(cur.parentNode?.children || [])].filter((c) => c.nodeName === cur.nodeName);
      parts.unshift(same.length > 1 ? `${cur.nodeName}[${same.indexOf(cur) + 1}]` : cur.nodeName);
    }
  }
  return `/${parts.join('/')}`;
}
