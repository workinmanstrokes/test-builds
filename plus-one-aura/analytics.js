/* Diddlerrr player analytics — drop-in, dependency-free, $0 (Firestore Spark).
 * Writes ONE compact row per session to Firestore `sessions` via REST.
 * No names, emails, ad IDs, IPs or device IDs: only a random install id.
 * If not configured / offline / blocked, every call is a silent no-op.
 * Usage: <script>window.DA_CONFIG={projectId:'floamhunters',apiKey:'AIza...',game:'plus-one-aura',version:'1.0.0'}</script>
 *        <script src="analytics.js"></script>   then DA.levelStart(3) etc.
 */
(function (w) {
  var noop = function () {};
  var api = { sessionStart: noop, sessionEnd: noop, levelStart: noop, levelComplete: noop, levelFail: noop,
    rewardedShown: noop, rewardedAccepted: noop, rewardedDeclined: noop, removeAdsShown: noop, removeAdsPurchased: noop };
  w.DA = api;
  try {
    var C = w.DA_CONFIG; if (!C || !C.projectId || !C.apiKey || !w.fetch) return;
    var LS = w.localStorage, now = Date.now(), DAY = 864e5;
    var rid = function () { return (w.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + now.toString(36)); };
    var pid = LS.getItem('da_pid') || rid(); LS.setItem('da_pid', pid);
    var first = +LS.getItem('da_first') || now; LS.setItem('da_first', first);
    var idx = (+LS.getItem('da_idx') || 0) + 1; LS.setItem('da_idx', idx);
    var dsi = Math.floor((now - first) / DAY);
    var s = { game: C.game, ver: C.version || '', plat: /Android/i.test(navigator.userAgent) ? 'android' : 'web',
      pid: pid, sid: rid(), ts: new Date(now).toISOString().slice(0, 10), sidx: idx, dsi: dsi,
      ret_d1: dsi === 1 ? 1 : 0, ret_d7: dsi === 7 ? 1 : 0, dur: 0,
      lv_start: 0, lv_done: 0, lv_fail: 0, max_lv: 0, deaths: 0, lv_time: 0,
      fails_first_offer: -1, rw: {}, ra_shown: 0, ra_buy: 0 };
    var t0 = now, sent = false, lvT = 0, fails = 0;
    function rw(p, k) { var r = s.rw[p] = s.rw[p] || { shown: 0, acc: 0, dec: 0 }; r[k]++; }
    function F(v) { return typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) }; }
    function flush() {
      if (sent) return; sent = true; s.dur = Math.round((Date.now() - t0) / 1000);
      var f = {}; Object.keys(s).forEach(function (k) {
        if (k === 'rw') Object.keys(s.rw).slice(0, 6).forEach(function (p) { var r = s.rw[p], n = p.replace(/\W/g, '').slice(0, 12);
          f['rw_' + n + '_shown'] = F(r.shown); f['rw_' + n + '_acc'] = F(r.acc); f['rw_' + n + '_dec'] = F(r.dec); });
        else f[k] = F(s[k]); });
      try { fetch('https://firestore.googleapis.com/v1/projects/' + C.projectId + '/databases/(default)/documents/sessions?key=' + C.apiKey,
        { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) }).catch(noop); } catch (e) {}
    }
    var safe = function (fn) { return function () { try { fn.apply(null, arguments); } catch (e) {} }; };
    api.sessionStart = noop; // automatic on load
    api.sessionEnd = safe(flush);
    api.levelStart = safe(function (lv) { s.lv_start++; lvT = Date.now(); s.max_lv = Math.max(s.max_lv, +lv || 0); });
    api.levelComplete = safe(function (lv, deaths) { s.lv_done++; s.deaths += +deaths || 0; s.lv_time += lvT ? Math.round((Date.now() - lvT) / 1000) : 0; fails = 0; });
    api.levelFail = safe(function (lv, deaths) { s.lv_fail++; fails++; s.deaths += +deaths || 1; s.lv_time += lvT ? Math.round((Date.now() - lvT) / 1000) : 0; });
    api.rewardedShown = safe(function (p) { rw(p, 'shown'); if (s.fails_first_offer < 0) s.fails_first_offer = fails; });
    api.rewardedAccepted = safe(function (p) { rw(p, 'acc'); });
    api.rewardedDeclined = safe(function (p) { rw(p, 'dec'); });
    api.removeAdsShown = safe(function () { s.ra_shown++; });
    api.removeAdsPurchased = safe(function () { s.ra_buy = 1; });
    w.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  } catch (e) { w.DA = api; }
})(window);
