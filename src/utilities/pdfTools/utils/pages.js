// Parse "1-3, 5, 8-" style page lists into 0-based indexes (order kept, duplicates allowed).
export function parsePageRanges(text, pageCount) {
  const t = String(text).trim();
  if (!t) throw new Error('Enter the pages, e.g. 1-3, 5');
  const out = [];
  t.split(/[,\s]+/).filter(Boolean).forEach((part) => {
    const m = part.match(/^(\d+)?(-)?(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" is not a page or range`);
    const start = m[1] ? Number(m[1]) : 1;
    const end = m[2] ? (m[3] ? Number(m[3]) : pageCount) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) throw new Error(`Page ${start > pageCount || start < 1 ? start : end} is outside 1–${pageCount}`);
    const step = start <= end ? 1 : -1;
    for (let p = start; p !== end + step; p += step) out.push(p - 1);
  });
  return out;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}
