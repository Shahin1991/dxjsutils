import React, { useCallback, useEffect, useState } from 'react';

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'EGP', 'PKR', 'LKR', 'BDT', 'PHP', 'CNY', 'JPY', 'KRW', 'SGD', 'HKD', 'AUD', 'NZD', 'CAD', 'CHF', 'ZAR', 'TRY', 'THB', 'MYR', 'IDR', 'BRL', 'MXN', 'RUB'];
const TTL = 60 * 60 * 1000;

function readCache(from) {
  try {
    const c = JSON.parse(localStorage.getItem(`currencyRates:${from}`));
    return c && Date.now() - c.fetchedAt < TTL ? c : null;
  } catch (e) {
    return null;
  }
}

function CurrencyConverterInner() {
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('AED');
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (code, force) => {
    setError('');
    const cached = force ? null : readCache(code);
    if (cached) {
      setRates(cached);
      return;
    }
    setLoading(true);
    const res = await window.electron.currencyRates(code.toLowerCase());
    setLoading(false);
    if (res?.error || !res?.data) {
      setError(res?.error || 'Failed to fetch rates');
      setRates(null);
      return;
    }
    const entry = { rates: res.data[code.toLowerCase()], date: res.data.date, fetchedAt: Date.now() };
    try {
      localStorage.setItem(`currencyRates:${code}`, JSON.stringify(entry));
    } catch (e) {
      // ignore
    }
    setRates(entry);
  }, []);

  useEffect(() => {
    load(from, false);
  }, [from, load]);

  const rate = rates?.rates?.[to.toLowerCase()];
  const value = parseFloat(amount);
  const result = rate !== undefined && !isNaN(value) ? value * rate : null;

  return (
    <div className="cc-container">
      <h2 className="cc-title">💱 Currency Converter</h2>
      <p className="cc-desc">Live exchange rates (cached for one hour).</p>
      <div className="cc-panel cc-row">
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select value={from} onChange={(e) => setFrom(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        <button type="button" className="cc-btn secondary" onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
        <select value={to} onChange={(e) => setTo(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        <button type="button" className="cc-btn" onClick={() => load(from, true)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <p className="cc-err">{error}</p>}
      {result !== null && (
        <div className="cc-panel">
          <div className="cc-result">{value.toLocaleString()} {from} = <b>{result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}</b></div>
          <div className="cc-muted">1 {from} = {rate} {to}</div>
          <div className="cc-muted">Rates date: {rates.date} · Last updated: {new Date(rates.fetchedAt).toLocaleString()}</div>
        </div>
      )}
      {rates && (
        <div className="cc-panel">
          <strong>1 {from} in other currencies</strong>
          <table className="cc-table">
            <tbody>
              {CURRENCIES.filter((c) => c !== from && rates.rates[c.toLowerCase()] !== undefined).map((c) => (
                <tr key={c}><td>{c}</td><td>{rates.rates[c.toLowerCase()]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CurrencyConverter() {
  if (!window.electron?.isElectron) {
    return (
      <div className="cc-container">
        <h2 className="cc-title">💱 Currency Converter</h2>
        <p className="cc-notice">This utility requires the desktop app.</p>
      </div>
    );
  }
  return <CurrencyConverterInner />;
}
