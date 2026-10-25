import {ICON_SPRITE, SLOT_ICONS, icon, suitIcon} from './icons.js';
const KEY='spinanddeal-state-v1'; const LEGACY_KEYS=['freq0ff-state-v1']; // pre-rename save key, migrated once in load()
const fresh={coins:10000,xp:0,level:1,lastDaily:'',totalSpins:0,playStarted:Date.now(),limits:{reminder:30},slotHistory:[],rouletteHistory:[]};
let state=load(); let view='lobby'; let bet=100; let roulettePick='red'; let deck=[]; let player=[]; let dealer=[]; let toastTimer; let spinning=false;
const $=s=>document.querySelector(s); const app=$('#app');
document.body.insertAdjacentHTML('afterbegin', ICON_SPRITE);
function migrate(){try{if(localStorage.getItem(KEY)!==null)return;for(const k of LEGACY_KEYS){const v=localStorage.getItem(k);if(v!==null){localStorage.setItem(KEY,v);localStorage.removeItem(k);return}}}catch{}}
function load(){migrate();try{return {...fresh,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...fresh}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function rand(max){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%max}
function money(n){return Math.max(0,n).toLocaleString()}
function notify(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
function earnXP(n){state.xp+=n;const need=state.level*500;if(state.xp>=need){state.xp-=need;state.level++;state.coins+=1000;notify(`Level ${state.level}! +1,000 coins`)}save()}
function spend(n){if(state.coins<n){notify('Not enough coins');return false}state.coins-=n;save();return true}
function header(title='Spin & Deal'){return `<div class="topbar"><div class="brand">${title.replace('& Deal','<span>&amp; Deal</span>')}</div><div class="wallet">${icon('i-gem','',  'url(#gGem)')}${money(state.coins)}</div></div>`}
function nav(active='lobby'){const items=[['lobby','i-crown','Casino'],['rewards','i-gift','Rewards'],['store','i-wallet','Store'],['profile','i-profile','Profile']];return `<nav class="nav">${items.map(([v,ic,label])=>`<button data-view="${v}" class="${active===v?'active':''}">${icon(ic)}${label}</button>`).join('')}</nav>`}
function wire(){document.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>{if(spinning)return;view=x.dataset.view;render()})}
function screen(html){return `<div class="screen-in">${html}</div>`}
function render(){if(view==='lobby')lobby();else if(view==='slots')slots();else if(view==='roulette')roulette();else if(view==='blackjack')blackjack();else if(view==='rewards')rewards();else if(view==='store')store();else profile();wire()}

function lobby(){const pct=Math.floor(state.xp/(state.level*500)*100);app.innerHTML=screen(`${header()}<section class="hero"><div class="eyebrow">SOCIAL CASINO • FREE PLAY</div><h1>Turn up<br>your fortune.</h1><div class="row"><p>Level ${state.level} • ${state.xp}/${state.level*500} XP</p><span>${pct}%</span></div><div class="progress"><i style="width:${pct}%"></i></div></section><div class="grid"><article class="card daily wide"><div class="row"><div><span class="tag">DAILY DROP</span><h3>Free coin vault</h3><p class="muted">Return every day to build your streak.</p></div><button class="button" data-view="rewards">Claim</button></div></article><article class="card game-card" data-view="slots"><div class="game-icon gem">${icon('i-gem','',  'url(#gGem)')}</div><div><span class="tag">FEATURED</span><h3>Neon Fortune</h3><p class="muted">3-reel original slot</p></div></article><article class="card game-card" data-view="blackjack"><div class="game-icon">${icon('i-suit-spade')}</div><div><span class="tag">TABLE</span><h3>Blackjack</h3><p class="muted">Dealer stands on 17</p></div></article><article class="card game-card wide" data-view="roulette"><div class="row"><div><div class="game-icon chip">${icon('i-chip','','url(#gGold)')}</div><span class="tag">TABLE</span><h3>Roulette Rush</h3><p class="muted">Red, black, green</p></div><button class="button pink">Play</button></div></article></div>${nav('lobby')}`)}

const symbolKeys=Object.keys(SLOT_ICONS);
const weights=symbolKeys.map(k=>SLOT_ICONS[k].weight);
function symbolKey(){let n=rand(weights.reduce((a,b)=>a+b,0));for(let i=0;i<weights.length;i++){if(n<weights[i])return symbolKeys[i];n-=weights[i]}return symbolKeys[0]}
function reelHTML(key){const s=SLOT_ICONS[key];return icon(s.id,'reel-icon',s.fill)}
function historyDots(hist,render){return `<div class="history">${hist.length?hist.map(render).join(''):'<span class="muted" style="font-size:12px">No spins yet</span>'}</div>`}
function slots(){app.innerHTML=screen(`${header()}<div class="screen-head"><button class="back" data-view="lobby">‹</button><div><h2 style="margin:0">Neon Fortune</h2><small class="muted">Virtual coins only</small></div></div><article class="card slot-machine"><div class="eyebrow">MATCH 3 TO WIN</div><div class="reels"><div class="reel" id="r1">${reelHTML('gem')}</div><div class="reel" id="r2">${reelHTML('seven')}</div><div class="reel" id="r3">${reelHTML('bell')}</div></div><div class="betbar"><button id="betDown">−</button><b>BET <span id="bet">${money(bet)}</span></b><button id="betUp">+</button></div><div class="result" id="result">Good luck!</div><button class="button spin" id="spin">SPIN</button></article><div class="section-title small">Recent spins</div>${historyDots(state.slotHistory,k=>`<span class="hdot">${icon(SLOT_ICONS[k].id,'',SLOT_ICONS[k].fill)}</span>`)}<p class="notice">Prize table: three diamonds 20×; three 7s 15×; any other triple 8×; any pair 2×. For entertainment only — virtual coins have no cash value.</p>${nav()}`);$('#betDown').onclick=()=>{bet=Math.max(50,bet-50);$('#bet').textContent=money(bet)};$('#betUp').onclick=()=>{bet=Math.min(1000,bet+50);$('#bet').textContent=money(bet)};$('#spin').onclick=spin;wire()}

function spin(){
  if(spinning||!spend(bet))return;
  spinning=true;
  $('#spin').disabled=true;$('#result').textContent='';$('#result').className='result';
  const reels=[$('#r1'),$('#r2'),$('#r3')];
  reels.forEach(r=>r.classList.add('spinning'));
  const out=[symbolKey(),symbolKey(),symbolKey()];
  const ticks=[10,14,18];
  reels.forEach((r,i)=>{
    let n=0;
    const iv=setInterval(()=>{
      n++;
      r.innerHTML=reelHTML(symbolKey());
      if(n>=ticks[i]){clearInterval(iv);r.innerHTML=reelHTML(out[i]);r.classList.remove('spinning');r.classList.add('landed');
        if(i===2)finishSpin(out);
      }
    },70+i*12);
  });
}
function finishSpin(out){
  let mult=0;if(out.every(x=>x===out[0]))mult=out[0]==='gem'?20:out[0]==='seven'?15:8;else if(new Set(out).size===2)mult=2;
  const win=bet*mult;state.coins+=win;state.totalSpins++;
  state.slotHistory.unshift(out[0]);state.slotHistory.length=Math.min(8,state.slotHistory.length);save();earnXP(25);
  const r=$('#result');r.textContent=win?`WIN! +${money(win)} coins`:'Spin again';r.className='result'+(win?' win':'');
  $('.wallet').innerHTML=icon('i-gem','','url(#gGem)')+money(state.coins);
  $('#spin').disabled=false;spinning=false;
  const strip=$('.history');if(strip)strip.outerHTML=historyDots(state.slotHistory,k=>`<span class="hdot">${icon(SLOT_ICONS[k].id,'',SLOT_ICONS[k].fill)}</span>`);
}

const WHEEL_COLORS=['green','red','black'];
function rouletteColorFor(n){return n===0?'green':n%2?'red':'black'}
function roulette(){app.innerHTML=screen(`${header()}<div class="screen-head"><button class="back" data-view="lobby">‹</button><div><h2 style="margin:0">Roulette Rush</h2><small class="muted">Bet ${money(bet)} coins</small></div></div><article class="card" style="text-align:center"><div class="wheel-wrap"><div class="wheel-pointer"></div><div class="roulette-wheel" id="wheel"><b id="ball">${icon('i-gem','',  'url(#gGem)')}</b></div></div><div class="choices"><button class="choice red selected" data-pick="red">RED<br>2×</button><button class="choice black" data-pick="black">BLACK<br>2×</button><button class="choice green" data-pick="green">GREEN<br>14×</button></div><div class="result" id="result">Choose a color</div><button class="button spin" id="roll">SPIN WHEEL</button></article><div class="section-title small">Recent spins</div>${historyDots(state.rouletteHistory,r=>`<span class="hdot ${r.color}">${r.n}</span>`)}${nav()}`);
  document.querySelectorAll('[data-pick]').forEach(x=>x.onclick=()=>{if(spinning)return;roulettePick=x.dataset.pick;document.querySelectorAll('[data-pick]').forEach(b=>b.classList.toggle('selected',b===x))});
  $('#roll').onclick=rollWheel;wire()}
let wheelRotation=0;
function rollWheel(){
  if(spinning||!spend(bet))return;
  spinning=true;$('#roll').disabled=true;
  const n=rand(37);const color=rouletteColorFor(n);
  const wheel=$('#wheel');
  wheelRotation+=360*4+rand(360);
  wheel.style.transform=`rotate(${wheelRotation}deg)`;
  $('#result').textContent='Spinning…';$('#result').className='result';
  setTimeout(()=>{
    $('#ball').textContent=n;$('#ball').classList.add(color);
    let win=0;if(color===roulettePick)win=bet*(color==='green'?14:2);
    state.coins+=win;save();earnXP(20);
    state.rouletteHistory.unshift({n,color});state.rouletteHistory.length=Math.min(8,state.rouletteHistory.length);save();
    const r=$('#result');r.textContent=win?`${color.toUpperCase()}! +${money(win)}`:`${color.toUpperCase()} — try again`;r.className='result'+(win?' win':'');
    $('.wallet').innerHTML=icon('i-gem','','url(#gGem)')+money(state.coins);
    const strip=$('.history');if(strip)strip.outerHTML=historyDots(state.rouletteHistory,r=>`<span class="hdot ${r.color}">${r.n}</span>`);
    $('#roll').disabled=false;spinning=false;
  },2600);
}

const suits=['♠','♥','♦','♣'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function newDeck(){deck=suits.flatMap(s=>ranks.map(r=>({s,r})));for(let i=deck.length-1;i;i--){const j=rand(i+1);[deck[i],deck[j]]=[deck[j],deck[i]]}}
function value(hand){let v=hand.reduce((n,c)=>n+(c.r==='A'?11:['J','Q','K'].includes(c.r)?10:+c.r),0),a=hand.filter(c=>c.r==='A').length;while(v>21&&a--){v-=10}return v}
function cards(hand,hide=false){return hand.map((c,i)=>hide&&i===1?`<div class="playing-card back deal-in" style="animation-delay:${i*90}ms"><span class="back-mark">${icon('i-gem','',  'url(#gGem)')}</span></div>`:`<div class="playing-card ${['♥','♦'].includes(c.s)?'red-suit':''} deal-in" style="animation-delay:${i*90}ms"><span>${c.r}</span>${suitIcon(c.s)}</div>`).join('')}
function handLabel(hand,hide){if(!hand.length)return'';const v=hide?value([hand[0]]):value(hand);return hide?'':` (${v})`}
function blackjack(){app.innerHTML=screen(`${header()}<div class="screen-head"><button class="back" data-view="lobby">‹</button><div><h2 style="margin:0">Blackjack</h2><small class="muted">Bet ${money(bet)} coins</small></div></div><article class="card felt" style="text-align:center"><span class="tag">DEALER<span id="dealerVal"></span></span><div class="hand" id="dealer">${dealer.length?cards(dealer,true):''}</div><span class="tag">YOUR HAND<span id="playerVal">${handLabel(player,false)}</span></span><div class="hand" id="player">${player.length?cards(player):''}</div><div class="result" id="result">Get as close to 21 as possible</div><div class="actions"><button class="button" id="deal">DEAL</button><button class="button secondary" id="hit" disabled>HIT</button><button class="button secondary" id="stand" disabled>STAND</button></div></article>${nav()}`);$('#deal').onclick=deal;$('#hit').onclick=hit;$('#stand').onclick=stand;wire()}
function deal(){if(!spend(bet))return;newDeck();player=[deck.pop(),deck.pop()];dealer=[deck.pop(),deck.pop()];updateHands(true);$('#deal').disabled=true;$('#hit').disabled=false;$('#stand').disabled=false;if(value(player)===21)stand()}
function updateHands(hide){$('#player').innerHTML=cards(player);$('#dealer').innerHTML=cards(dealer,hide);$('#playerVal').textContent=handLabel(player,false);$('#dealerVal').textContent=hide?'':handLabel(dealer,false);$('.wallet').innerHTML=icon('i-gem','','url(#gGem)')+money(state.coins)}
function hit(){player.push(deck.pop());updateHands(true);if(value(player)>21)finishBJ('Bust — dealer wins',0);else if(value(player)===21)stand()}
function stand(){while(value(dealer)<17)dealer.push(deck.pop());const p=value(player),d=value(dealer);let win=0,msg='';if(p>21)msg='Bust — dealer wins';else if(d>21||p>d){win=p===21&&player.length===2?Math.floor(bet*2.5):bet*2;msg=`You win! +${money(win)}`}else if(p===d){win=bet;msg='Push — bet returned'}else msg='Dealer wins';finishBJ(msg,win)}
function finishBJ(msg,win){state.coins+=win;save();earnXP(30);updateHands(false);const r=$('#result');r.textContent=msg;r.className='result'+(win>0?' win':'');$('#deal').disabled=false;$('#hit').disabled=true;$('#stand').disabled=true}

function rewards(){const today=new Date().toISOString().slice(0,10),ready=state.lastDaily!==today;app.innerHTML=screen(`${header()}<section class="hero"><div class="eyebrow">COME BACK DAILY</div><h1>Your rewards.</h1></section><article class="card daily"><div class="game-icon">${icon('i-gift')}</div><h2>Daily Vault</h2><p class="muted">Claim 2,500 free virtual coins once per day.</p><br><button class="button" id="claim" ${ready?'':'disabled'}>${ready?'CLAIM 2,500':'CLAIMED TODAY'}</button></article><h2 class="section-title">How rewards work</h2><p class="notice">Rewards have no cash value. No purchase is required. Daily rewards reset using your device's date.</p>${nav('rewards')}`);$('#claim').onclick=()=>{state.coins+=2500;state.lastDaily=today;save();notify('+2,500 coins');render()};wire()}

function store(){app.innerHTML=screen(`${header()}<section class="hero"><div class="eyebrow">STORE PREVIEW</div><h1>Coin vault.</h1><p>Purchases are coming in a future update.</p></section>${[['Starter Stack','10,000 coins','$0.99'],['Lucky Vault','65,000 coins','$4.99'],['High Roller','150,000 coins','$9.99'],['Royal Club','Daily coins • No ads','$9.99/mo']].map(x=>`<article class="card store-item locked"><div><h3>${x[0]}</h3><span class="muted">${x[1]}</span></div><div class="soon-badge">${icon('i-lock')}Soon</div></article>`).join('')}<p class="notice">Virtual currency has no monetary value and cannot be transferred, redeemed, or exchanged for cash or prizes.</p>${nav('store')}`);wire()}

function profile(){app.innerHTML=screen(`${header()}<section class="hero"><div class="eyebrow">PLAYER PROFILE</div><h1>Level ${state.level}</h1><p>${state.xp}/${state.level*500} XP to next level</p></section><article class="card"><div class="row"><span>Total slot spins</span><b>${state.totalSpins}</b></div><hr style="border-color:#ffffff12"><div class="row"><span>Current balance</span><b>${money(state.coins)}</b></div></article><h2 class="section-title">Responsible play</h2><article class="card"><label class="row"><span>Session reminder</span><select id="reminder"><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option></select></label><br><button class="button secondary" id="reset">Reset my progress</button></article><p class="notice">For entertainment only. No real-money gambling or prizes. Take regular breaks and never treat simulated outcomes as predictions.</p>${nav('profile')}`);$('#reminder').value=state.limits.reminder;$('#reminder').onchange=e=>{state.limits.reminder=+e.target.value;save()};$('#reset').onclick=()=>{if(confirm('Reset coins, level, and progress?')){state={...fresh,limits:{...fresh.limits},slotHistory:[],rouletteHistory:[]};save();render()}};wire()}

setInterval(()=>{const mins=(Date.now()-state.playStarted)/60000;if(mins>=state.limits.reminder){state.playStarted=Date.now();save();notify(`You've played ${state.limits.reminder} minutes — consider a break.`)}},30000);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});render();
