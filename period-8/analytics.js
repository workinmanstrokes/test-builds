/* Diddlerrr player analytics — drop-in, dependency-free, $0 (Firestore Spark).
 * Writes ONE compact row per session to Firestore `sessions` via REST, and only
 * after DA.setAllowed(true). Nothing is read from or written to localStorage,
 * and nothing is uploaded, until that call. setAllowed(false) drops an unsent
 * session and does not upload it. forgetDevice() also removes the on-device
 * install id. If not configured / offline / blocked, every call is a silent no-op.
 * No names, emails, ad IDs or raw IP addresses are placed in the row: only a
 * random install id created at opt-in, plus counts.
 */
(function (w) {
  var noop = function () {};
  var api = {
    sessionStart: noop, sessionEnd: noop, levelStart: noop, levelComplete: noop, levelFail: noop,
    rewardedShown: noop, rewardedAccepted: noop, rewardedDeclined: noop, removeAdsShown: noop, removeAdsPurchased: noop,
    setAllowed: noop, dropUnsent: noop, forgetDevice: noop
  };
  w.DA = api;
  try {
    var C = w.DA_CONFIG;
    var LS = w.localStorage;
    if (!C || !C.projectId || !C.apiKey || !w.fetch || !LS) return;
    var allowed = false, started = false, sent = false, s = null, snap = null, t0 = 0, lvT = 0, fails = 0;
    var KEYS = { pid: 'da_pid', first: 'da_first', idx: 'da_idx' };
    function rid() {
      try { if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID(); } catch (e) {}
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    function remember() {
      snap = { pid: LS.getItem(KEYS.pid), first: LS.getItem(KEYS.first), idx: LS.getItem(KEYS.idx) };
    }
    function putBack(key, value) {
      if (value == null) LS.removeItem(key); else LS.setItem(key, value);
    }
    function restore() {
      if (!snap) return;
      putBack(KEYS.pid, snap.pid); putBack(KEYS.first, snap.first); putBack(KEYS.idx, snap.idx);
    }
    function wipeIds() {
      try { LS.removeItem(KEYS.pid); LS.removeItem(KEYS.first); LS.removeItem(KEYS.idx); } catch (e) {}
      snap = null;
    }
    function clearMemory() { s = null; started = false; sent = false; allowed = false; lvT = 0; fails = 0; }
    // Drop the in-memory session. If it was never uploaded, roll storage back so
    // an install id created for that unsent session does not remain.
    function stopWithoutSend() {
      if (started && !sent) restore();
      clearMemory();
    }
    function forgetDevice() { stopWithoutSend(); wipeIds(); }
    function start() {
      if (started) return;
      remember();
      var now = Date.now(), DAY = 864e5;
      var pid = LS.getItem(KEYS.pid) || rid(); LS.setItem(KEYS.pid, pid);
      var first = +LS.getItem(KEYS.first) || now; LS.setItem(KEYS.first, String(first));
      var idx = (+LS.getItem(KEYS.idx) || 0) + 1; LS.setItem(KEYS.idx, String(idx));
      var dsi = Math.floor((now - first) / DAY);
      var ua = (w.navigator && w.navigator.userAgent) || '';
      s = {
        game: C.game, ver: C.version || '', plat: /Android/i.test(ua) ? 'android' : 'web',
        pid: pid, sid: rid(), ts: new Date(now).toISOString().slice(0, 10), sidx: idx, dsi: dsi,
        ret_d1: dsi === 1 ? 1 : 0, ret_d7: dsi === 7 ? 1 : 0, dur: 0,
        lv_start: 0, lv_done: 0, lv_fail: 0, max_lv: 0, deaths: 0, lv_time: 0,
        fails_first_offer: -1, rw: {}, ra_shown: 0, ra_buy: 0
      };
      t0 = now; sent = false; lvT = 0; fails = 0; started = true;
    }
    function F(v) { return typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) }; }
    function flush() {
      if (!allowed || !started || sent || !s) return;
      sent = true; s.dur = Math.round((Date.now() - t0) / 1000);
      var f = {};
      Object.keys(s).forEach(function (k) {
        if (k === 'rw') Object.keys(s.rw).slice(0, 6).forEach(function (p) {
          var r = s.rw[p], n = String(p).replace(/\W/g, '').slice(0, 12);
          f['rw_' + n + '_shown'] = F(r.shown); f['rw_' + n + '_acc'] = F(r.acc); f['rw_' + n + '_dec'] = F(r.dec);
        });
        else f[k] = F(s[k]);
      });
      try {
        w.fetch('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(C.projectId) + '/databases/(default)/documents/sessions?key=' + encodeURIComponent(C.apiKey),
          { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) }).catch(noop);
      } catch (e) {}
    }
    function safe(fn) {
      return function () { try { if (!allowed || !started) return; fn.apply(null, arguments); } catch (e) {} };
    }
    function rw(p, k) { var r = s.rw[p] = s.rw[p] || { shown: 0, acc: 0, dec: 0 }; r[k]++; }
    api.setAllowed = function (on) {
      try { if (on) { allowed = true; start(); } else stopWithoutSend(); }
      catch (e) { clearMemory(); }
    };
    api.dropUnsent = function () { try { stopWithoutSend(); } catch (e) { clearMemory(); } };
    api.forgetDevice = function () { try { forgetDevice(); } catch (e) { clearMemory(); wipeIds(); } };
    api.sessionStart = noop; // a session starts only in setAllowed(true), never on load
    api.sessionEnd = function () { try { flush(); } catch (e) {} };
    api.levelStart = safe(function (lv) { s.lv_start++; lvT = Date.now(); s.max_lv = Math.max(s.max_lv, +lv || 0); });
    api.levelComplete = safe(function (lv, deaths) { s.lv_done++; s.deaths += +deaths || 0; s.lv_time += lvT ? Math.round((Date.now() - lvT) / 1000) : 0; fails = 0; });
    api.levelFail = safe(function (lv, deaths) { s.lv_fail++; fails++; s.deaths += +deaths || 1; s.lv_time += lvT ? Math.round((Date.now() - lvT) / 1000) : 0; });
    api.rewardedShown = safe(function (p) { rw(p, 'shown'); if (s.fails_first_offer < 0) s.fails_first_offer = fails; });
    api.rewardedAccepted = safe(function (p) { rw(p, 'acc'); });
    api.rewardedDeclined = safe(function (p) { rw(p, 'dec'); });
    api.removeAdsShown = safe(function () { s.ra_shown++; });
    api.removeAdsPurchased = safe(function () { s.ra_buy = 1; });
    if (w.addEventListener) w.addEventListener('pagehide', flush);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    }
  } catch (e) { w.DA = api; }
})(window);
