export function textStats(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const sentences = (trimmed.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || []).filter((s) => s.trim()).length;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  return {
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(/\s/g, '')].length,
    words,
    sentences,
    paragraphs,
    lines: text === '' ? 0 : text.split(/\r?\n/).length,
    readingMinutes: words / 200, // ~200 wpm silent reading
    speakingMinutes: words / 130,
  };
}

export function formatMinutes(m) {
  if (m === 0) return '0 sec';
  if (m < 1) return `${Math.max(1, Math.round(m * 60))} sec`;
  return `${Math.round(m * 10) / 10} min`;
}

const WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in ' +
  'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in ' +
  'culpa qui officia deserunt mollit anim id est laborum').split(' ');

// Deterministic output (no randomness) so the same request always gives the same text.
export function lorem(kind, count, startWithLorem = true) {
  const wordAt = (i) => WORDS[i % WORDS.length];
  let cursor = startWithLorem ? 0 : 7;
  const sentence = (len) => {
    const w = Array.from({ length: len }, () => {
      const x = wordAt(cursor);
      cursor += 1;
      return x;
    });
    return `${w[0][0].toUpperCase()}${w[0].slice(1)} ${w.slice(1).join(' ')}.`.replace(' .', '.');
  };
  const para = () => Array.from({ length: 5 }, (_, i) => sentence(8 + ((i * 3) % 7))).join(' ');
  if (kind === 'words') {
    return Array.from({ length: count }, (_, i) => wordAt((startWithLorem ? 0 : 7) + i)).join(' ');
  }
  if (kind === 'sentences') return Array.from({ length: count }, (_, i) => sentence(8 + ((i * 3) % 7))).join(' ');
  return Array.from({ length: count }, para).join('\n\n');
}
