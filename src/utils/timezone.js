export const COMMON_ZONES = [
  { tz: 'UTC', label: 'UTC' },
  { tz: 'Asia/Dubai', label: 'Dubai / Abu Dhabi (UAE)' },
  { tz: 'Asia/Qatar', label: 'Doha (Qatar)' },
  { tz: 'Asia/Riyadh', label: 'Riyadh (Saudi Arabia)' },
  { tz: 'Asia/Kuwait', label: 'Kuwait' },
  { tz: 'Asia/Bahrain', label: 'Manama (Bahrain)' },
  { tz: 'Asia/Muscat', label: 'Muscat (Oman)' },
  { tz: 'Europe/London', label: 'London' },
  { tz: 'Europe/Paris', label: 'Paris' },
  { tz: 'Europe/Berlin', label: 'Berlin' },
  { tz: 'Europe/Moscow', label: 'Moscow' },
  { tz: 'Europe/Istanbul', label: 'Istanbul' },
  { tz: 'Africa/Cairo', label: 'Cairo' },
  { tz: 'Africa/Johannesburg', label: 'Johannesburg' },
  { tz: 'Africa/Nairobi', label: 'Nairobi' },
  { tz: 'Asia/Karachi', label: 'Karachi' },
  { tz: 'Asia/Kolkata', label: 'Mumbai / Delhi' },
  { tz: 'Asia/Dhaka', label: 'Dhaka' },
  { tz: 'Asia/Bangkok', label: 'Bangkok' },
  { tz: 'Asia/Singapore', label: 'Singapore' },
  { tz: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { tz: 'Asia/Shanghai', label: 'Shanghai' },
  { tz: 'Asia/Tokyo', label: 'Tokyo' },
  { tz: 'Asia/Seoul', label: 'Seoul' },
  { tz: 'Australia/Sydney', label: 'Sydney' },
  { tz: 'Pacific/Auckland', label: 'Auckland' },
  { tz: 'Pacific/Honolulu', label: 'Honolulu' },
  { tz: 'America/Anchorage', label: 'Anchorage' },
  { tz: 'America/Los_Angeles', label: 'Los Angeles' },
  { tz: 'America/Denver', label: 'Denver' },
  { tz: 'America/Chicago', label: 'Chicago' },
  { tz: 'America/New_York', label: 'New York' },
  { tz: 'America/Toronto', label: 'Toronto' },
  { tz: 'America/Sao_Paulo', label: 'São Paulo' },
  { tz: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
];

export function getOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const p = {};
  dtf.formatToParts(date).forEach((x) => {
    p[x.type] = x.value;
  });
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// 'YYYY-MM-DDTHH:mm[:ss]' interpreted as wall-clock time in tz -> Date (absolute instant)
export function zonedToUtc(local, tz) {
  const [d, t = '00:00'] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm, ss = 0] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm, ss);
  const off = getOffsetMs(new Date(guess), tz);
  let utc = guess - off;
  const off2 = getOffsetMs(new Date(utc), tz);
  if (off2 !== off) utc = guess - off2;
  return new Date(utc);
}

export function formatInZone(date, tz, opts = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
    ...opts,
  }).format(date);
}

export function offsetLabel(date, tz) {
  const mins = Math.round(getOffsetMs(date, tz) / 60000);
  const sign = mins < 0 ? '-' : '+';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

export function toLocalInputValue(date, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(date)
    .forEach((x) => {
      p[x.type] = x.value;
    });
  return `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, '0')}:${p.minute}`;
}
