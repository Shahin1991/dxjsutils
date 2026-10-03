const indentOf = (l) => l.match(/^\s*/)[0].length;
const isComment = (l) => l.trim().startsWith('#');
const isBlank = (l) => !l.trim();

// Split lines into blocks; a block starts at a line where isStart is true and includes the
// comment lines directly above it plus everything until the next block start.
function splitBlocks(lines, isStart) {
  const blocks = [];
  let pending = [];
  let current = null;
  lines.forEach((line) => {
    if (isStart(line)) {
      current = { lines: [...pending, line], first: line };
      pending = [];
      blocks.push(current);
    } else if (isComment(line)) {
      // comments belong to the next block unless indented deeper (inside the current block)
      if (current && indentOf(line) > indentOf(current.first)) current.lines.push(line);
      else pending.push(line);
    } else if (isBlank(line)) {
      if (current) current.lines.push(line);
      else pending.push(line);
    } else if (current) {
      current.lines.push(...pending, line);
      pending = [];
    } else {
      pending.push(line);
    }
  });
  return { blocks, trailing: pending, leading: blocks.length ? [] : pending };
}

function entryKey(first) {
  let body = first.trim().replace(/^-\s*/, '');
  const named = body.match(/^name\s*:\s*(.+)$/);
  if (named) return named[1].replace(/^["']|["']$/g, '').trim().toLowerCase();
  const m = body.match(/^([^=:]+?)\s*[=:]/);
  return (m ? m[1] : body).replace(/^["']|["']$/g, '').trim().toLowerCase();
}

function sortBlocks(lines, isStart, keyFn) {
  const { blocks, trailing, leading } = splitBlocks(lines, isStart);
  if (!blocks.length) return lines;
  // move trailing blank lines of each block (but not the last) so they don't travel with the key
  const sorted = [...blocks].sort((a, b) => keyFn(a.first).localeCompare(keyFn(b.first)));
  return [...leading, ...sorted.flatMap((b) => b.lines), ...trailing];
}

export function sortEnvSections(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)(env|environment)\s*:\s*$/i);
    out.push(lines[i]);
    i += 1;
    if (!m) continue;
    const base = m[1].length;
    const body = [];
    while (i < lines.length && (isBlank(lines[i]) || isComment(lines[i]) || indentOf(lines[i]) > base || (indentOf(lines[i]) === base && /^\s*-\s/.test(lines[i])))) {
      body.push(lines[i]);
      i += 1;
    }
    // drop trailing blank lines from the section body so they stay after it
    const tail = [];
    while (body.length && isBlank(body[body.length - 1])) tail.unshift(body.pop());
    const first = body.find((l) => !isBlank(l) && !isComment(l));
    if (first) {
      const entryIndent = indentOf(first);
      const isStart = (l) => !isBlank(l) && !isComment(l) && indentOf(l) === entryIndent && (/^\s*-\s/.test(first) ? /^\s*-\s/.test(l) : true);
      out.push(...sortBlocks(body, isStart, entryKey));
    } else {
      out.push(...body);
    }
    out.push(...tail);
  }
  return out.join('\n');
}

export function sortTopLevel(text) {
  const lines = text.split(/\r?\n/);
  const isStart = (l) => /^[^\s#-][^:]*:/.test(l);
  const keyFn = (l) => l.split(':')[0].trim().toLowerCase();
  return sortBlocks(lines, isStart, keyFn).join('\n');
}
