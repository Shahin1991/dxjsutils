import React, { useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { downloadFile } from '../../utils/clipboard';

const SAMPLE = '# Hello Markdown\n\nWrite **bold**, *italic* and `code`.\n\n- item one\n- item two\n\n[Link](https://example.com)\n';

// [label, before, after, placeholder, linePrefix?]
const TOOLS = [
  ['B', '**', '**', 'bold'],
  ['I', '*', '*', 'italic'],
  ['H', '## ', '', 'Heading', true],
  ['• List', '- ', '', 'item', true],
  ['🔗', '[', '](https://)', 'link text'],
  ['</>', '`', '`', 'code'],
];

function sanitize(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
}

export function MarkdownEditor() {
  const [text, setText] = useState(SAMPLE);
  const ref = useRef(null);

  const html = useMemo(() => sanitize(marked.parse(text, { breaks: true })), [text]);

  const apply = ([, before, after, placeholder, line]) => {
    const el = ref.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end) || placeholder;
    let insert = before + selected + after;
    let from = start;
    if (line && start > 0 && text[start - 1] !== '\n') {
      insert = '\n' + insert;
      from = start + 1;
    }
    const next = text.slice(0, start) + insert + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const s = from + before.length;
      el.setSelectionRange(s, s + selected.length);
    });
  };

  return (
    <div className="md-container">
      <h2 className="md-title">📝 Markdown Editor</h2>
      <div className="md-row">
        {TOOLS.map((t) => (
          <button key={t[0]} type="button" className="md-btn secondary" onClick={() => apply(t)}>{t[0]}</button>
        ))}
        <button type="button" className="md-btn" onClick={() => downloadFile('document.md', text, 'text/markdown')}>Export .md</button>
      </div>
      <div className="md-split">
        <textarea ref={ref} className="md-textarea md-editor" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
