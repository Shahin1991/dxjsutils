import { webcrypto } from 'crypto';
import { diffLines, summarize } from '../utilities/textDiff/utils/diff';
import { generatePassword, entropyBits, SETS } from '../utilities/passwordGenerator/utils/password';
import { jsonToCsv, csvToJson, jsonToYaml, yamlToJson } from '../utilities/jsonConverter/utils/convert';
import { textStats, lorem, formatMinutes } from '../utilities/textStats/utils/stats';
import { decode, parseUrl, encodeComponent } from '../utilities/urlTools/utils/url';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

test('diffLines finds additions, deletions and handles options', () => {
  const rows = diffLines('a\nb\nc', 'a\nc\nd');
  expect(summarize(rows)).toEqual({ same: 2, add: 1, del: 1 });
  expect(summarize(diffLines('Hello', 'hello', { ignoreCase: true })).same).toBe(1);
  expect(summarize(diffLines('a  b', 'a b', { ignoreWhitespace: true })).same).toBe(1);
  expect(diffLines('', '')).toEqual([]);
});

test('generatePassword honours length and character groups', () => {
  const p = generatePassword({ length: 24, symbols: true });
  expect(p).toHaveLength(24);
  expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)).toBe(true);
  expect([...p].some((c) => SETS.symbols.includes(c))).toBe(true);
  expect(/[O0oIl1|]/.test(generatePassword({ length: 200, avoidAmbiguous: true }))).toBe(false);
  expect(() => generatePassword({ lower: false, upper: false, digits: false, symbols: false })).toThrow();
  expect(entropyBits(62, 16)).toBe(95);
});

test('json/csv/yaml conversions round-trip', () => {
  const json = '[{"a":1,"b":{"c":"x,y"}},{"a":2,"b":{"c":"z"}}]';
  const csv = jsonToCsv(json);
  expect(csv).toBe('a,b.c\n1,"x,y"\n2,z');
  expect(JSON.parse(csvToJson(csv))).toEqual([{ a: 1, 'b.c': 'x,y' }, { a: 2, 'b.c': 'z' }]);
  expect(yamlToJson(jsonToYaml('{"k":[1,2],"n":{"x":true}}'))).toBe(JSON.stringify({ k: [1, 2], n: { x: true } }, null, 2));
});

test('textStats and lorem', () => {
  const s = textStats('Hello world. This is a test!\n\nSecond paragraph.');
  expect(s.words).toBe(8);
  expect(s.sentences).toBe(3);
  expect(s.paragraphs).toBe(2);
  expect(textStats('').words).toBe(0);
  expect(lorem('words', 5)).toBe('lorem ipsum dolor sit amet');
  expect(lorem('paragraphs', 2).split('\n\n')).toHaveLength(2);
  expect(formatMinutes(0.5)).toBe('30 sec');
});

test('url helpers', () => {
  expect(encodeComponent('a b&c')).toBe('a%20b%26c');
  expect(decode('a%20b+c')).toBe('a b c');
  expect(() => decode('%E0%A4%A')).toThrow();
  const r = parseUrl('https://u:p@example.com:8080/x/y?q=1&r=a%20b#frag');
  expect(r.parts.Host).toBe('example.com');
  expect(r.params).toEqual([['q', '1'], ['r', 'a b']]);
  expect(() => parseUrl('http://')).toThrow();
});

test('new tools render without crashing', () => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { TextDiff } = require('../utilities/textDiff/TextDiff');
  const { UrlTools } = require('../utilities/urlTools/UrlTools');
  const { JsonConverter } = require('../utilities/jsonConverter/JsonConverter');
  const { PasswordGenerator } = require('../utilities/passwordGenerator/PasswordGenerator');
  const { TextStats } = require('../utilities/textStats/TextStats');
  const { FinanceCalculator } = require('../utilities/financeCalculator/FinanceCalculator');
  [TextDiff, UrlTools, JsonConverter, PasswordGenerator, TextStats, FinanceCalculator].forEach((C) => {
    const el = document.createElement('div');
    act(() => createRoot(el).render(React.createElement(C)));
    expect(el.querySelector('h2').textContent.length).toBeGreaterThan(0);
    expect(el.textContent).not.toMatch(/⚠/);
  });
});

test('InstructionBanner types word by word, loops through the steps and can be hidden', () => {
  jest.useFakeTimers();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  const { InstructionBanner, buildLines } = require('../components/InstructionBanner');
  const { HELP } = require('./help');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: false });
  localStorage.clear();

  const lines = buildLines(HELP.base64);
  expect(lines[0]).toBe(HELP.base64.summary);
  expect(lines[1]).toMatch(/^Step 1: /);

  const el = document.createElement('div');
  act(() => createRoot(el).render(React.createElement(InstructionBanner, { utilityId: 'base64' })));
  const typed = () => el.querySelector('.instr-line').textContent;
  expect(typed()).toBe('');
  const tick = (ms) => act(() => { jest.advanceTimersByTime(ms); });
  for (let i = 0; i < 3; i += 1) tick(90);
  expect(typed().split(' ')).toHaveLength(3);
  expect(HELP.base64.summary.startsWith(typed())).toBe(true);
  // finish the first line, hold, then the next line starts
  for (let i = 0; i < 40; i += 1) tick(90);
  tick(2600);
  tick(90);
  expect(lines[1].startsWith(typed())).toBe(true);
  expect(typed().startsWith('Step')).toBe(true);

  act(() => el.querySelector('.instr-hide').click());
  expect(el.querySelector('.instr-show')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem('hideInstructions'))).toBe(true);
  jest.useRealTimers();
});

test('finance calculators match known financejs results and validate input', () => {
  const { CALCULATORS, defaultValues, runCalculator, parseDatedFlows } = require('../utilities/financeCalculator/utils/calculators');
  const calc = (id, over = {}) => {
    const c = CALCULATORS.find((x) => x.id === id);
    return runCalculator(c, { ...defaultValues(c), ...over });
  };
  const val = (r, label) => r.rows.find((x) => x.label === label).value;

  // Loan: library example 20000 @ 7.5% over 5 years = 400.76/month
  const loan = calc('loan', { principal: '20000', rate: '7.5', term: '5' });
  expect(val(loan, 'Monthly payment')).toBe(400.76);
  expect(loan.table.rows).toHaveLength(60);
  expect(loan.table.rows[59][4]).toBeCloseTo(0, 6);
  expect(val(calc('loan', { rate: '0', principal: '1200', term: '12', unit: 'months' }), 'Monthly payment')).toBe(100);

  expect(val(calc('compound', { rate: '4.3', n: '4', principal: '1500', years: '6' }), 'Final balance')).toBe(1938.84);
  expect(val(calc('npv', { rate: '10', initial: '-500000', flows: '200000, 300000, 200000' }), 'Net present value')).toBe(80015.03);
  expect(val(calc('irr'), 'IRR')).toBeCloseTo(18.83, 1);
  expect(val(calc('roi', { cost: '55000', earnings: '60000' }), 'ROI')).toBe(9.09);
  expect(val(calc('cagr', { start: '10000', end: '19500', years: '3' }), 'CAGR')).toBe(24.93);
  expect(val(calc('rule72', { rate: '10' }), 'Years to double')).toBeCloseTo(7.2, 5);
  expect(val(calc('wacc'), 'WACC')).toBe(4.9);
  expect(val(calc('payback', { initial: '-50', flows: '10, 13, 16, 19, 22' }), 'Payback period')).toBeCloseTo(3.42, 2);
  expect(val(calc('inflation', { ret: '8', infl: '3' }), 'Real return')).toBeCloseTo(4.85, 2);
  expect(val(calc('xirr', { flows: '2015-12-01, -1000\n2016-08-01, -100\n2016-08-19, 1200' }), 'XIRR (annualised)')).toBeCloseTo(14.11, 1);
  expect(val(calc('xirr'), 'XIRR (annualised)')).toBeGreaterThan(0);

  // Bad input gives a message, never a crash or a hang
  expect(calc('loan', { principal: 'abc' }).error).toMatch(/must be a number/);
  expect(calc('irr', { initial: '100', flows: '200' }).error).toMatch(/positive value and one negative/);
  expect(calc('irr', { flows: '100, 200' }).error).toMatch(/No IRR found/);
  expect(calc('payback', { initial: '-50', flows: '0' }).error).toBeTruthy();
  expect(calc('cagr', { start: '0' }).error).toMatch(/greater than 0/);
  expect(() => parseDatedFlows('nonsense')).toThrow();
});
