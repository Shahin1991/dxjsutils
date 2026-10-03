import React from 'react';
import { UTILITIES } from '../config/utilities';

export function LeftNav({ currentUtilityId, onSelect, onHome, open, onClose }) {
  const isElectron = Boolean(window.electron?.isElectron);
  const visible = UTILITIES.filter((u) => isElectron || !u.electronOnly);

  return (
    <>
      {open && <div className="nav-overlay" onClick={onClose} />}
      <nav className={`left-nav ${open ? 'open' : 'collapsed'}`} aria-label="Utilities">
        <button
          type="button"
          className={`nav-item ${currentUtilityId === null ? 'active' : ''}`}
          onClick={onHome}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <div className="nav-section-label">UTILITIES</div>
        {visible.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`nav-item ${currentUtilityId === u.id ? 'active' : ''}`}
            onClick={() => onSelect(u.id)}
          >
            <span className="nav-icon">{u.icon}</span>
            <span className="nav-label">{u.name}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export default LeftNav;
