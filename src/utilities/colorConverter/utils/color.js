const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export const rgbToHex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function rgbToHsl({ r, g, b }) {
  const [rr, gg, bb] = [r, g, b].map((v) => v / 255);
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
    else if (max === gg) h = ((bb - rr) / d + 2) * 60;
    else h = ((rr - gg) / d + 4) * 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToRgb(h, s, l) {
  const ss = s / 100;
  const ll = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsv({ r, g, b }) {
  const [rr, gg, bb] = [r, g, b].map((v) => v / 255);
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
    else if (max === gg) h = ((bb - rr) / d + 2) * 60;
    else h = ((rr - gg) / d + 4) * 60;
  }
  return [Math.round(h), Math.round(max ? (d / max) * 100 : 0), Math.round(max * 100)];
}

export function hsvToRgb(h, s, v) {
  const ss = s / 100;
  const vv = v / 100;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return vv - vv * ss * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}

export function fmt(rgb) {
  const [h, s, l] = rgbToHsl(rgb);
  const [hh, ss, vv] = rgbToHsv(rgb);
  return {
    hex: rgbToHex(rgb),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsv: `hsv(${hh}, ${ss}%, ${vv}%)`,
  };
}

// Parse "fn(a, b, c)" or "a b c" into numbers, validating against maximums.
export function parseFn(text, name, max) {
  const m = text.match(new RegExp(`^\\s*(?:${name}a?\\()?\\s*([\\d.]+)[\\s,]+([\\d.]+)%?[\\s,]+([\\d.]+)%?\\s*\\)?\\s*$`, 'i'));
  if (!m) return null;
  const n = [m[1], m[2], m[3]].map(Number);
  if (n.some((v, i) => isNaN(v) || v < 0 || v > max[i])) return null;
  return n.map((v, i) => clamp(v, 0, max[i]));
}

function lum({ r, g, b }) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
