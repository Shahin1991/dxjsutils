import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.assign(globalThis, { TextEncoder, TextDecoder });

const { columnName, exportSheet, readWorkbook, sheetRows, workbookFromText, workbookToXlsx } = require('../utilities/spreadsheetViewer/utils/sheet');
const { displayToUser, displaySize } = require('../utilities/pdfSign/utils/place');
const jwt = require('../utilities/jwtEncoder/utils/jwt');
const { diffJson } = require('../utilities/jsonDiff/utils/jsonDiff');
const { queryJson, queryXml } = require('../utilities/jsonPathTester/utils/query');
const { decodeMetar, decodeWeather, flightCategory } = require('../utilities/metarDecoder/utils/metar');
const { decodeBcbp, julianToDate } = require('../utilities/boardingPass/utils/bcbp');
const { SAMPLE: BCBP_SAMPLE } = require('../utilities/boardingPass/BoardingPass');
const { checksums, crc32, normalizeHash } = require('../utilities/fileChecksum/utils/checksum');
const zones = require('../utilities/meetingPlanner/utils/zones');
const exif = require('../utilities/imageMetadata/utils/exif');
const { buildSrcdoc } = require('../utilities/codePlayground/utils/srcdoc');
const totpLib = require('../utilities/totpGenerator/utils/totp');
const bc = require('../utilities/bcryptTool/utils/bcrypt');
const mm = require('../utilities/mindMap/utils/mindmap');

test('spreadsheet: create, read back and export', () => {
  expect([0, 25, 26, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  const wb = workbookFromText('[{"flight":"XX202","pax":489,"meta":{"a":1}},{"flight":"XX001","pax":517}]');
  const back = readWorkbook(new Uint8Array(workbookToXlsx(wb)));
  expect(sheetRows(back, back.SheetNames[0])).toEqual([['flight', 'pax', 'meta'], ['XX202', '489', '{"a":1}'], ['XX001', '517', '']]);
  expect(exportSheet(back, back.SheetNames[0], 'csv').data).toBe('flight,pax,meta\nXX202,489,"{""a"":1}"\nXX001,517,');
  expect(JSON.parse(exportSheet(back, back.SheetNames[0], 'json').data)[1]).toEqual({ flight: 'XX001', pax: 517, meta: null });
  expect(sheetRows(workbookFromText('a,b\n1,2'), 'Sheet1')).toEqual([['a', 'b'], ['1', '2']]);
  expect(sheetRows(workbookFromText('[[1,2],[3,4]]'), 'Sheet1')).toEqual([['1', '2'], ['3', '4']]);
  expect(() => workbookFromText('[1,2]')).toThrow(/array of objects/);
  expect(() => workbookFromText('{bad')).toThrow(/Invalid JSON/);
  expect(() => workbookFromText('  ')).toThrow();
});

test('pdf sign: display→user coordinates for every page rotation', () => {
  const box = { W: 600, H: 800 };
  const corners = (rotation) => {
    const { width, height } = displaySize({ ...box, rotation });
    return [[0, 0], [width, 0], [0, height]].map(([x, y]) => displayToUser(x, y, { ...box, rotation }));
  };
  // Display top-left, top-right, bottom-left map to the expected page corners.
  expect(corners(0)).toEqual([{ x: 0, y: 800 }, { x: 600, y: 800 }, { x: 0, y: 0 }]);
  expect(corners(90)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 800 }, { x: 600, y: 0 }]);
  expect(corners(180)).toEqual([{ x: 600, y: 0 }, { x: 0, y: 0 }, { x: 600, y: 800 }]);
  expect(corners(270)).toEqual([{ x: 600, y: 800 }, { x: 600, y: 0 }, { x: 0, y: 800 }]);
  expect(displayToUser(10, 10, { x0: 50, y0: 20, ...box })).toEqual({ x: 60, y: 810 });
});

test('pdf sign: stamps text and images, fills and flattens forms', async () => {
  const { PDFDocument, degrees } = require('pdf-lib');
  const { applyToPdf, readForm } = require('../utilities/pdfSign/utils/sign');
  const doc = await PDFDocument.create();
  const p1 = doc.addPage([600, 800]);
  doc.addPage([600, 800]).setRotation(degrees(90));
  const form = doc.getForm();
  form.createTextField('name').addToPage(p1, { x: 50, y: 700, width: 200, height: 20 });
  form.createCheckBox('agree').addToPage(p1, { x: 50, y: 650, width: 15, height: 15 });
  form.createDropdown('cabin').addOptions(['Economy', 'Business']);
  const bytes = await doc.save();

  const info = await readForm(bytes);
  expect(info.pages).toBe(2);
  expect(info.fields.map((f) => [f.name, f.type])).toEqual([['name', 'text'], ['agree', 'checkbox'], ['cabin', 'select']]);

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const out = await applyToPdf(bytes, {
    items: [
      { page: 0, kind: 'text', text: 'Jane Doe', x: 0.1, y: 0.1, size: 0.02 },
      { page: 1, kind: 'image', src: png, x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
      { page: 0, kind: 'text', text: 'مرحبا', x: 0.1, y: 0.2, size: 0.02, fallbackSrc: png, w: 0.1, h: 0.02 },
    ],
    fields: [{ name: 'name', type: 'text', value: 'Jane' }, { name: 'agree', type: 'checkbox', value: true }, { name: 'cabin', type: 'select', value: 'Business' }],
  });
  const filled = (await readForm(out)).fields;
  expect(filled.find((f) => f.name === 'name').value).toBe('Jane');
  expect(filled.find((f) => f.name === 'agree').value).toBe(true);
  expect(filled.find((f) => f.name === 'cabin').value).toBe('Business');
  expect((await readForm(await applyToPdf(bytes, { fields: [{ name: 'name', type: 'text', value: 'x' }], flatten: true }))).fields).toHaveLength(0);
  await expect(applyToPdf(bytes, { items: [{ page: 0, kind: 'text', text: 'مرحبا', x: 0, y: 0, size: 0.02 }] })).rejects.toThrow(/built-in PDF font/);
  await expect(readForm(new Uint8Array([1, 2, 3]))).rejects.toThrow(/could not be read/);
});

test('jwt: matches the jwt.io HS256 example, round-trips RS/PS/ES and rejects tampering', async () => {
  const token = await jwt.signJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '1234567890', name: 'John Doe', iat: 1516239022 }, 'your-256-bit-secret');
  expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  expect((await jwt.verifyJwt(token, 'your-256-bit-secret')).valid).toBe(true);
  expect((await jwt.verifyJwt(token, 'wrong')).valid).toBe(false);
  for (const alg of ['RS256', 'PS256', 'ES256', 'ES384']) {
    // eslint-disable-next-line no-await-in-loop
    const keys = await jwt.generateKeyPair(alg);
    // eslint-disable-next-line no-await-in-loop
    const t = await jwt.signJwt({ alg, typ: 'JWT' }, { sub: 'x', exp: 1 }, keys.privateKey);
    // eslint-disable-next-line no-await-in-loop
    const r = await jwt.verifyJwt(t, keys.publicKey);
    expect(r.valid).toBe(true);
    const [h, , s] = t.split('.');
    const forged = `${h}.${jwt.b64url(new TextEncoder().encode('{"sub":"admin"}'))}.${s}`;
    // eslint-disable-next-line no-await-in-loop
    expect((await jwt.verifyJwt(forged, keys.publicKey)).valid).toBe(false);
  }
  expect(jwt.claimStatus({ exp: 100 }, 200).ok).toBe(false);
  expect(jwt.claimStatus({ nbf: 300 }, 200).ok).toBe(false);
  expect(jwt.claimStatus({}, 200).text).toMatch(/No expiry/);
  await expect(jwt.signJwt({ alg: 'RS256' }, {}, '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----')).rejects.toThrow(/PKCS#8/);
  await expect(jwt.verifyJwt('a.b', 'k')).rejects.toThrow(/three parts/);
  expect((await jwt.verifyJwt(`${jwt.b64url(new TextEncoder().encode('{"alg":"none"}'))}.e30.`, 'k')).valid).toBe(false);
});

test('json diff', () => {
  const a = { a: 1, b: { c: 'x' }, list: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }], arr: [1, 2], 'odd key': true };
  const b = { a: 2, b: { c: 'X', d: null }, list: [{ id: 2, v: 'b' }, { id: 1, v: 'z' }], arr: [1], 'odd key': true };
  const changes = diffJson(a, b, { arrayKey: 'id' }).map((c) => `${c.op} ${c.path}`);
  expect(changes).toEqual(['changed $.a', 'changed $.b.c', 'added $.b.d', 'changed $.list[id=1].v', 'removed $.arr[1]']);
  expect(diffJson(a, b, { arrayKey: 'id', ignoreCase: true }).some((c) => c.path === '$.b.c')).toBe(false);
  expect(diffJson(a, b).filter((c) => c.path.startsWith('$.list')).length).toBe(4);
  expect(diffJson({ x: [1] }, { x: { 0: 1 } })).toEqual([{ op: 'changed', path: '$.x', before: [1], after: { 0: 1 } }]);
  expect(diffJson({ 'a b': 1 }, {})[0].path).toBe('$["a b"]');
  expect(diffJson({ q: 1 }, { q: 1 })).toEqual([]);
});

test('jsonpath and xpath queries', () => {
  const doc = JSON.stringify({ store: { book: [{ t: 'A', p: 8 }, { t: 'B', p: 22 }] } });
  expect(queryJson(doc, '$.store.book[?(@.p < 15)].t').map((m) => m.value)).toEqual(['A']);
  expect(queryJson(doc, '$..p').map((m) => m.value)).toEqual([8, 22]);
  expect(queryJson(doc, '$.store.book[1].t')[0].path).toBe("$['store']['book'][1]['t']");
  expect(() => queryJson('{', '$')).toThrow(/Invalid JSON/);
  expect(() => queryJson(doc, '$..[?(@.constructor.constructor("return 1")())]')).toThrow();
  const xml = '<f><flight no="XX1"><pax>5</pax></flight><flight no="XX2"><pax>7</pax></flight></f>';
  expect(queryXml(xml, '//flight/@no').map((m) => m.value)).toEqual(['XX1', 'XX2']);
  expect(queryXml(xml, '//flight/@no')[1].path).toBe('/f/flight[2]/@no');
  expect(queryXml(xml, 'sum(//pax)')[0].value).toBe(12);
  expect(queryXml(xml, '//flight[pax > 6]')[0].value).toBe('<flight no="XX2"><pax>7</pax></flight>');
  expect(() => queryXml('<a>', '/a')).toThrow(/Invalid XML/);
  expect(() => queryXml(xml, '//[')).toThrow(/Invalid XPath/);
});

test('metar and taf decoding', () => {
  const m = decodeMetar('METAR OMDB 170600Z 32012G22KT 280V350 6000 -TSRA FEW035 BKN008CB 33/18 Q1008 NOSIG');
  const get = (label) => m.rows.filter((r) => r[0] === label).map((r) => r[1]);
  expect(m.station).toBe('OMDB');
  expect(m.time).toBe('Day 17 of the month at 06:00 UTC');
  expect(get('Wind')).toEqual(['From 320° at 12 kt, gusting 22 kt']);
  expect(get('Wind variation')).toEqual(['Varying between 280° and 350°']);
  expect(get('Visibility')).toEqual(['6 km (6000 m)']);
  expect(get('Weather')).toEqual(['Light thunderstorm with rain']);
  expect(get('Cloud')).toEqual(['Few (1–2 oktas) at 3,500 ft', 'Broken (5–7 oktas) at 800 ft cumulonimbus']);
  expect(get('Temperature')[0]).toMatch(/^33 °C, dew point 18 °C \(humidity ≈ 41%\)$/);
  expect(get('Pressure (QNH)')).toEqual(['1008 hPa (29.77 inHg)']);
  expect(m.category.code).toBe('IFR');
  expect(m.rows.some((r) => r[0] === 'Not decoded')).toBe(false);

  const us = decodeMetar('KJFK 170551Z 21016KT 1 1/2SM BR OVC004 M02/M03 A2981 RMK AO2');
  expect(us.rows.find((r) => r[0] === 'Visibility')[1]).toBe('1 1/2 statute miles');
  expect(us.rows.find((r) => r[0] === 'Temperature')[1]).toMatch(/^-2 °C, dew point -3 °C/);
  expect(us.remarks).toBe('AO2');
  expect(us.category.code).toBe('LIFR');
  expect(decodeMetar('OMDB 170600Z 00000KT CAVOK 30/10 Q1012').category.code).toBe('VFR');
  expect(decodeMetar('OMDB 170600Z 00000KT 9999 FOO Q1012').rows.find((r) => r[0] === 'Not decoded')[1]).toBe('FOO');

  const taf = decodeMetar('TAF OMDB 170500Z 1706/1812 34010KT 6000 NSC BECMG 1709/1711 30015G25KT 4000 DU TEMPO 1712/1716 2000 BLSA PROB30 TEMPO 1801/1805 1500 BR FM180800 10008KT 9999 FEW040');
  expect(taf.type).toBe('TAF');
  expect(taf.rows[0]).toEqual(['Valid', 'From day 17 06:00 UTC to day 18 12:00 UTC']);
  expect(taf.groups.map((g) => g.rows[0][1])).toEqual([
    'Becoming (from day 17 09:00 utc to day 17 11:00 utc)',
    'Temporarily (from day 17 12:00 utc to day 17 16:00 utc)',
    '30% chance of temporary (from day 18 01:00 utc to day 18 05:00 utc)',
    'From day 18 at 08:00 UTC, conditions become',
  ]);
  expect(taf.groups[1].rows.find((r) => r[0] === 'Weather')[1]).toBe('Blowing sand');
  expect(decodeWeather('VCSH')).toBe('In the vicinity: showers of');
  expect(decodeWeather('RERA')).toBe('Recent rain');
  expect(flightCategory(undefined, undefined)).toBeNull();
  expect(() => decodeMetar('')).toThrow();
  expect(() => decodeMetar('hello world')).toThrow(/ICAO/);
});

test('boarding pass (BCBP) decoding', () => {
  const ref = new Date(Date.UTC(2026, 9, 17));
  const d = decodeBcbp(BCBP_SAMPLE, ref);
  const leg = Object.fromEntries(d.legs[0].map((f) => [f.label, f.text]));
  expect(d.header.find((f) => f.label === 'Passenger name').text).toBe('JOHN MR SMITH');
  expect(leg['Booking reference (PNR)']).toBe('ABC123');
  expect([leg.From, leg.To, leg.Flight, leg.Seat]).toEqual(['DXB', 'LHR', 'XX 1', '34A']);
  expect(leg['Date of flight']).toBe('Day 290 of the year (≈ 17 Oct 2026)');
  expect(leg.Cabin).toBe('Y – Economy');
  expect(leg['Frequent flyer number']).toBe('XX123456789');
  expect(leg['Free baggage allowance']).toBe('30 kg');
  expect(d.version).toBe('6');
  expect(d.unique.find((f) => f.label === 'Checked in via').text).toBe('Web');
  expect(julianToDate('001', new Date(Date.UTC(2026, 11, 30))).getUTCFullYear()).toBe(2027);
  expect(() => decodeBcbp('hello')).toThrow(/Too short/);
  expect(() => decodeBcbp(`X${BCBP_SAMPLE.slice(1)}`)).toThrow(/starts with M/);
});

test('file checksums', async () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe('cbf43926');
  const h = await checksums(new TextEncoder().encode('abc'));
  expect(h.MD5).toBe('900150983cd24fb0d6963f7d28e17f72');
  expect(h['SHA-1']).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  expect(h['SHA-256']).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(normalizeHash(' BA:78:16 ')).toBe('ba7816');
  expect(normalizeHash('unrecognisable!')).toBeNull();
  expect(normalizeHash('q83v')).toBe('abcdef');
});

test('meeting planner time zones', () => {
  const day = '2026-03-29'; // Europe switches to summer time this day
  const midnight = zones.zoneMidnight(day, 'Asia/Dubai');
  expect(midnight.toISOString()).toBe('2026-03-28T20:00:00.000Z');
  expect(zones.zoneOffset(new Date('2026-07-01T00:00:00Z'), 'Europe/London')).toBe(60);
  expect(zones.zoneOffset(new Date('2026-01-01T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
  const grid = zones.buildGrid('2026-10-20', ['Asia/Dubai', 'Europe/London'], { start: 9, end: 18 });
  expect(grid).toHaveLength(24);
  expect(grid[13].cells.map((c) => c.hour)).toEqual([13, 10]);
  expect(grid.filter((r) => r.allWork).map((r) => r.cells[0].hour)).toEqual([12, 13, 14, 15, 16, 17]);
  expect(zones.classify(10, 'Fri', { weekend: zones.weekendFor('Asia/Riyadh') })).toBe('edge');
  expect(zones.classify(10, 'Fri', { weekend: zones.weekendFor('Asia/Dubai') })).toBe('work');
  expect(zones.cityOf('America/New_York')).toBe('New York');
});

// Builds a tiny JPEG: SOI, APP1(EXIF with Make, Orientation=6 and GPS), APP13, SOS + data, EOI.
function makeJpeg() {
  const tiff = [];
  const u16 = (v) => tiff.push((v >> 8) & 255, v & 255);
  const u32 = (v) => tiff.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  tiff.push(0x4d, 0x4d, 0, 0x2a); u32(8);
  // IFD0 at 8: 3 entries (Make, Orientation, GPS pointer)
  u16(3);
  u16(0x010f); u16(2); u32(6); u32(50); // "Canon\0" at 50
  u16(0x0112); u16(3); u32(1); u16(6); u16(0);
  u16(0x8825); u16(4); u32(1); u32(56);
  u32(0);
  while (tiff.length < 50) tiff.push(0);
  tiff.push(...[...'Canon'].map((c) => c.charCodeAt(0)), 0);
  // GPS IFD at 56: LatRef N, Lat 25/1 12/1 0/1, LonRef E, Lon 55/1 18/1 0/1
  u16(4);
  u16(1); u16(2); u32(2); tiff.push(78, 0, 0, 0);
  u16(2); u16(5); u32(3); u32(120);
  u16(3); u16(2); u32(2); tiff.push(69, 0, 0, 0);
  u16(4); u16(5); u32(3); u32(144);
  u32(0);
  while (tiff.length < 120) tiff.push(0);
  [25, 1, 12, 1, 0, 1, 55, 1, 18, 1, 0, 1].forEach(u32);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const seg = (m, data) => [0xff, m, ((data.length + 2) >> 8) & 255, (data.length + 2) & 255, ...data];
  return new Uint8Array([0xff, 0xd8, ...seg(0xe0, [74, 70, 73, 70, 0]), ...seg(0xe1, app1), ...seg(0xed, [1, 2, 3]), 0xff, 0xda, 0, 2, 9, 9, 9, 0xff, 0xd9]);
}

test('image metadata read and lossless strip', () => {
  const jpg = makeJpeg();
  const info = exif.readMetadata(jpg);
  expect(info.format).toBe('JPEG');
  expect(info.rows.find((r) => r.label === 'Camera make').value).toBe('Canon');
  expect(info.rows.find((r) => r.label === 'Orientation').value).toBe('Rotated 90° clockwise');
  expect(info.location.lat).toBeCloseTo(25.2, 5);
  expect(info.location.lon).toBeCloseTo(55.3, 5);
  expect(info.blocks).toEqual(expect.arrayContaining(['EXIF', 'IPTC / Photoshop']));
  const clean = exif.stripMetadata(jpg);
  const after = exif.readMetadata(clean);
  expect(after.location).toBeFalsy();
  expect(after.rows.map((r) => r.label)).toEqual(['Orientation']);
  expect(after.blocks).toEqual(['EXIF']);
  expect([...clean.slice(-9)]).toEqual([...jpg.slice(-9)]); // image data copied untouched

  const chunk = (type, data) => [0, 0, 0, data.length, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', Array(13).fill(0)), ...chunk('tEXt', [...'Author\0Jane'].map((c) => c.charCodeAt(0))), ...chunk('IDAT', [1, 2]), ...chunk('IEND', [])]);
  expect(exif.readMetadata(png).rows).toEqual([{ label: 'Author', value: 'Jane' }]);
  const pclean = exif.stripMetadata(png);
  expect(exif.readMetadata(pclean).rows).toEqual([]);
  expect(pclean.length).toBe(png.length - (12 + 11));
  expect(exif.readMetadata(new Uint8Array([1, 2, 3]))).toBeNull();
});

test('code playground escapes closing tags', () => {
  const html = buildSrcdoc({ html: '<p>x</p>', css: 'a{}</style><b>', js: 'console.log("</script><img>")' }, 'tok');
  expect(html.match(/<\/script>/g)).toHaveLength(2);
  expect(html.match(/<\/style>/g)).toHaveLength(1);
  expect(html).toContain('"tok"');
});

test('totp matches RFC 6238 test vectors', async () => {
  const key = new TextEncoder().encode('12345678901234567890');
  expect(await totpLib.totp(key, { time: 59000, digits: 8 })).toBe('94287082');
  expect(await totpLib.totp(key, { time: 1111111109000, digits: 8 })).toBe('07081804');
  const k256 = new TextEncoder().encode('12345678901234567890123456789012');
  expect(await totpLib.totp(k256, { time: 59000, digits: 8, algorithm: 'SHA-256' })).toBe('46119246');
  expect(totpLib.base32Encode(totpLib.base32Decode('JBSWY3DPEHPK3PXP'))).toBe('JBSWY3DPEHPK3PXP');
  expect(() => totpLib.base32Decode('abc1')).toThrow(/Base32/);
  const uri = totpLib.buildOtpauth({ secret: 'JBSWY3DPEHPK3PXP', issuer: 'ACME Co', account: 'jane@x.com', digits: 8, algorithm: 'SHA-256' });
  expect(totpLib.parseOtpauth(uri)).toEqual({ secret: 'JBSWY3DPEHPK3PXP', issuer: 'ACME Co', account: 'jane@x.com', digits: 8, period: 30, algorithm: 'SHA-256' });
  expect(() => totpLib.parseOtpauth('otpauth://hotp/x?secret=A')).toThrow(/time-based/);
  expect(totpLib.randomSecret()).toMatch(/^[A-Z2-7]{32}$/);
});

test('bcrypt hash and verify', async () => {
  const h = await bc.bcryptHash('hunter2', 4);
  expect(bc.parseBcrypt(h)).toMatchObject({ version: '2b', cost: 4, rounds: 16 });
  expect(await bc.bcryptVerify('hunter2', h)).toBe(true);
  expect(await bc.bcryptVerify('hunter3', h)).toBe(false);
  expect(await bc.bcryptVerify('hunter2', h.replace('$2b$', '$2y$'))).toBe(true);
  await expect(bc.bcryptVerify('x', 'nope')).rejects.toThrow(/not a bcrypt hash/);
  expect(bc.tooLong('x'.repeat(73))).toBe(true);
});

test('mind map editing, layout and import/export', () => {
  let t = mm.createMap('Trip');
  const [a, b] = t.children;
  let r = mm.addChild(t, a.id, 'Outbound');
  t = r.tree;
  const out = r.id;
  r = mm.addSibling(t, out, 'Return');
  t = r.tree;
  expect(mm.findNode(t, a.id).node.children.map((c) => c.text)).toEqual(['Outbound', 'Return']);
  expect(mm.addSibling(t, t.id).tree.children).toHaveLength(4); // sibling of root becomes child
  expect(mm.moveNode(t, a.id, out)).toBe(t); // cannot move into own subtree
  t = mm.moveNode(t, out, b.id);
  expect(mm.findNode(t, out).parent.id).toBe(b.id);
  t = mm.shiftNode(t, b.id, -1);
  expect(t.children[0].id).toBe(b.id);
  const removed = mm.removeNode(t, b.id);
  expect(mm.findNode(removed.tree, out)).toBeNull();
  expect(mm.removeNode(t, t.id).tree).toBe(t);
  expect(mm.countNodes(t)).toBe(6);

  const lay = mm.layoutMap(t);
  expect(lay.nodes[0]).toMatchObject({ x: 0, y: 0, depth: 0 });
  expect(lay.nodes).toHaveLength(6);
  // No two nodes overlap.
  lay.nodes.forEach((n, i) => lay.nodes.slice(i + 1).forEach((m) => {
    const overlap = Math.abs(n.x - m.x) < (n.w + m.w) / 2 && Math.abs(n.y - m.y) < (n.h + m.h) / 2;
    expect(overlap).toBe(false);
  }));
  expect(new Set(lay.nodes.filter((n) => n.depth === 1).map((n) => n.side))).toEqual(new Set([1, -1]));
  const collapsed = mm.layoutMap(mm.updateNode(t, b.id, { collapsed: true }));
  expect(collapsed.nodes).toHaveLength(5);
  const right = lay.nodes.find((n) => n.side === 1 && n.depth === 1);
  expect(mm.neighbour(lay, t.id, 'right')).toBe(right.id);
  expect(mm.neighbour(lay, right.id, 'left')).toBe(t.id);

  const md = mm.toMarkdown(t);
  expect(md.split('\n')[0]).toBe('# Trip');
  const back = mm.fromOutline(md);
  expect(mm.toMarkdown(back)).toBe(md);
  expect(mm.toMarkdown(mm.fromOutline('Plan\n\tGoals\n\t\tFast\n\tRisks'))).toBe('# Plan\n- Goals\n  - Fast\n- Risks');
  expect(mm.fromOutline('- a\n- b').text).toBe('Central idea');
  expect(mm.toMarkdown(mm.fromOutline('# Root\n## A\n- a1\n## B'))).toBe('# Root\n- A\n  - a1\n- B');
  expect(mm.toMarkdown(mm.fromJson(mm.toJson(t)))).toBe(md);
  expect(() => mm.fromJson('{"x":1}')).toThrow(/not a mind map/);
  expect(() => mm.fromOutline('  ')).toThrow();
  expect(mm.toSvg(mm.layoutMap(mm.createMap('<A & B>')))).toContain('&lt;A &amp; B&gt;');
});

test('new JS tools render without crashing', () => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  const tools = [
    require('../utilities/spreadsheetViewer/SpreadsheetViewer').SpreadsheetViewer,
    require('../utilities/meetingPlanner/MeetingPlanner').MeetingPlanner,
    require('../utilities/mindMap/MindMap').MindMap,
    require('../utilities/diagramEditor/DiagramEditor').DiagramEditor,
    require('../utilities/jsonDiff/JsonDiff').JsonDiff,
    require('../utilities/jsonPathTester/JsonPathTester').JsonPathTester,
    require('../utilities/codePlayground/CodePlayground').CodePlayground,
    require('../utilities/jwtEncoder/JwtEncoder').JwtEncoder,
    require('../utilities/fileChecksum/FileChecksum').FileChecksum,
    require('../utilities/totpGenerator/TotpGenerator').TotpGenerator,
    require('../utilities/bcryptTool/BcryptTool').BcryptTool,
    require('../utilities/metarDecoder/MetarDecoder').MetarDecoder,
    require('../utilities/boardingPass/BoardingPass').BoardingPass,
    require('../utilities/pdfSign/PdfSign').PdfSign,
    require('../utilities/imageMetadata/ImageMetadata').ImageMetadata,
  ];
  tools.forEach((C) => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let root;
    act(() => {
      root = createRoot(el);
      root.render(React.createElement(C));
    });
    expect(el.querySelector('h2').textContent.length).toBeGreaterThan(0);
    expect(el.textContent).not.toMatch(/⚠/);
    act(() => root.unmount());
  });
});

test('mind map keyboard: Tab adds a child, typing names it, Enter commits', () => {
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  const { MindMap } = require('../utilities/mindMap/MindMap');
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(React.createElement(MindMap)));
  const stage = el.querySelector('.mm-stage');
  const key = (target, k, opts = {}) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts })); });
  expect(el.querySelectorAll('.mm-node')).toHaveLength(4);
  key(stage, 'Tab');
  const input = el.querySelector('.mm-edit');
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => { setter.call(input, 'Budget'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  key(input, 'Escape');
  expect(el.querySelectorAll('.mm-node')).toHaveLength(4); // Escape on a new idea discards it
  key(stage, 'Tab');
  const input2 = el.querySelector('.mm-edit');
  act(() => { setter.call(input2, 'Budget'); input2.dispatchEvent(new Event('input', { bubbles: true })); });
  key(input2, 'Enter');
  // Enter on a new idea commits it and starts a sibling right away
  expect([...el.querySelectorAll('.mm-node')].map((n) => n.textContent)).toContain('Budget');
  const sib = el.querySelector('.mm-edit');
  expect(sib).not.toBeNull();
  key(sib, 'Escape');
  expect(el.querySelectorAll('.mm-node')).toHaveLength(5);
  key(stage, 'z', { ctrlKey: true });
  expect([...el.querySelectorAll('.mm-node')].map((n) => n.textContent)).not.toContain('Budget');
  key(stage, 'z', { ctrlKey: true, shiftKey: true });
  expect([...el.querySelectorAll('.mm-node')].map((n) => n.textContent)).toContain('Budget');
});
