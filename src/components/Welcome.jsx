import React, { useMemo, useState } from 'react';
import { AVAILABLE_UTILITIES, CATEGORIES } from '../config/utilities';
import { searchUtilities } from '../utils/searchUtilities';

const ALL = 'All tools';

function SignArrow({ dir }) {
  return (
    <svg className="sign-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M20 12H5M11 5l-7 7 7 7' : 'M4 12h15M13 5l7 7-7 7'} />
    </svg>
  );
}

export function Welcome({ onSelect, favorites = [] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);

  // Same matching rules as the sidebar filter and command palette.
  const matches = useMemo(() => searchUtilities(query), [query]);
  const grouped = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        category: cat,
        items: matches.filter((u) => u.category === cat && (category === ALL || category === cat)),
      })).filter((g) => g.items.length > 0),
    [matches, category]
  );
  const favs = favorites.map((id) => AVAILABLE_UTILITIES.find((u) => u.id === id)).filter(Boolean);
  const first = grouped[0]?.items[0];
  const searching = query.trim().length > 0;

  // Like an airfield sign array: the current category is the location sign,
  // the others are direction signs pointing the way they sit along the row.
  const signs = [ALL, ...CATEGORIES.filter((c) => AVAILABLE_UTILITIES.some((u) => u.category === c))];
  const here = signs.indexOf(category);

  return (
    <div className="welcome">
      <header className="welcome-hero">
        <h1 className="welcome-title">{AVAILABLE_UTILITIES.length} tools, all running on this device</h1>
        <p className="welcome-sub">
          Text, tokens, files and passwords you work with here are processed locally and never uploaded. No sign-up, no
          tracking, no ads.
        </p>
        <input
          className="welcome-search"
          type="search"
          placeholder="Find a tool, e.g. jwt, timestamp, pdf"
          aria-label="Search utilities"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && first && onSelect(first.id)}
        />
        <div className="sign-array" role="group" aria-label="Filter by category">
          {signs.map((c, i) => {
            const isHere = i === here;
            const dir = i < here ? 'left' : 'right';
            return (
              <button
                key={c}
                type="button"
                className={`sign ${isHere ? 'sign-location' : 'sign-direction'}`}
                aria-pressed={isHere}
                onClick={() => setCategory(c)}
              >
                {!isHere && dir === 'left' && <SignArrow dir="left" />}
                <span>{c}</span>
                {!isHere && dir === 'right' && <SignArrow dir="right" />}
              </button>
            );
          })}
        </div>
      </header>

      {favs.length > 0 && !searching && (
        <section className="welcome-favs" aria-label="Your favorites">
          <h2>Favorites</h2>
          <div className="welcome-fav-list">
            {favs.map((u) => (
              <button key={u.id} type="button" className="fav-link" onClick={() => onSelect(u.id)}>
                <span aria-hidden="true">{u.icon}</span> {u.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {grouped.length === 0 && (
        <p className="welcome-empty">
          No tools match “{query.trim()}”. Try a shorter word{category !== ALL ? `, or switch to ${ALL}` : ''}.
        </p>
      )}
      {grouped.map((g) => (
        <section key={g.category} className="welcome-group">
          <h2>
            {g.category} <span className="welcome-count">{g.items.length}</span>
          </h2>
          <div className="welcome-grid">
            {g.items.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`utility-card ${searching && u === first ? 'is-first' : ''}`}
                onClick={() => onSelect(u.id)}
              >
                <span className="card-icon" aria-hidden="true">
                  {u.icon}
                </span>
                <span className="card-text">
                  <span className="card-name">{u.name}</span>
                  <span className="card-desc">{u.description}</span>
                </span>
                {searching && u === first && (
                  <kbd className="card-enter" title="Press Enter to open">
                    Enter
                  </kbd>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default Welcome;
