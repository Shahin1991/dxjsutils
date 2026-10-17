import React from 'react';
import { CopyButton } from '../../components/CopyButton';
import { useToolState } from '../../utils/toolState';
import { CALCULATORS, runCalc } from './utils/percent';

const defaults = () => Object.fromEntries(CALCULATORS.map((c) => [c.id, Object.fromEntries(c.inputs.map(([k, , d]) => [k, d]))]));

export function PercentageCalculator() {
  const [values, setValues] = useToolState('values', defaults);

  const set = (id, k, v) => setValues((all) => ({ ...all, [id]: { ...all[id], [k]: v } }));

  return (
    <div className="tl-container">
      <h2 className="tl-title">💯 Percentage &amp; VAT Calculator</h2>
      <p className="tl-desc">Everyday percentages, UAE VAT (5%), discounts and profit margins. Results update as you type.</p>
      <div className="pc-grid">
        {CALCULATORS.map((c) => {
          const r = runCalc(c, values[c.id]);
          return (
            <section key={c.id} className="tl-panel pc-card" aria-label={c.label}>
              <strong>{c.label}</strong>
              <div className="pc-inputs tl-gap">
                {c.inputs.map(([k, label]) => (
                  <label key={k}>
                    <span className="tl-label">{label}</span>
                    <input type="text" inputMode="decimal" value={values[c.id][k]} onChange={(e) => set(c.id, k, e.target.value)} />
                  </label>
                ))}
              </div>
              {r.error ? (
                <div className="tl-err tl-gap">⚠ {r.error}</div>
              ) : (
                <>
                  <div className="tl-row tl-gap pc-result">
                    <span className="pc-value">{r.result}</span>
                    <CopyButton text={String(r.result)} />
                  </div>
                  <div className="tl-muted">{r.detail}</div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
