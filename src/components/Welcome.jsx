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
      <h1>Welcome to dxjsutils</h1>
      <p className="welcome-sub">A toolbox of offline-capable utilities for everyday work.</p>
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
