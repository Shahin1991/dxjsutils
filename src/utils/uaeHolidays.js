// UAE public holidays, shared by Calendar and Working Days Calculator.
const FIXED_HOLIDAYS = { '1-1': "New Year's Day", '12-2': 'UAE National Day', '12-3': 'UAE National Day' };

const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric' });

// UAE Islamic holidays derived from the Umm al-Qura calendar (dates may shift by a day with moon sighting).
function islamicHoliday(date) {
  const p = {};
  hijriFmt.formatToParts(date).forEach((x) => {
    p[x.type] = parseInt(x.value, 10);
  });
  const { month: m, day: d } = p;
  if (m === 1 && d === 1) return 'Islamic New Year';
  if (m === 3 && d === 12) return "Prophet's Birthday";
  if (m === 10 && d <= 3) return 'Eid Al Fitr';
  if (m === 12 && d === 9) return 'Arafat Day';
  if (m === 12 && d >= 10 && d <= 12) return 'Eid Al Adha';
  return null;
}

export function holidayFor(date) {
  return FIXED_HOLIDAYS[`${date.getMonth() + 1}-${date.getDate()}`] || islamicHoliday(date);
}
