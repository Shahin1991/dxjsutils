const { contextBridge, ipcRenderer } = require('electron');

let mockRequestListener = null;

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  readClipboard: () => ipcRenderer.invoke('clipboard-read'),
  dnsLookup: (hostname, types) => ipcRenderer.invoke('dns-lookup', hostname, types),
  certInspect: (host, port) => ipcRenderer.invoke('cert-inspect', host, port),
  httpRequest: (opts) => ipcRenderer.invoke('http-request', opts),
  currencyRates: (from) => ipcRenderer.invoke('currency-rates', from),
  startMockServer: (port, routes) => ipcRenderer.invoke('mock-server-start', port, routes),
  stopMockServer: () => ipcRenderer.invoke('mock-server-stop'),
  onMockRequest: (cb) => {
    if (mockRequestListener) {
      ipcRenderer.removeListener('mock-server-request', mockRequestListener);
    }
    mockRequestListener = (_event, data) => cb(data);
    ipcRenderer.on('mock-server-request', mockRequestListener);
  },
  offMockRequest: () => {
    if (mockRequestListener) {
      ipcRenderer.removeListener('mock-server-request', mockRequestListener);
      mockRequestListener = null;
    }
  },
});

// Work around Electron clipboard/paste quirks: manually insert clipboard text on Cmd/Ctrl+V.
window.addEventListener(
  'keydown',
  async (e) => {
    if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v')) return;
    const el = document.activeElement;
    if (!el || !(el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
    e.preventDefault();
    const text = await ipcRenderer.invoke('clipboard-read');
    if (typeof text !== 'string') return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
    setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
    el.setSelectionRange(start + text.length, start + text.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },
  true
);
