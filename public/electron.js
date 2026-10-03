const { app, BrowserWindow, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');
const dns = require('dns').promises;
const tls = require('tls');
const http = require('http');
const https = require('https');
const isDev = require('electron-is-dev');

let mainWindow = null;
let mockServer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'Ek_logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  mainWindow.loadURL(
    isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopMockServer();
  if (process.platform !== 'darwin') app.quit();
});

/* ---------------- Clipboard ---------------- */

ipcMain.handle('clipboard-read', () => clipboard.readText());

/* ---------------- DNS ---------------- */

const DNS_RESOLVERS = {
  A: (h) => dns.resolve4(h),
  AAAA: (h) => dns.resolve6(h),
  MX: (h) => dns.resolveMx(h),
  TXT: (h) => dns.resolveTxt(h),
  CNAME: (h) => dns.resolveCname(h),
  NS: (h) => dns.resolveNs(h),
  SOA: (h) => dns.resolveSoa(h),
  PTR: (h) => dns.resolvePtr(h),
};

ipcMain.handle('dns-lookup', async (_event, hostname, types) => {
  const requested = Array.isArray(types) && types.length ? types : Object.keys(DNS_RESOLVERS);
  const results = {};
  await Promise.all(
    requested.map(async (type) => {
      const resolver = DNS_RESOLVERS[type];
      if (!resolver) {
        results[type] = { error: `Unsupported record type: ${type}` };
        return;
      }
      try {
        results[type] = { records: await resolver(hostname) };
      } catch (err) {
        results[type] = { error: err.code || err.message };
      }
    })
  );
  return results;
});

/* ---------------- TLS certificate inspection ---------------- */

ipcMain.handle('cert-inspect', (_event, host, port = 443) =>
  new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: Number(port) || 443, servername: host, rejectUnauthorized: false, timeout: 10000 },
      () => {
        const pick = (c) => ({
          subject: c.subject,
          issuer: c.issuer,
          subjectaltname: c.subjectaltname,
          valid_from: c.valid_from,
          valid_to: c.valid_to,
          fingerprint: c.fingerprint,
          fingerprint256: c.fingerprint256,
          serialNumber: c.serialNumber,
          bits: c.bits,
        });
        const cert = socket.getPeerCertificate(true);
        const chain = [];
        const seen = new Set();
        let cur = cert && cert.issuerCertificate;
        while (cur && !seen.has(cur.fingerprint256) && chain.length < 10) {
          seen.add(cur.fingerprint256);
          chain.push(pick(cur));
          cur = cur.issuerCertificate;
        }
        const result = {
          certificate: { ...pick(cert), chain },
          protocol: socket.getProtocol(),
          cipher: socket.getCipher() && socket.getCipher().name,
          authorized: socket.authorized,
        };
        socket.end();
        resolve(result);
      }
    );
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ error: 'Connection timed out' });
    });
    socket.on('error', (err) => resolve({ error: err.message }));
  })
);

/* ---------------- HTTP (CORS-free) ---------------- */

const REDIRECT_CODES = [301, 302, 303, 307, 308];
const MAX_REDIRECTS = 10;

function rawRequest({ method = 'GET', url, headers = {}, body, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (err) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }
    const lib = target.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = lib.request(
      target,
      { method, headers, timeout, rejectUnauthorized: false },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            body: buffer.toString('utf8'),
            size: buffer.length,
            duration: Date.now() - started,
          });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestWithRedirects(opts, followRedirects) {
  let current = { ...opts };
  const started = Date.now();
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const res = await rawRequest(current);
    if (followRedirects && REDIRECT_CODES.includes(res.status) && res.headers.location) {
      const nextUrl = new URL(res.headers.location, current.url).toString();
      const switchToGet = res.status === 303 || ((res.status === 301 || res.status === 302) && current.method === 'POST');
      current = {
        ...current,
        url: nextUrl,
        method: switchToGet ? 'GET' : current.method,
        body: switchToGet ? undefined : current.body,
      };
      continue;
    }
    return { ...res, duration: Date.now() - started };
  }
  throw new Error('Too many redirects');
}

ipcMain.handle('http-request', async (_event, opts) => {
  try {
    const { followRedirects = false, ...rest } = opts || {};
    return await requestWithRedirects(rest, followRedirects);
  } catch (err) {
    return { error: err.message };
  }
});

/* ---------------- Currency rates ---------------- */

ipcMain.handle('currency-rates', async (_event, from) => {
  try {
    const code = String(from || 'usd').toLowerCase();
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code}.json`;
    const res = await requestWithRedirects({ method: 'GET', url, headers: {} }, true);
    if (res.status !== 200) return { error: `HTTP ${res.status}` };
    return { data: JSON.parse(res.body) };
  } catch (err) {
    return { error: err.message };
  }
});

/* ---------------- Mock server ---------------- */

function matchRoute(routes, method, pathname) {
  return routes.find((r) => {
    if (!r.enabled) return false;
    const methodOk = !r.method || r.method === 'ANY' || r.method.toUpperCase() === method;
    if (!methodOk) return false;
    if (r.path === '*') return true;
    if (r.path && r.path.endsWith('*')) return pathname.startsWith(r.path.slice(0, -1));
    return r.path === pathname;
  });
}

function stopMockServer() {
  return new Promise((resolve) => {
    if (!mockServer) {
      resolve({ stopped: true });
      return;
    }
    const server = mockServer;
    mockServer = null;
    server.close(() => resolve({ stopped: true }));
    if (server.closeAllConnections) server.closeAllConnections();
  });
}

ipcMain.handle('mock-server-start', async (_event, port, routes = []) => {
  await stopMockServer();
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const route = matchRoute(routes, req.method, pathname);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mock-server-request', {
            time: new Date().toISOString(),
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            matched: route ? route.name || route.path : null,
          });
        }
        const respond = () => {
          const headers = { 'X-Mocked-By': 'EK-Mock-Server' };
          if (route) {
            headers['Content-Type'] = route.contentType || 'application/json';
            (route.headers || []).forEach((h) => {
              if (h.enabled !== false && h.key) headers[h.key] = h.value;
            });
            res.writeHead(route.status || 200, headers);
            res.end(route.body || '');
          } else {
            headers['Content-Type'] = 'application/json';
            res.writeHead(404, headers);
            res.end(JSON.stringify({ error: 'No mock route matched' }));
          }
        };
        if (route && route.delay > 0) setTimeout(respond, route.delay);
        else respond();
      });
    });
    server.on('error', (err) => resolve({ error: err.message }));
    server.listen(Number(port), () => {
      mockServer = server;
      resolve({ started: true, port: Number(port) });
    });
  });
});

ipcMain.handle('mock-server-stop', () => stopMockServer());
