import Finance from 'financejs';

const finance = new Finance();

// ---- input parsing -------------------------------------------------------
export function parseNumber(raw, label) {
  const s = String(raw).trim().replace(/,/g, '');
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) throw new Error(`${label} must be a number`);
  return n;
}

export function parseList(raw, label) {
  const parts = String(raw).split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) throw new Error(`${label}: enter at least one number`);
  return parts.map((p) => parseNumber(p, label));
}

// "2024-01-01, -1000" per line -> { amounts, dates }
export function parseDatedFlows(raw) {
  const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Enter at least two lines like "2024-01-01, -1000"');
  const amounts = [];
  const dates = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*[,;\s]\s*(-?[\d,.]+)$/);
    if (!m) throw new Error(`Line ${i + 1} should look like "2024-01-01, -1000"`);
    const d = new Date(`${m[1]}T00:00:00`);
    if (Number.isNaN(d.getTime())) throw new Error(`Line ${i + 1} has an invalid date`);
    dates.push(d);
    amounts.push(parseNumber(m[2], `Line ${i + 1} amount`));
  });
  return { amounts, dates };
}

const positive = (n, label) => {
  if (n <= 0) throw new Error(`${label} must be greater than 0`);
  return n;
};

// ---- amortization schedule (exact, to complement the library's rounded payment) ----
export function amortizationSchedule(principal, annualRatePct, payments) {
  const r = annualRatePct / 12 / 100;
  const pay = r === 0 ? principal / payments : (principal * r) / (1 - (1 + r) ** -payments);
  let balance = principal;
  const rows = [];
  for (let i = 1; i <= payments; i += 1) {
    const interest = balance * r;
    const part = pay - interest;
    balance = i === payments ? 0 : balance - part;
    rows.push({ period: i, payment: pay, principal: part, interest, balance: Math.max(0, balance) });
  }
  return { payment: pay, rows };
}

// ---- calculators ----------------------------------------------------------
// Each field: { key, label, def, hint?, kind?: 'number' | 'list' | 'dated' | 'select', options? }
// compute(values) -> { rows: [{ label, value, unit?: 'money' | 'pct' | 'num' | 'years' | 'x' , note? }], table? }
const N = (v, k, label) => parseNumber(v[k], label);

export const CALCULATORS = [
  {
    id: 'loan',
    name: 'Loan / Mortgage Payment',
    description: 'Monthly payment, total interest and a full repayment schedule for a loan.',
    fields: [
      { key: 'principal', label: 'Loan amount', def: '250000' },
      { key: 'rate', label: 'Annual interest rate (%)', def: '6.5' },
      { key: 'term', label: 'Term', def: '25' },
      { key: 'unit', label: 'Term unit', kind: 'select', def: 'years', options: [['years', 'Years'], ['months', 'Months']] },
    ],
    compute: (v) => {
      const principal = positive(N(v, 'principal', 'Loan amount'), 'Loan amount');
      const rate = N(v, 'rate', 'Interest rate');
      if (rate < 0) throw new Error('Interest rate cannot be negative');
      const term = positive(N(v, 'term', 'Term'), 'Term');
      const months = v.unit === 'months' ? term : term * 12;
      if (!Number.isInteger(months)) throw new Error('Term must be a whole number of months');
      const monthly = rate === 0 ? principal / months : finance.AM(principal, rate, months, 1);
      const sched = amortizationSchedule(principal, rate, months);
      const total = sched.payment * months;
      return {
        rows: [
          { label: 'Monthly payment', value: monthly, unit: 'money' },
          { label: 'Total paid', value: total, unit: 'money' },
          { label: 'Total interest', value: total - principal, unit: 'money' },
          { label: 'Number of payments', value: months, unit: 'num' },
        ],
        table: { columns: ['Month', 'Payment', 'Principal', 'Interest', 'Balance'], rows: sched.rows.map((r) => [r.period, r.payment, r.principal, r.interest, r.balance]) },
      };
    },
  },
  {
    id: 'compound',
    name: 'Compound Interest',
    description: 'How much a deposit grows with interest compounded several times a year.',
    fields: [
      { key: 'principal', label: 'Starting amount', def: '5000' },
      { key: 'rate', label: 'Annual interest rate (%)', def: '5' },
      { key: 'n', label: 'Compounded times per year', def: '12', hint: '1 = yearly, 12 = monthly, 365 = daily' },
      { key: 'years', label: 'Years', def: '10' },
    ],
    compute: (v) => {
      const principal = N(v, 'principal', 'Starting amount');
      const rate = N(v, 'rate', 'Interest rate');
      const n = positive(N(v, 'n', 'Compounding'), 'Compounding');
      const years = N(v, 'years', 'Years');
      const end = finance.CI(rate, n, principal, years);
      return { rows: [
        { label: 'Final balance', value: end, unit: 'money' },
        { label: 'Interest earned', value: end - principal, unit: 'money' },
        { label: 'Growth', value: principal ? ((end - principal) / Math.abs(principal)) * 100 : 0, unit: 'pct' },
      ] };
    },
  },
  {
    id: 'fv',
    name: 'Future Value',
    description: 'What an amount today will be worth after some years at a fixed growth rate.',
    fields: [
      { key: 'amount', label: 'Amount today', def: '1000' },
      { key: 'rate', label: 'Annual rate (%)', def: '7' },
      { key: 'years', label: 'Years', def: '10' },
    ],
    compute: (v) => ({ rows: [{ label: 'Future value', value: finance.FV(N(v, 'rate', 'Rate'), N(v, 'amount', 'Amount'), N(v, 'years', 'Years')), unit: 'money' }] }),
  },
  {
    id: 'pv',
    name: 'Present Value',
    description: 'What a future amount is worth in today\'s money.',
    fields: [
      { key: 'amount', label: 'Future amount', def: '10000' },
      { key: 'rate', label: 'Discount rate (%)', def: '5' },
      { key: 'years', label: 'Years from now', def: '5' },
    ],
    compute: (v) => ({ rows: [{ label: 'Present value', value: finance.PV(N(v, 'rate', 'Rate'), N(v, 'amount', 'Amount'), N(v, 'years', 'Years')), unit: 'money' }] }),
  },
  {
    id: 'npv',
    name: 'Net Present Value (NPV)',
    description: 'Is an investment worth it? Discounts its future cash flows to today.',
    fields: [
      { key: 'rate', label: 'Discount rate (%)', def: '10' },
      { key: 'initial', label: 'Initial investment (negative)', def: '-500000' },
      { key: 'flows', label: 'Cash flows per period', kind: 'list', def: '200000, 300000, 200000', hint: 'Separate with commas or spaces' },
    ],
    compute: (v) => {
      const initial = N(v, 'initial', 'Initial investment');
      const flows = parseList(v.flows, 'Cash flows');
      const rate = N(v, 'rate', 'Discount rate');
      const npv = finance.NPV(rate, initial, ...flows);
      return { rows: [
        { label: 'Net present value', value: npv, unit: 'money' },
        { label: 'Verdict', value: npv > 0 ? 'Adds value (NPV > 0)' : npv < 0 ? 'Destroys value (NPV < 0)' : 'Break-even', unit: 'text' },
        { label: 'Profitability index', value: finance.PI(rate, initial, ...flows), unit: 'x' },
      ] };
    },
  },
  {
    id: 'irr',
    name: 'Internal Rate of Return (IRR)',
    description: 'The yearly return an investment earns, from its cash flows.',
    fields: [
      { key: 'initial', label: 'Initial investment (negative)', def: '-500000' },
      { key: 'flows', label: 'Cash flows per period', kind: 'list', def: '200000, 300000, 200000' },
    ],
    compute: (v) => {
      const flows = parseList(v.flows, 'Cash flows');
      try {
        return { rows: [{ label: 'IRR', value: finance.IRR(N(v, 'initial', 'Initial investment'), ...flows), unit: 'pct' }] };
      } catch (e) {
        if (/can't find/.test(e.message)) throw new Error('No IRR found. These cash flows lose most of the investment (IRR below about -10%) or have no solution');
        throw e;
      }
    },
  },
  {
    id: 'xirr',
    name: 'XIRR (dated cash flows)',
    description: 'Return on cash flows that happen on irregular dates.',
    fields: [
      { key: 'flows', label: 'One "date, amount" per line', kind: 'dated', def: '2024-01-01, -1000\n2024-08-01, -100\n2024-08-19, 1200', hint: 'Money paid out is negative' },
    ],
    compute: (v) => {
      const { amounts, dates } = parseDatedFlows(v.flows);
      const r = finance.XIRR(amounts, dates, 0);
      // The library returns 0 when it fails to converge, so verify the answer actually zeroes the NPV.
      const t0 = dates[0].getTime();
      const npv = amounts.reduce((s, a, i) => s + a / (1 + r / 100) ** ((dates[i].getTime() - t0) / 31557600000), 0);
      if (!Number.isFinite(r) || Math.abs(npv) > Math.max(1, Math.abs(amounts[0])) * 0.01) throw new Error('XIRR could not find a result for these cash flows');
      return { rows: [{ label: 'XIRR (annualised)', value: r, unit: 'pct' }] };
    },
  },
  {
    id: 'roi',
    name: 'Return on Investment (ROI)',
    description: 'Profit or loss as a percentage of what you put in.',
    fields: [
      { key: 'cost', label: 'Amount invested', def: '55000' },
      { key: 'earnings', label: 'Amount received', def: '60000' },
    ],
    compute: (v) => {
      const cost = positive(Math.abs(N(v, 'cost', 'Amount invested')), 'Amount invested');
      const earnings = N(v, 'earnings', 'Amount received');
      return { rows: [
        { label: 'ROI', value: finance.ROI(-cost, earnings), unit: 'pct' },
        { label: 'Profit / loss', value: earnings - cost, unit: 'money' },
      ] };
    },
  },
  {
    id: 'payback',
    name: 'Payback Period',
    description: 'How long it takes to earn back an investment.',
    fields: [
      { key: 'initial', label: 'Initial investment (negative)', def: '-50' },
      { key: 'flows', label: 'Cash flows per period', kind: 'list', def: '10, 13, 16, 19, 22', hint: 'For a constant yearly inflow enter one number' },
    ],
    compute: (v) => {
      const initial = N(v, 'initial', 'Initial investment');
      if (initial >= 0) throw new Error('Initial investment must be negative');
      const flows = parseList(v.flows, 'Cash flows');
      const years = flows.length === 1
        ? finance.PP(0, initial, flows[0])
        : finance.PP(flows.length, initial, ...flows);
      if (!Number.isFinite(years) || years <= 0) throw new Error('The investment is never paid back with these cash flows');
      return { rows: [{ label: 'Payback period', value: years, unit: 'years' }] };
    },
  },
  {
    id: 'cagr',
    name: 'CAGR (growth rate)',
    description: 'The steady yearly growth rate between a start and an end value.',
    fields: [
      { key: 'start', label: 'Beginning value', def: '10000' },
      { key: 'end', label: 'Ending value', def: '19500' },
      { key: 'years', label: 'Years', def: '3' },
    ],
    compute: (v) => {
      const start = positive(N(v, 'start', 'Beginning value'), 'Beginning value');
      const end = positive(N(v, 'end', 'Ending value'), 'Ending value');
      return { rows: [{ label: 'CAGR', value: finance.CAGR(start, end, positive(N(v, 'years', 'Years'), 'Years')), unit: 'pct' }] };
    },
  },
  {
    id: 'rule72',
    name: 'Rule of 72',
    description: 'Roughly how many years it takes money to double.',
    fields: [{ key: 'rate', label: 'Annual rate (%)', def: '8' }],
    compute: (v) => ({ rows: [{ label: 'Years to double', value: finance.R72(positive(N(v, 'rate', 'Rate'), 'Rate')), unit: 'years' }] }),
  },
  {
    id: 'inflation',
    name: 'Inflation-adjusted Return',
    description: 'Your real return after inflation eats into it.',
    fields: [
      { key: 'ret', label: 'Investment return (%)', def: '8' },
      { key: 'infl', label: 'Inflation rate (%)', def: '3' },
    ],
    compute: (v) => ({ rows: [{ label: 'Real return', value: finance.IAR(N(v, 'ret', 'Return') / 100, N(v, 'infl', 'Inflation') / 100), unit: 'pct' }] }),
  },
  {
    id: 'wacc',
    name: 'WACC',
    description: 'Weighted average cost of capital for a company.',
    fields: [
      { key: 'equity', label: 'Market value of equity', def: '600000' },
      { key: 'debt', label: 'Market value of debt', def: '400000' },
      { key: 'ke', label: 'Cost of equity (%)', def: '6' },
      { key: 'kd', label: 'Cost of debt (%)', def: '5' },
      { key: 'tax', label: 'Tax rate (%)', def: '35' },
    ],
    compute: (v) => {
      const e = N(v, 'equity', 'Equity');
      const d = N(v, 'debt', 'Debt');
      positive(e + d, 'Equity plus debt');
      return { rows: [{ label: 'WACC', value: finance.WACC(e, d, N(v, 'ke', 'Cost of equity'), N(v, 'kd', 'Cost of debt'), N(v, 'tax', 'Tax rate')), unit: 'pct' }] };
    },
  },
  {
    id: 'leverage',
    name: 'Leverage Ratio',
    description: 'How much debt and liabilities you carry compared with income.',
    fields: [
      { key: 'liab', label: 'Total liabilities', def: '25' },
      { key: 'debt', label: 'Total debts', def: '10' },
      { key: 'income', label: 'Total income', def: '20' },
    ],
    compute: (v) => ({ rows: [{ label: 'Leverage ratio', value: finance.LR(N(v, 'liab', 'Liabilities'), N(v, 'debt', 'Debts'), positive(N(v, 'income', 'Income'), 'Income')), unit: 'x' }] }),
  },
];

export function defaultValues(calc) {
  return Object.fromEntries(calc.fields.map((f) => [f.key, f.def]));
}

export function runCalculator(calc, values) {
  try {
    return calc.compute(values);
  } catch (e) {
    return { error: e.message };
  }
}

export function formatValue(value, unit) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  const f = (digits) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  switch (unit) {
    case 'money': return f(2);
    case 'pct': return `${f(2)}%`;
    case 'x': return `${f(2)}×`;
    case 'years': return `${f(2)} years`;
    default: return f(Number.isInteger(value) ? 0 : 2);
  }
}
