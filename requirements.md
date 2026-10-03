# Master Prompt: Build "dxjsutils"

## 1. Project Summary

Build a cross-platform desktop productivity toolbox called **dxjsutils** for Emirates (EK) employees. It is a single offline-capable application that bundles 30+ independent utilities (developer tools, productivity helpers, encoding/security tools, reference material, and media tools) behind one unified shell with sidebar navigation, light/dark theming, and a home/welcome screen. Ship it both as a browser-runnable React app and as a packaged Electron desktop app (macOS/Windows/Linux).

## 2. Tech Stack

- **Framework**: React 18 (function components + hooks only, no class components except one error boundary)
- **Bootstrapping**: Create React App (`react-scripts` 5.0.1) — do not use Vite/Next
- **Desktop shell**: Electron 29, packaged via `electron-builder`
- **Dev convenience**: `concurrently` + `wait-on` to run CRA dev server and Electron together
- **Dependencies to install**: `crypto-js` (hashing), `date-fns` (date math), `electron-is-dev`, `marked` (Markdown rendering), `pdf-lib` (image→PDF export), `qrcode` (QR generation)
- **Dev dependencies**: `electron`, `electron-builder`, `concurrently`, `wait-on`, `husky` + `lint-staged` (pre-commit `eslint --fix --max-warnings=0` on `src/**/*.{js,jsx}`)
- **No state management library** — no Redux/Context/Zustand. Each utility owns its local `useState`.
- **No UI component library** — hand-rolled CSS with CSS custom properties for theming, one CSS file per utility.
- **No backend/server** — everything runs client-side; privileged operations (clipboard, raw sockets, DNS, TLS, HTTP without CORS, local mock server) go through Electron IPC only and are unavailable in the plain browser build.

## 3. package.json Requirements

- `"main": "public/electron.js"`, `"homepage": "./"`
- Scripts: `start` (`react-scripts start`), `build` (`react-scripts build`), `test` (`react-scripts test`), `electron` (`electron .`), `electron-dev` (`concurrently "npm start" "wait-on http://localhost:3000 && npm run electron"`), `electron-build` (`npm run build && electron-builder`), `prepare` (`husky`)
- `eslintConfig.extends: ["react-app"]`, `env: { es2020: true }`
- `lint-staged` config scoped to `src/**/*.{js,jsx}` running `eslint --fix --max-warnings=0`
- `electron-builder` `build` config: appId `com.dxjsutils.app`, productName `dxjsutils`, `files` including `build/**/*`, `public/electron.js`, `public/preload.js`, `public/Ek_logo.png`, `node_modules/**/*`; mac target `dmg`+`zip` (category `public.app-category.business`); win target `zip` (optional code-signing cert fields); linux target `AppImage`+`deb` (category `Office`)

## 4. Folder Structure (must match exactly)

public/
electron.js # Electron main process
preload.js # contextBridge + IPC exposure
index.html
src/
App.jsx # root: theme state, routing, utility lifecycle
index.js
components/
LeftNav.jsx # collapsible sidebar nav, mobile overlay
Welcome.jsx # home screen: search + category filters + utility cards
ErrorBoundary.jsx # class component, wraps each active utility
config/
utilities.js # single source of truth: id, name, icon, category, description, version, optional electronOnly flag
styles/

index.css # imports every CSS file below in order
global.css # CSS variables, reset, dark/light theme definitions
navigation.css # LeftNav styles
layout.css # header, Welcome, shell layout
[one .css file per utility, named after the utility folder]
utilities/
<utilityName>/
<UtilityName>.jsx # default-exported-as-named-export component, e.g. export function Base64Tool()
components/ # utility-local subcomponents (optional)
utils/ # utility-local business logic, pure functions (optional)




## 5. Theming System

Define two themes entirely via CSS custom properties scoped under `.app-shell.dark` and `.app-shell.light` (dark is default, applied to `:root` as well). Variables to define: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-card`, `--bg-input`, `--bg-input-focus`, `--bg-stat`, `--bg-stat-hover`, `--bg-progress`, `--bg-header`, `--bg-table`, `--bg-table-hover`, `--bg-ongoing`, `--bg-ongoing-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-color`, `--border-color-light`, `--color-primary`, `--color-secondary`, `--color-accent`, `--color-success`, `--color-error`, `--color-warning`, `--shadow-box`.

- **Dark theme**: GitHub-dark-inspired palette — background `#0d1117`/`#161b22`/`#1c2230`, text `#f0f6fc`, accent blue `#58a6ff`.
- **Light theme ("Emirates" branded)**: light grey surfaces (`#e8edf2`/`#f2f4f7`), dark charcoal text `#1a1a2e`, Emirates red primary `#af0e20`, teal secondary `#00796b`.

Persist the chosen theme in `localStorage` under key `theme`. Toggle via a checkbox-styled switch (☀️/🌙 icons) in the header. All utility CSS must reference the variables — never hardcode colors — so every utility re-themes automatically with zero utility-specific code.

## 6. App Shell Behavior (`App.jsx`)

- State: `theme` (from localStorage, default `'dark'`), `currentUtilityId` (default `null` = show Welcome), `navOpen` (bool, for mobile sidebar), `utilityKey` (int counter).
- Every utility component is **lazy-loaded** via `React.lazy(() => import('./utilities/x/X').then(m => ({ default: m.X })))` — import paths must be static string literals for webpack chunk splitting.
- A `UTILITY_COMPONENTS` map of `id -> lazy component` mirrors `config/utilities.js` ids.
- Selecting a utility: set `currentUtilityId`, **increment `utilityKey`** (forces full remount via `key={utilityKey}` so switching utilities always gives a clean slate — no stale state leaks between tools), close the nav on mobile.
- Render the active utility inside an `ErrorBoundary` (keyed by `currentUtilityId`) and a `Suspense` fallback showing a spinner + "Loading…".
- Header: hamburger nav-toggle button, clickable brand/logo (goes home), app name + current utility name, theme switch.
- No global utility state, no shared context — this is intentional, keep utilities fully isolated.

## 7. Shared Components

- **LeftNav**: reads `config/utilities.js`, filters out `electronOnly` utilities when not running inside Electron (`window.electron?.isElectron`), renders a Home item + "UTILITIES" section label + one button per utility (icon + name), highlights the active one, includes a mobile overlay + collapse toggle.
- **Welcome**: search box (filters by name/description), category filter chips (categories: Productivity, Developer Tools, Encoding & Security, Reference, Media), grid of utility cards grouped by category, each card shows icon/name/description and is clickable to open the utility.
- **ErrorBoundary**: class component with `componentDidCatch`, renders a friendly fallback UI with the error message instead of crashing the whole app.

## 8. Electron Main Process (`public/electron.js`) & Preload (`public/preload.js`)

Security settings on `BrowserWindow`: `nodeIntegration: false`, `contextIsolation: true`, no remote module, `preload` pointed at `preload.js`. Hide the default app menu on non-mac platforms. Load `index.html` from `build/` in production, `http://localhost:3000` in dev (`electron-is-dev`).

Expose via `contextBridge.exposeInMainWorld('electron', { ... })` **only** these methods (never expose raw `ipcRenderer` or Node APIs):

- `isElectron: true`
- `readClipboard()` → `ipcMain.handle('clipboard-read', ...)` using Electron's `clipboard.readText()`
- `dnsLookup(hostname, types)` → resolves A/AAAA/MX/TXT/CNAME/NS/SOA/PTR via Node's `dns.promises`, catching per-type errors individually and returning partial results
- `certInspect(host, port)` → opens a raw `tls.connect` (ignore cert errors with `rejectUnauthorized: false` since this is an inspection tool), returns `getPeerCertificate(true)`, negotiated protocol, and cipher name
- `httpRequest(opts: {method,url,headers,body,followRedirects,timeout})` → raw `http`/`https` request (bypasses browser CORS entirely), manually follows 301/302/303/307/308 redirects when requested, returns status/statusText/headers/body/size/duration
- `currencyRates(from)` → fetches `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{from}.json` from the main process (bypasses CORS), follows redirects manually
- `startMockServer(port, routes)` / `stopMockServer()` → spins up/tears down a real local `http.createServer` that matches incoming requests against a routes array (`{method, path, enabled, status, body, contentType, headers:[{key,value,enabled}], delay, name}`), supports exact path match, trailing-`*` prefix match, and `path: '*'` catch-all, supports `ANY` method, adds `X-Mocked-By: EK-Mock-Server` response header, applies per-route artificial delay
- `onMockRequest(cb)` / `offMockRequest()` → subscribe/unsubscribe to a `mock-server-request` event the main process pushes to the renderer (`webContents.send`) every time the mock server receives a request, so the UI can show a live log
- Also in preload: a `keydown` listener that intercepts Cmd/Ctrl+V on focused `<textarea>`/`<input>` elements and manually inserts clipboard text at the cursor via `ipcRenderer.invoke('clipboard-read')`, dispatching synthetic `input`/`change` events (works around Electron clipboard/paste quirks).

## 9. `config/utilities.js` — Utility Registry

Export a flat array; each entry: `{ id, name, icon (emoji), category, description, version: '1.0.0', electronOnly?: true }`. This list drives the sidebar, Welcome screen, and `App.jsx` routing map — it is the single source of truth. Build the following utilities, grouped by category:

### Productivity

1. **Calculator** (`calculator`, 🧮) — Standard calculator UI with full keyboard support for digits, `+ − × ÷ %`, decimal point, sign toggle, clear, and Enter-to-equals.
2. **Calendar** (`calendar`, 📆) — Month-grid calendar showing UAE weekends, UAE public holidays, ISO week numbers, month/year navigation, and per-day personal notes persisted to `localStorage`.
3. **Useful Links** (`useful-links`, 🔗) — User-managed list of bookmarked URLs (add/edit/delete, open in new tab), persisted to `localStorage`.
4. **Date Difference Calculator** (`date-diff-calculator`, 📅) — Two date/time pickers; outputs the difference broken into years, months, weeks, days, hours, minutes, seconds, and total units.
5. **Timezone Converter** (`timezone-converter`, 🌐) — Convert a given date/time from one IANA timezone to many others simultaneously; include major world zones plus UAE/Gulf cities.
6. **Markdown Editor** (`markdown-editor`, 📝) — Side-by-side raw/preview editor using `marked` for rendering, formatting toolbar (bold/italic/heading/list/link/code), export to `.md` file.
7. **Currency Converter** (`currency-converter`, 💱, **electron-only**) — Convert between 25+ currencies (AED, USD, EUR, GBP, INR, Gulf currencies, etc.) using live rates fetched through the `currencyRates` IPC call (CORS-free), with caching and a "last updated" timestamp.
8. **World Clock** (`world-clock`, 🌍) — Live-updating local time for ~25 major world cities, rendered against an interactive world-map visualization with day/night shading and per-city UTC offset detail panel.

### Developer Tools

9. **Regex Tester** (`regex-tester`, 🔍) — Live regex evaluation against sample text, highlighted matches, capture group breakdown, flag toggles (g/i/m/s/u), syntax-aware error messages for invalid patterns.
10. **String Tools** (`string-tools`, 🔤) — Convert input text between camelCase, snake_case, kebab-case, PascalCase, CONSTANT_CASE, Title Case, sentence case, plus utilities like trim/reverse/counts.
11. **UUID Generator** (`uuid-generator`, 🆔) — Generate RFC4122 v4 UUIDs, single or batch (configurable count), copy individually or all at once, optional uppercase/hyphen-stripped formatting.
12. **JSON Viewer** (`json-viewer`, 🌳) — Paste JSON, render as a collapsible interactive tree (expand/collapse per-node and all-at-once), show type-colored values, validation errors for malformed JSON. Build a reusable `TreeNode` component (shared conceptually with JWT Decoder's payload view).
13. **Cron Parser** (`cron-parser`, ⏰) — Parse a 5/6-field cron expression, output a human-readable description and a list of upcoming execution times.
14. **YAML Comparator** (`yaml-comparator`, 🔄) — Paste two YAML documents (e.g., env configs), parse `env:`/`environment:` sections, align keys, sort alphabetically, highlight additions/removals/changed values side-by-side.
15. **YAML Key Sorter** (`yaml-sorter`, 🔀) — Sort YAML keys alphabetically, with a mode toggle for "env/environment sections only" vs "all top-level keys in the file", preserving comments where feasible.
16. **Code Formatter** (`code-formatter`, ✨) — Auto-detect and pretty-print JSON, XML, HTML, CSS, and SQL with consistent indentation.
17. **cURL Decoder** (`curl-decoder`, 🔁) — Paste a `curl` command string; parse out method, URL, query params, headers, body, auth flags, and misc options into a structured, readable view.
18. **curl Builder** (`curl-builder`, 🔧) — The inverse: form-based builder (method, URL, query params table, headers table, body, auth) that generates a copyable `curl` command.
19. **CSV Viewer** (`csv-viewer`, 📋) — Paste CSV text or open a local file; auto-detect comma/semicolon/tab delimiters; render as a sortable (click column header), searchable/filterable table.
20. **Unix Timestamp** (`unix-timestamp`, ⏱️) — Bidirectional converter: epoch (seconds/ms) → human-readable date across multiple timezones, and date-picker → epoch.
21. **IP / CIDR Calculator** (`cidr-calculator`, 🌐) — Given an IPv4 CIDR (e.g. `10.0.0.0/24`), compute network address, broadcast address, subnet mask, wildcard mask, usable host range, and host count.
22. **Color Converter** (`color-converter`, 🎨) — Convert between HEX/RGB/HSL/HSV with live swatch preview, RGB channel sliders, and WCAG contrast-ratio analysis against black/white or a second chosen color.
23. **Number System Converter** (`number-system-converter`, 🔢) — Convert a number between binary, octal, decimal, hexadecimal, and an arbitrary custom base, including two's-complement handling for negative values.
24. **DNS Lookup** (`dns-lookup`, 🔎, **electron-only**) — Resolve A/AAAA/MX/TXT/CNAME/NS/SOA/PTR records for a hostname via the `dnsLookup` IPC call; show per-record-type results and failures gracefully.
25. **Certificate Inspector** (`cert-inspector`, 📜, **electron-only**) — Connect to any `host:port` over TLS via `certInspect`; display subject, issuer, SANs, validity dates/expiry countdown, fingerprint, negotiated protocol and cipher.
26. **HTTP Request Tester** (`http-tester`, 🧪, **electron-only**) — Full request builder (method, URL, headers table, auth, body editor) that fires through the `httpRequest` IPC call to avoid browser CORS; shows status, response headers, body (with pretty-print), size, and duration.
27. **HTTP Mock Server** (`http-mock-server`, 🎭, **electron-only**) — Define a list of stub routes (method, path incl. wildcard, status, response body, content-type, custom headers, artificial delay, enabled toggle, name); start/stop a real local server via `startMockServer`/`stopMockServer`; show a live incoming-request log fed by `onMockRequest`.
28. **Fake Data Generator** (`fake-data-generator`, 🧑‍🤝‍🧑) — Generate bulk realistic-looking test data (names, emails, phone numbers, addresses, card numbers, IBANs) fully offline with a seeded/pure-JS generator; export as JSON or CSV.

### Encoding & Security

29. **Base64 Tool** (`base64`, 🔐) — Encode arbitrary text to Base64 and decode Base64 back to text, with error handling for invalid input.
30. **Hash Generator** (`hash-generator`, 🔐) — Generate MD5, SHA-1, SHA-256, SHA-512 hashes for input text using `crypto-js`.
31. **JWT Decoder** (`jwt-decoder`, 🔓) — Decode a JWT's header and payload (base64url), pretty-print both as trees, flag and display `exp`/`iat`/`nbf` validity state (expired/valid/not-yet-valid).
32. **Card / IBAN Validator** (`card-validator`, 💳) — Validate credit card numbers via the Luhn checksum plus network/brand detection (Visa/Mastercard/Amex/etc. via BIN prefix ranges), and validate IBANs via ISO 7064 MOD-97 checksum with country-format awareness. Fully offline.

### Reference

33. **Cheatsheet** (`cheatsheet`, 📚) — Searchable reference database of common commands for Git, Docker, Linux, VS Code, npm, etc., grouped by tool with a live filter/search box.

### Media

34. **Image Tools** (`image-tools`, 🖼️) — Convert images between PNG/JPEG/WebP, compress with an adjustable quality slider, and export one or more images into a single PDF using `pdf-lib`. All processing client-side via `<canvas>`.
35. **QR Code Generator** (`qr-code-generator`, 🔳) — Generate QR codes for URLs, plain text, and Wi-Fi credential strings using the `qrcode` package, with configurable size, foreground/background color, and error-correction level, fully offline.

*(Note: keep the registry above in sync with the sidebar/router map — this list is the authoritative source of truth.)*

## 10. Coding Conventions

- Each utility folder exports its root component as a **named export** matching the component filename (e.g. `export function Base64Tool()`), never `export default`, since `App.jsx` imports them via `.then(m => ({ default: m.X }))`.
- Prefix utility CSS class names with a short abbreviation unique to that utility (e.g. `.rt-` for Regex Tester, `.st-` for String Tools) to avoid collisions across the single global stylesheet bundle.
- No utility imports another utility's component or CSS. Shared logic only lives in `src/components/`, `src/config/`, or `src/utils/`.
- Persist only what's necessary to `localStorage` (theme, Useful Links, Calendar notes) — don't add a persistence layer beyond `localStorage.getItem/setItem` per utility.
- Gate all Electron-only utilities behind `electronOnly: true` in the registry and check `window.electron?.isElectron` before rendering IPC-dependent UI, with a friendly "requires the desktop app" fallback message when running in a plain browser.

## 11. Acceptance Checklist

- [ ] App boots to Welcome screen with search + category filters + all utility cards
- [ ] Sidebar lists all non-electron-only utilities in browser mode, all utilities in Electron mode
- [ ] Theme toggle switches instantly and persists across reload
- [ ] Switching between any two utilities fully resets component state (no leaked state)
- [ ] Each utility works standalone with no console errors
- [ ] `npm run electron-dev` launches the desktop shell against the CRA dev server
- [ ] `npm run electron-build` produces a `dist/` installer for the host platform
- [ ] Clipboard paste shortcut, DNS lookup, cert inspection, HTTP tester, mock server, and currency rates all function only inside Electron and are hidden/degrade gracefully in the browser build