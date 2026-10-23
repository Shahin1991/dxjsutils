import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchUtilities } from '../utils/searchUtilities';
import { useFocusTrap } from '../utils/useFocusTrap';

export function CommandPalette({ onSelect, onClose, favorites = [], recents = [] }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);

  const results = useMemo(() => {
    const all = searchUtilities(query);
    if (query.trim()) return all.slice(0, 12);
    // No query yet: lead with the tools the user actually uses.
    const pinned = [...favorites, ...recents];
    const rank = (u) => (pinned.includes(u.id) ? pinned.indexOf(u.id) : pinned.length);
    return [...all].sort((a, b) => rank(a) - rank(b)).slice(0, 12);
  }, [query, favorites, recents]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[index]) {
      onSelect(results[index].id);
    }
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Jump to a tool…"
          aria-label="Search tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[index] ? `palette-${results[index].id}` : undefined}
        />
        <ul className="palette-list" role="listbox" id="palette-list" ref={listRef}>
          {results.length === 0 && <li className="palette-empty">No tools match “{query}”.</li>}
          {results.map((u, i) => (
            <li
              key={u.id}
              id={`palette-${u.id}`}
              role="option"
              aria-selected={i === index}
              className={`palette-item ${i === index ? 'active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(u.id)}
            >
              <span className="nav-icon">{u.icon}</span>
              <span className="palette-name">{u.name}</span>
              <span className="palette-cat">{favorites.includes(u.id) ? '★ ' : ''}{u.category}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette;
