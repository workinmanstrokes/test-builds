// Confetti / brain-splat particles on a full-screen canvas.
const cv = document.getElementById('fx'), g = cv.getContext('2d');
let parts = [], raf = 0;
function size() { const d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', size); size();
export function confetti(n = 140, colors = ['#ff2e88', '#ffd60a', '#2ee6d6', '#fff', '#8b5cf6'], emoji = null) {
  for (let i = 0; i < n; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, r: Math.random() * 6 + 4, c: colors[i % colors.length], a: Math.random() * 6, va: (Math.random() - .5) * .4, life: 1, e: emoji && i % 6 === 0 ? emoji : null });
  if (!raf) raf = requestAnimationFrame(step);
}
function step() {
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; p.life -= .014;
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.min(1, p.life * 2);
    if (p.e) { g.font = '26px system-ui'; g.fillText(p.e, -13, 9); } else { g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r, p.r, p.r * 2); }
    g.restore();
  }
  raf = parts.length ? requestAnimationFrame(step) : 0;
  if (!raf) g.clearRect(0, 0, innerWidth, innerHeight);
}
