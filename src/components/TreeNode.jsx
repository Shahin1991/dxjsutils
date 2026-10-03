import React, { useEffect, useState } from 'react';

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// signal: { mode: 'expand' | 'collapse', n: number } - bump n to apply to every node
export function TreeNode({ name, value, depth = 0, signal }) {
  const type = typeOf(value);
  const isContainer = type === 'object' || type === 'array';
  const [open, setOpen] = useState(depth < 1);

  useEffect(() => {
    if (signal && signal.n > 0) setOpen(signal.mode === 'expand');
  }, [signal]);

  if (!isContainer) {
    return (
      <div className="tn-row">
        <span className="tn-spacer" />
        {name !== undefined && <span className="tn-key">{name}: </span>}
        <span className={`tn-val tn-${type}`}>{type === 'string' ? JSON.stringify(value) : String(value)}</span>
      </div>
    );
  }

  const entries = type === 'array' ? value.map((v, i) => [i, v]) : Object.entries(value);
  const bracket = type === 'array' ? ['[', ']'] : ['{', '}'];

  return (
    <div className="tn-node">
      <div className="tn-row tn-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="tn-arrow">{open ? '▼' : '▶'}</span>
        {name !== undefined && <span className="tn-key">{name}: </span>}
        <span className="tn-bracket">{bracket[0]}</span>
        {!open && (
          <span className="tn-summary">
            {' '}
            {entries.length} {type === 'array' ? 'items' : 'keys'}{' '}
          </span>
        )}
        {!open && <span className="tn-bracket">{bracket[1]}</span>}
      </div>
      {open && (
        <div className="tn-children">
          {entries.map(([k, v]) => (
            <TreeNode key={k} name={k} value={v} depth={depth + 1} signal={signal} />
          ))}
          <div className="tn-row">
            <span className="tn-spacer" />
            <span className="tn-bracket">{bracket[1]}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreeNode;
