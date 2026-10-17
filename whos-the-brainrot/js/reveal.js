// The dramatic vote reveal: drumroll + spotlight sweep across names -> slam on the voted player -> verdict.
// Built as a clip-friendly ~4s moment; Clip Mode adds a 3-2-1, captions and a watermark for screen recording.
import { sfx } from './audio.js';
import { buzz } from './haptics.js';
import { confetti } from './fx.js';
import { brainrotSVG } from './art.js';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** names[], voted (index or -1 for tie), isHidden(i) -> bool, opts {clip, fast, label}. Resolves when the verdict is on screen. */
export async function playReveal(stage, { names, voted, isHidden, clip = false, fast = false, hiddenLabel = 'the Brainrot' }) {
  const T = fast ? 0.25 : 1;
  stage.hidden = false; stage.className = clip ? 'clip' : ''; stage.innerHTML = '';
  const top = el('div', 'cap top', clip ? "Who's the Brainrot? 🧠" : 'The votes are in…'); stage.append(top);
  if (clip) stage.append(el('div', 'wm', "WHO'S THE BRAINROT? · play free"));
  if (clip && !fast) { for (const n of ['3', '2', '1']) { const c = el('div', 'cd', n); stage.append(c); sfx.tick(n === '1'); buzz('tap'); await sleep(750); c.remove(); } }
  // name ring
  const ring = el('div', 'ring'); stage.append(ring);
  const cx = innerWidth / 2, cy = innerHeight * 0.48, R = Math.min(innerWidth * 0.36, 180);
  const chips = names.map((n, i) => { const a = -Math.PI / 2 + (i / names.length) * Math.PI * 2; const c = el('div', 'nchip', esc(n)); c.style.left = cx + Math.cos(a) * R + 'px'; c.style.top = cy + Math.sin(a) * R * 1.15 + 'px'; ring.append(c); return c; });
  const spot = el('div', 'spot'); ring.append(spot);
  sfx.drumroll(2.6 * T);
  // spotlight sweep that slows down and lands on the voted player (or keeps spinning on a tie)
  let i = Math.floor(Math.random() * names.length), gap = 70;
  const n = names.length, base = n * Math.ceil(Math.max(12, 2 * n) / n);
  const steps = base + ((((voted >= 0 ? voted : i) - i + 1) % n) + n) % n; // last lit chip == voted
  for (let s = 0; s < steps; s++) {
    chips.forEach(c => c.classList.remove('lit')); const c = chips[i % names.length]; c.classList.add('lit'); spot.style.left = c.style.left; spot.style.top = c.style.top;
    sfx.tick(false); await sleep(gap * T); gap *= 1.09; i++;
  }
  const landed = (i - 1) % names.length;
  await sleep(380 * T);
  ring.remove(); top.textContent = voted < 0 ? "It's a TIE!" : (clip ? 'And the Brainrot is…' : 'You voted out…');
  const hero = el('div', 'hero'); stage.append(hero);
  if (voted < 0) {
    hero.innerHTML = `<div class="nm">Nobody!</div><div class="verdict no">The vote was split…</div>`;
    hero.classList.add('show'); sfx.buzzer(); buzz('heavy'); stage.classList.add('flashG');
  } else {
    hero.innerHTML = `<div class="nm">${esc(names[landed])}</div>`; hero.classList.add('show'); sfx.boom(); buzz('heavy');
    await sleep(900 * T); // the beat before the verdict
    const yes = isHidden(landed);
    const v = el('div', `verdict ${yes ? 'yes' : 'no'}`, yes ? `WAS ${esc(hiddenLabel).toUpperCase()}!` : `was NOT ${esc(hiddenLabel)}…`);
    if (yes) { hero.insertAdjacentHTML('afterbegin', brainrotSVG(220)); hero.append(v); stage.classList.add('flashR'); stage.classList.add('shake'); sfx.brainrot(); setTimeout(() => sfx.horn(), 500 * T); confetti(160, undefined, '🧠'); buzz('success'); }
    else { hero.append(v); stage.classList.add('flashG'); sfx.sad(); buzz('error'); }
  }
  await sleep((clip ? 1600 : 700) * T);
  return landed;
}
export function closeStage(stage) { stage.hidden = true; stage.innerHTML = ''; }
function el(tag, cls, html = '') { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; }
