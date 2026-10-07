import React, { useMemo, useState } from 'react';
import { UTILITIES, CATEGORIES } from '../config/utilities';

export function Welcome({ onSelect }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const isElectron = Boolean(window.electron?.isElectron);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((cat) => ({
      category: cat,
      items: UTILITIES.filter(
        (u) =>
          (isElectron || !u.electronOnly) &&
          u.category === cat &&
          (category === 'All' || category === cat) &&
          (!q || u.name.toLowerCase().includes(q) || u.description.toLowerCase().includes(q))
      ),
    })).filter((g) => g.items.length > 0);
  }, [query, category, isElectron]);

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
        placeholder="Search utilities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="welcome-chips">
        {['All', ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? 'active' : ''}`}
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
