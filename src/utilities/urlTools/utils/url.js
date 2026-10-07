export const encodeComponent = (s) => encodeURIComponent(s);
export const encodeFull = (s) => encodeURI(s);

export function decode(s) {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch (e) {
    throw new Error('Input contains an invalid percent-encoded sequence');
  }
}

export function parseUrl(input) {
  const text = input.trim();
  if (!text) return null;
  let u;
  try {
    u = new URL(text);
  } catch (e) {
    // Allow "example.com/path" but not a malformed URL that already has a scheme.
    if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/]+:\d+(\/|$)/.test(text)) throw new Error('Not a valid URL');
    try {
      u = new URL(`https://${text}`);
    } catch (err) {
      throw new Error('Not a valid URL');
    }
  }
  return {
    parts: {
      Protocol: u.protocol,
      Username: u.username,
      Password: u.password,
      Host: u.hostname,
      Port: u.port,
      Path: u.pathname,
      Query: u.search,
      Fragment: u.hash,
      Origin: u.origin,
    },
    params: [...u.searchParams.entries()],
  };
}
