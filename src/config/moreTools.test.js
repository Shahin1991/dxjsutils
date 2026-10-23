import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
import { convert, formatNumber } from '../utilities/unitConverter/utils/units';
import { CALCULATORS, runCalc } from '../utilities/percentageCalculator/utils/percent';
import { formatDuration, parseDuration } from '../utilities/stopwatch/utils/time';
import { parsePageRanges } from '../utilities/pdfTools/utils/pages';
import { applyOperation, joinLines, splitToLines, wrapLines } from '../utilities/lineTools/utils/lines';
import { ENCODERS } from '../utilities/textEncoders/utils/encoders';
import { jsonToTs } from '../utilities/jsonToTypescript/utils/toTs';
import { fromOctal, fromSymbolic, toOctal, toSymbolic } from '../utilities/chmodCalculator/utils/chmod';
import { addWorkingDays, countWorkingDays, parseDate, parseExtraOff, toISO } from '../utilities/workingDays/utils/workdays';
import { ALGOS, hmac } from '../utilities/hmacGenerator/utils/hmac';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.assign(globalThis, { TextEncoder, TextDecoder });

test('unit conversions', () => {
  expect(formatNumber(convert('length', 1, 'km', 'mi'))).toBe('0.6213711922');
  expect(convert('temperature', 100, 'c', 'f')).toBeCloseTo(212);
  expect(convert('temperature', 32, 'f', 'k')).toBeCloseTo(273.15);
  expect(convert('speed', 1, 'kn', 'kmh')).toBeCloseTo(1.852);
  expect(convert('data', 1, 'GiB', 'MB')).toBeCloseTo(1073.741824);
  expect(convert('pressure', 1013.25, 'hpa', 'inhg')).toBeCloseTo(29.92, 2);
  expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  expect(formatNumber(NaN)).toBe('—');
});

test('percentage and VAT calculators', () => {
  const run = (id, v) => runCalc(CALCULATORS.find((c) => c.id === id), v);
  expect(run('of', { p: '15', y: '200' }).result).toBe(30);
  expect(run('is-what', { x: '30', y: '120' }).result).toBe('25%');
  expect(run('change', { from: '80', to: '100' }).result).toBe('+25%');
  expect(run('change', { from: '100', to: '80' }).result).toBe('-20%');
  expect(run('vat-add', { amount: '1,000', rate: '5' }).result).toBe(1050);
  expect(run('vat-remove', { amount: '1050', rate: '5' }).result).toBe(1000);
  expect(run('discount', { price: '250', p: '20' }).result).toBe(200);
  expect(run('margin', { cost: '60', price: '100' }).detail).toMatch(/markup 66.67%/);
  expect(run('of', { p: 'x', y: '1' }).error).toMatch(/must be a number/);
  expect(run('is-what', { x: '1', y: '0' }).error).toBeTruthy();
});

test('duration formatting and parsing', () => {
  expect(formatDuration(3723456)).toBe('01:02:03.45');
  expect(formatDuration(65000, { centis: false })).toBe('01:05');
  expect(parseDuration('25')).toBe(25 * 60000);
  expect(parseDuration('1:30')).toBe(90000);
  expect(parseDuration('1:00:00')).toBe(3600000);
  expect(parseDuration('abc')).toBeNull();
});

test('pdf page ranges', () => {
  expect(parsePageRanges('1-3, 5', 10)).toEqual([0, 1, 2, 4]);
  expect(parsePageRanges('8-', 10)).toEqual([7, 8, 9]);
  expect(parsePageRanges('3-1', 5)).toEqual([2, 1, 0]);
  expect(() => parsePageRanges('11', 10)).toThrow(/outside/);
  expect(() => parsePageRanges('a', 10)).toThrow();
  expect(() => parsePageRanges('', 10)).toThrow();
});

test('pdf merge, extract, remove and rotate', async () => {
  const { PDFDocument } = require('pdf-lib');
  const { mergePdfs, extractPages, removePages, rotatePages, pdfInfo } = require('../utilities/pdfTools/utils/pdf');
  const make = async (n) => {
    const d = await PDFDocument.create();
    for (let i = 0; i < n; i += 1) d.addPage([100 + i, 100]);
    return d.save();
  };
  const a = await make(3);
  const b = await make(2);
  expect((await pdfInfo(await mergePdfs([a, b]))).pages).toBe(5);
  const ex = await PDFDocument.load(await extractPages(a, [2, 0]));
  expect(ex.getPages().map((p) => p.getWidth())).toEqual([102, 100]);
  expect((await pdfInfo(await removePages(a, [1]))).pages).toBe(2);
  await expect(removePages(a, [0, 1, 2])).rejects.toThrow(/every page/);
  const rot = await PDFDocument.load(await rotatePages(a, [0], 90));
  expect(rot.getPage(0).getRotation().angle).toBe(90);
  await expect(pdfInfo(new Uint8Array([1, 2, 3]))).rejects.toThrow(/could not be read/);
});

test('line tools', () => {
  expect(applyOperation('b\na\nitem10\nitem2', 'sortAsc')).toBe('a\nb\nitem2\nitem10');
  expect(applyOperation('a\nA\nb\na', 'unique', { ignoreCase: true })).toBe('a\nb');
  expect(applyOperation('a\nA\nb\na', 'unique', { ignoreCase: false })).toBe('a\nA\nb');
  expect(applyOperation('a\nb\na\nc\nb', 'duplicates')).toBe('a\nb');
  expect(applyOperation('a\n\n  \nb', 'removeEmpty')).toBe('a\nb');
  expect(applyOperation('x\ny', 'number')).toBe('1. x\n2. y');
  expect(wrapLines('a\n\nb', { prefix: '<', suffix: '>' })).toBe('<a>\n\n<b>');
  expect(joinLines('a\n b \n\nc', { delimiter: ', ', quote: "'" })).toBe("'a', 'b', 'c'");
  expect(splitToLines('a, b,c', ',')).toBe('a\nb\nc');
});

test('text encoders round-trip and reject bad input', () => {
  Object.entries(ENCODERS).forEach(([id, e]) => {
    const back = e.decode(e.encode(e.sample));
    const expected = id === 'morse' || id === 'nato' ? e.sample.toUpperCase() : e.sample;
    expect(back).toBe(expected);
  });
  expect(ENCODERS.html.encode('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
  expect(ENCODERS.html.decode('&#169; &#x1F680; &euro; &bogus;')).toBe('© 🚀 € &bogus;');
  expect(ENCODERS.hex.encode('é')).toBe('c3 a9');
  expect(ENCODERS.hex.decode('0x48 0x69')).toBe('Hi');
  expect(ENCODERS.nato.encode('AB 2')).toBe('Alfa Bravo / Two');
  expect(ENCODERS.nato.decode('alpha x-ray')).toBe('AX');
  expect(ENCODERS.morse.encode('SOS')).toBe('... --- ...');
  expect(() => ENCODERS.hex.decode('zz')).toThrow();
  expect(() => ENCODERS.binary.decode('11111111')).toThrow(/UTF-8/);
  expect(() => ENCODERS.morse.decode('.-.-.-.-')).toThrow(/Unknown/);
  expect(() => ENCODERS.json.decode('bad \\q')).toThrow();
});

test('hmac matches RFC 4231 test case 2', () => {
  const sha256 = ALGOS.find(([n]) => n === 'HMAC-SHA256')[1];
  expect(hmac(sha256, 'what do ya want for nothing?', 'Jefe')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  expect(hmac(sha256, 'what do ya want for nothing?', '4a656665', { keyHex: true })).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  expect(hmac(sha256, 'x', 'k', { output: 'base64' })).toMatch(/=$/);
  expect(() => hmac(sha256, 'x', 'zz', { keyHex: true })).toThrow(/hex/);
});

test('text encryption round-trips and detects wrong passphrase', async () => {
  const { encryptText, decryptText } = require('../utilities/textEncryption/utils/aes');
  const c = await encryptText('Secret ☕ مرحبا', 'correct horse');
  expect(c).not.toContain('Secret');
  expect(await decryptText(c, 'correct horse')).toBe('Secret ☕ مرحبا');
  expect(await encryptText('same', 'p')).not.toBe(await encryptText('same', 'p'));
  await expect(decryptText(c, 'wrong')).rejects.toThrow(/Wrong passphrase/);
  await expect(decryptText('not base64!!', 'p')).rejects.toThrow();
  await expect(decryptText('aGVsbG8=', 'p')).rejects.toThrow(/does not look like/);
  await expect(encryptText('x', '')).rejects.toThrow(/passphrase/);
});

test('json to typescript', () => {
  const ts = jsonToTs('{"id":1,"name":"a","tags":["x"],"owner":{"email":"e"},"items":[{"a":1},{"a":2,"b":null}],"bad-key":true}');
  expect(ts).toMatch(/export interface Root \{/);
  expect(ts).toMatch(/id: number;/);
  expect(ts).toMatch(/tags: string\[\];/);
  expect(ts).toMatch(/owner: Owner;/);
  expect(ts).toMatch(/items: Item\[\];/);
  expect(ts).toMatch(/b\?: null;/);
  expect(ts).toMatch(/"bad-key": boolean;/);
  expect(ts.indexOf('interface Root')).toBe(ts.indexOf('export interface') + 'export '.length);
  expect(jsonToTs('[1,"a"]')).toBe('export type RootList = (number | string)[];');
  expect(jsonToTs('{"x":null}', { optionalNulls: true, useType: true })).toMatch(/export type Root = \{\n {2}x: null;/);
  expect(jsonToTs('{"x":[]}')).toMatch(/x: unknown\[\];/);
  expect(() => jsonToTs('{bad')).toThrow();
});

test('chmod conversions', () => {
  const s = fromOctal('755');
  expect(toSymbolic(s.perms, s.special)).toBe('rwxr-xr-x');
  expect(toOctal(fromSymbolic('-rw-r--r--').perms)).toBe('644');
  const t = fromOctal('1777');
  expect(toSymbolic(t.perms, t.special)).toBe('rwxrwxrwt');
  expect(toOctal(t.perms, t.special)).toBe('1777');
  const g = fromSymbolic('rwxr-Sr--');
  expect(toOctal(g.perms, g.special)).toBe('2744');
  expect(() => fromOctal('8')).toThrow();
  expect(() => fromSymbolic('rwx')).toThrow();
});

test('working days skip weekends and UAE holidays', () => {
  const d = parseDate;
  // Mon 1 Dec 2025 – Fri 5 Dec 2025, with National Day on Tue 2 and Wed 3
  const week = countWorkingDays(d('2025-12-01'), d('2025-12-07'));
  expect(week).toMatchObject({ total: 7, weekend: 2, working: 3 });
  expect(week.holidays.map(([x]) => x)).toEqual(['2025-12-02', '2025-12-03']);
  expect(countWorkingDays(d('2025-12-01'), d('2025-12-07'), { holidays: false }).working).toBe(5);
  expect(countWorkingDays(d('2025-12-07'), d('2025-12-01'), { holidays: false }).working).toBe(5);
  expect(countWorkingDays(d('2025-12-01'), d('2025-12-07'), { holidays: false, weekend: [5, 6] }).working).toBe(5);
  expect(countWorkingDays(d('2025-12-01'), d('2025-12-01'), { extraOff: ['2025-12-01'] }).leave).toBe(1);
  // Thu 27 Nov 2025 + 3 working days: Fri 28, Mon 1, (skip Tue 2/Wed 3), Thu 4
  expect(toISO(addWorkingDays(d('2025-11-27'), 3).date)).toBe('2025-12-04');
  expect(toISO(addWorkingDays(d('2025-12-04'), -3).date)).toBe('2025-11-27');
  expect(toISO(addWorkingDays(d('2025-12-04'), 0).date)).toBe('2025-12-04');
  expect(() => addWorkingDays(d('2025-12-04'), 1, { weekend: [0, 1, 2, 3, 4, 5, 6] })).toThrow();
  expect(d('2025-02-30')).toBeNull();
  expect(() => parseExtraOff('2025-12-01, nope')).toThrow(/nope/);
});

test('new tools render without crashing', () => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const tools = [
    require('../utilities/unitConverter/UnitConverter').UnitConverter,
    require('../utilities/percentageCalculator/PercentageCalculator').PercentageCalculator,
    require('../utilities/stopwatch/Stopwatch').Stopwatch,
    require('../utilities/workingDays/WorkingDays').WorkingDays,
    require('../utilities/lineTools/LineTools').LineTools,
    require('../utilities/jsonToTypescript/JsonToTypescript').JsonToTypescript,
    require('../utilities/chmodCalculator/ChmodCalculator').ChmodCalculator,
    require('../utilities/textEncoders/TextEncoders').TextEncoders,
    require('../utilities/hmacGenerator/HmacGenerator').HmacGenerator,
    require('../utilities/textEncryption/TextEncryption').TextEncryption,
    require('../utilities/httpStatusCodes/HttpStatusCodes').HttpStatusCodes,
    require('../utilities/pdfTools/PdfTools').PdfTools,
  ];
  tools.forEach((C) => {
    const el = document.createElement('div');
    act(() => createRoot(el).render(React.createElement(C)));
    expect(el.querySelector('h2').textContent.length).toBeGreaterThan(0);
    expect(el.textContent).not.toMatch(/⚠/);
  });
});

test('line tools buttons transform the input', () => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { LineTools } = require('../utilities/lineTools/LineTools');
  const el = document.createElement('div');
  act(() => createRoot(el).render(React.createElement(LineTools)));
  const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Remove duplicates');
  act(() => btn.click());
  expect(el.querySelector('pre').textContent).toBe('banana\nApple\ncherry\n\n  date  \nitem10\nitem2');
});
