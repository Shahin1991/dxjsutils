import React, { lazy, Suspense, useEffect, useState } from 'react';
import { LeftNav } from './components/LeftNav';
import { Welcome } from './components/Welcome';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UTILITIES } from './config/utilities';
import { HelpCenter, HelpDrawer } from './components/HelpPanel';
import { InstructionBanner } from './components/InstructionBanner';
import { CommandPalette } from './components/CommandPalette';
import { readJSON, writeJSON } from './utils/storage';

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
  "text-diff": lazy(() => import('./utilities/textDiff/TextDiff').then((m) => ({ default: m.TextDiff }))),
  "url-tools": lazy(() => import('./utilities/urlTools/UrlTools').then((m) => ({ default: m.UrlTools }))),
  "json-converter": lazy(() => import('./utilities/jsonConverter/JsonConverter').then((m) => ({ default: m.JsonConverter }))),
  "password-generator": lazy(() => import('./utilities/passwordGenerator/PasswordGenerator').then((m) => ({ default: m.PasswordGenerator }))),
  "text-stats": lazy(() => import('./utilities/textStats/TextStats').then((m) => ({ default: m.TextStats }))),
};

function readTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch (e) {
    return 'dark';
  }
}

const isDesktopWidth = () => window.innerWidth > 768;

// Location hash <-> view: "#/help", "#/<utility-id>", anything else is Home.
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'help') return { view: 'help', id: null };
  if (UTILITIES.some((u) => u.id === h) && UTILITY_COMPONENTS[h]) return { view: 'utility', id: h };
  return { view: 'home', id: null };
}

function initialRoute() {
  const fromHash = parseHash();
  if (fromHash.view !== 'home' || window.location.hash) return fromHash;
  const last = readJSON('lastUtility', null);
  return last && UTILITY_COMPONENTS[last] ? { view: 'utility', id: last } : fromHash;
}

function App() {
  const [theme, setTheme] = useState(readTheme);
  const [route, setRoute] = useState(initialRoute);
  const [navOpen, setNavOpen] = useState(isDesktopWidth);
  const [utilityKey, setUtilityKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [favorites, setFavorites] = useState(() => readJSON('favorites', []));
  const [recents, setRecents] = useState(() => readJSON('recents', []));
  const isElectron = Boolean(window.electron?.isElectron);
  const currentUtilityId = route.view === 'utility' ? route.id : null;

  useEffect(() => writeJSON('favorites', favorites), [favorites]);
  useEffect(() => writeJSON('recents', recents), [recents]);

  // Keep URL hash and remembered tool in sync with the current view.
  useEffect(() => {
    const target = route.view === 'utility' ? `#/${route.id}` : route.view === 'help' ? '#/help' : '';
    if (window.location.hash !== target && (target || window.location.hash)) {
      window.history.pushState(null, '', target || window.location.pathname + window.location.search);
    }
    if (route.view === 'utility') {
      writeJSON('lastUtility', route.id);
      setRecents((r) => [route.id, ...r.filter((x) => x !== route.id)].slice(0, 8));
    }
  }, [route]);

  // Browser back/forward.
  useEffect(() => {
    const onPop = () => {
      setRoute(parseHash());
      setUtilityKey((k) => k + 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Global shortcuts: Ctrl/Cmd+K palette, ? or F1 help for the current tool.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'F1' || (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFavorite = (id) =>
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const changeTheme = (next) => {
    setTheme(next);
    try {
      localStorage.setItem('theme', next); // only persisted on an explicit choice
    } catch (e) {
      // ignore storage errors
    }
  };

  const navigate = (next) => {
    setRoute(next);
    setUtilityKey((k) => k + 1); // force a full remount so no state leaks between utilities
    setHelpOpen(false);
    setPaletteOpen(false);
    if (!isDesktopWidth()) setNavOpen(false);
  };

  const selectUtility = (id) => navigate(id ? { view: 'utility', id } : { view: 'home', id: null });
  const goHome = () => selectUtility(null);
  const goHelp = () => navigate({ view: 'help', id: null });

  const current = UTILITIES.find((u) => u.id === currentUtilityId);
  const ActiveUtility = currentUtilityId ? UTILITY_COMPONENTS[currentUtilityId] : null;

  let content;
  if (route.view === 'help') {
    content = <HelpCenter onSelect={selectUtility} />;
  } else if (ActiveUtility && current && (isElectron || !current.electronOnly)) {
    content = (
      <>
        <InstructionBanner key={`${currentUtilityId}-${utilityKey}`} utilityId={currentUtilityId} />
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
      </>
    );
  } else if (current) {
    content = (
      <div className="welcome">
        <h1>
          {current.icon} {current.name}
        </h1>
        <p className="welcome-sub">This tool needs the desktop app because it uses network and system features a browser can't access.</p>
      </div>
    );
  } else {
    content = <Welcome onSelect={selectUtility} />;
  }

  return (
    <div className={`app-shell ${theme}`}>
      <header className="app-header">
        <button type="button" className="nav-toggle" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation">
          ☰
        </button>
        <button type="button" className="brand" onClick={goHome}>
          <img src={`${process.env.PUBLIC_URL}/logo.svg`} alt="" className="brand-logo" />
          <span className="brand-name">dxjsutils</span>
        </button>
        {current && (
          <span className="header-utility">
            /{' '}
            <button type="button" className="header-crumb" onClick={() => setUtilityKey((k) => k + 1)} title="Reset this tool">
              {current.name}
            </button>
          </span>
        )}
        <div className="header-actions">
          <button type="button" className="header-btn" onClick={() => setPaletteOpen(true)} title="Search tools (Ctrl/Cmd+K)">
            🔍 <span className="header-btn-text">Search</span> <kbd>⌘K</kbd>
          </button>
          {current && (
            <button type="button" className="header-btn" onClick={() => setHelpOpen(true)} title="Help for this tool (?)" aria-label="Help for this tool">
              ?
            </button>
          )}
          <label className="theme-switch" title="Toggle theme">
            <input
              type="checkbox"
              checked={theme === 'light'}
              onChange={(e) => changeTheme(e.target.checked ? 'light' : 'dark')}
            />
            <span className="theme-slider">
              <span className="theme-icon sun">☀️</span>
              <span className="theme-icon moon">🌙</span>
            </span>
          </label>
        </div>
      </header>
      <div className="app-body">
        <LeftNav
          view={route.view}
          currentUtilityId={currentUtilityId}
          onSelect={selectUtility}
          onHome={goHome}
          onHelp={goHelp}
          open={navOpen}
          onClose={() => setNavOpen(false)}
          favorites={favorites}
          recents={recents}
          onToggleFavorite={toggleFavorite}
        />
        <main className="app-main">{content}</main>
      </div>
      {helpOpen && (current ? (
        <HelpDrawer utility={current} onClose={() => setHelpOpen(false)} onOpenCenter={goHelp} />
      ) : null)}
      {paletteOpen && <CommandPalette onSelect={selectUtility} onClose={() => setPaletteOpen(false)} isElectron={isElectron} />}
    </div>
  );
}

export default App;
