// Each unit is a factor to the category's base unit. Temperature uses explicit to/from functions instead.
export const CATEGORIES = {
  length: {
    label: 'Length',
    units: {
      mm: ['Millimetre', 0.001], cm: ['Centimetre', 0.01], m: ['Metre', 1], km: ['Kilometre', 1000],
      in: ['Inch', 0.0254], ft: ['Foot', 0.3048], yd: ['Yard', 0.9144], mi: ['Mile', 1609.344], nmi: ['Nautical mile', 1852],
    },
  },
  mass: {
    label: 'Weight',
    units: {
      mg: ['Milligram', 0.001], g: ['Gram', 1], kg: ['Kilogram', 1000], t: ['Tonne', 1e6],
      oz: ['Ounce', 28.349523125], lb: ['Pound', 453.59237], st: ['Stone', 6350.29318],
    },
  },
  temperature: {
    label: 'Temperature',
    units: {
      c: ['Celsius', { to: (v) => v, from: (v) => v }],
      f: ['Fahrenheit', { to: (v) => ((v - 32) * 5) / 9, from: (v) => (v * 9) / 5 + 32 }],
      k: ['Kelvin', { to: (v) => v - 273.15, from: (v) => v + 273.15 }],
    },
  },
  area: {
    label: 'Area',
    units: {
      cm2: ['Square centimetre', 1e-4], m2: ['Square metre', 1], ha: ['Hectare', 1e4], km2: ['Square kilometre', 1e6],
      in2: ['Square inch', 0.00064516], ft2: ['Square foot', 0.09290304], ac: ['Acre', 4046.8564224], mi2: ['Square mile', 2589988.110336],
    },
  },
  volume: {
    label: 'Volume',
    units: {
      ml: ['Millilitre', 0.001], l: ['Litre', 1], m3: ['Cubic metre', 1000],
      floz: ['US fluid ounce', 0.0295735295625], cup: ['US cup', 0.2365882365], gal: ['US gallon', 3.785411784], igal: ['Imperial gallon', 4.54609],
    },
  },
  speed: {
    label: 'Speed',
    units: {
      ms: ['Metre/second', 1], kmh: ['Kilometre/hour', 1 / 3.6], mph: ['Mile/hour', 0.44704], kn: ['Knot', 1852 / 3600], mach: ['Mach (sea level)', 340.29],
    },
  },
  time: {
    label: 'Time',
    units: {
      ms: ['Millisecond', 0.001], s: ['Second', 1], min: ['Minute', 60], h: ['Hour', 3600], d: ['Day', 86400], wk: ['Week', 604800], yr: ['Year (365 d)', 31536000],
    },
  },
  data: {
    label: 'Data size',
    units: {
      b: ['Bit', 0.125], B: ['Byte', 1], KB: ['Kilobyte (1000)', 1e3], MB: ['Megabyte (1000²)', 1e6], GB: ['Gigabyte (1000³)', 1e9], TB: ['Terabyte (1000⁴)', 1e12],
      KiB: ['Kibibyte (1024)', 1024], MiB: ['Mebibyte (1024²)', 1024 ** 2], GiB: ['Gibibyte (1024³)', 1024 ** 3], TiB: ['Tebibyte (1024⁴)', 1024 ** 4],
    },
  },
  pressure: {
    label: 'Pressure',
    units: {
      pa: ['Pascal', 1], hpa: ['Hectopascal / millibar', 100], kpa: ['Kilopascal', 1000], bar: ['Bar', 1e5],
      atm: ['Atmosphere', 101325], psi: ['PSI', 6894.757293168], inhg: ['Inch of mercury', 3386.389],
    },
  },
  energy: {
    label: 'Energy',
    units: {
      j: ['Joule', 1], kj: ['Kilojoule', 1000], cal: ['Calorie', 4.184], kcal: ['Kilocalorie', 4184], wh: ['Watt-hour', 3600], kwh: ['Kilowatt-hour', 3.6e6], btu: ['BTU', 1055.05585262],
    },
  },
};

export function convert(category, value, from, to) {
  const { units } = CATEGORIES[category];
  const f = units[from][1];
  const t = units[to][1];
  const base = typeof f === 'number' ? value * f : f.to(value);
  return typeof t === 'number' ? base / t : t.from(base);
}

// Up to 10 significant digits, without trailing zeros or float noise like 0.30000000000000004.
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  if (n !== 0 && (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-6)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return String(parseFloat(n.toPrecision(10)));
}
