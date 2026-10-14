// Deep identification module: identifyCard(photo, hint) → one decision from pluggable adapters.
// Adapters: { name, kind: 'device'|'cloud', available(hint), run(photo, hint) → { game, ranked, conf, back?, ai?, parsed? } }
// On-device (DINOv2 artwork + OCR + free card DBs) is primary and always runs; cloud vision via the proxy is optional.
const IDCore = (() => {
  // Every call ends in a decision: result, guesses (retake: true), back, or nothing-found with what OCR read (read.text) – never silent. Hard timeout 45s (the app shows a 'taking longer' option at 15s).
  const adapters = [], RETAKE = 0.3, GAMES = ['pokemon', 'magic', 'yugioh', 'lorcana'];
  const nn = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const register = a => { const i = adapters.findIndex(x => x.name === a.name); i >= 0 ? adapters.splice(i, 1, a) : adapters.push(a); };
  // Guess the game from general OCR text (used when the user picked "Auto").
  function guessGames(text) {
    const t = text || '', s = { pokemon: 0, magic: 0, yugioh: 0, lorcana: 0 };
    if (/\bHP\s?\d{2,3}|\d{2,3}\s?HP\b|weakness|resistance|retreat|pok[eé]mon|\bBasic\b|Stage\s?[12]|Trainer/i.test(t)) s.pokemon += 2;
    if (/ATK\s?\/|DEF\s?\/|\b[A-Z0-9]{2,5}-[A-Z]{0,2}\d{3}\b|\[.*(Warrior|Spellcaster|Dragon|Fiend|Machine|Effect).*\]|Spell Card|Trap Card/i.test(t)) s.yugioh += 2;
    if (/Creature\s*[—-]|Instant|Sorcery|Enchantment|Artifact|Planeswalker|Legendary|Wizards of the Coast|Illus\.|\bTM\s*&|tap:|\{T\}/i.test(t)) s.magic += 2;
    if (/Lorcana|Disney|Inkwell|\bLore\b|Storyborn|Dreamborn|Floodborn/i.test(t)) s.lorcana += 3;
    return GAMES.slice().sort((a, b) => s[b] - s[a]).filter(g => s[g] > 0);
  }
  // Evidence = how well the OCR text agrees with the top database match (name similarity + collector number/set code).
  const evidence = r => { const t = r.ranked?.[0]; return t ? (t._name || 0) * 0.7 + (t._num || 0) * 0.3 : 0; };
  // Calibrate confidence: never trust artwork alone, and a right name with an unconfirmed print is only "probably".
  function calibrate(o) { const t = o.ranked[0]; if (!t) return o; const ev = evidence(o);
    o.conf = Math.min(o.conf, 0.25 + 0.75 * ev);
    if (!t._num && o.ranked.slice(1, 6).some(c => nn(c.name) === nn(t.name))) o.conf = Math.min(o.conf, 0.55);
    o.evidence = ev; return o; }
  async function sportsRun(photo, h) { const t = performance.now(); const { canvas } = await ID.rectify(photo, h.quad); console.log('[t] rectify ' + Math.round(performance.now() - t) + 'ms'); const r = await Sports.identify(canvas, h.step, Math.max(2500, Math.min(h.game === 'sports' ? 7000 : 9000, (h.deadline || Infinity) - performance.now() - 2500))); IDCore.last = { text: r.text, parsed: r.parsed }; return r; }
  register({ name: 'device', kind: 'device', available: () => true, async run(photo, h) {
    if (h.game === 'sports') return sportsRun(photo, h);
    let games = GAMES.includes(h.game) ? [h.game] : null, text = '';
    const quick = async () => { try { const r = await readCard(photo); text = r.text; IDCore.last = { text }; } catch {} return text; };
    if (!games) { h.step('Working out the card type…'); await quick(); if (!guessGames(text).length || Sports.looksSports(text)) { const sp = await sportsRun(photo, h); if (sp.parsed?.verified || Sports.looksSports(text) && sp.ranked.length) return sp; h.sportsTried = sp; }
      games = [...new Set([...guessGames(text), ...GAMES.slice(0, 3)])]; }
    else { await quick(); // selected TCG but the card has none of its text cues → likely a sports card: try that first (fast)
      if (!guessGames(text).length || Sports.looksSports(text)) { const sp = await sportsRun(photo, h); if (sp.parsed?.verified && (sp.parsed.athlete || sp.parsed.sports || Sports.looksSports(text))) return sp; h.sportsTried = sp; } }
    let best = null;
    for (const g of games) {
      const r = await ID.run(photo, g, h.step, null, h.quad);
      IDCore.last = { text: text || [...(r.parsed?.raw || r.parsed?.names || [])].join('\n'), parsed: r.parsed };
      if (r.back) { best = best || { back: true, ranked: [], conf: 0.6, game: g }; break; }
      const o = calibrate({ game: g, ranked: r.ranked, conf: r.confidence, parsed: r.parsed });
      if (!best || best.back || o.evidence > best.evidence + 0.05 || (o.evidence > best.evidence - 0.05 && o.conf > best.conf)) best = o;
      if (best.evidence >= 0.95 && best.conf >= 0.6) break;
    }
    // Wrong card type picked (e.g. a sports card while "Pokémon" is selected)? Check for sports text before giving up.
    if (!best || best.back || (best.evidence ?? 0) < 0.6) { const prev = IDCore.last; const sp = h.sportsTried || await sportsRun(photo, h);
      if (sp.ranked.length && sp.parsed?.verified && (sp.parsed.athlete || sp.parsed.sports || best?.back || !best?.ranked?.length)) return sp; if (!best?.ranked?.length) IDCore.last = sp.text ? IDCore.last : prev; }
    return best || { ranked: [], conf: 0 };
  } });
  register({ name: 'cloud', kind: 'cloud', available: () => typeof AI !== 'undefined' && AI.available(), async run(photo, h) {
    h.step('Identifying with AI vision…');
    const v = await AI.identify(h.cropped ? await h.cropped() : photo, GAMES.includes(h.game) || h.game === 'sports' ? h.game : '');
    if (v.is_back) return { back: true, ranked: [], conf: 0.8, ai: v };
    if (!v.name) return { ranked: [], conf: 0, ai: v };
    const g = v.game && v.game !== 'other' ? v.game : h.game, out = { ai: v, game: g, mode: 'ai', ranked: [], conf: v.confidence ?? 0.5 };
    if (g === 'sports' || !Adapters[g]) return out;
    h.step('Confirming the exact print…');
    let ranked = (await ID.run(photo, g, h.step, { name: v.name, number: v.number, total: v.total, setCode: v.setCode }, h.quad)).ranked;
    if (!ranked.length) ranked = await Adapters[g].search(v.name, v.number).catch(() => []);
    ranked.forEach(c => { c.score = (c.score || 0) + (nn(c.name) === nn(v.name) ? 0.3 : 0) + (v.number && nn(c.number) === nn(v.number) ? 0.5 : 0) + (v.setCode && (nn(c.number) === nn(v.setCode) || nn(c.setCode) === nn(v.setCode)) ? 0.4 : 0) + (v.set && nn(c.set).includes(nn(v.set).slice(0, 8)) ? 0.15 : 0); });
    ranked.sort((a, b) => b.score - a.score); out.ranked = ranked;
    const t = ranked[0]; out.conf = t ? Math.min(1, (v.confidence ?? 0.7) * 0.5 + (nn(t.name) === nn(v.name) ? 0.25 : 0) + (v.number && nn(t.number) === nn(v.number) || v.setCode && nn(t.number) === nn(v.setCode) ? 0.25 : 0)) : 0;
    return out;
  } });
  // Combine: run every available adapter in parallel, auto-pick the most confident, boost when they agree, ask for a retake when nothing is confident.
  async function identifyCard(photo, hint = {}) {
    const h = { game: 'auto', quad: null, step: () => {}, ...hint }, use = adapters.filter(a => (!h.only || h.only.includes(a.name)) && a.available(h));
    IDCore.last = null; const T = h.timeoutMs ?? (h.game === 'sports' ? 10000 : 45000); h.deadline = performance.now() + T;
    const runs = await Promise.all(use.map(async a => { const t0 = performance.now(); try {
      const r = await Promise.race([a.run(photo, h), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), T))]); return { adapter: a.name, ...r, ms: performance.now() - t0 }; }
      catch (e) { return { adapter: a.name, error: e.message, ranked: [], conf: 0 }; } }));
    const timedOut = runs.every(r => r.error === 'timeout');
    const ok = runs.filter(r => !r.error), id = r => r.ranked?.[0]?.id;
    ok.forEach(r => { if (r.ranked?.length && ok.some(o => o !== r && id(o) && id(o) === id(r))) r.conf = Math.min(1, r.conf + 0.2); });
    const backs = ok.filter(r => r.back), cands = ok.filter(r => !r.back && (r.ranked?.length || r.mode === 'ai'));
    let best = cands.sort((a, b) => b.conf - a.conf)[0];
    if (!best && backs.length) return { back: true, adapter: backs[0].adapter, runs, ranked: [], conf: backs[0].conf };
    if (!best) return { retake: true, timeout: timedOut, read: IDCore.last, ranked: [], conf: 0, runs, error: runs.map(r => r.error).filter(Boolean).join('; ') };
    // merge alternatives from the other adapters (deduped) so "Not right?" shows everything
    const seen = new Set(best.ranked.map(id => id.id)), alts = ok.filter(r => r !== best).flatMap(r => r.ranked || []).filter(c => !seen.has(c.id) && seen.add(c.id));
    return { ...best, read: IDCore.last, ranked: [...best.ranked, ...alts.slice(0, 6)], runs, retake: best.conf < RETAKE && best.mode !== 'ai', agree: ok.filter(r => id(r) && id(r) === id(best)).length };
  }
  return { last: null, identifyCard, register, adapters, guessGames, RETAKE };
})();
const identifyCard = IDCore.identifyCard;
