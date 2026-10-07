import { UTILITIES } from './utilities';
import { HELP } from './help';
import { searchUtilities } from '../utils/searchUtilities';

test('every utility has complete help content', () => {
  UTILITIES.forEach((u) => {
    const h = HELP[u.id];
    expect(h).toBeDefined();
    expect(h.summary).toBeTruthy();
    expect(h.howTo.length).toBeGreaterThan(0);
    expect(h.inputs).toBeTruthy();
    expect(h.outputs).toBeTruthy();
  });
});

test('help has no entries for unknown utilities', () => {
  const ids = new Set(UTILITIES.map((u) => u.id));
  Object.keys(HELP).forEach((id) => expect(ids.has(id)).toBe(true));
});

test('searchUtilities ranks name matches first and hides desktop-only tools in browsers', () => {
  expect(searchUtilities('base64')[0].id).toBe('base64');
  expect(searchUtilities('dns', { isElectron: false }).some((u) => u.id === 'dns-lookup')).toBe(false);
  expect(searchUtilities('dns', { isElectron: true }).some((u) => u.id === 'dns-lookup')).toBe(true);
  expect(searchUtilities('')).toHaveLength(UTILITIES.length);
});
