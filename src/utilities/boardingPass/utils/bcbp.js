// IATA Bar Coded Boarding Pass (BCBP, Resolution 792) decoder for the text inside the barcode.

const COMPARTMENT = { F: 'First', A: 'First (discounted)', P: 'First (premium)', J: 'Business', C: 'Business', D: 'Business (discounted)', I: 'Business (discounted)', Z: 'Business (discounted)', R: 'Supersonic', W: 'Premium economy', Y: 'Economy', B: 'Economy', H: 'Economy', K: 'Economy', L: 'Economy', M: 'Economy', N: 'Economy', Q: 'Economy', S: 'Economy', T: 'Economy', U: 'Economy', V: 'Economy', X: 'Economy', E: 'Economy', G: 'Economy', O: 'Economy' };
const PAX_STATUS = { 0: 'Ticket issuance / passenger not checked in', 1: 'Ticket issuance / passenger checked in', 2: 'Baggage checked, passenger not checked in', 3: 'Baggage checked, passenger checked in', 4: 'Passenger passed security', 5: 'Passenger passed gate exit', 6: 'Transit', 7: 'Standby', 8: 'Boarding data revalidation done', 9: 'Original boarding line used at check-in', A: 'Up- or downgrading required' };
const PAX_DESC = { 0: 'Adult', 1: 'Male', 2: 'Female', 3: 'Child', 4: 'Infant', 5: 'No passenger (cabin baggage)', 6: 'Adult travelling with infant', 7: 'Unaccompanied minor' };
const SOURCE = { W: 'Web', K: 'Airport kiosk', R: 'Remote or off-site kiosk', M: 'Mobile device', O: 'Airport agent', T: 'Town agent', V: 'Third-party vendor', X: 'Transfer kiosk', A: 'Automated', ' ': 'Not specified' };
const DOC_TYPE = { B: 'Boarding pass', I: 'Itinerary receipt' };

// Julian day-of-year -> "12 Mar" (guessing the year closest to `ref`).
export function julianToDate(day, ref = new Date()) {
  const n = Number(day);
  if (!n || n > 366) return null;
  const candidates = [-1, 0, 1].map((dy) => {
    const d = new Date(Date.UTC(ref.getUTCFullYear() + dy, 0, 1));
    d.setUTCDate(n);
    return d;
  });
  return candidates.reduce((best, d) => (Math.abs(d - ref) < Math.abs(best - ref) ? d : best));
}

const fmtDate = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

class Reader {
  constructor(s) {
    this.s = s;
    this.i = 0;
  }

  take(n) {
    const v = this.s.slice(this.i, this.i + n);
    this.i += n;
    return v;
  }

  hex(n) {
    const v = this.take(n);
    const num = parseInt(v, 16);
    if (Number.isNaN(num)) throw new Error(`Expected a hex field size at position ${this.i - n + 1}, found "${v}"`);
    return num;
  }

  get left() {
    return this.s.length - this.i;
  }
}

const field = (label, raw, text) => ({ label, raw, text: text ?? raw.trim() });

export function decodeBcbp(input, ref = new Date()) {
  const s = input.replace(/[\r\n]+$/, '');
  if (s.length < 60) throw new Error('Too short: a boarding pass barcode has at least 60 characters');
  if (s[0] !== 'M' && s[0] !== 'S') throw new Error('A BCBP barcode starts with M (or S); this does not look like one');
  const r = new Reader(s);
  const format = r.take(1);
  const legs = Number(r.take(1));
  if (!legs || legs > 4) throw new Error('Invalid number of flight legs');
  const name = r.take(20);
  const [last, first = ''] = name.trim().split('/');
  const head = [
    field('Format', format, format === 'M' ? 'M (multiple-leg capable)' : format),
    field('Passenger name', name, `${first.trim()} ${last.trim()}`.trim()),
    field('E-ticket', r.take(1), undefined),
  ];
  head[2].text = head[2].raw === 'E' ? 'Yes (electronic ticket)' : 'No';

  const result = { legs: [], header: head, security: null, version: null };
  for (let leg = 0; leg < legs; leg += 1) {
    const f = [];
    const pnr = r.take(7);
    const from = r.take(3);
    const to = r.take(3);
    const carrier = r.take(3);
    const flight = r.take(5);
    const julian = r.take(3);
    const cls = r.take(1);
    const seat = r.take(4);
    const seq = r.take(5);
    const status = r.take(1);
    if (r.left < 2) throw new Error('The barcode ends early (leg data is incomplete)');
    const varSize = r.hex(2);
    const date = julianToDate(julian, ref);
    f.push(field('Booking reference (PNR)', pnr), field('From', from), field('To', to), field('Operating carrier', carrier),
      field('Flight', flight, `${carrier.trim()} ${flight.trim().replace(/^0+(?=\d)/, '')}`),
      field('Date of flight', julian, `Day ${Number(julian)} of the year${date ? ` (≈ ${fmtDate(date)})` : ''}`),
      field('Cabin', cls, `${cls} – ${COMPARTMENT[cls] || 'Unknown'}`),
      field('Seat', seat, seat.trim().replace(/^0+(?=\d)/, '') || '—'),
      field('Check-in sequence', seq, seq.trim().replace(/^0+(?=\d)/, '')),
      field('Passenger status', status, PAX_STATUS[status] || status));

    const varField = r.take(varSize);
    const v = new Reader(varField);
    if (leg === 0 && v.left > 0 && varField[0] === '>') {
      v.take(1);
      result.version = v.take(1);
      const uniq = new Reader(v.take(v.hex(2)));
      const u = [];
      if (uniq.left >= 1) u.push(field('Passenger type', uniq.s[uniq.i], PAX_DESC[uniq.take(1)] || 'Unknown'));
      if (uniq.left >= 1) { const c = uniq.take(1); u.push(field('Checked in via', c, SOURCE[c] || c)); }
      if (uniq.left >= 1) { const c = uniq.take(1); u.push(field('Boarding pass issued via', c, SOURCE[c] || c)); }
      if (uniq.left >= 4) {
        const raw = uniq.take(4);
        u.push(field('Boarding pass issued', raw, /^\d{4}$/.test(raw) ? `Year ending in ${raw[0]}, day ${Number(raw.slice(1))}` : raw));
      }
      if (uniq.left >= 1) { const c = uniq.take(1); u.push(field('Document type', c, DOC_TYPE[c] || c)); }
      if (uniq.left >= 3) u.push(field('Issuing airline', uniq.take(3)));
      for (let b = 0; b < 3 && uniq.left >= 13; b += 1) {
        const tag = uniq.take(13);
        if (tag.trim()) u.push(field(`Bag tag ${b + 1}`, tag, `${tag.slice(1, 4)} ${tag.slice(4, 10)} (+${Number(tag.slice(10))} more)`));
      }
      result.unique = u.filter((x) => x.raw.trim());
    }
    if (v.left >= 2) {
      const cond = new Reader(v.take(v.hex(2)));
      const take = (label, n, fmt) => {
        if (cond.left < n) return;
        const raw = cond.take(n);
        if (raw.trim()) f.push(field(label, raw, fmt ? fmt(raw) : undefined));
      };
      take('Airline numeric code', 3);
      take('Ticket serial number', 10);
      take('Selectee', 1, (x) => ({ 0: 'No', 1: 'No', 3: 'Yes' }[x] || x));
      take('Document verification', 1, (x) => ({ 0: 'Not required', 1: 'Required', 2: 'Performed' }[x] || x));
      take('Marketing carrier', 3);
      take('Frequent flyer airline', 3);
      take('Frequent flyer number', 16);
      take('ID/AD indicator', 1);
      take('Free baggage allowance', 3, (x) => x.replace(/^0+(?=\d)/, '').replace(/K$/, ' kg').replace(/L$/, ' lb').replace(/PC$/, ' piece(s)'));
      take('Fast track', 1, (x) => ({ Y: 'Yes', N: 'No' }[x] || x));
    }
    if (v.left > 0) f.push(field('Airline private data', v.take(v.left)));
    result.legs.push(f);
  }
  if (r.left > 0) {
    const rest = r.take(r.left);
    if (rest[0] === '^') result.security = { type: rest[1], length: parseInt(rest.slice(2, 4), 16), data: rest.slice(4) };
    else result.trailing = rest;
  }
  return result;
}
