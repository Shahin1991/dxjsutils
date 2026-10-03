import React, { useState } from 'react';

const KEY = 'usefulLinks';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch (e) {
    return [];
  }
}

function normalizeUrl(url) {
  const u = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : `https://${u}`;
}

export function UsefulLinks() {
  const [links, setLinks] = useState(load);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [editId, setEditId] = useState(null);

  const persist = (next) => {
    setLinks(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      // storage unavailable
    }
  };

  const reset = () => {
    setTitle('');
    setUrl('');
    setEditId(null);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    const entry = { id: editId || String(Date.now()), title: title.trim() || url.trim(), url: normalizeUrl(url) };
    persist(editId ? links.map((l) => (l.id === editId ? entry : l)) : [...links, entry]);
    reset();
  };

  const edit = (l) => {
    setEditId(l.id);
    setTitle(l.title);
    setUrl(l.url);
  };

  return (
    <div className="ul-container">
      <h2 className="ul-title">🔗 Useful Links</h2>
      <p className="ul-desc">Your bookmarked URLs, stored locally in this browser.</p>
      <form className="ul-panel ul-row" onSubmit={submit}>
        <input className="ul-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="ul-input ul-url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className="ul-btn">{editId ? 'Save' : 'Add'}</button>
        {editId && <button type="button" className="ul-btn secondary" onClick={reset}>Cancel</button>}
      </form>
      <div className="ul-panel">
        {links.length === 0 && <p className="ul-muted">No links yet. Add one above.</p>}
        {links.map((l) => (
          <div key={l.id} className="ul-item">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="ul-link">
              <strong>{l.title}</strong>
              <span className="ul-muted"> {l.url}</span>
            </a>
            <button type="button" className="ul-btn secondary" onClick={() => edit(l)}>Edit</button>
            <button type="button" className="ul-btn secondary" onClick={() => persist(links.filter((x) => x.id !== l.id))}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
