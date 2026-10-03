import React, { lazy, Suspense, useEffect, useState } from 'react';
import { LeftNav } from './components/LeftNav';
import { Welcome } from './components/Welcome';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UTILITIES } from './config/utilities';

// Static import paths are required so webpack can split each utility into its own chunk.
const UTILITY_COMPONENTS = {
  "calculator": lazy(() => import('./utilities/calculator/Calculator').then((m) => ({ default: m.Calculator }))),
  "calendar": lazy(() => import('./utilities/calendar/Calendar').then((m) => ({ default: m.Calendar }))),
  "useful-links": lazy(() => import('./utilities/usefulLinks/UsefulLinks').then((m) => ({ default: m.UsefulLinks }))),
  "date-diff-calculator": lazy(() => import('./utilities/dateDiffCalculator/DateDiffCalculator').then((m) => ({ default: m.DateDiffCalculator }))),
  "timezone-converter": lazy(() => import('./utilities/timezoneConverter/TimezoneConverter').then((m) => ({ default: m.TimezoneConverter }))),
  "markdown-editor": lazy(() => import('./utilities/markdownEditor/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor }))),
  "currency-converter": lazy(() => import('./utilities/currencyConverter/CurrencyConverter').then((m) => ({ default: m.CurrencyConverter }))),
  "world-clock": lazy(() => import('./utilities/worldClock/WorldClock').then((m) => ({ default: m.WorldClock }))),
  "regex-tester": lazy(() => import('./utilities/regexTester/RegexTester').then((m) => ({ default: m.RegexTester }))),
  "string-tools": lazy(() => import('./utilities/stringTools/StringTools').then((m) => ({ default: m.StringTools }))),
  "uuid-generator": lazy(() => import('./utilities/uuidGenerator/UuidGenerator').then((m) => ({ default: m.UuidGenerator }))),
  "json-viewer": lazy(() => import('./utilities/jsonViewer/JsonViewer').then((m) => ({ default: m.JsonViewer }))),
  "cron-parser": lazy(() => import('./utilities/cronParser/CronParser').then((m) => ({ default: m.CronParser }))),
  "yaml-comparator": lazy(() => import('./utilities/yamlComparator/YamlComparator').then((m) => ({ default: m.YamlComparator }))),
  "yaml-sorter": lazy(() => import('./utilities/yamlSorter/YamlSorter').then((m) => ({ default: m.YamlSorter }))),
  "code-formatter": lazy(() => import('./utilities/codeFormatter/CodeFormatter').then((m) => ({ default: m.CodeFormatter }))),
  "curl-decoder": lazy(() => import('./utilities/curlDecoder/CurlDecoder').then((m) => ({ default: m.CurlDecoder }))),
  "curl-builder": lazy(() => import('./utilities/curlBuilder/CurlBuilder').then((m) => ({ default: m.CurlBuilder }))),
  "csv-viewer": lazy(() => import('./utilities/csvViewer/CsvViewer').then((m) => ({ default: m.CsvViewer }))),
  "unix-timestamp": lazy(() => import('./utilities/unixTimestamp/UnixTimestamp').then((m) => ({ default: m.UnixTimestamp }))),
  "cidr-calculator": lazy(() => import('./utilities/cidrCalculator/CidrCalculator').then((m) => ({ default: m.CidrCalculator }))),
  "color-converter": lazy(() => import('./utilities/colorConverter/ColorConverter').then((m) => ({ default: m.ColorConverter }))),
  "number-system-converter": lazy(() => import('./utilities/numberSystemConverter/NumberSystemConverter').then((m) => ({ default: m.NumberSystemConverter }))),
  "dns-lookup": lazy(() => import('./utilities/dnsLookup/DnsLookup').then((m) => ({ default: m.DnsLookup }))),
  "cert-inspector": lazy(() => import('./utilities/certInspector/CertInspector').then((m) => ({ default: m.CertInspector }))),
  "http-tester": lazy(() => import('./utilities/httpTester/HttpTester').then((m) => ({ default: m.HttpTester }))),
  "http-mock-server": lazy(() => import('./utilities/httpMockServer/HttpMockServer').then((m) => ({ default: m.HttpMockServer }))),
  "fake-data-generator": lazy(() => import('./utilities/fakeDataGenerator/FakeDataGenerator').then((m) => ({ default: m.FakeDataGenerator }))),
  "base64": lazy(() => import('./utilities/base64/Base64Tool').then((m) => ({ default: m.Base64Tool }))),
  "hash-generator": lazy(() => import('./utilities/hashGenerator/HashGenerator').then((m) => ({ default: m.HashGenerator }))),
  "jwt-decoder": lazy(() => import('./utilities/jwtDecoder/JwtDecoder').then((m) => ({ default: m.JwtDecoder }))),
  "card-validator": lazy(() => import('./utilities/cardValidator/CardValidator').then((m) => ({ default: m.CardValidator }))),
  "cheatsheet": lazy(() => import('./utilities/cheatsheet/Cheatsheet').then((m) => ({ default: m.Cheatsheet }))),
  "image-tools": lazy(() => import('./utilities/imageTools/ImageTools').then((m) => ({ default: m.ImageTools }))),
  "qr-code-generator": lazy(() => import('./utilities/qrCodeGenerator/QrCodeGenerator').then((m) => ({ default: m.QrCodeGenerator }))),
};

function readTheme() {
  try {
    return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
  } catch (e) {
    return 'dark';
  }
}

function App() {
  const [theme, setTheme] = useState(readTheme);
  const [currentUtilityId, setCurrentUtilityId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [utilityKey, setUtilityKey] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore storage errors
    }
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const selectUtility = (id) => {
    setCurrentUtilityId(id);
    setUtilityKey((k) => k + 1); // force a full remount so no state leaks between utilities
    setNavOpen(false);
  };

  const goHome = () => selectUtility(null);

  const current = UTILITIES.find((u) => u.id === currentUtilityId);
  const ActiveUtility = currentUtilityId ? UTILITY_COMPONENTS[currentUtilityId] : null;

  return (
    <div className={`app-shell ${theme}`}>
      <header className="app-header">
        <button type="button" className="nav-toggle" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation">
          ☰
        </button>
        <button type="button" className="brand" onClick={goHome}>
          <img src={`${process.env.PUBLIC_URL}/Ek_logo.png`} alt="" className="brand-logo" />
          <span className="brand-name">dxjsutils</span>
        </button>
        {current && <span className="header-utility">/ {current.name}</span>}
        <label className="theme-switch" title="Toggle theme">
          <input
            type="checkbox"
            checked={theme === 'light'}
            onChange={(e) => setTheme(e.target.checked ? 'light' : 'dark')}
          />
          <span className="theme-slider">
            <span className="theme-icon sun">☀️</span>
            <span className="theme-icon moon">🌙</span>
          </span>
        </label>
      </header>
      <div className="app-body">
        <LeftNav
          currentUtilityId={currentUtilityId}
          onSelect={selectUtility}
          onHome={goHome}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />
        <main className="app-main">
          {ActiveUtility ? (
            <ErrorBoundary key={currentUtilityId}>
              <Suspense
                fallback={
                  <div className="loading">
                    <div className="spinner" />
                    <span>Loading…</span>
                  </div>
                }
              >
                <ActiveUtility key={utilityKey} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <Welcome onSelect={selectUtility} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
