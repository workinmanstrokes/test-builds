// Sound (WebAudio synth, no asset files), haptics, particles, screen shake, win banners.
let ctx, master; const S = { sound: true, haptics: true };
export function fxSettings(o){ Object.assign(S, o) }
function ac(){ if(!ctx){ const C = window.AudioContext || window.webkitAudioContext; if(!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = .35; master.connect(ctx.destination) } if(ctx.state==='suspended') ctx.resume(); return ctx }
function tone(freq, dur=.08, type='square', vol=.25, when=0, slide=0){
  if(!S.sound) return; const a = ac(); if(!a) return; const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
function noise(dur=.05, vol=.15, when=0){ if(!S.sound) return; const a = ac(); if(!a) return; const b = a.createBuffer(1, a.sampleRate*dur, a.sampleRate), d = b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length); const s=a.createBufferSource(), g=a.createGain(); g.gain.value=vol; s.buffer=b; s.connect(g); g.connect(master); s.start(a.currentTime+when) }
export const sfx = {
  click(){ tone(660,.04,'triangle',.15) },
  tick(p=1){ tone(900*p,.025,'square',.06) },
  stop(){ tone(180,.07,'triangle',.3); noise(.04,.08) },
  chip(){ noise(.03,.2); tone(1400,.03,'sine',.1) },
  card(){ noise(.06,.18) },
  lose(){ tone(300,.18,'sawtooth',.1,0,-120); tone(220,.25,'sawtooth',.08,.12,-80) },
  win(){ [523,659,784].forEach((f,i)=>tone(f,.12,'square',.14,i*.08)) },
  big(){ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,.16,'square',.16,i*.09)); noise(.4,.05,.6) },
  tension(){ tone(220,1.1,'sawtooth',.07,0,440) },
  coin(i=0){ tone(1500+((i*137)%600),.06,'sine',.08,i*.03) },
  level(){ [392,523,659,784,1047].forEach((f,i)=>tone(f,.2,'triangle',.18,i*.1)) },
};
export function buzz(pattern=15){
  if(!S.haptics) return; const H = window.Capacitor?.Plugins?.Haptics;
  try { if(H){ if(Array.isArray(pattern)) H.vibrate({duration: pattern.reduce((a,b)=>a+b,0)}); else if(pattern<25) H.impact({style:'LIGHT'}); else if(pattern<60) H.impact({style:'MEDIUM'}); else H.vibrate({duration:pattern}); return } } catch{}
  navigator.vibrate?.(pattern);
}
export function shake(level=1){ const el=document.getElementById('app'); el.classList.remove('shake','shake2'); void el.offsetWidth; el.classList.add(level>1?'shake2':'shake') }
export function coinBurst(n=24, from){
  const layer = document.getElementById('fx') ; const r = from?.getBoundingClientRect?.() || {left:innerWidth/2-20,top:innerHeight/2-20,width:40,height:40};
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  for(let i=0;i<n;i++){ const c=document.createElement('i'); c.className='coin'; c.textContent=i%5?'◈':'✦';
    const ang=Math.random()*Math.PI*2, d=80+Math.random()*180; c.style.left=cx+'px'; c.style.top=cy+'px';
    c.style.setProperty('--dx', Math.cos(ang)*d+'px'); c.style.setProperty('--dy', (Math.sin(ang)*d-120)+'px'); c.style.animationDelay=(i*12)+'ms';
    layer.appendChild(c); setTimeout(()=>c.remove(), 1400); if(i<10) sfx.coin(i) }
}
// Win tiers relative to the bet: big >=10x, mega >=25x, epic >=50x.
export function winTier(win, bet){ const m = win/bet; return m>=50?'EPIC WIN':m>=25?'MEGA WIN':m>=10?'BIG WIN':'' }
export function bigWinBanner(label, amount, done){
  const layer=document.getElementById('fx'); const el=document.createElement('div'); el.className='bigwin '+label.split(' ')[0].toLowerCase();
  el.innerHTML=`<div class="bw-label">${label}</div><div class="bw-amt">◈ 0</div><small>tap to collect</small>`; layer.appendChild(el);
  sfx.big(); buzz([60,40,60,40,120]); shake(2); coinBurst(40);
  const t0=performance.now(), dur=1600; let raf; const step=t=>{const p=Math.min(1,(t-t0)/dur); el.querySelector('.bw-amt').textContent='◈ '+Math.floor(amount*(1-Math.pow(1-p,3))).toLocaleString(); if(p<1) raf=requestAnimationFrame(step)}; raf=requestAnimationFrame(step);
  const close=()=>{cancelAnimationFrame(raf); el.remove(); done?.()}; el.onclick=close; setTimeout(()=>el.isConnected&&close(), 3800);
}
