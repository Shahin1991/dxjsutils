import React, { useMemo, useState } from 'react';
import { AVAILABLE_UTILITIES, CATEGORIES } from '../config/utilities';
import { searchUtilities } from '../utils/searchUtilities';

export function Welcome({ onSelect, favorites = [] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  // Same matching rules as the sidebar filter and command palette.
  const matches = useMemo(() => searchUtilities(query), [query]);
  const grouped = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        category: cat,
        items: matches.filter((u) => u.category === cat && (category === 'All' || category === cat)),
      })).filter((g) => g.items.length > 0),
    [matches, category]
  );
  const favs = favorites.map((id) => AVAILABLE_UTILITIES.find((u) => u.id === id)).filter(Boolean);
  const first = grouped[0]?.items[0];

  return (
    <div className="welcome">
      <h1 className="welcome-title">
        <img src={`${process.env.PUBLIC_URL}/logo.svg`} alt="" className="welcome-logo" />
        Welcome to dxjsutils
      </h1>
      <p className="welcome-sub">A toolbox of offline-capable utilities for everyday work.</p>
      <aside className="privacy-note" aria-label="Privacy">
        <span className="privacy-icon" aria-hidden="true">🔒</span>
        <div>
          <strong>Your data never leaves your browser.</strong> Every tool here runs entirely on your device, so the
          text, tokens, files and passwords you work with are never uploaded, stored on a server or shared. No sign-up,
          no tracking, no ads. In an era when personal data is bought and sold, that makes this a safe place to paste
          things you would never put into a random website.
        </div>
      </aside>
      <input
        className="welcome-search"
        type="search"
        placeholder="Search utilities… (Enter opens the first match)"
        aria-label="Search utilities"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && first && onSelect(first.id)}
      />
      {favs.length > 0 && !query.trim() && (
        <div className="welcome-chips" aria-label="Your favorites">
          {favs.map((u) => (
            <button key={u.id} type="button" className="chip" onClick={() => onSelect(u.id)}>
              ★ {u.icon} {u.name}
            </button>
          ))}
        </div>
      )}
      <div className="welcome-chips">
        {['All', ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? 'active' : ''}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {grouped.length === 0 && <p className="welcome-empty">No utilities match your search.</p>}
      {grouped.map((g) => (
        <section key={g.category} className="welcome-group">
          <h2>{g.category}</h2>
          <div className="welcome-grid">
            {g.items.map((u) => (
              <button key={u.id} type="button" className="utility-card" onClick={() => onSelect(u.id)}>
                <span className="card-icon">{u.icon}</span>
                <span className="card-name">{u.name}</span>
                <span className="card-desc">{u.description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default Welcome;
