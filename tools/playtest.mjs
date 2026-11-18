#!/usr/bin/env node
// Automated playtester. Plays the real game in a hidden browser with bot players,
// then writes playtest/report.json (full data) and playtest/report.md (short summary for AI bots).
//
//   npm run playtest                 # default: 3 bots x 5 game-minutes
//   npm run playtest -- --minutes 10 --speed 4 --bots careful,rusher
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'playtest');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = +arg('minutes', 5);
const SPEED = +arg('speed', 4);
const BOTS = arg('bots', 'careful,rusher,greedy').split(',');

// ---- tiny static server ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || p.includes(`${path.sep}.git`)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => server.listen(0, r));
const URL = `http://localhost:${server.address().port}/index.html`;

// ---- bot brains (run inside the page) ----
const BOT_SRC = `
// Bots act through a human-like delay: they see the game, decide, and their hands catch up REACTION seconds later.
window.__bot = function (strategy) {
  const g = __game; let lastS = -1, sameFor = 0;
  const REACT = { careful: 0.22, rusher: 0.26, greedy: 0.26 }[strategy];
  const READ_TIME = { careful: 4, rusher: 2, greedy: 3 }[strategy];   // seconds spent reading the board
  const PRIORITY = { careful: ['psi','servo','sensor','coils','dies','sign'], rusher: ['psi','coils','dies','servo','sign','sensor'], greedy: ['psi','sign','dies','servo','coils','sensor'] }[strategy];
  const reserve = strategy === 'careful' ? 60 : 0;
  let queue = [], want = null, reading = 0;
  const intend = (on, fine) => { const k = on + ':' + fine; if (want === k) return; want = k; queue.push({ at: g.simTime + REACT * (0.8 + Math.random() * 0.4), on, fine }); };
  window.__botStep = (dt) => {
    while (queue.length && queue[0].at <= g.simTime) { const a = queue.shift(); g.hold(a.on, a.fine); }
    const j = g.job;
    if (!j) {
      if (want !== 'false:false') intend(false, false);
      reading -= dt; if (reading > 0) return; reading = READ_TIME;
      if (g.save.ingots >= (strategy === 'greedy' ? 1 : 4)) g.sell();
      for (const id of PRIORITY) { const c = g.upgradeCost(id); if (g.save.cash - c >= reserve && c < Infinity) { g.buy(id); break; } }
      let os = g.orders.filter(o => o.feasible);
      if (!os.length) { const bad = g.orders[0]; if (bad && g.orders.length >= 3) g.decline(bad.id); return; }
      if (strategy === 'greedy') os.sort((a, b) => b.pay - a.pay);
      if (strategy === 'careful') os = os.filter(o => o.type !== 'crate').concat(os.filter(o => o.type === 'crate'));
      g.accept(os[0].id); want = null; queue = [];
      return;
    }
    if (j.resolved || j.ruptured) { intend(false, false); return; }
    if (Math.abs(j.s - lastS) < 1e-6 && j.contact) sameFor += dt; else sameFor = 0; lastS = j.s;
    if (sameFor > 25) { window.__stuck = (window.__stuck || 0) + 1; sameFor = 0; }

    if (j.type === 'scrap' || j.type === 'crate' || !j.contact) return intend(true, false);
    const lead = j.rate * REACT;   // how far it will move before my hands react
    if (j.type === 'flatten') {
      const rem = j.target - j.s;
      if (strategy === 'careful') {
        if (rem - lead > 0.06) intend(true, false);
        else if (rem - lead > 0.006) intend(true, true);
        else { intend(false, false); if (g.canDeliver()) g.deliver(); }
      } else {
        if (rem - lead * 0.5 > 0.01) intend(true, false);
        else { intend(false, false); if (g.canDeliver()) g.deliver(); }
      }
      return;
    }
    if (j.type === 'crack') {
      if (!j.cracked) intend(true, strategy === 'careful' ? j.s > 0.06 : false);
      else { intend(false, false); if (g.canDeliver()) g.deliver(); }
    }
  };
};`;

// ---- run ----
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const results = [];
for (const strat of BOTS) {
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/GL Driver|favicon/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => { localStorage.clear(); __game.reset(); });
  await page.evaluate(s => __game.setTimeScale(s), SPEED);
  await page.addScriptTag({ content: BOT_SRC });
  await page.evaluate(s => __bot(s), strat);
  const t0 = Date.now(), fpsSamples = [];
  const timeline = [];
  while (true) {
    await page.waitForTimeout(2000);
    const snap = await page.evaluate(() => ({ t: __game.simTime, cash: __game.save.cash, rep: __game.save.rep, stars: __game.stars(), psi: __game.maxPsi(), lv: { ...__game.save.lv } }));
    timeline.push(snap);
    if (snap.t >= MINUTES * 60) break;
    if (Date.now() - t0 > MINUTES * 60 * 1000 * 3 / SPEED + 120000) { errors.push('timeout: sim ran too slowly'); break; }
  }
  fpsSamples.push(await page.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); })));
  const data = await page.evaluate(() => ({ log: __game.log, save: __game.save, stuck: window.__stuck || 0, simTime: __game.simTime, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }));
  results.push({ bot: strat, errors, timeline, fps: fpsSamples[0], ...data });
  await page.close();
  console.log(`✓ ${strat}: ${data.save.stats.jobs} jobs, $${Math.round(data.save.cash)}, rep ${data.save.rep}`);
}
await browser.close(); server.close();

// ---- analyse ----
function analyse(r) {
  const res = r.log.filter(e => e.ev === 'resolve');
  const byType = {};
  for (const e of res) {
    const b = byType[e.type] ||= { n: 0, ok: 0, perfect: 0, fail: 0, pay: 0 };
    b.n++; b.pay += e.pay;
    if (e.result === 'perfect') { b.ok++; b.perfect++; } else if (['good', 'crushed'].includes(e.result)) b.ok++; else if (e.result === 'close') b.close = (b.close || 0) + 1; else b.fail++;
  }
  const failsByItem = {};
  for (const e of res.filter(e => ['over', 'ruined', 'close'].includes(e.result))) failsByItem[e.item] = (failsByItem[e.item] || 0) + 1;
  const buys = r.log.filter(e => e.ev === 'buy').map(e => `${e.id}${e.lv}@${Math.round(e.t)}s`);
  const starTimes = []; let st = 0;
  for (const s of r.timeline) if (s.stars > st) { st = s.stars; starTimes.push(`★${st}@${Math.round(s.t)}s`); }
  const mins = r.simTime / 60;
  const declines = r.log.filter(e => e.ev === 'decline').length;
  const loot = r.log.filter(e => e.ev === 'loot').map(e => e.kind);
  return { bot: r.bot, minutes: +mins.toFixed(1), jobs: res.length, jobsPerMin: +(res.length / mins).toFixed(2), cash: Math.round(r.save.cash), earned: r.save.stats.earned, earnedPerMin: Math.round(r.save.stats.earned / mins), rep: r.save.rep, stars: starTimes, byType, failsByItem, upgrades: buys, finalLevels: r.save.lv, declines, loot, stuck: r.stuck, fps: r.fps, heapMB: r.mem, errors: r.errors.slice(0, 10) };
}
const summary = results.map(analyse);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), minutes: MINUTES, speed: SPEED, summary, raw: results.map(r => ({ bot: r.bot, log: r.log.slice(-400), timeline: r.timeline })) }, null, 1));

const md = [`# Playtest report`, ``, `${new Date().toLocaleString()} · ${MINUTES} game-minutes per bot · speed ${SPEED}x`, ``,
  `Bots: **careful** uses FINE near targets · **rusher** never uses FINE · **greedy** takes the best-paying job and sells often.`, ``];
for (const s of summary) {
  md.push(`## ${s.bot}`, ``,
    `- Jobs: ${s.jobs} (${s.jobsPerMin}/min) · Earned: $${s.earned} ($${s.earnedPerMin}/min) · Cash left: $${s.cash} · Rep: ${s.rep}`,
    `- Star milestones: ${s.stars.join(', ') || 'none'}`,
    `- Results by job type: ${Object.entries(s.byType).map(([k, v]) => `${k} ${v.ok}/${v.n} ok (${v.perfect} perfect, ${v.close || 0} close, ${v.fail} failed)`).join(' · ') || 'none'}`,
    `- Failures by item: ${Object.entries(s.failsByItem).map(([k, v]) => `${k}×${v}`).join(', ') || 'none'}`,
    `- Upgrades (id+level@time): ${s.upgrades.join(' ') || 'none'}`,
    `- Declined orders: ${s.declines} · Crate loot: ${s.loot.join(', ') || 'none'} · Stuck events: ${s.stuck}`,
    `- FPS (headless, software GPU): ${s.fps} · Heap: ${s.heapMB ?? '?'} MB`,
    `- Errors: ${s.errors.length ? s.errors.join(' | ') : 'none'}`, ``);
}
md.push(`## Things to check`, ``,
  `- Is any job type failing more than 30% of the time for the careful bot? → too hard or a bug.`,
  `- Does rusher do almost as well as careful? → FINE control doesn't matter enough.`,
  `- How long until ★1 and ★2? Target: ★1 within ~4 min, ★2 within ~12 min.`,
  `- Any errors or stuck events? → bug.`, ``);
fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
console.log(`\nWrote playtest/report.md and playtest/report.json`);
