const pad = (n, w = 2) => String(n).padStart(w, '0');

// 3723456 -> "01:02:03.45" (hours shown only when needed unless forceHours)
export function formatDuration(ms, { centis = true, forceHours = false } = {}) {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const main = `${h || forceHours ? `${pad(h)}:` : ''}${pad(m)}:${pad(s)}`;
  return centis ? `${main}.${pad(cs)}` : main;
}

// "1:30" -> 90000, "1:02:03" -> 3723000, "45" -> 45 minutes
export function parseDuration(text) {
  const t = String(text).trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(':').map(Number);
  if (parts.length === 1) return parts[0] * 60000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
}
