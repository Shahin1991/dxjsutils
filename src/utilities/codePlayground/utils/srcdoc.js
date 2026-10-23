// Build the HTML for the sandboxed preview frame. Console output and errors are forwarded to the
// parent with postMessage, tagged with a per-run token so other frames cannot spoof messages.
export function buildSrcdoc({ html, css, js }, token, jsLine = 0) {
  const bridge = `
(function () {
  var T = ${JSON.stringify(token)};
  var JS_LINE = ${jsLine};
  function fmt(v) {
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      try { parent.postMessage({ __pg: T, level: level, text: args.map(fmt).join(' ') }, '*'); } catch (e) {}
      orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    parent.postMessage({ __pg: T, level: 'error', text: (e.message || 'Error') + (e.lineno > JS_LINE ? ' (line ' + (e.lineno - JS_LINE) + ' of your JavaScript)' : '') }, '*');
  });
  window.addEventListener('unhandledrejection', function (e) {
    parent.postMessage({ __pg: T, level: 'error', text: 'Unhandled promise rejection: ' + fmt(e.reason) }, '*');
  });
})();`;
  // Keep user code from closing the script tag early.
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const before = `<!doctype html><html><head><meta charset="utf-8"><style>${css.replace(/<\/style/gi, '<\\/style')}</style><script>${bridge}</script></head><body>${html}<script>`;
  // Error line numbers count from the top of this document; pass the offset once so they can be made relative.
  const offset = before.split('\n').length - 1;
  if (offset !== jsLine) return buildSrcdoc({ html, css, js }, token, offset);
  return `${before}${safeJs}\n</script></body></html>`;
}
