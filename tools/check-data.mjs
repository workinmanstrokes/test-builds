#!/usr/bin/env node
// Validates data.js so bot edits can't break the game. Run: npm run check
import { ITEMS, CUSTOMERS, LINES } from '../data.js';

const errs = [];
const SHAPES = ['can', 'box', 'crate', 'ball', 'geode', 'bar', 'safe', 'engine', 'core'];
const ids = new Set();
for (const it of ITEMS) {
  const at = `item "${it.id}"`;
  if (!it.id || ids.has(it.id)) errs.push(`${at}: id missing or duplicated`); ids.add(it.id);
  for (const k of ['name', 'icon', 'kind', 'shape']) if (typeof it[k] !== 'string' || !it[k]) errs.push(`${at}: "${k}" must be a non-empty string`);
  for (const k of ['reqPsi', 'scrap', 'pay', 'tier', 'color', 'metal', 'rough']) if (typeof it[k] !== 'number') errs.push(`${at}: "${k}" must be a number`);
  if (!['flatten', 'crack', 'crate'].includes(it.kind)) errs.push(`${at}: kind must be flatten, crack or crate`);
  if (!SHAPES.includes(it.shape)) errs.push(`${at}: shape must be one of ${SHAPES.join(', ')}`);
  if (it.tier < 0 || it.tier > 5) errs.push(`${at}: tier must be 0-5`);
  if (it.reqPsi < 10 || it.reqPsi > 900) errs.push(`${at}: reqPsi must be 10-900 (max press is 885)`);
  if (it.metal < 0 || it.metal > 1 || it.rough < 0 || it.rough > 1) errs.push(`${at}: metal/rough must be 0-1`);
  if (it.kind === 'crack') {
    for (const k of ['crackMin', 'crackMax', 'windowMin', 'windowMax', 'inner']) if (typeof it[k] !== 'number') errs.push(`${at}: crack items need "${k}"`);
    if (!(it.crackMin < it.crackMax && it.crackMax < 0.6)) errs.push(`${at}: need crackMin < crackMax < 0.6`);
    if (!(it.windowMin > 0.01 && it.windowMin < it.windowMax && it.windowMax < 0.2)) errs.push(`${at}: need 0.01 < windowMin < windowMax < 0.2`);
  } else {
    if (!(it.breakMin > 0.3 && it.breakMin < it.breakMax && it.breakMax <= 0.95)) errs.push(`${at}: need 0.3 < breakMin < breakMax <= 0.95`);
  }
}
for (const t of [0, 1]) if (!ITEMS.some(i => i.tier === t && i.kind !== 'crate')) errs.push(`need at least one non-crate item at tier ${t}`);
for (const c of CUSTOMERS) if (!c.name || !c.biz) errs.push(`customer ${JSON.stringify(c)}: needs name and biz`);
for (const k of ['flatten', 'scrap', 'crack', 'crate', 'success', 'fail']) {
  if (!Array.isArray(LINES[k]) || !LINES[k].length) errs.push(`LINES.${k} must be a non-empty list`);
  else for (const l of LINES[k]) {
    if (typeof l !== 'string' || l.length > 120) errs.push(`LINES.${k}: lines must be strings under 120 chars: ${String(l).slice(0, 40)}`);
    if (k === 'flatten' && !l.includes('{target}')) errs.push(`LINES.flatten must include {target}: "${l}"`);
  }
}
if (errs.length) { console.error('✗ data.js has problems:\n  - ' + errs.join('\n  - ')); process.exit(1); }
console.log(`✓ data.js OK — ${ITEMS.length} items, ${CUSTOMERS.length} customers, ${Object.values(LINES).flat().length} lines`);
