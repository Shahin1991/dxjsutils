import React, { useMemo, useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { CALCULATORS, defaultValues, formatValue, runCalculator } from './utils/calculators';

export function FinanceCalculator() {
  const [id, setId] = useState(CALCULATORS[0].id);
  const [all, setAll] = useState(() => Object.fromEntries(CALCULATORS.map((c) => [c.id, defaultValues(c)])));
  const [showAll, setShowAll] = useState(false);

  const calc = CALCULATORS.find((c) => c.id === id);
  const values = all[id];
  const result = useMemo(() => runCalculator(calc, values), [calc, values]);
  const setField = (key, v) => setAll((a) => ({ ...a, [id]: { ...a[id], [key]: v } }));

  const summary = result.rows ? result.rows.map((r) => `${r.label}: ${formatValue(r.value, r.unit)}`).join('\n') : '';
  const table = result.table;
  const tableRows = table ? (showAll ? table.rows : table.rows.slice(0, 12)) : [];

  return (
    <div className="tl-container">
      <h2 className="tl-title">💰 Finance Calculator</h2>
      <p className="tl-desc">Loans, investments and returns. Powered by finance.js and calculated on your device.</p>

      <div className="tl-row fc-tabs" role="tablist" aria-label="Calculators">
        {CALCULATORS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === id}
            className={`tl-btn ${c.id === id ? '' : 'secondary'}`} onClick={() => { setId(c.id); setShowAll(false); }}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="tl-panel">
        <p className="tl-muted" style={{ marginTop: 0 }}>{calc.description}</p>
        <div className="fc-form">
          {calc.fields.map((f) => {
            const fid = `fc-${id}-${f.key}`;
            return (
              <div key={f.key} className={f.kind === 'dated' || f.kind === 'list' ? 'fc-wide' : ''}>
                <label className="tl-label" htmlFor={fid}>{f.label}</label>
                {f.kind === 'select' ? (
                  <select id={fid} value={values[f.key]} onChange={(e) => setField(f.key, e.target.value)}>
                    {f.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                ) : f.kind === 'dated' ? (
                  <textarea id={fid} className="tl-textarea" style={{ minHeight: 110 }} value={values[f.key]} spellCheck={false} onChange={(e) => setField(f.key, e.target.value)} />
                ) : (
                  <input id={fid} type="text" inputMode="decimal" value={values[f.key]} spellCheck={false} style={{ width: '100%' }} onChange={(e) => setField(f.key, e.target.value)} />
                )}
                {f.hint && <span className="tl-muted fc-hint">{f.hint}</span>}
              </div>
            );
          })}
        </div>
        <div className="tl-row tl-gap">
          <button type="button" className="tl-btn secondary" onClick={() => setAll((a) => ({ ...a, [id]: defaultValues(calc) }))}>Reset example</button>
        </div>
      </div>

      <div className="tl-panel" aria-live="polite">
        {result.error ? (
          <div className="tl-err">⚠ {result.error}</div>
        ) : (
          <>
            <div className="tl-grid">
              {result.rows.map((r) => (
                <div key={r.label} className="tl-stat">
                  <b>{r.label}</b>
                  <span className={r.unit === 'text' ? 'fc-text' : ''}>{formatValue(r.value, r.unit)}</span>
                </div>
              ))}
            </div>
            <div className="tl-row tl-gap"><CopyButton text={summary} label="Copy results" /></div>
          </>
        )}
      </div>

      {table && !result.error && (
        <div className="tl-panel">
          <strong>Repayment schedule</strong>
          <div className="fc-table-wrap tl-gap">
            <table className="tl-table">
              <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{i === 0 ? cell : formatValue(cell, 'money')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.rows.length > 12 && (
            <button type="button" className="tl-btn secondary tl-gap" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show first 12 months' : `Show all ${table.rows.length} months`}
            </button>
          )}
        </div>
      )}
      <p className="tl-muted tl-gap">For information only, not financial advice. Results use the standard formulas and may differ slightly from a lender's figures.</p>
    </div>
  );
}
