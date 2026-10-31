import React, { useMemo, useRef, useState } from 'react';
import { utils } from 'xlsx';
import { FileDrop } from '../../components/FileDrop';
import { ClearableTextarea } from '../../components/ClearableTextarea';
import { downloadFile } from '../../utils/clipboard';
import { svgToPng } from '../../utils/svgExport';
import { useToolState } from '../../utils/toolState';
import { readWorkbook } from '../spreadsheetViewer/utils/sheet';
import { ChartView, DataTable } from './ChartView';
import { RaceView } from './RaceView';
import { raceFrames, videoFormat } from './utils/race';
import {
  AGGREGATIONS, CHART_TYPES, MAX_SERIES, buildModel, defaultConfig, inferColumns, longGroupColumn, modelTable, seriesCap, tableFromText, tableToCsv, timeColumn, toTable, toggleY,
} from './utils/data';

const ACCEPT = '.csv,.tsv,.txt,.json,.xlsx,.xlsm,.xlsb,.xls,.ods';

const SAMPLE = `Month,DXB–LHR,DXB–JFK,DXB–SYD
2025-01,61200,48900,35100
2025-02,55800,44100,33800
2025-03,60400,47600,31900
2025-04,63900,49800,29400
2025-05,66100,51200,27800
2025-06,70800,55900,26100
2025-07,78400,61800,27300
2025-08,79900,62500,28900
2025-09,68200,53300,30200
2025-10,66700,52100,32600
2025-11,64300,50400,35800
2025-12,73500,57800,39900`;

const TYPE_HINT = { number: 'number', date: 'date', text: 'text' };

function readData(mode, file, sheet, text, headerRow) {
  if (mode === 'file') {
    if (!file) return { table: null };
    if (file.text != null) {
      const t = tableFromText(file.text);
      return { table: toTable(t.rows, headerRow) };
    }
    const ws = file.wb.Sheets[sheet] || file.wb.Sheets[file.wb.SheetNames[0]];
    return { table: toTable(utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }), headerRow) };
  }
  if (!text.trim()) return { table: null };
  return { table: toTable(tableFromText(text).rows, headerRow) };
}

export function ChartMaker() {
  const [mode, setMode] = useToolState('mode', 'paste');
  const [file, setFile] = useToolState('file', null); // { name, wb } or { name, text } for JSON
  const [sheet, setSheet] = useToolState('sheet', '');
  const [text, setText] = useToolState('text', SAMPLE);
  const [headerRow, setHeaderRow] = useToolState('headerRow', true);
  const [stored, setStored] = useToolState('cfg', null);
  const [showTable, setShowTable] = useToolState('showTable', false);
  const [fileError, setFileError] = useToolState('fileError', '');
  const chartRef = useRef(null);
  const [recording, setRecording] = useState(null); // { progress } while a video is being made
  const cancelRef = useRef(false);

  const parsed = useMemo(() => {
    try {
      return readData(mode, file, sheet, text, headerRow);
    } catch (e) {
      return { table: null, error: e.message };
    }
  }, [mode, file, sheet, text, headerRow]);
  const { table } = parsed;
  const error = (mode === 'file' && fileError) || parsed.error;

  const columns = useMemo(() => (table ? inferColumns(table) : []), [table]);
  // Settings belong to one dataset shape; new columns start from fresh defaults.
  const sig = columns.map((c) => `${c.name}:${c.type}`).join('|');
  const cfg = useMemo(() => (stored && stored.sig === sig ? stored : { ...defaultConfig(columns, table), sig }), [stored, sig, columns, table]);
  const update = (patch) => setStored({ ...cfg, ...patch, sig });

  const model = useMemo(() => (table && columns.length ? buildModel(table, columns, cfg) : null), [table, columns, cfg]);

  const open = async ([f]) => {
    setFileError('');
    try {
      if (/\.json$/i.test(f.name)) setFile({ name: f.name, text: await f.text() });
      else {
        const wb = readWorkbook(new Uint8Array(await f.arrayBuffer()));
        setFile({ name: f.name, wb });
        setSheet(wb.SheetNames[0]);
      }
    } catch (e) {
      setFile(null);
      setFileError(`${f.name}: ${e.message}`);
    }
  };

  const numeric = columns.filter((c) => c.type === 'number' && c.index !== cfg.x);
  const cap = seriesCap(cfg.chart);
  const chartType = CHART_TYPES.find((t) => t.id === cfg.chart);
  const xCol = columns[cfg.x];
  const groupCol = cfg.groupBy != null ? columns[cfg.groupBy] : null;
  const isCount = cfg.agg === 'count' && cfg.chart !== 'scatter';
  const bandX = chartType.band || xCol?.type === 'text';
  const race = Boolean(chartType.race);
  const format = useMemo(() => videoFormat(), []);

  const setChart = (id) => {
    const nextCap = seriesCap(id);
    const ys = cfg.ys.slice(0, nextCap);
    const patch = { chart: id, ys };
    if (id === 'scatter' && cfg.agg === 'count') patch.agg = 'sum';
    // A race needs time on X. If X is text and there is a date or year column, move X there;
    // the old text column (e.g. City) then names the entries.
    const isRaceType = CHART_TYPES.find((t) => t.id === id).race;
    const time = timeColumn(columns);
    if (isRaceType && xCol?.type === 'text' && time) {
      patch.x = time.index;
      patch.groupBy = cfg.groupBy ?? (longGroupColumn(table, columns, time.index) ?? xCol.index);
      const value = columns.find((c) => c.type === 'number' && !c.year && c.index !== time.index);
      patch.ys = value ? [value.index] : [];
    } else if (id === 'bar-race' && cfg.groupBy == null) {
      // Wide data (one column per entry): start with every number column in the race.
      patch.ys = columns.filter((c) => c.type === 'number' && !c.year && c.index !== cfg.x).slice(0, nextCap).map((c) => c.index);
    }
    // Leaving a big race: give the kept columns the first colour slots again.
    if (nextCap <= MAX_SERIES && patch.ys.some((c) => (cfg.slots[c] ?? 0) >= MAX_SERIES)) {
      patch.slots = Object.fromEntries(patch.ys.map((c, i) => [c, i]));
    } else if (patch.ys !== ys || id === 'bar-race') {
      patch.slots = Object.fromEntries(patch.ys.map((c, i) => [c, cfg.slots[c] ?? i]));
    }
    // A scatter compares two measures, so move a text X onto the first number column.
    const nums = columns.filter((c) => c.type === 'number');
    if (id === 'scatter' && xCol?.type === 'text' && nums.length >= 2) {
      const x = nums[0].index;
      const rest = cfg.ys.filter((c) => c !== x);
      patch.x = x;
      // The old text X (e.g. Fleet) becomes the series split, which needs a single Y column.
      patch.groupBy = cfg.groupBy ?? xCol.index;
      patch.ys = (rest.length ? rest : [nums[1].index]).slice(0, 1);
      patch.slots = { [patch.ys[0]]: 0 };
    }
    update(patch);
  };
  const setGroup = (v) => {
    const g = v === '' ? null : Number(v);
    const ys = g != null ? cfg.ys.slice(0, 1) : cfg.ys;
    update({ groupBy: g, ys, slots: Object.fromEntries(ys.map((c, i) => [c, g != null ? 0 : cfg.slots[c] ?? i])) });
  };
  const setX = (v) => {
    const x = Number(v);
    const ys = cfg.ys.filter((c) => c !== x);
    update({ x, ys, groupBy: cfg.groupBy === x ? null : cfg.groupBy, chart: columns[x].type === 'text' && !chartType.band && !race && cfg.chart !== 'scatter' ? 'column' : cfg.chart });
  };

  const aggLabel = AGGREGATIONS.find((a) => a.id === cfg.agg)?.label;
  let subtitle = '';
  if (model && xCol) {
    const what = isCount ? 'Number of rows' : model.yName ? (model.agg ? `${aggLabel} of ${model.yName}` : model.yName) : model.agg ? `${aggLabel} of values` : '';
    // With several Y columns the legend names them, so a bare "by Month" would add nothing.
    if (what) subtitle = `${what} by ${xCol.name}${groupCol ? `, split by ${groupCol.name}` : ''}`;
  }
  const description = `${chartType.label} chart${subtitle ? `: ${subtitle}` : ''}`;
  const fileBase = (mode === 'file' && file ? file.name.replace(/\.[^.]+$/, '') : '') || 'chart';
  let tbl = model && model.series.length ? modelTable(model) : null;
  if (tbl && race && cfg.cumulative) {
    // The table shows what the animation shows: running totals.
    tbl = { head: tbl.head, body: raceFrames(model, { cumulative: true }).map((f) => [f.label, ...f.values]) };
  }

  const makeVideo = async () => {
    cancelRef.current = false;
    setRecording({ progress: 0 });
    try {
      const blob = await chartRef.current.video(format, (progress) => setRecording({ progress }), () => cancelRef.current);
      if (blob) downloadFile(`${fileBase}.${format.ext}`, blob);
    } catch (e) {
      setFileError(`Video export failed: ${e.message}`);
    } finally {
      setRecording(null);
    }
  };

  const exportAs = async (kind) => {
    if (kind === 'csv') {
      downloadFile(`${fileBase}-chart-data.csv`, new Blob([tableToCsv(tbl)], { type: 'text/csv' }));
      return;
    }
    const svg = chartRef.current.svg();
    if (kind === 'svg') downloadFile(`${fileBase}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
    else downloadFile(`${fileBase}.png`, await svgToPng(svg, { background: chartRef.current.background }));
  };

  return (
    <div className="tl-container cmk-container">
      <h2 className="tl-title">📉 Chart Maker</h2>
      <p className="tl-desc">Turn a spreadsheet, CSV or JSON into a line, bar, area or scatter chart, or an animated bar or line race, then download it as an image or video. Your data never leaves your device.</p>

      <div className="tl-panel">
        <div className="tl-row">
          {[['paste', 'Paste data'], ['file', 'Open a file']].map(([id, label]) => (
            <button key={id} type="button" className={`tl-btn ${mode === id ? '' : 'secondary'}`} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>
          ))}
          <label className="tl-check"><input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} /> First row is a header</label>
        </div>
        {mode === 'paste' ? (
          <>
            <label className="tl-label" htmlFor="cmk-text">CSV, TSV (paste straight from Excel) or a JSON array</label>
            <ClearableTextarea id="cmk-text" className="tl-textarea cmk-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </>
        ) : (
          <>
            <FileDrop accept={ACCEPT} onFiles={open} hint="Drop a .csv, .xlsx, .ods or .json file here or" />
            {file && (
              <div className="tl-row">
                <strong>{file.name}</strong>
                {file.wb && file.wb.SheetNames.length > 1 && (
                  <select value={sheet} onChange={(e) => setSheet(e.target.value)} aria-label="Sheet">
                    {file.wb.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                {table && <span className="tl-muted">{table.rows.length.toLocaleString()} rows · {columns.length} columns</span>}
              </div>
            )}
          </>
        )}
        {error && <div className="tl-err">⚠ {error}</div>}
      </div>

      {table && columns.length > 0 && model && (
        <>
          <div className="tl-panel cmk-controls">
            <div className="tl-row cmk-types" role="group" aria-label="Chart type">
              {CHART_TYPES.map((t, i) => (
                <React.Fragment key={t.id}>
                  {t.race && !CHART_TYPES[i - 1].race && <span className="cmk-sep" aria-hidden="true" />}
                  <button type="button" className={`tl-btn ${cfg.chart === t.id ? '' : 'secondary'}`} aria-pressed={cfg.chart === t.id} onClick={() => setChart(t.id)}>
                    {t.race && <span aria-hidden="true">▶ </span>}{t.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="cmk-fields">
              <label>
                <span className="tl-label">{race ? 'Time (one frame per value)' : cfg.chart === 'bar' ? 'Categories (Y axis)' : 'X axis'}</span>
                <select value={cfg.x} onChange={(e) => setX(e.target.value)}>
                  {columns.map((c) => <option key={c.index} value={c.index}>{c.name} ({TYPE_HINT[c.type]})</option>)}
                </select>
              </label>
              <label>
                <span className="tl-label">Split into series by</span>
                <select value={cfg.groupBy ?? ''} onChange={(e) => setGroup(e.target.value)}>
                  <option value="">None</option>
                  {columns.filter((c) => c.index !== cfg.x && c.type !== 'number').map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
                </select>
              </label>
              {cfg.chart !== 'scatter' && (
                <label>
                  <span className="tl-label">Combine rows with the same X</span>
                  <select value={cfg.agg} onChange={(e) => update({ agg: e.target.value })}>
                    {AGGREGATIONS.map((a) => <option key={a.id} value={a.id} disabled={a.id !== 'count' && !numeric.length}>{a.label}</option>)}
                  </select>
                </label>
              )}
              {bandX && !race && xCol?.type === 'text' && cfg.chart !== 'scatter' && (
                <label>
                  <span className="tl-label">Order</span>
                  <select value={cfg.sort} onChange={(e) => update({ sort: e.target.value })}>
                    <option value="natural">As in the data</option>
                    <option value="desc">Largest first</option>
                    <option value="asc">Smallest first</option>
                    <option value="label">A to Z</option>
                  </select>
                </label>
              )}
              <label className="cmk-title-field">
                <span className="tl-label">Chart title</span>
                <input type="text" value={cfg.title} onChange={(e) => update({ title: e.target.value })} placeholder="Optional" />
              </label>
            </div>

            {!isCount && (
              <fieldset className="cmk-ys">
                <legend className="tl-label">
                  {cfg.chart === 'bar-race' ? 'Entries in the race' : cfg.chart === 'bar' ? 'Values (X axis)' : 'Y axis'}
                  {groupCol ? ' · one column when splitting by a column' : ` · up to ${cap}`}
                </legend>
                {numeric.length ? (
                  numeric.map((c) => {
                    const on = cfg.ys.includes(c.index);
                    const full = !on && !groupCol && cfg.ys.length >= cap;
                    return (
                      <label key={c.index} className={`cmk-chip ${on ? 'on' : ''} ${full ? 'off' : ''}`}>
                        <input type={groupCol ? 'radio' : 'checkbox'} name="cmk-y" checked={on} disabled={full} onChange={() => update(toggleY(cfg, c.index, cap))} />
                        {c.name}
                      </label>
                    );
                  })
                ) : (
                  <span className="tl-muted">No number columns found. Choose "Count rows" to chart how often each value appears.</span>
                )}
              </fieldset>
            )}

            <div className="tl-row cmk-opts">
              {(cfg.chart === 'line' || cfg.chart === 'scatter') && (
                <label className="tl-check"><input type="checkbox" checked={cfg.zero} onChange={(e) => update({ zero: e.target.checked })} /> Start the value axis at zero</label>
              )}
              {chartType.band && !race && (
                <label className="tl-check"><input type="checkbox" checked={cfg.labels} onChange={(e) => update({ labels: e.target.checked })} /> Show a value on every bar</label>
              )}
              {cfg.chart === 'bar-race' && (
                <label className="tl-check">
                  Show top
                  <select value={cfg.topN} onChange={(e) => update({ topN: Number(e.target.value) })} aria-label="Number of bars">
                    {[5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
              {race && (
                <>
                  <label className="tl-check">
                    Speed
                    <select value={cfg.stepMs} onChange={(e) => update({ stepMs: e.target.value })} aria-label="Time per step">
                      <option value="auto">Auto (about 18 s)</option>
                      <option value="250">0.25 s per step</option>
                      <option value="500">0.5 s per step</option>
                      <option value="1000">1 s per step</option>
                      <option value="2000">2 s per step</option>
                    </select>
                  </label>
                  <label className="tl-check"><input type="checkbox" checked={cfg.cumulative} onChange={(e) => update({ cumulative: e.target.checked })} /> Running total</label>
                </>
              )}
              {cfg.chart === 'line-race' && (
                <label className="tl-check"><input type="checkbox" checked={cfg.zero} onChange={(e) => update({ zero: e.target.checked })} /> Start the value axis at zero</label>
              )}
            </div>
          </div>

          <div className="tl-panel cmk-output">
            <div className="tl-row">
              <span className="tl-muted">Download</span>
              {race && format && (
                recording ? (
                  <>
                    <span className="cmk-rec" role="status">Recording video… {Math.round(recording.progress * 100)}%</span>
                    <button type="button" className="tl-btn secondary" onClick={() => { cancelRef.current = true; }}>Cancel</button>
                  </>
                ) : (
                  <button type="button" className="tl-btn secondary" onClick={makeVideo} disabled={!tbl || model.rows.length < 2} title="Plays the animation and records it. Keep this tab visible while it runs.">Video ({format.ext.toUpperCase()})</button>
                )
              )}
              <button type="button" className="tl-btn secondary" onClick={() => exportAs('png')} disabled={!tbl}>{race ? 'PNG (this frame)' : 'PNG'}</button>
              <button type="button" className="tl-btn secondary" onClick={() => exportAs('svg')} disabled={!tbl}>SVG</button>
              <button type="button" className="tl-btn secondary" onClick={() => exportAs('csv')} disabled={!tbl}>Chart data (CSV)</button>
              <label className="tl-check cmk-push"><input type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} /> Show data table</label>
            </div>
            {race ? (
              <RaceView ref={chartRef} model={model} chart={cfg.chart} topN={cfg.topN ?? 10} cumulative={cfg.cumulative} stepMs={cfg.stepMs ?? 'auto'} zero={cfg.zero} title={cfg.title} subtitle={subtitle} description={description} />
            ) : (
              <ChartView ref={chartRef} model={model} chart={cfg.chart} zero={cfg.zero} labels={cfg.labels} title={cfg.title} subtitle={subtitle} description={description} />
            )}
            {model.notes.map((n) => <p key={n} className="tl-muted cmk-note">{n}</p>)}
            {showTable && tbl && <DataTable table={tbl} />}
          </div>
        </>
      )}
    </div>
  );
}
