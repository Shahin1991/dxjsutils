import React, { useMemo, useState } from 'react';
import { CATEGORIES, UTILITIES } from '../config/utilities';
import { searchUtilities } from '../utils/searchUtilities';

export function LeftNav({
  view,
  currentUtilityId,
  onSelect,
  onHome,
  onHelp,
  open,
  onClose,
  favorites,
  recents,
  onToggleFavorite,
}) {
  const isElectron = Boolean(window.electron?.isElectron);
  const [query, setQuery] = useState('');
  const [collapsedCats, setCollapsedCats] = useState({});

  const searching = query.trim().length > 0;
  const byId = useMemo(() => Object.fromEntries(UTILITIES.map((u) => [u.id, u])), []);
  const favs = favorites.map((id) => byId[id]).filter(Boolean);
  const recent = recents.map((id) => byId[id]).filter((u) => u && !favorites.includes(u.id)).slice(0, 4);
  const matches = useMemo(() => searchUtilities(query), [query]);

  const renderItem = (u) => {
    const unavailable = u.electronOnly && !isElectron;
    const isFav = favorites.includes(u.id);
    return (
      <div key={u.id} className="nav-row">
        <button
          type="button"
          className={`nav-item ${view === 'utility' && currentUtilityId === u.id ? 'active' : ''}`}
          onClick={() => onSelect(u.id)}
          disabled={unavailable}
          title={unavailable ? 'Available in the desktop app only' : u.description}
        >
          <span className="nav-icon">{u.icon}</span>
          <span className="nav-label">{u.name}</span>
          {unavailable && <span className="nav-badge">Desktop</span>}
        </button>
        <button
          type="button"
          className={`nav-star ${isFav ? 'on' : ''}`}
          onClick={() => onToggleFavorite(u.id)}
          aria-label={isFav ? `Remove ${u.name} from favorites` : `Add ${u.name} to favorites`}
          aria-pressed={isFav}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>
    );
  };

  return (
    <>
      {open && <div className="nav-overlay" onClick={onClose} />}
      <nav className={`left-nav ${open ? 'open' : 'collapsed'}`} aria-label="Utilities">
        <button type="button" className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={onHome}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button type="button" className={`nav-item ${view === 'help' ? 'active' : ''}`} onClick={onHelp}>
          <span className="nav-icon">❓</span>
          <span className="nav-label">Help</span>
        </button>
        <input
          className="nav-search"
          type="search"
          placeholder="Filter tools…"
          aria-label="Filter tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {searching ? (
          <>
            <div className="nav-section-label">RESULTS</div>
            {matches.length === 0 && <div className="nav-empty">No tools match.</div>}
            {matches.map(renderItem)}
          </>
        ) : (
          <>
            {favs.length > 0 && (
              <>
                <div className="nav-section-label">FAVORITES</div>
                {favs.map(renderItem)}
              </>
            )}
            {recent.length > 0 && (
              <>
                <div className="nav-section-label">RECENT</div>
                {recent.map(renderItem)}
              </>
            )}
            {CATEGORIES.map((cat) => {
              const items = UTILITIES.filter((u) => u.category === cat);
              const isCollapsed = collapsedCats[cat];
              return (
                <div key={cat}>
                  <button
                    type="button"
                    className="nav-section-toggle"
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsedCats((c) => ({ ...c, [cat]: !c[cat] }))}
                  >
                    <span>{isCollapsed ? '▸' : '▾'}</span> {cat.toUpperCase()}
                    <span className="nav-count">{items.length}</span>
                  </button>
                  {!isCollapsed && items.map(renderItem)}
                </div>
              );
            })}
          </>
        )}
      </nav>
    </>
  );
}

export default LeftNav;
