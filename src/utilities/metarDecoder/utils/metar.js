// METAR / SPECI / TAF decoder (ICAO Annex 3 / WMO FM 15 & FM 51, plus common US variants).

const WX_INTENSITY = { '-': 'light', '+': 'heavy', VC: 'in the vicinity:' };
const WX_DESC = { MI: 'shallow', PR: 'partial', BC: 'patches of', DR: 'low drifting', BL: 'blowing', SH: 'showers of', TS: 'thunderstorm', FZ: 'freezing' };
const WX_PHEN = {
  DZ: 'drizzle', RA: 'rain', SN: 'snow', SG: 'snow grains', IC: 'ice crystals', PL: 'ice pellets', GR: 'hail', GS: 'small hail', UP: 'unknown precipitation',
  BR: 'mist', FG: 'fog', FU: 'smoke', VA: 'volcanic ash', DU: 'widespread dust', SA: 'sand', HZ: 'haze', PY: 'spray',
  PO: 'dust/sand whirls', SQ: 'squalls', FC: 'funnel cloud', SS: 'sandstorm', DS: 'duststorm',
};
const CLOUD = { FEW: 'Few (1–2 oktas)', SCT: 'Scattered (3–4 oktas)', BKN: 'Broken (5–7 oktas)', OVC: 'Overcast (8 oktas)', VV: 'Vertical visibility' };
const WX_RE = /^(-|\+|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+)?$/;

const temp = (s) => (s[0] === 'M' ? -Number(s.slice(1)) : Number(s));
const ft = (hundreds) => `${(Number(hundreds) * 100).toLocaleString('en-US')} ft`;

function fraction(s) {
  // "1 1/2", "1/4", "10"
  return s.split(' ').reduce((sum, p) => {
    if (p.includes('/')) {
      const [a, b] = p.split('/').map(Number);
      return sum + a / b;
    }
    return sum + Number(p);
  }, 0);
}

export function decodeWeather(code) {
  if (code === 'NSW') return 'No significant weather';
  if (/^RE[A-Z]{2,}$/.test(code)) {
    const w = decodeWeather(code.slice(2));
    return w ? `Recent ${w.toLowerCase()}` : null;
  }
  const m = code.match(WX_RE);
  if (!m || (!m[2] && !m[3])) return null;
  const phen = (m[3] || '').match(/.{2}/g) || [];
  const desc = m[2] === 'TS' && phen.length ? 'thunderstorm with' : m[2] ? WX_DESC[m[2]] : '';
  const words = [m[1] ? WX_INTENSITY[m[1]] : '', desc, phen.map((p) => WX_PHEN[p]).join(' and ')].filter(Boolean);
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Decode one token at a time; returns [label, text] or null if not recognised.
function decodeToken(tok, ctx) {
  let m;
  if ((m = tok.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/))) {
    const unit = { KT: 'kt', MPS: 'm/s', KMH: 'km/h' }[m[4]];
    ctx.wind = { speed: Number(m[2]), unit: m[4] };
    if (m[1] === '000' && Number(m[2]) === 0) return ['Wind', 'Calm'];
    const dir = m[1] === 'VRB' ? 'Variable direction' : `From ${Number(m[1])}°`;
    return ['Wind', `${dir} at ${Number(m[2])} ${unit}${m[3] ? `, gusting ${Number(m[3])} ${unit}` : ''}`];
  }
  if ((m = tok.match(/^(\d{3})V(\d{3})$/))) return ['Wind variation', `Varying between ${Number(m[1])}° and ${Number(m[2])}°`];
  if (tok === 'CAVOK') {
    ctx.vis = 10000;
    ctx.ceiling = Infinity;
    return ['Visibility', 'CAVOK: visibility 10 km or more, no cloud below 5,000 ft or CB/TCU, no significant weather'];
  }
  if ((m = tok.match(/^(\d{4})(NDV)?$/)) && !ctx.visSeen) {
    ctx.visSeen = true;
    const v = Number(m[1]);
    ctx.vis = v;
    return ['Visibility', v === 9999 ? '10 km or more' : v < 1000 ? `${v} m` : `${(v / 1000).toLocaleString('en-US')} km (${v} m)`];
  }
  if ((m = tok.match(/^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/))) return ['Minimum visibility', `${Number(m[1])} m to the ${m[2]}`];
  if ((m = tok.match(/^(P|M)?(\d{1,2}|\d\/\d|\d{1,2}\/\d{1,2})SM$/))) {
    let whole = m[2];
    if (ctx.prevToken) whole = `${ctx.prevToken} ${whole}`;
    const sm = fraction(whole);
    ctx.vis = sm * 1609;
    return ['Visibility', `${m[1] === 'P' ? 'More than ' : m[1] === 'M' ? 'Less than ' : ''}${whole} statute mile${sm === 1 ? '' : 's'}`];
  }
  if ((m = tok.match(/^R(\d{2}[LCR]?)\/([PM])?(\d{4})(?:V([PM])?(\d{4}))?(FT)?(?:\/?([UDN]))?$/))) {
    const unit = m[6] ? 'ft' : 'm';
    const trend = { U: ', improving', D: ', getting worse', N: ', no change' }[m[7]] || '';
    const range = m[4] || m[5] ? ` to ${m[4] === 'P' ? 'more than ' : ''}${Number(m[5])} ${unit}` : '';
    return ['Runway visual range', `Runway ${m[1]}: ${m[2] === 'P' ? 'more than ' : m[2] === 'M' ? 'less than ' : ''}${Number(m[3])} ${unit}${range}${trend}`];
  }
  if ((m = tok.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/{3})(CB|TCU|\/{3})?$/))) {
    const h = m[2] === '///' ? 'unknown height' : ft(m[2]);
    if ((m[1] === 'BKN' || m[1] === 'OVC' || m[1] === 'VV') && m[2] !== '///') ctx.ceiling = Math.min(ctx.ceiling ?? Infinity, Number(m[2]) * 100);
    const type = m[3] === 'CB' ? ' cumulonimbus' : m[3] === 'TCU' ? ' towering cumulus' : '';
    return ['Cloud', `${CLOUD[m[1]]} at ${h}${type}`];
  }
  if (['NSC', 'SKC', 'CLR', 'NCD'].includes(tok)) {
    ctx.ceiling = ctx.ceiling ?? Infinity;
    return ['Cloud', { NSC: 'No significant cloud', SKC: 'Sky clear', CLR: 'No cloud below 12,000 ft (automated)', NCD: 'No cloud detected (automated)' }[tok]];
  }
  if ((m = tok.match(/^(M?\d{2})\/(M?\d{2})?$/))) {
    const t = temp(m[1]);
    const d = m[2] ? temp(m[2]) : null;
    const rh = d !== null ? Math.round(100 * Math.exp((17.625 * d) / (243.04 + d) - (17.625 * t) / (243.04 + t))) : null;
    return ['Temperature', `${t} °C, dew point ${d ?? '—'} °C${rh !== null ? ` (humidity ≈ ${rh}%)` : ''}`];
  }
  if ((m = tok.match(/^Q(\d{4})$/))) return ['Pressure (QNH)', `${Number(m[1])} hPa (${(Number(m[1]) / 33.8639).toFixed(2)} inHg)`];
  if ((m = tok.match(/^A(\d{4})$/))) return ['Pressure (altimeter)', `${(Number(m[1]) / 100).toFixed(2)} inHg (${Math.round((Number(m[1]) / 100) * 33.8639)} hPa)`];
  if ((m = tok.match(/^WS(R\d{2}[LCR]?|ALL RWY)$/))) return ['Wind shear', `Wind shear on ${m[1]}`];
  if (tok === 'NOSIG') return ['Trend', 'No significant change expected in the next 2 hours'];
  if (tok === 'AUTO') return ['Report', 'Fully automated observation'];
  if (tok === 'COR') return ['Report', 'Corrected report'];
  if (tok === 'NIL') return ['Report', 'Missing report'];
  const wx = decodeWeather(tok);
  if (wx) return ['Weather', wx];
  return null;
}

function decodeDayTime(s) {
  const m = s.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `Day ${Number(m[1])} of the month at ${m[2]}:${m[3]} UTC` : null;
}

function decodePeriod(s) {
  const m = s.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
  return m ? `From day ${Number(m[1])} ${m[2]}:00 UTC to day ${Number(m[3])} ${m[4]}:00 UTC` : null;
}

export function flightCategory(vis, ceiling) {
  if (vis === undefined && ceiling === undefined) return null;
  const sm = (vis ?? 10000) / 1609;
  const c = ceiling ?? Infinity;
  if (c < 500 || sm < 1) return { code: 'LIFR', text: 'Low IFR' };
  if (c < 1000 || sm < 3) return { code: 'IFR', text: 'IFR' };
  if (c <= 3000 || sm <= 5) return { code: 'MVFR', text: 'Marginal VFR' };
  return { code: 'VFR', text: 'VFR' };
}

function decodeTokens(tokens, ctx, rows) {
  const unknown = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    // "1 1/2SM": the whole-number part comes first as its own token.
    if (/^\d$/.test(tok) && /SM$/.test(tokens[i + 1] || '')) {
      ctx.prevToken = tok;
      continue; // eslint-disable-line no-continue
    }
    const r = decodeToken(tok, ctx);
    ctx.prevToken = null;
    if (r) rows.push(r);
    else unknown.push(tok);
  }
  if (unknown.length) rows.push(['Not decoded', unknown.join(' ')]);
}

export function decodeMetar(text) {
  let t = text.trim().toUpperCase().replace(/=+$/, '').replace(/\s+/g, ' ');
  if (!t) throw new Error('Paste a METAR or TAF');
  const rows = [];
  let remarks = null;
  const rmk = t.indexOf(' RMK ');
  if (rmk >= 0) {
    remarks = t.slice(rmk + 5);
    t = t.slice(0, rmk);
  }
  let tokens = t.split(' ');
  let type = 'METAR';
  if (['METAR', 'SPECI', 'TAF'].includes(tokens[0])) type = tokens.shift();
  if (tokens[0] === 'AMD' || tokens[0] === 'COR') rows.push(['Report', tokens.shift() === 'AMD' ? 'Amended forecast' : 'Corrected report']);
  if (!/^[A-Z][A-Z0-9]{3}$/.test(tokens[0] || '')) throw new Error('Expected a 4-letter ICAO station code, e.g. OMDB');
  const station = tokens.shift();
  const time = tokens[0] && decodeDayTime(tokens[0]);
  if (time) tokens.shift();
  if (type === 'METAR' && decodePeriod(tokens[0] || '')) type = 'TAF';
  if (type === 'TAF') return decodeTaf(station, time, tokens, rows, remarks);

  const ctx = {};
  // Split off trend groups (BECMG/TEMPO) so they don't change the current flight category.
  const trendAt = tokens.findIndex((x) => x === 'BECMG' || x === 'TEMPO');
  const trend = trendAt >= 0 ? tokens.slice(trendAt) : [];
  tokens = trendAt >= 0 ? tokens.slice(0, trendAt) : tokens;
  decodeTokens(tokens, ctx, rows);
  const groups = trend.length ? [{ title: `Trend: ${trend.join(' ')}`, rows: decodeGroup(trend) }] : [];
  return { type, station, time, rows, groups, remarks, category: flightCategory(ctx.vis, ctx.ceiling) };
}

function decodeGroup(tokens) {
  const rows = [];
  const [head, ...rest] = tokens;
  let body = rest;
  let m;
  if ((m = head.match(/^FM(\d{2})(\d{2})(\d{2})$/))) rows.push(['Change', `From day ${Number(m[1])} at ${m[2]}:${m[3]} UTC, conditions become`]);
  else if (head === 'BECMG' || head === 'TEMPO') {
    const text = head === 'BECMG' ? 'Becoming' : 'Temporarily';
    const period = decodePeriod(rest[0] || '');
    const time = (rest[0] || '').match(/^(FM|TL|AT)(\d{2})(\d{2})$/);
    if (period) body = rest.slice(1);
    else if (time) body = rest.slice(1);
    rows.push(['Change', `${text}${period ? ` (${period.toLowerCase()})` : time ? ` ${{ FM: 'from', TL: 'until', AT: 'at' }[time[1]]} ${time[2]}:${time[3]} UTC` : ''}`]);
  } else if ((m = head.match(/^PROB(\d{2})$/))) {
    const tempo = rest[0] === 'TEMPO';
    body = rest.slice(tempo ? 1 : 0);
    const period = decodePeriod(body[0] || '');
    if (period) body = body.slice(1);
    rows.push(['Change', `${m[1]}% chance${tempo ? ' of temporary' : ''}${period ? ` (${period.toLowerCase()})` : ''}`]);
  } else body = tokens;
  decodeTokens(body, {}, rows);
  return rows;
}

function decodeTaf(station, time, tokens, rows, remarks) {
  const period = decodePeriod(tokens[0] || '');
  if (period) {
    tokens.shift();
    rows.push(['Valid', period]);
  }
  // Split into groups at FMxxxxxx, BECMG, TEMPO, PROBxx (PROB30 TEMPO stays together).
  const groups = [];
  let cur = [];
  tokens.forEach((tok, i) => {
    const starts = /^FM\d{6}$/.test(tok) || tok === 'BECMG' || /^PROB\d{2}$/.test(tok) || (tok === 'TEMPO' && !/^PROB\d{2}$/.test(tokens[i - 1] || ''));
    if (starts && cur.length) {
      groups.push(cur);
      cur = [];
    }
    cur.push(tok);
  });
  if (cur.length) groups.push(cur);
  const [first, ...changes] = groups;
  const ctx = {};
  if (first) decodeTokens(first.filter((x) => !/^TX|^TN/.test(x)), ctx, rows);
  (first || []).filter((x) => /^T[XN]M?\d{2}\/\d{4}Z$/.test(x)).forEach((x) => {
    const m = x.match(/^T([XN])(M?\d{2})\/(\d{2})(\d{2})Z$/);
    rows.push([m[1] === 'X' ? 'Max temperature' : 'Min temperature', `${temp(m[2])} °C on day ${Number(m[3])} at ${m[4]}:00 UTC`]);
  });
  return {
    type: 'TAF', station, time, rows, remarks,
    groups: changes.map((g) => ({ title: g.join(' '), rows: decodeGroup(g) })),
    category: flightCategory(ctx.vis, ctx.ceiling),
  };
}

