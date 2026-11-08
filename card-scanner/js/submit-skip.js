/* Submit-or-skip decision for Card PreGrade (v1.3.0).
 * One plain call per scan: SUBMIT this card for grading, SKIP it and sell raw,
 * or UNSURE when the inputs are too thin to call it. Pure functions (no network,
 * no DOM) so Node tests can load them.
 *
 * Inputs (see decideSubmit): the on-device grade estimate + range, the 0-100
 * match score + "unsure" flags from the full-ID step, the raw card value, and
 * the PSA 9 / PSA 10 prices from CardSight completed auctions. Nothing is
 * invented: a grade price with no completed sales behind it is a labelled
 * fallback to the overall sales median, and a call that leans on a fallback
 * is capped at UNSURE. PSA/BGS population data has no free API, so pop is
 * never used and never shown.
 *
 * Fee table: PSA's own published trading-card tiers, read from
 * https://www.psacard.com/services/CardsPSAGrades (checked 2026-11-08).
 * Value Bulk is paused, so it is not a tier you can pick. Fees change often;
 * the app lets the user edit the fee and the return shipping, stored on-device.
 * Return shipping defaults to $20 (PSA's return-postage chart starts at $19.99
 * for 1-4 cards) and is labelled an estimate in the UI. */
(function (root) {
  'use strict';

  // ---------- PSA fee tiers (published, checked 2026-11-08) ----------
  const FEE_SOURCE = 'https://www.psacard.com/services/CardsPSAGrades';
  const FEE_CHECKED = '2026-11-08';
  const PSA_FEES = [
    { tier: 'Value', fee: 39.99, maxValue: 500, turnaround: '90–100 business days', status: 'open' },
    { tier: 'Standard', fee: 59.99, maxValue: 1000, turnaround: '70–80 business days', status: 'open' },
    { tier: 'Priority', fee: 79.99, maxValue: 1500, turnaround: '50–60 business days', status: 'open' },
    { tier: 'Express', fee: 199, maxValue: 2500, turnaround: '20–30 business days', status: 'open' },
    { tier: 'Super Express', fee: 349, maxValue: 5000, turnaround: '10–15 business days', status: 'open' },
    { tier: 'Premier', fee: 599, maxValue: 10000, turnaround: '7–10 business days', status: 'open' },
    { tier: 'Premium', fee: 999, maxValue: 25000, turnaround: '5–7 business days', status: 'open', from: true },
  ];
  const DEFAULT_SHIPPING = 20; // return postage estimate; PSA chart starts at $19.99 for 1-4 cards
  const MIN_ID_SCORE = 70; // below this the card itself is not confirmed well enough to price
  const MIN_GRADE_CONFIDENCE = 0.5; // GradeCore label 'Low' is below this
  const MIN_NET_GAIN = 10; // submit only when the expected gain clears the fee by this much
  const MIN_GRADED_SALES = 2; // fewer graded sales than this and the grade prices are thin

  function money(v) { return '$' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)); }
  function median(a) { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // Cheapest open tier whose max insured value covers the declared value.
  // Declared value is the card's expected graded value (or the raw value if higher).
  function pickTier(declaredValue) {
    const v = Number(declaredValue) || 0;
    for (const t of PSA_FEES) if (v <= t.maxValue) return { ...t };
    return { ...PSA_FEES[PSA_FEES.length - 1], note: 'Declared value over $25,000 — Premium pricing starts at $999 and is quoted by PSA.' };
  }

  // Parse a CardSight sale's grade string ("PSA 9", "PSA 10", "SGC 7", "BGS 9.5", null).
  function parseGrade(g) {
    if (!g) return null;
    const m = String(g).trim().match(/^(PSA|BGS|SGC|CGC)\s*[- ]?\s*(\d+(?:\.\d+)?)$/i);
    return m ? { company: m[1].toUpperCase(), grade: +m[2] } : null;
  }

  // CardSight completed sales -> per-grade PSA prices + raw price.
  // sales: [{ price, grade }] as the Worker returns them (grade is "PSA 9" or null).
  // Returns { psa: { 9: {median, count} | null, 10: {...} | null }, raw: {median, count} | null,
  //           gradedCount, overall: {median, count} | null }.
  // A grade with no sales is null here — the fallback happens in decideSubmit, labelled.
  function gradedPrices(sales) {
    const list = (sales || []).filter(x => x && Number.isFinite(+x.price) && +x.price > 0);
    if (!list.length) return { psa: { 9: null, 10: null }, raw: null, gradedCount: 0, overall: null };
    const rawVals = [], psaVals = { 9: [], 10: [] };
    let gradedCount = 0;
    for (const s of list) {
      const g = parseGrade(s.grade);
      if (g) { gradedCount++; if (g.company === 'PSA' && (g.grade === 9 || g.grade === 10)) psaVals[g.grade].push(+s.price); }
      else rawVals.push(+s.price);
    }
    const psa = {};
    for (const gr of [9, 10]) psa[gr] = psaVals[gr].length ? { median: median(psaVals[gr]), count: psaVals[gr].length } : null;
    return { psa, raw: rawVals.length ? { median: median(rawVals), count: rawVals.length } : null,
      gradedCount, overall: { median: median(list.map(x => +x.price)), count: list.length } };
  }

  // Price to use for a given grade: the real PSA median when there is one,
  // otherwise the overall sales median, flagged estimated (never invented).
  function priceForGrade(gp, grade) {
    const real = gp && gp.psa && gp.psa[grade];
    if (real) return { value: real.median, count: real.count, estimated: false };
    if (gp && gp.overall) return { value: gp.overall.median, count: gp.overall.count, estimated: true };
    return null;
  }

  // Expected graded value: the grade estimate gets half the weight, the other
  // grades in the range share the rest. Grades outside 1..10 are not possible.
  function expectedValue(gp, range, est) {
    const lo = Math.max(1, Math.round(range[0])), hi = Math.min(10, Math.round(range[1]));
    const grades = []; for (let g = lo; g <= hi; g++) grades.push(g);
    if (!grades.length) return null;
    const centre = Math.round(est);
    let ev = 0, usedFallback = false; const parts = [];
    for (const g of grades) {
      const p = priceForGrade(gp, g);
      if (!p) return null;
      const w = g === centre && grades.includes(centre) ? 0.5 : 0.5 / (grades.length - (grades.includes(centre) ? 1 : 0));
      ev += w * p.value; if (p.estimated) usedFallback = true;
      parts.push({ grade: g, weight: +w.toFixed(2), price: p.value, estimated: p.estimated, count: p.count });
    }
    return { value: ev, grades: parts, usedFallback };
  }

  // ---------- the decision ----------
  // in: { grade: { est, range:[lo,hi], confidence }, idScore (0-100), unsure: [strings],
  //       identStatus: 'ok'|'none'|'error', rawValue (number|null), sales: [CardSight sales],
  //       fees: { fee, shipping } (optional override; defaults = cheapest tier + $20 ship) }
  // out: null when the card was not identified (no decision at all), otherwise
  // { verdict: 'SUBMIT'|'SKIP'|'UNSURE', ...numbers, reasons[], changes[] }.
  function decideSubmit(input) {
    const inp = input || {};
    if (inp.identStatus !== 'ok' || !inp.grade) return null; // unreadable / unidentified: no call
    const reasons = [], changes = [];
    const gp = gradedPrices(inp.sales || []);
    const rawValue = Number.isFinite(+inp.rawValue) && +inp.rawValue > 0 ? +inp.rawValue : (gp.raw ? gp.raw.median : null);
    const ev = expectedValue(gp, inp.grade.range || [inp.grade.est, inp.grade.est], inp.grade.est);
    const idScore = inp.idScore == null ? 0 : +inp.idScore;
    const gradeConf = inp.grade.confidence == null ? 0 : +inp.grade.confidence;
    const unsure = inp.unsure || [];
    const priceBlocking = unsure.filter(u => /variant|finish|parallel/i.test(u));

    // --- what would block a solid call, checked first and shown in the UI ---
    if (idScore < MIN_ID_SCORE) { reasons.push(`Match score ${idScore}/100 is below ${MIN_ID_SCORE} — the card itself is not confirmed well enough to price.`); changes.push('Confirm the card match (check the set and number) and re-scan.'); }
    if (gradeConf < MIN_GRADE_CONFIDENCE) { reasons.push(`Grade confidence is ${gradeConf.toFixed(2)} (Low) — the photo was not clear enough for a firm grade.`); changes.push('Retake the photo with even light and no glare.'); }
    if (priceBlocking.length) { reasons.push('Price depends on something the photo did not confirm: ' + priceBlocking.join('; ') + '.'); changes.push('Confirm the variant, finish or parallel before trusting the price.'); }
    if (!rawValue) { reasons.push('No raw price found for this card.'); changes.push('Wait for completed sales to appear, or check the eBay sold listings.'); }
    if (!ev) { reasons.push('No completed sales to price graded copies from.'); changes.push('Wait for graded sales of this card to appear.'); }
    if (gp.gradedCount < MIN_GRADED_SALES) { reasons.push(`Only ${gp.gradedCount} graded sale${gp.gradedCount === 1 ? '' : 's'} found — the PSA 9/10 prices are thin.`); changes.push('More graded sales would firm up the PSA 9/10 prices.'); }

    const thin = reasons.length > 0;
    if (!ev || !rawValue) {
      return { verdict: 'UNSURE', rawValue, gradePrices: gp, expectedValue: ev ? ev.value : null,
        fee: null, shipping: null, totalCost: null, netGain: null, reasons,
        changes: changes.length ? changes : ['More price data would firm this up.'] };
    }

    // --- costs: cheapest tier that covers the declared value, or the user's override ---
    const declared = Math.max(ev.value, rawValue);
    const tier = pickTier(declared);
    const fee = inp.fees && Number.isFinite(+inp.fees.fee) ? +inp.fees.fee : tier.fee;
    const shipping = inp.fees && Number.isFinite(+inp.fees.shipping) ? +inp.fees.shipping : DEFAULT_SHIPPING;
    const totalCost = fee + shipping;
    const netGain = ev.value - rawValue - totalCost;
    const bestGrade = Math.round(inp.grade.range[1]), best = priceForGrade(gp, bestGrade);
    const bestNet = best ? best.value - rawValue - totalCost : null;

    if (thin) {
      if (bestNet != null && bestNet >= MIN_NET_GAIN) changes.push(`If it comes back a ${bestGrade}, the net gain would be about ${money(bestNet)} — that would flip this to SUBMIT.`);
      return { verdict: 'UNSURE', rawValue, gradePrices: gp, expectedValue: ev.value, expectedParts: ev.grades,
        tier, fee, shipping, totalCost, netGain, reasons, changes };
    }
    if (netGain >= MIN_NET_GAIN) {
      return { verdict: 'SUBMIT', rawValue, gradePrices: gp, expectedValue: ev.value, expectedParts: ev.grades,
        tier, fee, shipping, totalCost, netGain, bestGrade, bestNet,
        reasons: [`Expected graded value ${money(ev.value)} beats raw ${money(rawValue)} by ${money(netGain)} after the ${money(fee)} ${tier.tier} fee and ${money(shipping)} return shipping.`],
        changes: bestNet != null && bestGrade !== Math.round(inp.grade.est) ? [`If it comes back a ${bestGrade} instead of a ${Math.round(inp.grade.est)}, the net gain would be about ${money(bestNet)}.`] : [] };
    }
    reasons.push(netGain < 0
      ? `Expected graded value ${money(ev.value)} does not cover the raw value ${money(rawValue)} plus ${money(totalCost)} in grading and shipping — you would lose about ${money(-netGain)}.`
      : `The expected gain is only ${money(netGain)}, under the $${MIN_NET_GAIN} margin worth grading for.`);
    if (bestNet != null && bestNet >= MIN_NET_GAIN) changes.push(`If it comes back a ${bestGrade}, the net gain would be about ${money(bestNet)} — that would flip this to SUBMIT.`);
    return { verdict: 'SKIP', rawValue, gradePrices: gp, expectedValue: ev.value, expectedParts: ev.grades,
      tier, fee, shipping, totalCost, netGain, bestGrade, bestNet, reasons, changes };
  }

  const api = { PSA_FEES, FEE_SOURCE, FEE_CHECKED, DEFAULT_SHIPPING, MIN_ID_SCORE, MIN_GRADE_CONFIDENCE,
    MIN_NET_GAIN, MIN_GRADED_SALES, pickTier, parseGrade, gradedPrices, priceForGrade, expectedValue,
    decideSubmit, money, median };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SubmitSkip = api;
})(typeof self !== 'undefined' ? self : this);
