import { UTILITIES } from '../config/utilities';

// Returns utilities whose name/description/category match every word in the query.
// Name matches are ranked ahead of description-only matches.
export function searchUtilities(query, { isElectron = true, list = UTILITIES } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const available = list.filter((u) => isElectron || !u.electronOnly);
  if (words.length === 0) return available;
  return available
    .map((u) => {
      const name = u.name.toLowerCase();
      const rest = `${u.description} ${u.category}`.toLowerCase();
      const all = words.every((w) => name.includes(w) || rest.includes(w));
      const score = words.every((w) => name.includes(w)) ? 0 : 1;
      return all ? { u, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.u);
}
