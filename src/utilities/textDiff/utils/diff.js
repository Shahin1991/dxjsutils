// Line-based diff using the longest common subsequence.
// Returns rows of { type: 'same' | 'add' | 'del', text, left?, right? } with 1-based line numbers.
export function diffLines(a, b, { ignoreCase = false, ignoreWhitespace = false } = {}) {
  const left = a === '' ? [] : a.split(/\r?\n/);
  const right = b === '' ? [] : b.split(/\r?\n/);
  const norm = (s) => {
    let t = s;
    if (ignoreWhitespace) t = t.replace(/\s+/g, ' ').trim();
    if (ignoreCase) t = t.toLowerCase();
    return t;
  };
  const l = left.map(norm);
  const r = right.map(norm);
  const n = l.length;
  const m = r.length;

  // lcs[i][j] = LCS length of l[i..] and r[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = l[i] === r[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (l[i] === r[j]) {
      rows.push({ type: 'same', text: right[j], left: i + 1, right: j + 1 });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: 'del', text: left[i], left: i + 1 });
      i += 1;
    } else {
      rows.push({ type: 'add', text: right[j], right: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ type: 'del', text: left[i], left: i + 1 });
    i += 1;
  }
  while (j < m) {
    rows.push({ type: 'add', text: right[j], right: j + 1 });
    j += 1;
  }
  return rows;
}

export function summarize(rows) {
  return rows.reduce(
    (acc, r) => ({ ...acc, [r.type]: acc[r.type] + 1 }),
    { same: 0, add: 0, del: 0 }
  );
}
