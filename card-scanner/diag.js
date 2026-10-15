// Session diagnostics: keeps [t] timings, warnings and errors (incl. OCR worker / file-load failures) for Settings → Advanced → technical details.
const Diag = (() => {
  const log = [], t0 = performance.now(), MAX = 300, api = { log, onchange: null, text: () => log.join('\n') };
  const add = (lvl, args) => { const msg = args.map(a => a instanceof Error ? a.message : typeof a === 'object' ? (() => { try { return JSON.stringify(a); } catch { return String(a); } })() : String(a)).join(' ');
    if (lvl === 'log' && !/^\[t\]/.test(msg)) return; log.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${lvl === 'log' ? '' : lvl.toUpperCase() + ' '}${msg}`.slice(0, 400)); if (log.length > MAX) log.shift(); try { api.onchange?.(); } catch {} };
  for (const lvl of ['log', 'warn', 'error']) { const o = console[lvl].bind(console); console[lvl] = (...a) => { o(...a); add(lvl, a); }; }
  addEventListener('error', e => add('error', [e.message || ('failed to load ' + (e.target?.src || e.target?.href || '?')), e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : '']), true);
  addEventListener('unhandledrejection', e => add('error', ['unhandled: ' + (e.reason?.message || e.reason)]));
  add('log', [`[t] start ${navigator.userAgent.replace(/^.*?\(([^)]*)\).*?(Chrome\/[\d.]+)?.*$/, '$1 $2')} ${location.origin}`]);
  api.add = add; return api;
})();
