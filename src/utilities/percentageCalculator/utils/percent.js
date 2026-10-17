const num = (v, name) => {
  const n = Number(String(v).replace(/,/g, '').trim());
  if (String(v).trim() === '' || !Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
};
const round = (n) => Math.round(n * 100) / 100;

// Each calculator: inputs [key, label, default], run(values) -> { result, detail }
export const CALCULATORS = [
  {
    id: 'of', label: 'X% of Y',
    inputs: [['p', 'Percent', '15'], ['y', 'Of value', '200']],
    run: ({ p, y }) => {
      const r = (num(p, 'Percent') / 100) * num(y, 'Value');
      return { result: round(r), detail: `${p}% of ${y} = ${round(r)}` };
    },
  },
  {
    id: 'is-what', label: 'X is what % of Y',
    inputs: [['x', 'Value', '30'], ['y', 'Total', '120']],
    run: ({ x, y }) => {
      const total = num(y, 'Total');
      if (total === 0) throw new Error('Total cannot be 0');
      const r = (num(x, 'Value') / total) * 100;
      return { result: `${round(r)}%`, detail: `${x} is ${round(r)}% of ${y}` };
    },
  },
  {
    id: 'change', label: '% change',
    inputs: [['from', 'From', '80'], ['to', 'To', '100']],
    run: ({ from, to }) => {
      const a = num(from, 'From');
      if (a === 0) throw new Error('"From" cannot be 0');
      const r = ((num(to, 'To') - a) / Math.abs(a)) * 100;
      return { result: `${r >= 0 ? '+' : ''}${round(r)}%`, detail: `From ${from} to ${to} is a ${r >= 0 ? 'increase' : 'decrease'} of ${Math.abs(round(r))}%` };
    },
  },
  {
    id: 'vat-add', label: 'Add VAT',
    inputs: [['amount', 'Amount excl. VAT', '1000'], ['rate', 'VAT rate %', '5']],
    run: ({ amount, rate }) => {
      const a = num(amount, 'Amount');
      const vat = (a * num(rate, 'VAT rate')) / 100;
      return { result: round(a + vat), detail: `VAT ${round(vat)} + net ${round(a)} = gross ${round(a + vat)}` };
    },
  },
  {
    id: 'vat-remove', label: 'Remove VAT',
    inputs: [['amount', 'Amount incl. VAT', '1050'], ['rate', 'VAT rate %', '5']],
    run: ({ amount, rate }) => {
      const g = num(amount, 'Amount');
      const net = g / (1 + num(rate, 'VAT rate') / 100);
      return { result: round(net), detail: `Net ${round(net)} + VAT ${round(g - net)} = gross ${round(g)}` };
    },
  },
  {
    id: 'discount', label: 'Discount',
    inputs: [['price', 'Original price', '250'], ['p', 'Discount %', '20']],
    run: ({ price, p }) => {
      const pr = num(price, 'Price');
      const off = (pr * num(p, 'Discount')) / 100;
      return { result: round(pr - off), detail: `You save ${round(off)}; you pay ${round(pr - off)}` };
    },
  },
  {
    id: 'margin', label: 'Margin & markup',
    inputs: [['cost', 'Cost', '60'], ['price', 'Selling price', '100']],
    run: ({ cost, price }) => {
      const c = num(cost, 'Cost');
      const p = num(price, 'Price');
      if (p === 0 || c === 0) throw new Error('Cost and price must not be 0');
      const margin = ((p - c) / p) * 100;
      const markup = ((p - c) / c) * 100;
      return { result: `${round(margin)}% margin`, detail: `Profit ${round(p - c)} · margin ${round(margin)}% · markup ${round(markup)}%` };
    },
  },
];

export function runCalc(calc, values) {
  try {
    return calc.run(values);
  } catch (e) {
    return { error: e.message };
  }
}
