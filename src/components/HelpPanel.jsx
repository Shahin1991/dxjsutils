import React, { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, UTILITIES } from '../config/utilities';
import { GENERAL_HELP, HELP } from '../config/help';

function HelpBody({ utility }) {
  const help = HELP[utility.id];
  if (!help) return <p>No help is available for this tool yet.</p>;
  return (
    <div className="help-body">
      <p className="help-summary">{help.summary}</p>
      {utility.electronOnly && <p className="help-note">🖥️ Available in the desktop app only.</p>}
      <h4>How to use</h4>
      <ol>
        {help.howTo.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <dl className="help-io">
        <dt>Input</dt>
        <dd>{help.inputs}</dd>
        <dt>Output</dt>
        <dd>{help.outputs}</dd>
      </dl>
      {help.example && (
        <>
          <h4>Example</h4>
          <pre className="help-example">{help.example}</pre>
        </>
      )}
      {help.tips && help.tips.length > 0 && (
        <>
          <h4>Tips</h4>
          <ul>
            {help.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Slide-over drawer with help for the tool currently in use.
export function HelpDrawer({ utility, onClose, onOpenCenter }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="help-backdrop" onClick={onClose} />
      <aside className="help-drawer" role="dialog" aria-label={`Help: ${utility.name}`}>
        <header className="help-drawer-header">
          <h3>
            {utility.icon} {utility.name}
          </h3>
          <button type="button" className="help-close" onClick={onClose} aria-label="Close help">
            ✕
          </button>
        </header>
        <HelpBody utility={utility} />
        <button type="button" className="help-link" onClick={onOpenCenter}>
          Browse all help →
        </button>
      </aside>
    </>
  );
}

// Full help center: getting started, shortcuts and an entry per utility.
export function HelpCenter({ onSelect, initialId }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(initialId || null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((category) => ({
      category,
      items: UTILITIES.filter((u) => {
        if (u.category !== category) return false;
        if (!q) return true;
        const h = HELP[u.id];
        const hay = `${u.name} ${u.description} ${h ? `${h.summary} ${h.howTo.join(' ')}` : ''}`.toLowerCase();
        return hay.includes(q);
      }),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="help-center">
      <h1>Help</h1>
      <section className="help-intro">
        <h2>Getting started</h2>
        <ul>
          {GENERAL_HELP.gettingStarted.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h2>Keyboard shortcuts</h2>
        <table className="help-shortcuts">
          <tbody>
            {GENERAL_HELP.shortcuts.map(([keys, what]) => (
              <tr key={keys}>
                <td>
                  <kbd>{keys}</kbd>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <h2>Tools</h2>
      <input
        className="welcome-search"
        type="search"
        placeholder="Search help…"
        aria-label="Search help"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 && <p className="welcome-empty">No help topics match your search.</p>}
      {groups.map((g) => (
        <section key={g.category} className="welcome-group">
          <h2>{g.category}</h2>
          {g.items.map((u) => {
            const open = openId === u.id || Boolean(query.trim());
            return (
              <div key={u.id} className={`help-item ${open ? 'open' : ''}`}>
                <button
                  type="button"
                  className="help-item-head"
                  aria-expanded={open}
                  onClick={() => setOpenId(openId === u.id ? null : u.id)}
                >
                  <span>
                    {u.icon} {u.name}
                  </span>
                  <span className="help-item-desc">{u.description}</span>
                </button>
                {open && (
                  <div className="help-item-body">
                    <HelpBody utility={u} />
                    <button type="button" className="help-link" onClick={() => onSelect(u.id)}>
                      Open {u.name} →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
