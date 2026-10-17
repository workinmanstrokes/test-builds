// Illustrations for the three endings, drawn in the same hand-drawn style.
import { Pen, INK, paperize, HAND } from './sketch.js';
import { drawFace } from './scenes.js';
export function drawEnding(canvas, id) {
  const W = 900, H = 600; canvas.width = W; canvas.height = H; const c = canvas.getContext('2d'), P = new Pen(c).at('end' + id);
  if (id === 'normal') { // double doors thrown open onto a sunny afternoon
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f9d9a0'); g.addColorStop(1, '#f6efd9'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    P.rect(0, 0, W, 90, '#d7d0bf', null); P.rect(0, 90, 230, 420, '#e8ddc3', null); P.rect(670, 90, 230, 420, '#e8ddc3', null);
    c.fillStyle = '#fff4d0'; c.fillRect(230, 90, 440, 420); c.fillStyle = '#8aa864'; c.fillRect(230, 400, 440, 110);
    P.circle(560, 190, 60, '#ffe08a', null); for (let i = 0; i < 4; i++) P.circle(300 + i * 110, 380 - (i % 2) * 20, 55, ['#d07a2c', '#e0a03a', '#c4572a', '#cf8f3a'][i], INK, 2);
    P.poly([[230, 90], [130, 60], [130, 540], [230, 510]], '#8b8270'); P.poly([[670, 90], [770, 60], [770, 540], [670, 510]], '#8b8270');
    P.poly([[150, 140], [205, 150], [205, 300], [150, 300]], '#fbf1d2'); P.poly([[695, 150], [750, 140], [750, 300], [695, 300]], '#fbf1d2');
    P.rect(0, 510, W, 90, '#d4c9b0', null); P.line(0, 510, W, 510, 3);
    c.fillStyle = 'rgba(30,20,10,0.75)'; c.beginPath(); c.ellipse(450, 470, 26, 34, 0, 0, 7); c.fill(); c.fillRect(428, 495, 44, 70);
  } else if (id === 'secret') { // a door marked 9 that was never there, glowing
    c.fillStyle = '#18141f'; c.fillRect(0, 0, W, H); const g = c.createRadialGradient(450, 300, 30, 450, 300, 420); g.addColorStop(0, 'rgba(242,201,76,0.55)'); g.addColorStop(1, 'rgba(242,201,76,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    P.rect(340, 110, 220, 420, '#2a2230'); c.fillStyle = '#fff3c4'; c.fillRect(352, 122, 196, 408); P.poly([[352, 122], [300, 100], [300, 560], [352, 530]], '#5b4a3b');
    P.rect(590, 230, 70, 74, '#2e3a5a'); P.text('ROOM', 625, 248, 13, '#e9e2c8', 'center', 'system-ui', 700); P.text('9', 625, 278, 34, '#f2c94c', 'center', 'system-ui', 900);
    c.save(); c.translate(450, 470); c.rotate(-0.1); P.rect(-60, -36, 120, 72, '#f2c94c', '#8a6a12', 3); P.text('HALL PASS', 0, 0, 20, '#5a3d00', 'center', 'system-ui', 900); c.restore();
  } else { // bad: you, at a desk in Room 8, the clock stuck at 2:52
    c.fillStyle = '#2b3330'; c.fillRect(0, 0, W, H); P.rect(140, 70, 620, 260, '#24382e', '#6b5236', 3);
    for (let i = 0; i < 5; i++) P.chalk('I will stay after class.', 180, 110 + i * 44, 30);
    P.circle(450, 40, 30, '#f7f2e4'); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(450, 40); c.lineTo(450, 22); c.moveTo(450, 40); c.lineTo(440, 46); c.stroke();
    P.poly([[330, 470], [570, 470], [610, 520], [290, 520]], '#a6845a'); P.poly([[380, 470], [395, 380], [505, 380], [520, 470]], '#6d6a7a');
    drawFace(P, 450, 340, 46, { skin: '#d9c7b2', hair: '#3b2a20', eyes: 'down' });
    P.rect(0, 520, W, 80, '#4a3b2e', null);
  }
  paperize(c, W, H, 11);
}
