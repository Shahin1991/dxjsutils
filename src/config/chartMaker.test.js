import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildModel, defaultConfig, inferColumns, modelTable, tableFromText, tableToCsv, toDate, toNumber, toTable, toggleY,
} from '../utilities/chartMaker/utils/data';
import { dateTicks, formatNumber, niceTicks } from '../utilities/chartMaker/utils/scale';
import { THEMES, barPath, hitTest, layoutChart } from '../utilities/chartMaker/utils/layout';

const load = (text) => {
  const table = toTable(tableFromText(text).rows);
  return { table, columns: inferColumns(table) };
};

test('numbers and dates are read the way people type them', () => {
  expect(toNumber('1,234.5')).toBe(1234.5);
  expect(toNumber('$40')).toBe(40);
  expect(toNumber('AED 1,200')).toBe(1200);
  expect(toNumber('(300)')).toBe(-300);
  expect(toNumber('12%')).toBe(12);
  expect(toNumber('1e3')).toBe(1000);
  expect(toNumber('12,34')).toBeNull();
  expect(toNumber('abc')).toBeNull();
  expect(toNumber('')).toBeNull();

  expect(toDate('2025-03-04')).toBe(Date.UTC(2025, 2, 4));
  expect(toDate('2025-03')).toBe(Date.UTC(2025, 2, 1));
  expect(toDate('2025-03-04T10:30:00Z')).toBe(Date.UTC(2025, 2, 4, 10, 30));
  expect(toDate('2025-03-04T10:30:00+04:00')).toBe(Date.UTC(2025, 2, 4, 6, 30));
  expect(toDate('03/04/2025')).toBe(Date.UTC(2025, 3, 3)); // day first
  expect(toDate('03/04/2025', 'mdy')).toBe(Date.UTC(2025, 2, 4));
  expect(toDate('Jan 2025')).toBe(Date.UTC(2025, 0, 1));
  expect(toDate('5-Feb-25')).toBe(Date.UTC(2025, 1, 5));
  expect(toDate('2025-13-01')).toBeNull();
  expect(toDate('hello')).toBeNull();
});

test('input formats: CSV, TSV and JSON become the same table', () => {
  const csv = load('a,b\nx,1\ny,2').table;
  expect(load('a\tb\nx\t1\ny\t2').table).toEqual(csv);
  expect(load('[{"a":"x","b":1},{"a":"y","b":2}]').table).toEqual({ headers: ['a', 'b'], rows: [['x', 1], ['y', 2]] });
  expect(load('[["a","b"],["x",1]]').table.rows).toEqual([['x', 1]]);
  expect(() => tableFromText('{bad')).toThrow(/Invalid JSON/);
  expect(() => tableFromText('[1,2]')).toThrow(/array of objects/);
  expect(toTable([['n', 'n', ''], [1, 2, 3]]).headers).toEqual(['n', 'n (2)', 'Column 3']);
  expect(toTable([[1, 2]], false).headers).toEqual(['Column 1', 'Column 2']);
});

test('column types and defaults', () => {
  const { columns } = load('Month,Region,Sales,Year\n2025-01,North,"1,200",2025\n2025-02,South,900,2025\n13/03/2025,North,n/a,2025\n2025-04,East,1500,2025\n2025-05,West,700,2025');
  expect(columns.map((c) => c.type)).toEqual(['date', 'text', 'number', 'number']);
  expect(columns[3].year).toBe(true);
  expect(columns[0].dateOnly).toBe(true);
  const cfg = defaultConfig(columns);
  expect(cfg.x).toBe(0);
  expect(cfg.chart).toBe('line');
  expect(cfg.ys).toEqual([2]); // a year column is time, not a value to plot
  expect(defaultConfig(load('name,score\na,1\nb,2').columns).chart).toBe('column');
});

test('rows sharing an X are combined; split-by pivots long data into series', () => {
  const { table, columns } = load('region,month,sales\nN,Jan,10\nS,Jan,5\nN,Feb,20\nN,Feb,4\nS,Feb,1');
  const base = { ...defaultConfig(columns), chart: 'column', x: 1, ys: [2], slots: { 2: 0 } };
  let m = buildModel(table, columns, base);
  expect(m.rows.map((r) => [r.label, r.values[0]])).toEqual([['Jan', 15], ['Feb', 25]]);
  expect(m.notes.join(' ')).toMatch(/combined \(sum\)/);
  expect(buildModel(table, columns, { ...base, agg: 'avg' }).rows[1].values[0]).toBeCloseTo(25 / 3);
  expect(buildModel(table, columns, { ...base, agg: 'count' }).rows.map((r) => r.values[0])).toEqual([2, 3]);
  expect(buildModel(table, columns, { ...base, sort: 'desc' }).rows[0].label).toBe('Feb');

  m = buildModel(table, columns, { ...base, groupBy: 0 });
  expect(m.series.map((s) => s.name)).toEqual(['N', 'S']);
  expect(m.rows.map((r) => r.values)).toEqual([[10, 5], [24, 1]]);
  expect(tableToCsv(modelTable(m))).toBe('month,N,S\nJan,10,5\nFeb,24,1');
});

test('more groups than colours fold into Other; scatter keeps raw points', () => {
  const lines = ['g,x,y'];
  for (let i = 0; i < 12; i += 1) lines.push(`G${i},1,${100 - i}`, `G${i},2,${50 - i}`);
  const { table, columns } = load(lines.join('\n'));
  const cfg = { ...defaultConfig(columns), chart: 'line', x: 1, ys: [2], groupBy: 0 };
  const m = buildModel(table, columns, cfg);
  expect(m.series).toHaveLength(8);
  expect(m.series[7]).toEqual({ name: 'Other', slot: 'other' });
  expect(m.rows[0].values[7]).toBe(93 + 92 + 91 + 90 + 89); // G7..G11 at x=1

  const sc = buildModel(table, columns, { ...cfg, chart: 'scatter' });
  expect(sc.series).toHaveLength(3);
  expect(sc.points.reduce((a, p) => a + p.length, 0)).toBe(24);
});

test('colour follows the column, not its position in the list', () => {
  let cfg = { ys: [], slots: {}, groupBy: null };
  cfg = toggleY(cfg, 4, 8);
  cfg = toggleY(cfg, 5, 8);
  cfg = toggleY(cfg, 6, 8);
  cfg = toggleY(cfg, 4, 8); // remove the first
  expect(cfg.slots).toEqual({ 5: 1, 6: 2 });
  cfg = toggleY(cfg, 7, 8);
  expect(cfg.slots[7]).toBe(0); // reuses the freed slot
  expect(toggleY({ ys: [1, 2, 3], slots: {}, groupBy: null }, 9, 3).ys).toEqual([1, 2, 3]);
});

test('ticks and number formatting', () => {
  expect(niceTicks(0, 87).ticks).toEqual([0, 20, 40, 60, 80, 100]);
  expect(niceTicks(0.1, 0.9).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  expect(niceTicks(5, 5).ticks.length).toBeGreaterThan(1);
  expect(formatNumber(25000, { step: 5000, compact: true })).toBe('25K');
  expect(formatNumber(2500, { step: 500 })).toBe('2,500');
  expect(formatNumber(2500, { step: 500, compact: true })).toBe('2.5K'); // one style per axis
  expect(formatNumber(0.25, { step: 0.25 })).toBe('0.25');
  expect(formatNumber(2025, { year: true })).toBe('2025');
  expect(formatNumber(0.00345)).toBe('0.00345');
  const dt = dateTicks(Date.UTC(2025, 0, 1), Date.UTC(2025, 11, 1), 6);
  expect(dt.unit).toBe('month');
  expect(dt.format(dt.ticks[0])).toBe('Jan 2025');
});

test('layout: thin bars with rounded data ends, labels never on every point', () => {
  const { table, columns } = load('k,v\na,10\nb,-4\nc,30');
  const model = buildModel(table, columns, { ...defaultConfig(columns), chart: 'column' });
  const scene = layoutChart(model, { chart: 'column', width: 900, theme: THEMES.dark });
  expect(scene.bars).toHaveLength(3);
  const widths = scene.bars.map((b) => {
    const xs = b.d.match(/[MHQL ]?(-?\d+(\.\d+)?),/g).map((s) => parseFloat(s.replace(/[MHQL ]/, '')));
    return Math.max(...xs) - Math.min(...xs);
  });
  widths.forEach((w) => expect(w).toBeLessThanOrEqual(24));
  expect(scene.valueLabels.map((l) => l.text)).toEqual(['30']); // only the extreme
  expect(layoutChart(model, { chart: 'column', width: 900, theme: THEMES.dark, labels: true }).valueLabels).toHaveLength(3);
  expect(barPath(0, 0, 10, 20, 'top')).toContain('Q');
  expect(barPath(0, 0, 0, 20, 'top')).toBe('');

  // Hover snaps to the band under the pointer.
  expect(hitTest(scene, model, scene.px(2), scene.plot.y + 10)).toEqual({ row: 2 });
  expect(hitTest(scene, model, 1, 1)).toBeNull();
});

test('layout: line end labels drop out when they would collide', () => {
  const { table, columns } = load('m,a,b\n2025-01,10,10\n2025-02,20,20.1');
  const model = buildModel(table, columns, defaultConfig(columns));
  const s = layoutChart(model, { chart: 'line', width: 800, theme: THEMES.light });
  expect(s.legend).toHaveLength(2);
  expect(s.endLabels).toHaveLength(0);
  const { table: t2, columns: c2 } = load('m,a,b\n2025-01,10,10\n2025-02,90,5');
  const s2 = layoutChart(buildModel(t2, c2, defaultConfig(c2)), { chart: 'line', width: 800, theme: THEMES.light });
  expect(s2.endLabels.map((l) => l.text)).toEqual(['a', 'b']);
});

test('Chart Maker renders the sample, switches type, and reads values from the keyboard', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { ChartMaker } = require('../utilities/chartMaker/ChartMaker');
  const el = document.createElement('div');
  document.body.appendChild(el);
  let root;
  act(() => {
    root = createRoot(el);
    root.render(React.createElement(ChartMaker));
  });
  expect(el.querySelector('h2').textContent).toMatch(/Chart Maker/);
  expect(el.textContent).not.toMatch(/⚠/);
  expect(el.querySelectorAll('svg path[stroke-width="2"]').length).toBe(3); // three lines
  expect(el.querySelector('svg').getAttribute('aria-label')).toMatch(/Line chart/);

  const button = (label) => [...el.querySelectorAll('button')].find((b) => b.textContent === label);
  act(() => button('Column').click());
  expect(el.querySelector('svg').getAttribute('aria-label')).toMatch(/Column chart/);
  expect(el.querySelectorAll('svg path[fill]').length).toBeGreaterThanOrEqual(36);

  const chart = el.querySelector('.cmk-chart');
  act(() => chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  const tip = el.querySelector('.cmk-tip');
  expect(tip.textContent).toContain('Jan 2025');
  expect(tip.textContent).toContain('61,200');

  act(() => [...el.querySelectorAll('label')].find((l) => l.textContent.includes('Show data table')).querySelector('input').click());
  expect(el.querySelector('.cmk-table').textContent).toContain('DXB–SYD');
  act(() => root.unmount());
});

describe('animated races', () => {
  const { raceFrames, ranks, barRaceScene, lineRaceScene, stepDuration, videoFormat, frameLabel } = require('../utilities/chartMaker/utils/race');
  const raceData = () => {
    const { table, columns } = load('year,team,points\n2021,A,10\n2021,B,30\n2022,A,50\n2022,B,35\n2023,A,60\n2023,C,90');
    const cfg = { ...defaultConfig(columns), chart: 'bar-race', x: 0, ys: [2], groupBy: 1 };
    return buildModel(table, columns, cfg);
  };

  test('frames carry missing values forward, or keep a running total', () => {
    const model = raceData();
    expect(model.series.map((s) => s.name)).toEqual(['A', 'B', 'C']);
    expect(raceFrames(model).map((f) => f.values)).toEqual([[10, 30, null], [50, 35, null], [60, 35, 90]]);
    expect(raceFrames(model, { cumulative: true }).map((f) => f.values)).toEqual([[10, 30, 0], [60, 65, 0], [120, 65, 90]]);
    expect(ranks([10, 30, null])).toEqual([1, 0, 2]);
    expect(frameLabel(raceFrames(model), 1.4)).toBe('2022');
    expect(frameLabel(raceFrames(model), 1.6)).toBe('2023');
  });

  test('a race holds far more than 8 entries without folding them away', () => {
    const lines = ['t,name,v'];
    for (let i = 0; i < 30; i += 1) lines.push(`1,N${i},${i}`, `2,N${i},${30 - i}`);
    const { table, columns } = load(lines.join('\n'));
    const model = buildModel(table, columns, { ...defaultConfig(columns), chart: 'bar-race', x: 0, ys: [2], groupBy: 1 });
    expect(model.series).toHaveLength(30);
    const scene = barRaceScene(model, raceFrames(model), 0, { width: 800, topN: 10, theme: THEMES.dark });
    expect(scene.bars).toHaveLength(10);
    expect(new Set(scene.bars.map((b) => b.fill)).size).toBe(1); // >8 entries: one colour, names carry identity
    expect([...scene.bars].sort((a, b) => a.nameY - b.nameY).map((b) => b.name).slice(0, 3)).toEqual(['N29', 'N28', 'N27']);
  });

  test('bars swap places smoothly between frames', () => {
    const model = raceData();
    const frames = raceFrames(model);
    const y = (scene, name) => {
      const b = scene.bars.find((x) => x.name === name);
      return b ? b.nameY : null;
    };
    const at = (p) => barRaceScene(model, frames, p, { width: 800, topN: 3, theme: THEMES.light });
    expect(y(at(0), 'B')).toBeLessThan(y(at(0), 'A')); // B leads in 2021
    expect(y(at(1), 'A')).toBeLessThan(y(at(1), 'B')); // A leads in 2022
    const mid = y(at(0.5), 'A');
    expect(mid).toBeGreaterThan(y(at(1), 'A'));
    expect(mid).toBeLessThan(y(at(0), 'A'));
    expect(at(2).period.text).toBe('2023');
  });

  test('line race reveals lines up to the current moment', () => {
    const { table, columns } = load(SAMPLE_WIDE);
    const model = buildModel(table, columns, { ...defaultConfig(columns), chart: 'line-race' });
    const frames = raceFrames(model);
    const early = lineRaceScene(model, frames, 1.5, { width: 800, theme: THEMES.dark });
    const late = lineRaceScene(model, frames, 3, { width: 800, theme: THEMES.dark });
    expect(early.lines[0].d.split('L')).toHaveLength(3); // points 0, 1 and the head at 1.5
    expect(late.heads[0].x).toBeGreaterThan(early.heads[0].x);
    expect(early.legend).toHaveLength(2);
  });

  test('speed and video format helpers', () => {
    expect(stepDuration('500', 10)).toBe(500);
    expect(stepDuration('auto', 13)).toBe(1500);
    expect(stepDuration('auto', 400)).toBe(150);
    expect(videoFormat(null)).toBeNull();
    expect(videoFormat({ isTypeSupported: (m) => m === 'video/webm' })).toEqual({ mime: 'video/webm', ext: 'webm' });
    expect(videoFormat({ isTypeSupported: (m) => m.startsWith('video/mp4') }).ext).toBe('mp4');
  });

  test('Chart Maker plays a bar race from the keyboard', () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { ChartMaker } = require('../utilities/chartMaker/ChartMaker');
    const el = document.createElement('div');
    document.body.appendChild(el);
    let root;
    act(() => {
      root = createRoot(el);
      root.render(React.createElement(ChartMaker));
    });
    const button = (label) => [...el.querySelectorAll('button')].find((b) => b.textContent.includes(label));
    act(() => button('Bar race').click());
    expect(el.querySelector('.cmk-period').textContent).toMatch(/Jan 2025\s+1 \/ 12/);
    expect(el.querySelectorAll('.cmk-chart svg path').length).toBe(3);
    const key = (k) => act(() => el.querySelector('.cmk-chart').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
    key('ArrowRight');
    expect(el.querySelector('.cmk-period').textContent).toMatch(/Feb 2025/);
    key('End');
    expect(el.querySelector('.cmk-period').textContent).toMatch(/Dec 2025\s+12 \/ 12/);
    expect(button('Replay')).toBeTruthy();
    act(() => root.unmount());
  });
});

const SAMPLE_WIDE = 'm,a,b\n2025-01,1,5\n2025-02,4,3\n2025-03,9,2\n2025-04,7,8';

test('long data splits into series by default, and only real merges are reported', () => {
  const { table, columns } = load('Year,City,Pax\n2020,Dubai,10.5\n2020,Paris,8\n2021,Dubai,12\n2021,Paris,9.25');
  const cfg = defaultConfig(columns, table);
  expect(cfg.x).toBe(0);
  expect(cfg.groupBy).toBe(1);
  expect(cfg.ys).toEqual([2]);
  const m = buildModel(table, columns, cfg);
  expect(m.series.map((s) => s.name)).toEqual(['Dubai', 'Paris']);
  expect(m.notes).toEqual([]);
  const { valueDecimals, raceFrames } = require('../utilities/chartMaker/utils/race');
  expect(valueDecimals(raceFrames(m))).toBe(2);
});
