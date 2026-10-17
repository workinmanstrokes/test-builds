// Procedural SVG art for the original characters: body shape + gradient + googly face + accessory + limbs.
// Same character id always renders the same; returns an SVG string (viewBox 0 0 200 200).
const H = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const SH = {
  round: { top: 52, bot: 168, fy: 100, hw: 50, d: 'M100 52a58 58 0 1 1-.1 0z' },
  blob: { top: 56, bot: 170, fy: 104, hw: 52, d: 'M100 56c34-2 66 18 64 56s-14 56-40 58-56 2-74-14-20-58-4-80 22-18 54-20z' },
  box: { top: 55, bot: 165, fy: 100, hw: 48, d: 'M67 55h66a22 22 0 0 1 22 22v66a22 22 0 0 1-22 22H67a22 22 0 0 1-22-22V77a22 22 0 0 1 22-22z' },
  tall: { top: 34, bot: 176, fy: 86, hw: 34, d: 'M96 34h8a34 34 0 0 1 34 34v74a34 34 0 0 1-34 34h-8a34 34 0 0 1-34-34V68a34 34 0 0 1 34-34z' },
  tri: { top: 38, bot: 170, fy: 120, hw: 40, d: 'M92 44c4-8 12-8 16 0l58 112c4 10-2 16-12 16H46c-10 0-16-6-12-16z' },
  long: { top: 36, bot: 180, fy: 92, hw: 40, d: 'M100 36c26 0 44 30 44 72s-18 72-44 72-44-30-44-72 18-72 44-72z' },
  drop: { top: 34, bot: 172, fy: 118, hw: 46, d: 'M100 34c18 30 56 62 56 92a56 56 0 0 1-112 0c0-30 38-62 56-92z' },
  star: { top: 36, bot: 168, fy: 106, hw: 40, d: 'M100 36l18 40 44 6-32 30 8 44-38-22-38 22 8-44-32-30 44-6z' },
  bean: { top: 54, bot: 168, fy: 102, hw: 50, d: 'M78 56c30-8 70 4 80 34s-4 70-38 76-74-4-80-36 8-66 38-74z' },
};
const eye = (x, y, r, px, py, lid) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#1a1027" stroke-width="3"/><circle cx="${x + px}" cy="${y + py}" r="${r * 0.48}" fill="#1a1027"/><circle cx="${x + px - r * .18}" cy="${y + py - r * .2}" r="${r * .15}" fill="#fff"/>${lid ? `<path d="M${x - r - 1} ${y - 1}a${r + 1} ${r + 1} 0 0 1 ${2 * r + 2} 0z" fill="${lid}" stroke="#1a1027" stroke-width="3"/>` : ''}`;
const MOUTH = [
  (y) => `<path d="M84 ${y}q16 16 32 0" fill="none" stroke="#1a1027" stroke-width="4" stroke-linecap="round"/>`,
  (y) => `<path d="M82 ${y - 2}q18 26 36 0z" fill="#5c1a33" stroke="#1a1027" stroke-width="3.5" stroke-linejoin="round"/><path d="M92 ${y + 8}q8 6 16 0" fill="#ff6b8a"/>`,
  (y) => `<ellipse cx="100" cy="${y + 4}" rx="8" ry="10" fill="#5c1a33" stroke="#1a1027" stroke-width="3.5"/>`,
  (y) => `<path d="M82 ${y + 2}q6-6 12 0t12 0 12 0" fill="none" stroke="#1a1027" stroke-width="4" stroke-linecap="round"/>`,
  (y) => `<path d="M80 ${y - 2}h40q-4 20-20 20t-20-20z" fill="#fff" stroke="#1a1027" stroke-width="3.5" stroke-linejoin="round"/><path d="M90 ${y - 2}v8M100 ${y - 2}v10M110 ${y - 2}v8" stroke="#1a1027" stroke-width="2.5"/>`,
  (y) => `<path d="M86 ${y + 6}q14-12 28 0" fill="none" stroke="#1a1027" stroke-width="4" stroke-linecap="round"/>`,
];
function acc(kind, t, a, b) {
  const o = 'stroke="#1a1027" stroke-width="3.5" stroke-linejoin="round"';
  switch (kind) {
    case 'hat': return `<path d="M70 ${t + 2}h60l-8-30H78z" fill="#1a1027"/>`;
    case 'crown': return `<path d="M74 ${t + 6}l-4-28 16 14 14-20 14 20 16-14-4 28z" fill="#ffd60a" ${o}/><circle cx="100" cy="${t - 8}" r="4" fill="#e63946"/>`;
    case 'shades': return '';
    case 'glasses': return '';
    case 'mustache': return '';
    case 'propeller': return `<path d="M100 ${t}v-14" ${o}/><path d="M72 ${t - 18}q28-10 56 0q-28 10-56 0z" fill="#e63946" ${o}/><circle cx="100" cy="${t - 18}" r="5" fill="#ffd60a" ${o}/>`;
    case 'horns': return `<path d="M70 ${t + 14}q-14-20-4-36q6 18 18 26z" fill="#e63946" ${o}/><path d="M130 ${t + 14}q14-20 4-36q-6 18-18 26z" fill="#e63946" ${o}/>`;
    case 'bow': return `<path d="M100 ${t + 2}l-26-14v28zM100 ${t + 2}l26-14v28z" fill="#ff4d9d" ${o}/><circle cx="100" cy="${t + 2}" r="6" fill="#ff4d9d" ${o}/>`;
    case 'headphones': return `<path d="M58 ${t + 50}q0-60 42-60t42 60" fill="none" stroke="#1a1027" stroke-width="7"/><rect x="48" y="${t + 40}" width="16" height="28" rx="6" fill="${b}" ${o}/><rect x="136" y="${t + 40}" width="16" height="28" rx="6" fill="${b}" ${o}/>`;
    case 'chef': return `<path d="M76 ${t + 4}v-16a14 14 0 0 1 12-22a16 16 0 0 1 24 0a14 14 0 0 1 12 22v16z" fill="#fff" ${o}/>`;
    case 'pirate': return `<path d="M60 ${t + 6}q40-46 80 0z" fill="#1a1027" ${o}/><circle cx="100" cy="${t - 8}" r="5" fill="#fff"/>`;
    case 'witch': return `<path d="M62 ${t + 6}h76" stroke="#1a1027" stroke-width="7" stroke-linecap="round"/><path d="M76 ${t + 4}l30-46-2 16 18 30z" fill="#3c096c" ${o}/>`;
    case 'halo': return `<ellipse cx="100" cy="${t - 14}" rx="26" ry="7" fill="none" stroke="#ffd60a" stroke-width="5"/>`;
    case 'antenna': return `<path d="M90 ${t + 2}q-6-18-16-26M110 ${t + 2}q6-18 16-26" fill="none" ${o}/><circle cx="74" cy="${t - 24}" r="6" fill="${a}" ${o}/><circle cx="126" cy="${t - 24}" r="6" fill="${a}" ${o}/>`;
    case 'bandana': return `<path d="M66 ${t + 18}q34-14 68 0v10q-34-12-68 0z" fill="#e63946" ${o}/><path d="M134 ${t + 22}l14 6-12 8z" fill="#e63946" ${o}/>`;
    case 'cape': return '';
    case 'flower': return `<g transform="translate(124 ${t + 4})">${[0, 72, 144, 216, 288].map(r => `<ellipse rx="6" ry="11" transform="rotate(${r}) translate(0 -9)" fill="#ff4d6d" ${o}/>`).join('')}<circle r="6" fill="#ffd60a" ${o}/></g>`;
    default: return '';
  }
}
function limbs(kind, s, a, b) {
  const o = 'stroke="#1a1027" stroke-width="4" stroke-linecap="round" fill="none"';
  const y = s.bot, fy = s.fy + 30, hw = s.hw + 8;
  switch (kind) {
    case 'legs': return `<path d="M86 ${y - 6}v20h-10M114 ${y - 6}v20h10" ${o}/>`;
    case 'arms': return `<path d="M${100 - hw} ${fy}q-18 4-22-16M${100 + hw} ${fy}q18 4 22-16" ${o}/><path d="M86 ${y - 6}v18M114 ${y - 6}v18" ${o}/>`;
    case 'wheels': return `<circle cx="78" cy="${y + 6}" r="11" fill="#2b2d42" stroke="#1a1027" stroke-width="3"/><circle cx="122" cy="${y + 6}" r="11" fill="#2b2d42" stroke="#1a1027" stroke-width="3"/><circle cx="78" cy="${y + 6}" r="4" fill="#adb5bd"/><circle cx="122" cy="${y + 6}" r="4" fill="#adb5bd"/>`;
    case 'tentacles': return [72, 88, 104, 120].map((x, i) => `<path d="M${x + 4} ${y - 10}q${i % 2 ? 8 : -8} 14 0 26" ${o}/>`).join('');
    case 'wings': return `<path d="M${100 - hw} ${s.fy}q-36-30-44 6q20-6 26 10q8-12 18-6z" fill="${b}" stroke="#1a1027" stroke-width="3.5" stroke-linejoin="round"/><path d="M${100 + hw} ${s.fy}q36-30 44 6q-20-6-26 10q-8-12-18-6z" fill="${b}" stroke="#1a1027" stroke-width="3.5" stroke-linejoin="round"/>`;
    default: return '';
  }
}
export function charSVG(c, { size = 200, bg = true } = {}) {
  const s = SH[c.shape] || SH.round, h = H(c.id), gid = 'g' + h.toString(36);
  const er = 11 + (h % 6), gap = 16 + ((h >>> 3) % 8), px = ((h >>> 5) % 7) - 3, py = ((h >>> 8) % 5) - 2;
  const lid = (h >>> 11) % 5 === 0 ? c.b : '';
  const mouth = MOUTH[(h >>> 13) % MOUTH.length](s.fy + 28);
  const one = c.name.startsWith('Nacho');
  const eyes = one ? eye(100, s.fy, er + 6, px, py, '') : eye(100 - gap, s.fy, er, px, py, lid) + eye(100 + gap, s.fy + ((h >>> 15) % 3) - 1, er * (0.85 + ((h >>> 17) % 4) / 10), px, py, lid);
  const face = `${eyes}${mouth}<circle cx="${100 - gap - 8}" cy="${s.fy + 20}" r="6" fill="#ff6b8a" opacity=".45"/><circle cx="${100 + gap + 8}" cy="${s.fy + 20}" r="6" fill="#ff6b8a" opacity=".45"/>`;
  const o = 'stroke="#1a1027" stroke-width="3.5" stroke-linejoin="round"';
  const over = c.acc === 'shades' ? `<path d="M${100 - gap - er - 4} ${s.fy - 8}h${2 * (gap + er + 4)}" stroke="#1a1027" stroke-width="4"/><rect x="${100 - gap - er - 3}" y="${s.fy - 9}" width="${2 * er + 6}" height="${er + 8}" rx="6" fill="#1a1027"/><rect x="${100 + gap - er - 3}" y="${s.fy - 9}" width="${2 * er + 6}" height="${er + 8}" rx="6" fill="#1a1027"/><path d="M${100 - gap - er + 2} ${s.fy - 4}l8 0" stroke="#fff" stroke-width="3" opacity=".6"/>`
    : c.acc === 'glasses' ? `<circle cx="${100 - gap}" cy="${s.fy}" r="${er + 5}" fill="none" stroke="#1a1027" stroke-width="4"/><circle cx="${100 + gap}" cy="${s.fy}" r="${er + 5}" fill="none" stroke="#1a1027" stroke-width="4"/><path d="M${100 - gap + er + 5} ${s.fy}h${2 * (gap - er - 5)}" stroke="#1a1027" stroke-width="4"/>`
    : c.acc === 'mustache' ? `<path d="M100 ${s.fy + 20}c-8-8-26-6-30 8 10-4 20-2 30-2 10 0 20-2 30 2-4-14-22-16-30-8z" fill="#1a1027"/>` : '';
  const cape = c.acc === 'cape' ? `<path d="M${100 - s.hw} ${s.fy + 8}L${100 - s.hw - 22} ${s.bot + 10}H${100 + s.hw + 22}L${100 + s.hw} ${s.fy + 8}z" fill="#c1121f" ${o}/>` : '';
  const spark = [0, 1, 2].map(i => { const x = 24 + ((h >>> (i * 4)) % 150), y = 20 + ((h >>> (i * 5 + 2)) % 50); return `<path d="M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity=".7"/>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${c.name}">
<defs><radialGradient id="${gid}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></radialGradient></defs>
${bg ? `<circle cx="100" cy="104" r="96" fill="${c.b}" opacity=".18"/>${spark}` : ''}
<g transform="translate(100 100) scale(.82) translate(-100 -100)"><ellipse cx="100" cy="${s.bot + 20}" rx="54" ry="8" fill="#000" opacity=".18"/>
${cape}${limbs(c.limbs, s, c.a, c.b)}
<path d="${s.d}" fill="url(#${gid})" ${o}/>
<path d="${s.d}" fill="none" stroke="#fff" stroke-width="5" opacity=".18" transform="translate(-3 -3)"/>
${face}${over}${acc(c.acc, s.top, c.a, c.b)}</g>
</svg>`;
}
export const brainrotSVG = (size = 200) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="Brainrot">
<defs><radialGradient id="br" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ff8fd8"/><stop offset="1" stop-color="#c9184a"/></radialGradient></defs>
<circle cx="100" cy="104" r="96" fill="#ff2e88" opacity=".16"/>
<path d="M60 80c-20 0-28 30-12 42-8 22 14 40 32 30 10 18 40 18 50 0 18 10 40-8 32-30 16-12 8-42-12-42 0-22-30-32-44-16-14-16-46-6-46 16z" fill="url(#br)" stroke="#1a1027" stroke-width="4" stroke-linejoin="round"/>
<path d="M78 70q10 14 0 28M104 62q-6 18 6 30M128 76q-10 12 2 26M70 118q16-6 26 6M110 122q12-12 28-4" fill="none" stroke="#1a1027" stroke-width="3.5" stroke-linecap="round" opacity=".55"/>
<g><circle cx="82" cy="112" r="14" fill="#fff" stroke="#1a1027" stroke-width="3"/><path d="M74 104l16 16M90 104l-16 16" stroke="#1a1027" stroke-width="4" stroke-linecap="round"/></g>
<g><circle cx="122" cy="108" r="17" fill="#fff" stroke="#1a1027" stroke-width="3"/><path d="M122 108m-9 0a9 9 0 1 0 18 0a5 5 0 1 0-10 0" fill="none" stroke="#1a1027" stroke-width="3.5" stroke-linecap="round"/></g>
<path d="M86 140q14 10 30-2" fill="none" stroke="#1a1027" stroke-width="4" stroke-linecap="round"/><path d="M104 142q4 12 10 4" fill="#ff6b8a" stroke="#1a1027" stroke-width="2.5"/>
<path d="M38 52l6 10M162 50l-6 10M100 18v12" stroke="#ffd60a" stroke-width="5" stroke-linecap="round"/>
</svg>`;
