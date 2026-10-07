import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchUtilities } from '../utils/searchUtilities';

export function CommandPalette({ onSelect, onClose, isElectron }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(
    () => searchUtilities(query, { isElectron }).slice(0, 12),
    [query, isElectron]
  );

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setIndex(0), [query]);

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
      <div className="palette" role="dialog" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Jump to a tool…"
          aria-label="Search tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="palette-list" role="listbox">
          {results.length === 0 && <li className="palette-empty">No tools match “{query}”.</li>}
          {results.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={i === index}
              className={`palette-item ${i === index ? 'active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(u.id)}
            >
              <span className="nav-icon">{u.icon}</span>
              <span className="palette-name">{u.name}</span>
              <span className="palette-cat">{u.category}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette;
