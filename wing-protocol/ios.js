/* iOS / PWA support (Safari "Add to Home Screen"). Web-only: does nothing harmful inside the native Capacitor app.
   - registers the offline service worker (sw.js) on real web hosts only
   - unlocks WebAudio on the first tap (iOS starts every AudioContext suspended)
   - stops pinch / double-tap zoom and rubber-band page scroll, keeps inner scroll areas working */
(function () {
  'use strict';
  var w = window, d = document;
  var native = !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  if (native) return; // the Android/Capacitor app keeps its existing behaviour untouched
  var topLevel = (function () { try { return w.top === w; } catch (e) { return false; } })();
  var standalone = w.navigator.standalone === true || (w.matchMedia && w.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
  d.documentElement.classList.add(standalone ? 'pwa-standalone' : 'pwa-browser');

  // 1. Service worker: only on http(s) web hosts, never in the native app or inside a portal iframe.
  // sw.js is resolved against this script's own URL (not the page URL) so the
  // registration + scope stay correct on sub-path hosts (e.g. GitHub Pages test
  // builds), where a bare 'sw.js' could resolve to the domain root.
  var capHost = location.protocol === 'https:' && location.hostname === 'localhost' && !location.port; // Capacitor Android origin
  var swUrl = (function () {
    try {
      var src = (d.currentScript && d.currentScript.src) || '';
      if (src) return new URL('sw.js', src).toString();
    } catch (e) {}
    return 'sw.js';
  })();
  // Update gate: a new build never interrupts a mission.
  // sw.js installs a new build and lets it wait. The game marks <html data-wp-busy="1"> while a run,
  // a tower climb or its results are on screen (src/components/game-app.tsx) and fires 'wp-play-state'
  // when that changes. The new build is applied only when the player is between missions:
  //  - on the menu, a small "update ready" bar offers one tap to reload into it;
  //  - leaving the app while on the menu applies it quietly;
  //  - otherwise it applies on the next launch (the browser switches once every window is closed).
  // The page reloads only when this page asked for the switch, never on its own.
  var pending = null; // the waiting worker, or true when another window already switched builds
  var requested = false;
  var dismissed = false;
  var bar = null;
  function busy() { return d.documentElement.getAttribute('data-wp-busy') === '1'; }
  function applyUpdate() {
    if (!pending || busy()) return;
    requested = true;
    if (pending === true || !pending.postMessage) { w.location.reload(); return; }
    pending.postMessage({ type: 'SKIP_WAITING' }); // controllerchange below then reloads once
  }
  function hideBar() { if (bar) { bar.remove(); bar = null; } }
  function showBar() {
    if (bar || dismissed || !d.body) return;
    bar = d.createElement('div');
    bar.setAttribute('data-testid', 'sw-update-banner');
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:9999;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;background:#18181b;color:#fafafa;border:1px solid #3f3f46;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)';
    bar.textContent = 'A new Wing Protocol build is ready.';
    var btn = d.createElement('button');
    btn.setAttribute('data-testid', 'sw-update-reload');
    btn.type = 'button';
    btn.textContent = 'Reload to update';
    btn.style.cssText = 'flex:none;padding:10px 14px;border:0;border-radius:8px;background:#e8c84a;color:#18181b;font:700 14px system-ui,sans-serif';
    btn.onclick = applyUpdate;
    var later = d.createElement('button');
    later.setAttribute('data-testid', 'sw-update-dismiss');
    later.type = 'button';
    later.textContent = 'Later';
    later.style.cssText = 'flex:none;min-height:36px;padding:0 10px;border:0;background:transparent;color:#a1a1aa;font:600 14px system-ui,sans-serif';
    later.addEventListener('click', function () { dismissed = true; hideBar(); });
    bar.appendChild(btn);
    bar.appendChild(later);
    d.body.appendChild(bar);
  }
  // Show the bar only between missions; hide it the moment a run starts.
  function refresh() { if (pending && !busy()) showBar(); else hideBar(); }
  function ready(worker) { pending = worker || true; refresh(); }
  w.addEventListener('wp-play-state', refresh);
  d.addEventListener('visibilitychange', function () { if (d.hidden && pending && !busy()) applyUpdate(); });
  if (!native && !capHost && topLevel && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    w.addEventListener('load', function () {
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register(swUrl).then(function (reg) {
        // reg.update() returns a promise that rejects when sw.js can't be fetched (offline, flaky
        // signal, host hiccup). That is harmless: the game keeps running and the next check retries.
        // Catch it so it doesn't surface as an unhandled error.
        var check = function () {
          try { var p = reg.update && reg.update(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        };
        check();
        if (reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            // A new build is ready while an old one still runs this page: hold it until between missions.
            if (nw.state === 'installed' && navigator.serviceWorker.controller) ready(nw);
          });
        });
        var reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (requested) { if (!reloaded) { reloaded = true; w.location.reload(); } return; }
          // Not asked for here: the first-ever install taking control (nothing to reload), or another
          // window of the game switching builds. Then treat it like a waiting update.
          if (hadController) ready(true);
        });
        // An old home-screen install only discovers the new build when the worker is
        // re-checked: poll while the page is open, and on every foregrounding.
        w.setInterval(check, 60000);
        d.addEventListener('visibilitychange', function () { if (!d.hidden) check(); });
      }).catch(function () {});
    });
  }

  // 2. WebAudio unlock: remember every AudioContext and resume them on the first user gesture.
  var AC = w.AudioContext || w.webkitAudioContext, ctxs = [];
  if (AC && !AC.__iosPatched) {
    var Patched = function (opts) { var c = opts === undefined ? new AC() : new AC(opts); ctxs.push(c); return c; };
    Patched.prototype = AC.prototype; Patched.__iosPatched = true;
    try { w.AudioContext = Patched; if (w.webkitAudioContext) w.webkitAudioContext = Patched; } catch (e) {}
  }
  function unlock() {
    for (var i = 0; i < ctxs.length; i++) {
      var c = ctxs[i];
      if (c.state === 'suspended' || c.state === 'interrupted') { try { c.resume(); } catch (e) {} }
      try { var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
    }
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(function (t) { d.addEventListener(t, unlock, { capture: true, passive: true }); });
  // Coming back from the background (iOS suspends audio): resume on the next tap too, which the listeners above do.
  d.addEventListener('visibilitychange', function () { if (!d.hidden) unlock(); });

  // 3. Zoom + rubber-band control.
  var css = 'html,body{overscroll-behavior:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    'html,body,button,a,canvas,[role=button]{touch-action:manipulation;-webkit-tap-highlight-color:transparent}' +
    'canvas{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}';
  var st = d.createElement('style'); st.id = 'ios-pwa-style'; st.textContent = css; (d.head || d.documentElement).appendChild(st);
  ['gesturestart', 'gesturechange'].forEach(function (t) { d.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });
  function scrollable(el) {
    for (; el && el !== d.body && el !== d.documentElement; el = el.parentElement) {
      if (el.nodeType !== 1) continue;
      var cs = getComputedStyle(el), oy = cs.overflowY, ox = cs.overflowX;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return true;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    }
    var se = d.scrollingElement || d.documentElement;
    return se.scrollHeight > w.innerHeight + 1; // a page that really scrolls keeps scrolling
  }
  d.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) { e.preventDefault(); return; } // pinch
    if (e.cancelable && !scrollable(e.target)) e.preventDefault(); // no rubber-band on fixed game screens
  }, { passive: false });
})();
