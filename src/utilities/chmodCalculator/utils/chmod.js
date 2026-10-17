export const WHO = [['owner', 'Owner (u)'], ['group', 'Group (g)'], ['others', 'Others (o)']];
export const PERMS = [['r', 'Read', 4], ['w', 'Write', 2], ['x', 'Execute', 1]];

// perms: { owner: {r,w,x}, group: {...}, others: {...} }, special: { setuid, setgid, sticky }
export function toOctal(perms, special = {}) {
  const digits = WHO.map(([w]) => PERMS.reduce((n, [p, , bit]) => n + (perms[w][p] ? bit : 0), 0)).join('');
  const s = (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0);
  return s ? `${s}${digits}` : digits;
}

export function toSymbolic(perms, special = {}) {
  const marks = [['setuid', 's'], ['setgid', 's'], ['sticky', 't']];
  return WHO.map(([w], i) => {
    const [flag, ch] = marks[i];
    const r = perms[w].r ? 'r' : '-';
    const wr = perms[w].w ? 'w' : '-';
    let x = perms[w].x ? 'x' : '-';
    if (special[flag]) x = perms[w].x ? ch : ch.toUpperCase();
    return r + wr + x;
  }).join('');
}

export function fromOctal(text) {
  const t = String(text).trim();
  if (!/^[0-7]{3,4}$/.test(t)) throw new Error('Enter 3 or 4 octal digits, e.g. 755 or 2775');
  const d = t.padStart(4, '0').split('').map(Number);
  const perms = {};
  WHO.forEach(([w], i) => {
    perms[w] = { r: Boolean(d[i + 1] & 4), w: Boolean(d[i + 1] & 2), x: Boolean(d[i + 1] & 1) };
  });
  return { perms, special: { setuid: Boolean(d[0] & 4), setgid: Boolean(d[0] & 2), sticky: Boolean(d[0] & 1) } };
}

export function fromSymbolic(text) {
  const t = String(text).trim().replace(/^[-dlbcps]?(?=[-r][-w][-xsStT][-r][-w][-xsStT][-r][-w][-xtT]$)/, '');
  if (!/^[-r][-w][-xsS][-r][-w][-xsS][-r][-w][-xtT]$/.test(t)) throw new Error('Enter 9 characters like rwxr-xr-x (an ls -l prefix such as d is fine)');
  const perms = {};
  WHO.forEach(([w], i) => {
    const c = t.slice(i * 3, i * 3 + 3);
    perms[w] = { r: c[0] === 'r', w: c[1] === 'w', x: /[xst]/.test(c[2]) };
  });
  return { perms, special: { setuid: /[sS]/.test(t[2]), setgid: /[sS]/.test(t[5]), sticky: /[tT]/.test(t[8]) } };
}
