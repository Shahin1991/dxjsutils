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
  [TextDiff, UrlTools, JsonConverter, PasswordGenerator, TextStats].forEach((C) => {
    const el = document.createElement('div');
    act(() => createRoot(el).render(React.createElement(C)));
    expect(el.querySelector('h2').textContent.length).toBeGreaterThan(0);
    expect(el.textContent).not.toMatch(/⚠/);
  });
});
