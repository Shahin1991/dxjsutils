const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export function detectType(src) {
  const s = src.trim();
  if (!s) return 'json';
  if (s.startsWith('{') || s.startsWith('[')) return 'json';
  if (/^<\?xml/i.test(s)) return 'xml';
  if (/^<!doctype html|^<html|^<(div|body|head|p|span|ul|section|table|form|a|h[1-6])\b/i.test(s)) return 'html';
  if (s.startsWith('<')) return 'xml';
  if (/^\s*(select|insert|update|delete|with|create|alter|drop)\b/i.test(s)) return 'sql';
  if (/[^{}]+\{[^}]*:[^}]*\}/.test(s)) return 'css';
  return 'json';
}

export function formatJson(s) {
  return JSON.stringify(JSON.parse(s), null, 2);
}

export function formatMarkup(s, type) {
  const tokens = s.replace(/>\s+</g, '><').split(/(<[^>]+>)/).map((t) => t.trim()).filter(Boolean);
  const out = [];
  let depth = 0;
  const pad = () => '  '.repeat(Math.max(depth, 0));
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const isTag = t.startsWith('<');
    if (!isTag) {
      out.push(pad() + t);
    } else if (t.startsWith('</')) {
      depth -= 1;
      out.push(pad() + t);
    } else if (t.startsWith('<!') || t.startsWith('<?') || t.endsWith('/>')) {
      out.push(pad() + t);
    } else {
      const name = (t.match(/^<([^\s>/]+)/) || [])[1] || '';
      if (type === 'html' && VOID.has(name.toLowerCase())) {
        out.push(pad() + t);
      } else if (tokens[i + 1] && !tokens[i + 1].startsWith('<') && tokens[i + 2] === `</${name}>`) {
        out.push(`${pad()}${t}${tokens[i + 1]}${tokens[i + 2]}`);
        i += 2;
      } else {
        out.push(pad() + t);
        depth += 1;
      }
    }
  }
  return out.join('\n');
}

export function formatCss(s) {
  const src = s.replace(/\/\*[\s\S]*?\*\//g, (c) => c);
  let out = '';
  let depth = 0;
  let quote = null;
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    buf = '';
    return t;
  };
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      buf += c;
      if (c === quote && src[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      buf += c;
    } else if (c === '{') {
      out += `${'  '.repeat(depth)}${flush().replace(/\s+/g, ' ')} {\n`;
      depth += 1;
    } else if (c === '}') {
      const t = flush();
      if (t) out += `${'  '.repeat(depth)}${t.replace(/\s*:\s*/, ': ')};\n`;
      depth -= 1;
      out += `${'  '.repeat(Math.max(depth, 0))}}\n${depth === 0 ? '\n' : ''}`;
    } else if (c === ';') {
      const t = flush();
      if (t) out += `${'  '.repeat(depth)}${t.replace(/\s*:\s*/, ': ')};\n`;
    } else {
      buf += c;
    }
  }
  const rest = flush();
  if (rest) out += rest;
  return out.trim();
}

const MAJOR = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN'];

export function formatSql(s) {
  let sql = s.replace(/\s+/g, ' ').trim();
  const kw = new RegExp(`\\b(${MAJOR.join('|').replace(/ /g, '\\s+')})\\b`, 'gi');
  const parts = [];
  let quote = null;
  let depth = 0;
  let cur = '';
  // tokenise by walking so keywords inside strings/parentheses are untouched
  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === '(') {
      depth += 1;
      cur += c;
    } else if (c === ')') {
      depth -= 1;
      cur += c;
    } else if (depth === 0 && c === ',') {
      cur += ',\n    ';
    } else {
      cur += c;
    }
    if (i === sql.length - 1) parts.push(cur);
  }
  sql = parts.join('');
  sql = sql.replace(kw, (m) => `\n${m.toUpperCase().replace(/\s+/g, ' ')}`);
  sql = sql.replace(/\s+\b(AND|OR)\b\s+/gi, (m, op) => `\n  ${op.toUpperCase()} `);
  return sql.trim().replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n');
}

export function format(src, type) {
  const t = type === 'auto' ? detectType(src) : type;
  let out;
  if (t === 'json') out = formatJson(src);
  else if (t === 'xml' || t === 'html') out = formatMarkup(src, t);
  else if (t === 'css') out = formatCss(src);
  else out = formatSql(src);
  return { out, type: t };
}
