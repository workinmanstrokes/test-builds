// Gore-free jump scare: "the Hall Monitor", a tall figure with a blank paper face and hollow eyes, rushes the screen.
// No blood, no injury. 'soft' mode (Settings) keeps it at a distance with a gentler sting.
import { Pen, INK } from './sketch.js';
export function playScare(canvas, soft = false, noFlash = false) {
  return new Promise(res => {
    const c = canvas.getContext('2d'), d = Math.min(2, devicePixelRatio || 1); canvas.hidden = false;
    const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight; canvas.width = W * d; canvas.height = H * d;
    const dur = soft ? 1.3 : 1.05, t0 = performance.now(), P = new Pen(c);
    const draw = () => {
      const t = (performance.now() - t0) / 1000, k = Math.min(1, t / (soft ? 0.9 : 0.28));
      c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = t < 0.06 && !noFlash ? '#fff' : '#060508'; c.fillRect(0, 0, W, H);
      const s = (soft ? 0.35 + k * 0.25 : 0.25 + Math.pow(k, 2) * 1.25) * Math.min(W, H) / 400, jx = soft ? 0 : (Math.random() - 0.5) * 14, jy = soft ? 0 : (Math.random() - 0.5) * 14;
      c.save(); c.translate(W / 2 + jx, H * 0.55 + jy); c.scale(s, s); c.globalAlpha = soft ? Math.min(1, t * 2) : 1;
      // body
      c.fillStyle = '#121016'; c.beginPath(); c.moveTo(-170, 420); c.lineTo(-120, 40); c.quadraticCurveTo(0, -20, 120, 40); c.lineTo(170, 420); c.closePath(); c.fill();
      P.at('hm').line(-60, 60, 0, 150, 4, '#3a3540'); P.line(60, 60, 0, 150, 4, '#3a3540');
      c.fillStyle = '#b9b29a'; c.beginPath(); c.arc(0, 160, 10, 0, 7); c.fill(); c.strokeStyle = '#b9b29a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 150); c.lineTo(-20, 60); c.stroke(); // whistle on a lanyard
      // head: blank paper face
      P.ellipse(0, -90, 92, 118, '#ece6d4', INK, 5);
      c.fillStyle = '#060508'; c.beginPath(); c.ellipse(-34, -100, 16, 26 + (soft ? 0 : Math.sin(t * 40) * 3), 0, 0, 7); c.ellipse(34, -100, 16, 26, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(0, -18, 26, 6 + k * 22, 0, 0, 7); c.fill();
      P.line(-80, -170, 80, -175, 3, '#8f8875'); // paper crease
      c.restore();
      if (!soft && !noFlash && t > 0.12 && t < 0.4 && Math.random() < 0.5) { c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(0, 0, W, H); }
      if (t < dur) requestAnimationFrame(draw); else { canvas.hidden = true; res(); }
    };
    requestAnimationFrame(draw);
  });
}
