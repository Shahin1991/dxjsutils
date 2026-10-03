export function tokenize(cmd) {
  const s = cmd.replace(/\\\r?\n/g, ' ');
  const tokens = [];
  let cur = '';
  let has = false;
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else cur += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) {
        i += 1;
        cur += s[i];
      } else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === '$' && s[i + 1] === "'") {
      quote = "'";
      has = true;
      i += 1;
    } else if (c === '\\' && i + 1 < s.length) {
      i += 1;
      cur += s[i];
      has = true;
    } else if (/\s/.test(c)) {
      if (has || cur) tokens.push(cur);
      cur = '';
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has || cur) tokens.push(cur);
  return tokens;
}

const DATA_FLAGS = ['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode'];
const NOARG = { '-L': 'Follow redirects', '--location': 'Follow redirects', '-k': 'Insecure (skip TLS verify)', '--insecure': 'Insecure (skip TLS verify)', '-s': 'Silent', '--silent': 'Silent', '-i': 'Include response headers', '--include': 'Include response headers', '-v': 'Verbose', '--verbose': 'Verbose', '--compressed': 'Compressed response', '-f': 'Fail on HTTP errors', '--fail': 'Fail on HTTP errors', '-S': 'Show errors', '-g': 'Disable URL globbing' };
const WITHARG = { '-o': 'Output file', '--output': 'Output file', '-e': 'Referer', '--referer': 'Referer', '-A': 'User-Agent', '--user-agent': 'User-Agent', '-b': 'Cookie', '--cookie': 'Cookie', '-x': 'Proxy', '--proxy': 'Proxy', '-m': 'Max time (s)', '--max-time': 'Max time (s)', '--connect-timeout': 'Connect timeout (s)', '--retry': 'Retries', '-w': 'Write-out' };

export function parseCurl(cmd) {
  const tokens = tokenize(cmd.trim());
  if (!tokens.length) throw new Error('Empty command');
  if (tokens[0] !== 'curl') throw new Error('Command must start with "curl"');
  const r = { method: null, url: '', headers: [], data: [], forms: [], auth: null, options: [] };
  for (let i = 1; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = () => tokens[++i];
    let flag = t;
    let inline = null;
    if (t.startsWith('--') && t.includes('=')) {
      flag = t.slice(0, t.indexOf('='));
      inline = t.slice(t.indexOf('=') + 1);
    } else if (/^-[XHduFAebmxow]./.test(t)) {
      flag = t.slice(0, 2);
      inline = t.slice(2);
    }
    const arg = () => (inline !== null ? inline : next());
    if (flag === '-X' || flag === '--request') r.method = (arg() || '').toUpperCase();
    else if (flag === '-H' || flag === '--header') {
      const h = arg() || '';
      const idx = h.indexOf(':');
      r.headers.push(idx < 0 ? { key: h, value: '' } : { key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim() });
    } else if (DATA_FLAGS.includes(flag)) r.data.push({ flag, value: arg() });
    else if (flag === '-F' || flag === '--form') r.forms.push(arg());
    else if (flag === '-u' || flag === '--user') r.auth = { type: 'basic', value: arg() };
    else if (flag === '-I' || flag === '--head') {
      r.method = 'HEAD';
    } else if (flag === '--url') r.url = arg();
    else if (flag in NOARG) r.options.push([flag, NOARG[flag], '']);
    else if (flag in WITHARG) r.options.push([flag, WITHARG[flag], arg()]);
    else if (!t.startsWith('-') && !r.url) r.url = t;
    else if (t.startsWith('-')) r.options.push([t, 'Other option', '']);
  }
  if (!r.method) r.method = r.data.length || r.forms.length ? 'POST' : 'GET';
  let query = [];
  let base = r.url;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(r.url) ? r.url : `http://${r.url}`);
    query = [...u.searchParams.entries()].map(([key, value]) => ({ key, value }));
    base = r.url.split('?')[0].split('#')[0];
    r.host = u.host;
    r.path = u.pathname;
  } catch (e) {
    // leave raw URL
  }
  const bearer = r.headers.find((h) => h.key.toLowerCase() === 'authorization');
  if (bearer && !r.auth) r.auth = { type: /^bearer/i.test(bearer.value) ? 'bearer' : 'header', value: bearer.value };
  return { ...r, baseUrl: base, query };
}
