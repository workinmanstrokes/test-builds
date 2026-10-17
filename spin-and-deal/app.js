import { sfx, buzz, shake, coinBurst, winTier, bigWinBanner, fxSettings } from './fx.js';
import { ADS } from './config.js';
import { initAds, showRewarded, rewardStatus, maybeInterstitial, adsState, showPrivacyOptions, removeAdsAvailable } from './ads.js';

/* ---------- state ---------- */
const KEY='spinanddeal-state-v1'; const LEGACY_KEYS=['freq0ff-state-v1']; // pre-rename save key, migrated once in load()
const fresh=()=>({coins:10000,xp:0,level:1,totalSpins:0,playStarted:Date.now(),limits:{reminder:30},
  settings:{sound:true,haptics:true},daily:{last:'',streak:0},missions:{day:'',list:[]},ach:{},
  stats:{slotWins:0,bjWins:0,bjNaturals:0,rouletteWins:0,greenHits:0,bigWins:0,megaWins:0,freeSpinRounds:0,bonusRounds:0,bestWin:0,wagered:0},
  ads:{day:'',count:0,lastReward:0,lastInter:0},noAds:false,bjStreak:0,rlStreak:0,rlHistory:[],lastRefill:0});
function migrate(){try{if(localStorage.getItem(KEY)!==null)return;for(const k of LEGACY_KEYS){const v=localStorage.getItem(k);if(v!==null){localStorage.setItem(KEY,v);localStorage.removeItem(k);return}}}catch{}}
function load(){migrate();const f=fresh();try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');const o={...f,...s};
  for(const k of ['limits','settings','daily','missions','stats','ads'])o[k]={...f[k],...(s[k]||{})};
  if(s.lastDaily&&!o.daily.last)o.daily.last=s.lastDaily;return o}catch{return f}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
let state=load(); fxSettings(state.settings);
let view='lobby', bet=100, busy=false, toastTimer, sessionStart=Date.now(), gamesToday=new Set();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], app=$('#app');
const today=()=>new Date().toISOString().slice(0,10);
const yesterday=()=>new Date(Date.now()-864e5).toISOString().slice(0,10);
function rand(max){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%max}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function money(n){return Math.max(0,Math.floor(n)).toLocaleString()}
function notify(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}

/* ---------- levels & unlocks ---------- */
const need=l=>l*500;
const maxBet=()=>Math.min(5000,500+state.level*250);
const UNLOCKS={2:'Double Down in Blackjack + inside bets in Roulette',3:'Auto-spin ×10 on slots',4:'Lucky Lanterns slot machine',5:'Bet up to 1,750',7:'Bet up to 2,250',10:'Bet up to 3,000 • Royal badge'};
const unlocked={double:()=>state.level>=2,inside:()=>state.level>=2,auto:()=>state.level>=3,lanterns:()=>state.level>=4};
function earnXP(n){state.xp+=n;let up=false;while(state.xp>=need(state.level)){state.xp-=need(state.level);state.level++;up=true;const r=1000*state.level;state.coins+=r;levelUp(state.level,r)}save();checkAch();return up}
function levelUp(l,r){sfx.level();buzz([40,30,80]);coinBurst(30);const el=document.createElement('div');el.className='levelup';el.innerHTML=`<div>LEVEL UP</div><b>${l}</b><p>+${money(r)} coins${UNLOCKS[l]?`<br><span>Unlocked: ${UNLOCKS[l]}</span>`:''}</p>`;$('#fx').appendChild(el);el.onclick=()=>el.remove();setTimeout(()=>el.remove(),3200)}
function spend(n){if(state.coins<n){outOfCoins();return false}state.coins-=n;state.stats.wagered+=n;track('wager',n);save();wallet();return true}
function pay(n){if(n<=0)return;state.coins+=n;if(n>state.stats.bestWin)state.stats.bestWin=n;save();wallet()}
let shown=0;function wallet(){const el=$('.wallet');if(!el)return;const from=shown,to=state.coins,t0=performance.now();shown=to;const step=t=>{const p=Math.min(1,(t-t0)/500);el.textContent='◈ '+money(from+(to-from)*p);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step);el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}

/* ---------- missions ---------- */
const MISSION_POOL=[
  {id:'spin',text:'Spin the slots 20 times',goal:20,ev:'spin',coins:1500,xp:150},
  {id:'slotwin',text:'Win 6 slot spins',goal:6,ev:'slotwin',coins:1500,xp:150},
  {id:'bjwin',text:'Win 3 Blackjack hands',goal:3,ev:'bjwin',coins:2000,xp:200},
  {id:'rlwin',text:'Win 3 Roulette spins',goal:3,ev:'rlwin',coins:2000,xp:200},
  {id:'variety',text:'Play all 3 game types',goal:3,ev:'variety',coins:2500,xp:250},
  {id:'big',text:'Land a Big Win (10×+)',goal:1,ev:'big',coins:3000,xp:300},
  {id:'free',text:'Trigger Free Spins',goal:1,ev:'free',coins:3000,xp:300},
  {id:'wager',text:'Bet 10,000 coins total',goal:10000,ev:'wager',coins:2000,xp:200},
  {id:'streak',text:'Win 2 Blackjack hands in a row',goal:1,ev:'bjstreak2',coins:2500,xp:250},
];
function ensureMissions(){if(state.missions.day===today())return;const pool=[...MISSION_POOL],list=[];let seed=+today().replace(/-/g,'');while(list.length<3){seed=(seed*9301+49297)%233280;const m=pool.splice(seed%pool.length,1)[0];list.push({id:m.id,prog:0,claimed:false})}state.missions={day:today(),list};gamesToday=new Set();save()}
function track(ev,n=1){ensureMissions();for(const m of state.missions.list){const d=MISSION_POOL.find(x=>x.id===m.id);if(d.ev!==ev||m.prog>=d.goal)continue;m.prog=Math.min(d.goal,m.prog+n);if(m.prog>=d.goal){notify(`Mission complete: ${d.text}`);sfx.win()}}}
function playedGame(g){gamesToday.add(g);ensureMissions();const m=state.missions.list.find(x=>x.id==='variety');if(m)m.prog=Math.max(m.prog,gamesToday.size)}

/* ---------- achievements ---------- */
const ACH=[
  ['first','First Win','Win anything',s=>s.stats.slotWins+s.stats.bjWins+s.stats.rouletteWins>0,500,'🥇'],
  ['spins100','Reel Regular','Spin 100 times',s=>s.totalSpins>=100,2000,'🎰'],
  ['spins1k','Reel Legend','Spin 1,000 times',s=>s.totalSpins>=1000,10000,'👑'],
  ['big','Big Winner','Land a Big Win',s=>s.stats.bigWins>0,2000,'💥'],
  ['mega','Mega Moment','Land a Mega Win',s=>s.stats.megaWins>0,5000,'🌟'],
  ['natural','Natural 21','Get a Blackjack',s=>s.stats.bjNaturals>0,1500,'🂡'],
  ['green','Green Machine','Hit zero in Roulette',s=>s.stats.greenHits>0,3000,'🟢'],
  ['free','Free Spinner','Trigger Free Spins',s=>s.stats.freeSpinRounds>0,1500,'⭐'],
  ['bonus','Box Opener','Play a Pick Bonus',s=>s.stats.bonusRounds>0,1500,'🎁'],
  ['streak7','Loyal Player','7-day login streak',s=>s.daily.streak>=7,7000,'📅'],
  ['lvl5','Rising Star','Reach level 5',s=>s.level>=5,3000,'⬆️'],
  ['lvl10','High Roller','Reach level 10',s=>s.level>=10,10000,'💎'],
];
function checkAch(){for(const [id,name,,test,coins] of ACH){if(!state.ach[id]&&test(state)){state.ach[id]=Date.now();state.coins+=coins;notify(`🏆 ${name} +${money(coins)}`);sfx.win();buzz(40)}}save();wallet()}

/* ---------- chrome ---------- */
function header(){shown=state.coins;return `<div class="topbar"><div class="brand">Spin <span>&amp; Deal</span></div><div class="lvl">Lv ${state.level}</div><div class="wallet">◈ ${money(state.coins)}</div></div>`}
function nav(active='lobby'){const dot=(state.daily.last!==today()||claimable()>0)?'<i class="dot"></i>':'';return `<nav class="nav"><button data-view="lobby" class="${active==='lobby'?'active':''}"><b>♛</b>Casino</button><button data-view="rewards" class="${active==='rewards'?'active':''}"><b>🎁${dot}</b>Rewards</button><button data-view="store" class="${active==='store'?'active':''}"><b>◈</b>Store</button><button data-view="profile" class="${active==='profile'?'active':''}"><b>♙</b>Profile</button></nav>`}
function back(title,sub){return `<div class="screen-head"><button class="back" data-view="lobby">‹</button><div><h2 style="margin:0">${title}</h2><small class="muted">${sub}</small></div></div>`}
function claimable(){ensureMissions();return state.missions.list.filter(m=>!m.claimed&&m.prog>=MISSION_POOL.find(x=>x.id===m.id).goal).length}
function wire(){$$('[data-view]').forEach(x=>x.onclick=e=>{if(busy){notify('Finish this round first');return}e.stopPropagation();sfx.click();go(x.dataset.view)})}
const GAMES=['slots','lanterns','roulette','blackjack'];
function go(v){const from=view;view=v;render();if(GAMES.includes(from)&&!GAMES.includes(v)||GAMES.includes(from)&&GAMES.includes(v)&&from!==v)maybeInterstitial(state,busy).then(save)}
function render(){app.className='app-shell'+(view==='lanterns'?' theme-lanterns':'');({lobby,slots:()=>slots('neon'),lanterns:()=>slots('lanterns'),roulette,blackjack,rewards,store,profile}[view]||lobby)();wire()}

/* ---------- lobby ---------- */
function lobby(){ensureMissions();const pct=Math.floor(state.xp/need(state.level)*100),wheelReady=state.daily.last!==today(),done=state.missions.list.filter(m=>m.claimed).length;
app.innerHTML=`${header()}<section class="hero"><div class="eyebrow">SOCIAL CASINO • FREE PLAY</div><h1>Turn up<br>your fortune.</h1><div class="row"><p>Level ${state.level} • ${money(state.xp)}/${money(need(state.level))} XP</p><span>${pct}%</span></div><div class="progress"><i style="width:${pct}%"></i></div>${UNLOCKS[state.level+1]?`<p class="next">Next unlock (Lv ${state.level+1}): ${UNLOCKS[state.level+1]}</p>`:''}</section>
<div class="grid"><article class="card daily wide ${wheelReady?'pulse':''}" data-view="rewards"><div class="row"><div><span class="tag">DAILY WHEEL • STREAK ${state.daily.streak}🔥</span><h3>${wheelReady?'Your free spin is ready!':'Come back tomorrow'}</h3><p class="muted">Missions ${done}/3 claimed${claimable()?` • ${claimable()} ready to claim`:''}</p></div><button class="button">${wheelReady?'SPIN':'VIEW'}</button></div></article>
<article class="card game-card" data-view="slots"><div class="game-icon">💎</div><div><span class="tag">FEATURED</span><h3>Neon Fortune</h3><p class="muted">Free spins & pick bonus</p></div></article>
<article class="card game-card ${unlocked.lanterns()?'':'locked'}" ${unlocked.lanterns()?'data-view="lanterns"':'id="lockedLanterns"'}><div class="game-icon">🏮</div><div><span class="tag">${unlocked.lanterns()?'NEW':'🔒 LEVEL 4'}</span><h3>Lucky Lanterns</h3><p class="muted">Bigger dragons, bigger wins</p></div></article>
<article class="card game-card" data-view="blackjack"><div class="game-icon">🂡</div><div><span class="tag">TABLE</span><h3>Blackjack</h3><p class="muted">Win streak bonuses</p></div></article>
<article class="card game-card" data-view="roulette"><div class="game-icon">🎯</div><div><span class="tag">TABLE</span><h3>Roulette Rush</h3><p class="muted">European wheel</p></div></article>
${adCard()}</div>${nav('lobby')}`;
const l=$('#lockedLanterns');if(l)l.onclick=()=>{buzz(20);notify('Reach level 4 to unlock Lucky Lanterns')};wireAd()}
function adCard(){if(!ADS.enabled)return'';const s=rewardStatus(state);return `<article class="card wide adcard"><div class="row"><div><span class="tag">FREE COINS</span><h3>Watch a short ad</h3><p class="muted">+${money(ADS.rewardCoins)} virtual coins${s.ok?'':' • '+s.why}</p></div><button class="button pink" id="watchAd" ${s.ok?'':'disabled'}>▶ WATCH</button></div></article>`}
function wireAd(){const b=$('#watchAd');if(b)b.onclick=()=>rewardedCoins(ADS.rewardCoins)}
async function rewardedCoins(amount,label='Thanks for watching!'){const s=rewardStatus(state);if(!s.ok){notify(s.why);return false}if(busy)return false;busy=true;const ok=await showRewarded();busy=false;if(!ok){notify('No reward this time — ad not finished');render();return false}state.ads.count++;state.ads.lastReward=Date.now();pay(amount);coinBurst(26);sfx.win();notify(`${label} +${money(amount)}`);render();return true}
function outOfCoins(){const refillReady=Date.now()-state.lastRefill>36e5;const el=document.createElement('div');el.className='modal';const s=rewardStatus(state);
el.innerHTML=`<div class="card"><div class="game-icon">🪙</div><h2>Out of coins</h2><p class="muted">Grab some free virtual coins and keep playing.</p><div class="stack">${ADS.enabled?`<button class="button pink" id="mAd" ${s.ok?'':'disabled'}>▶ Watch ad +${money(ADS.rewardCoins)}${s.ok?'':' ('+s.why+')'}</button>`:''}<button class="button" id="mRefill" ${refillReady&&state.coins<500?'':'disabled'}>Free refill +2,000 ${refillReady?'':'(hourly)'}</button><button class="button secondary" id="mClose">Close</button></div></div>`;document.body.appendChild(el);
el.querySelector('#mClose').onclick=()=>el.remove();el.querySelector('#mRefill').onclick=()=>{state.lastRefill=Date.now();pay(2000);coinBurst(20);el.remove()};const a=el.querySelector('#mAd');if(a)a.onclick=()=>{el.remove();rewardedCoins(ADS.rewardCoins)}}

/* ---------- slots ---------- */
const MACHINES={
 neon:{name:'Neon Fortune',sym:['🍒','🍋','🔔','🍀','7️⃣','💎','⭐','🎁'],w:[30,26,20,14,8,4,7,4]},
 lanterns:{name:'Lucky Lanterns',sym:['🎋','🧧','🪙','🀄','🏮','🐉','⭐','🎁'],w:[30,26,20,14,8,4,7,4],boost:1.15},
};
// payout multipliers by symbol index (0..5); 6 = scatter, 7 = bonus
const PAYS=[6,10,15,25,50,100];
let freeSpins=0, freeWin=0, auto=0, machineId='neon';
const pick=m=>{let n=rand(m.w.reduce((a,b)=>a+b,0));for(let i=0;i<m.w.length;i++){if(n<m.w[i])return i;n-=m.w[i]}return 0};
function slots(id){machineId=id;const m=MACHINES[id];bet=Math.min(bet,maxBet());
app.innerHTML=`${header()}${back(m.name,'Virtual coins only')}<article class="card slot-machine ${id}"><div class="eyebrow" id="banner">${freeSpins?`FREE SPINS: ${freeSpins} LEFT • ALL WINS ×2`:'MATCH 3 ON THE LINE • 3 ⭐ ANYWHERE = FREE SPINS'}</div>
<div class="reels" id="reels">${[0,1,2].map(r=>`<div class="reel" id="reel${r}">${[0,1,2].map(i=>`<div class="cell">${m.sym[(r*3+i)%6]}</div>`).join('')}</div>`).join('')}<div class="payline"></div></div>
<div class="betbar"><button id="betDown">−</button><b>BET <span id="bet">${money(bet)}</span></b><button id="betUp">+</button><button id="betMax" class="maxb">MAX</button></div>
<div class="result" id="result">${freeSpins?'Tap SPIN for your free spin!':'Good luck!'}</div><div class="actions"><button class="button spin" id="spin">${freeSpins?'FREE SPIN':'SPIN'}</button>${unlocked.auto()?`<button class="button secondary" id="auto" style="flex:.45">${auto?'STOP':'AUTO ×10'}</button>`:''}</div></article>
<p class="notice">Paytable (× bet): ${m.sym.slice(0,6).map((s,i)=>`${s}${s}${s} ${Math.round(PAYS[i]*(m.boost||1))}×`).join(' • ')} • any two ${m.sym[0]} 2× • first two reels match 1× • 3+ ⭐ anywhere = 8 free spins (wins ×2) • 🎁🎁🎁 on the line = Pick Bonus. For entertainment only — virtual coins have no cash value.</p>${nav()}`;
const setBet=v=>{bet=Math.max(50,Math.min(maxBet(),v));$('#bet').textContent=money(bet);sfx.chip()};
$('#betDown').onclick=()=>setBet(bet-50);$('#betUp').onclick=()=>setBet(bet+50);$('#betMax').onclick=()=>setBet(maxBet());
$('#spin').onclick=()=>spin();const a=$('#auto');if(a)a.onclick=()=>{if(auto){auto=0;a.textContent='AUTO ×10'}else{auto=10;a.textContent='STOP';if(!busy)spin()}}}
async function spin(){if(busy)return;const m=MACHINES[machineId];const isFree=freeSpins>0;if(!isFree&&!spend(bet)){auto=0;return}
busy=true;playedGame('slots');if(isFree){freeSpins--}state.totalSpins++;track('spin');$('#spin').disabled=true;$('#result').textContent=isFree?`Free spin… ${freeSpins} left`:'Spinning…';sfx.click();buzz(10);
const grid=[0,1,2].map(()=>[pick(m),pick(m),pick(m)]); // grid[reel][row], row 1 = payline
const line=grid.map(r=>r[1]);
const scat2=grid[0].includes(6)+grid[1].includes(6)>=2||grid.slice(0,2).flat().filter(x=>x===6).length>=2;
const tease=(line[0]===line[1]&&(line[0]>=4))||scat2;
const reels=[0,1,2].map(r=>$('#reel'+r));reels.forEach(el=>el.classList.add('spinning'));
let running=[true,true,true];const ticker=setInterval(()=>{reels.forEach((el,r)=>{if(!running[r])return;el.querySelectorAll('.cell').forEach(c=>c.textContent=m.sym[rand(8)])});sfx.tick(.9+Math.random()*.2)},70);
const stops=[650,950,tease?2200:1250];if(tease){setTimeout(()=>{reels[2].classList.add('tease');$('#result').textContent=scat2?'⭐ One more star…':'Come on…';sfx.tension();buzz([20,40,20,40,20])},950)}
for(let r=0;r<3;r++){await wait(stops[r]-(r?stops[r-1]:0));running[r]=false;reels[r].classList.remove('spinning','tease');reels[r].querySelectorAll('.cell').forEach((c,i)=>c.textContent=m.sym[grid[r][i]]);reels[r].classList.add('land');setTimeout(()=>reels[r].classList.remove('land'),300);sfx.stop();buzz(12)}
clearInterval(ticker);
// evaluate
let mult=0,hits=[];
if(line[0]===line[1]&&line[1]===line[2]&&line[0]<6){mult=PAYS[line[0]]*(m.boost||1);hits=[[0,1],[1,1],[2,1]]}
else if(line.filter(x=>x===0).length>=2){mult=2;hits=line.map((x,r)=>x===0?[r,1]:null).filter(Boolean)}
else if(line[0]===line[1]&&line[0]<6){mult=1;hits=[[0,1],[1,1]]}
const scatters=grid.flat().filter(x=>x===6).length, bonus=line.every(x=>x===7);
let win=Math.floor(bet*mult*(isFree?2:1));
hits.forEach(([r,i])=>reels[r].children[i].classList.add('hit'));
if(win>0){state.stats.slotWins++;track('slotwin');if(isFree)freeWin+=win;pay(win);earnXP(25+Math.min(200,Math.floor(mult*3)));await celebrate(win,bet,$('#reels'))}else{earnXP(15);
  const near=line[0]===line[1]&&line[0]<6&&line[2]!==line[0]&&(grid[2][0]===line[0]||grid[2][2]===line[0]);
  if(near){$('#result').textContent='SO CLOSE! 😱';shake(1);buzz(30);sfx.lose()}else{$('#result').textContent=isFree?'No win this spin':'Spin again';if(!isFree)sfx.lose()}}
if(scatters>=3){const add=freeSpins>0||isFree?5:8;freeSpins+=add;state.stats.freeSpinRounds++;track('free');grid.forEach((col,r)=>col.forEach((x,i)=>x===6&&reels[r].children[i].classList.add('hit')));await overlay('FREE SPINS!',`${add} free spins • all wins ×2`,'⭐');auto=0}
if(bonus){state.stats.bonusRounds++;await pickBonus()}
if(isFree&&freeSpins===0){await overlay('FREE SPINS OVER',`You won ◈ ${money(freeWin)}`,'🏁');freeWin=0}
save();checkAch();busy=false;if(view!=='slots'&&view!=='lanterns')return;
$('#spin').disabled=false;$('#spin').textContent=freeSpins?'FREE SPIN':'SPIN';$('#banner').textContent=freeSpins?`FREE SPINS: ${freeSpins} LEFT • ALL WINS ×2`:'MATCH 3 ON THE LINE • 3 ⭐ ANYWHERE = FREE SPINS';
if(freeSpins>0){await wait(600);if(view==='slots'||view==='lanterns')spin();return}
if(auto>0){auto--;const a=$('#auto');if(auto===0&&a)a.textContent='AUTO ×10';if(auto>0){await wait(500);if(view==='slots'||view==='lanterns')spin()}}}
async function celebrate(win,stake,el){const tier=winTier(win,stake);const res=$('#result');
  if(tier){state.stats.bigWins++;track('big');if(tier!=='BIG WIN')state.stats.megaWins++;res.textContent=`${tier}! +${money(win)}`;await new Promise(r=>bigWinBanner(tier,win,r))}
  else{res.textContent=`WIN! +${money(win)}`;res.classList.remove('flash');void res.offsetWidth;res.classList.add('flash');sfx.win();buzz(30);coinBurst(Math.min(30,8+Math.floor(win/stake)*3),el);if(win/stake>=5)shake(1)}}
function overlay(title,sub,icon){return new Promise(r=>{const el=document.createElement('div');el.className='levelup';el.innerHTML=`<div>${title}</div><b>${icon}</b><p>${sub}</p>`;$('#fx').appendChild(el);sfx.big();buzz([40,30,80]);coinBurst(24);const close=()=>{el.remove();r()};el.onclick=close;setTimeout(()=>el.isConnected&&close(),2600)})}
function pickBonus(){return new Promise(r=>{const vals=[5,10,15,25,50];const boxes=[0,1,2].map(()=>vals[rand(vals.length)]);const el=document.createElement('div');el.className='modal';
el.innerHTML=`<div class="card"><div class="eyebrow">PICK BONUS</div><h2>Choose a gift box</h2><div class="boxes">${boxes.map((_,i)=>`<button class="box" data-i="${i}">🎁</button>`).join('')}</div><p class="muted" id="bmsg">Each box hides 5× to 50× your bet</p></div>`;document.body.appendChild(el);sfx.tension();
el.querySelectorAll('.box').forEach(b=>b.onclick=async()=>{const i=+b.dataset.i;el.querySelectorAll('.box').forEach((x,j)=>{x.disabled=true;x.textContent=boxes[j]+'×';x.classList.toggle('chosen',j===i)});const win=bet*boxes[i];el.querySelector('#bmsg').textContent=`You won ◈ ${money(win)}!`;pay(win);sfx.win();coinBurst(30,b);buzz(50);await wait(1600);el.remove();if(winTier(win,bet))await new Promise(rr=>bigWinBanner(winTier(win,bet),win,rr));r()})})}

/* ---------- roulette ---------- */
const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const colorOf=n=>n===0?'green':REDS.has(n)?'red':'black';
let rlBets={}, chip=100, wheelRot=0;
const BETS={red:{l:'RED',p:2,t:n=>colorOf(n)==='red'},black:{l:'BLACK',p:2,t:n=>colorOf(n)==='black'},green:{l:'ZERO',p:36,t:n=>n===0},
 odd:{l:'ODD',p:2,t:n=>n&&n%2,inside:1},even:{l:'EVEN',p:2,t:n=>n&&!(n%2),inside:1},low:{l:'1-18',p:2,t:n=>n>=1&&n<=18,inside:1},high:{l:'19-36',p:2,t:n=>n>=19,inside:1},
 d1:{l:'1st 12',p:3,t:n=>n>=1&&n<=12,inside:1},d2:{l:'2nd 12',p:3,t:n=>n>=13&&n<=24,inside:1},d3:{l:'3rd 12',p:3,t:n=>n>=25,inside:1}};
for(let n=1;n<=36;n++)BETS['n'+n]={l:String(n),p:36,t:x=>x===n,inside:1};
function wheelBg(){const a=360/37;return 'conic-gradient('+WHEEL.map((n,i)=>`${{red:'#c62842',black:'#15131b',green:'#168b50'}[colorOf(n)]} ${i*a}deg ${(i+1)*a}deg`).join(',')+')'}
function roulette(){const total=Object.values(rlBets).reduce((a,b)=>a+b,0);const ins=unlocked.inside();
app.innerHTML=`${header()}${back('Roulette Rush','European wheel • tap bets to place chips')}<article class="card"><div class="wheel-wrap"><div class="pointer">▼</div><div class="roulette-wheel" id="wheel" style="background:${wheelBg()};transform:rotate(${wheelRot}deg)"></div><b class="ball ${state.rlHistory.length?colorOf(state.rlHistory[0]):''}" id="ball">${state.rlHistory.length?state.rlHistory[0]:'?'}</b></div>
<div class="history">${state.rlHistory.map(n=>`<i class="${colorOf(n)}">${n}</i>`).join('')||'<small class="muted">No spins yet</small>'}</div>
<div class="choices">${['red','black','green'].map(k=>betBtn(k)).join('')}</div>
${ins?`<div class="choices four">${['odd','even','low','high'].map(betBtn).join('')}</div><div class="choices">${['d1','d2','d3'].map(betBtn).join('')}</div><details class="numbers"><summary>Straight-up numbers (36×)</summary><div class="numgrid">${Array.from({length:36},(_,i)=>betBtn('n'+(i+1))).join('')}</div></details>`:'<p class="muted small">🔒 Inside bets (odd/even, dozens, numbers) unlock at level 2</p>'}
<div class="betbar"><span class="muted">Chip</span>${[50,100,250,500,1000].filter(c=>c<=maxBet()).map(c=>`<button class="chipbtn ${c===chip?'sel':''}" data-chip="${c}">${c>=1000?c/1000+'K':c}</button>`).join('')}</div>
<div class="result" id="result">${total?`Total bet ◈ ${money(total)}${state.rlStreak>1?` • 🔥 ${state.rlStreak} win streak`:''}`:'Place your chips'}</div>
<div class="actions"><button class="button secondary" id="clear">CLEAR</button><button class="button spin" id="roll" ${total?'':'disabled'}>SPIN WHEEL</button></div></article>
<p class="notice">Pays (total return): colors / odd-even / halves 2× • dozens 3× • single number or zero 36×. 3 wins in a row = +500 streak bonus.</p>${nav()}`;
$$('[data-bet]').forEach(b=>b.onclick=()=>{if(busy)return;const k=b.dataset.bet;const total=Object.values(rlBets).reduce((a,c)=>a+c,0);if(total+chip>maxBet()*3){notify('Table limit reached');return}rlBets[k]=(rlBets[k]||0)+chip;sfx.chip();buzz(8);roulette();wire()});
$$('[data-chip]').forEach(b=>b.onclick=()=>{chip=+b.dataset.chip;sfx.chip();roulette();wire()});
$('#clear').onclick=()=>{if(busy)return;rlBets={};roulette();wire()};$('#roll').onclick=rollWheel}
function betBtn(k){const b=BETS[k],c=k==='red'||k==='black'||k==='green'?k:k.startsWith('n')?colorOf(+k.slice(1)):'';return `<button class="choice ${c} ${rlBets[k]?'selected':''}" data-bet="${k}">${b.l}${k.startsWith('n')?'':`<br><small>${b.p}×</small>`}${rlBets[k]?`<em>${rlBets[k]>=1000?(rlBets[k]/1000).toFixed(1)+'K':rlBets[k]}</em>`:''}</button>`}
async function rollWheel(){if(busy)return;const total=Object.values(rlBets).reduce((a,b)=>a+b,0);if(!total||!spend(total))return;busy=true;playedGame('roulette');$('#roll').disabled=true;$('#result').textContent='No more bets…';
const n=rand(37),idx=WHEEL.indexOf(n),a=360/37;const target=360-(idx+.5)*a;wheelRot=wheelRot-(wheelRot%360)+360*6+target;const w=$('#wheel');w.style.transition='transform 4.2s cubic-bezier(.12,.7,.15,1)';w.style.transform=`rotate(${wheelRot}deg)`;$('#ball').textContent='•';
let t=0,gap=40;while(t<4000){await wait(gap);t+=gap;gap*=1.09;sfx.tick(1.2);if(t>3000&&(state.settings.haptics))buzz(5);$('#ball').textContent=WHEEL[rand(37)]}
await wait(Math.max(0,4200-t));const col=colorOf(n);const ball=$('#ball');ball.textContent=n;ball.className='ball '+col+' show';sfx.stop();buzz(25);
let win=0;for(const [k,v] of Object.entries(rlBets))if(BETS[k].t(n))win+=v*BETS[k].p;
state.rlHistory=[n,...state.rlHistory].slice(0,12);
if(win>0){state.stats.rouletteWins++;track('rlwin');if(n===0)state.stats.greenHits++;state.rlStreak++;pay(win);earnXP(20+Math.floor(win/total*5));let extra='';if(state.rlStreak%3===0){pay(500);extra=' • 🔥 STREAK +500'}await celebrate(win,total,ball);$('#result').textContent=`${n} ${col.toUpperCase()}! +${money(win)}${extra}`}
else{state.rlStreak=0;earnXP(12);sfx.lose();$('#result').textContent=`${n} ${col.toUpperCase()} — try again`}
save();checkAch();busy=false;await wait(1400);if(view==='roulette'){roulette();wire()}}

/* ---------- blackjack ---------- */
const suits=['♠','♥','♦','♣'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
let deck=[],player=[],dealer=[],bjBet=0,bjLive=false,revealed=false;
function newDeck(){deck=[];for(let d=0;d<4;d++)deck.push(...suits.flatMap(s=>ranks.map(r=>({s,r}))));for(let i=deck.length-1;i;i--){const j=rand(i+1);[deck[i],deck[j]]=[deck[j],deck[i]]}}
function value(hand){let v=hand.reduce((n,c)=>n+(c.r==='A'?11:['J','Q','K'].includes(c.r)?10:+c.r),0),a=hand.filter(c=>c.r==='A').length;while(v>21&&a--){v-=10}return v}
function cards(hand,hide=false,fresh=0){return hand.map((c,i)=>hide&&i===1?`<div class="playing-card back ${i>=hand.length-fresh?'deal':''}"></div>`:`<div class="playing-card ${['♥','♦'].includes(c.s)?'red-suit':''} ${i>=hand.length-fresh?'deal':''}" style="animation-delay:${(i-(hand.length-fresh))*90}ms"><span>${c.r}</span><b>${c.s}</b><span class="rot">${c.r}</span></div>`).join('')}
function blackjack(){bet=Math.min(bet,maxBet());app.innerHTML=`${header()}${back('Blackjack',`Dealer stands on 17 • Blackjack pays 3:2${state.bjStreak>1?` • 🔥 ${state.bjStreak} in a row`:''}`)}<article class="card felt" style="text-align:center"><span class="tag">DEALER <b id="dv"></b></span><div class="hand" id="dealer">${dealer.length?cards(dealer,!revealed):''}</div><span class="tag">YOUR HAND <b id="pv"></b></span><div class="hand" id="player">${player.length?cards(player):''}</div>
<div class="betbar"><button id="betDown">−</button><b>BET <span id="bet">${money(bet)}</span></b><button id="betUp">+</button></div>
<div class="result" id="result">Get as close to 21 as possible</div><div class="actions"><button class="button" id="deal">DEAL</button><button class="button secondary" id="hit" disabled>HIT</button><button class="button secondary" id="stand" disabled>STAND</button>${unlocked.double()?'<button class="button secondary" id="dbl" disabled>DOUBLE</button>':''}</div></article>
<p class="notice">Win streaks pay bonuses: 3 in a row +500 • 5 in a row +1,500. ${unlocked.double()?'Double Down: double your bet on your first two cards for exactly one more card.':'🔒 Double Down unlocks at level 2.'}</p>${nav()}`;
const setBet=v=>{if(bjLive)return;bet=Math.max(50,Math.min(maxBet(),v));$('#bet').textContent=money(bet);sfx.chip()};$('#betDown').onclick=()=>setBet(bet-50);$('#betUp').onclick=()=>setBet(bet+50);
$('#deal').onclick=deal;$('#hit').onclick=hit;$('#stand').onclick=stand;const d=$('#dbl');if(d)d.onclick=doubleDown;buttons();vals()}
function buttons(){const on=bjLive&&!busy;$('#deal').disabled=bjLive||busy;$('#hit').disabled=!on;$('#stand').disabled=!on;const d=$('#dbl');if(d)d.disabled=!(on&&player.length===2&&state.coins>=bjBet)}
function vals(){$('#pv').textContent=player.length?value(player):'';$('#dv').textContent=dealer.length?(revealed?value(dealer):value([dealer[0]])):''}
function show(fp=0,fd=0){$('#player').innerHTML=cards(player,false,fp);$('#dealer').innerHTML=cards(dealer,!revealed,fd);vals()}
async function deal(){if(busy||bjLive||!spend(bet))return;bjBet=bet;busy=true;playedGame('blackjack');if(deck.length<52)newDeck();player=[];dealer=[];revealed=false;show();
for(const who of [player,dealer,player,dealer]){who.push(deck.pop());show(who===player?1:0,who===dealer?1:0);sfx.card();buzz(6);await wait(260)}
bjLive=true;busy=false;buttons();if(value(player)===21){await wait(300);stand()}}
async function hit(){if(!bjLive||busy)return;player.push(deck.pop());show(1);sfx.card();buzz(8);buttons();if(value(player)>21){bjLive=false;await finishBJ()}else if(value(player)===21)stand()}
async function doubleDown(){if(!bjLive||busy||player.length!==2||!spend(bjBet))return;bjBet*=2;$('#result').textContent=`Doubled! Bet ◈ ${money(bjBet)}`;player.push(deck.pop());show(1);sfx.card();buzz(20);await wait(400);if(value(player)>21){bjLive=false;await finishBJ()}else stand()}
async function stand(){if(!bjLive)return;bjLive=false;busy=true;buttons();revealed=true;show(0,0);$('#dealer').children[1]?.classList.add('flip');sfx.card();await wait(450);
if(value(player)<=21&&!(value(player)===21&&player.length===2)){while(value(dealer)<17){dealer.push(deck.pop());show(0,1);sfx.card();buzz(6);$('#result').textContent=`Dealer draws… ${value(dealer)}`;await wait(520)}}
await finishBJ()}
async function finishBJ(){busy=true;revealed=true;show();const p=value(player),d=value(dealer),natural=p===21&&player.length===2,dNat=d===21&&dealer.length===2;let win=0,msg='';
if(p>21)msg='Bust — dealer wins';else if(natural&&!dNat){win=Math.floor(bjBet*2.5);msg=`BLACKJACK! +${money(win)}`;state.stats.bjNaturals++}
else if(dNat&&!natural)msg='Dealer Blackjack';else if(d>21||p>d){win=bjBet*2;msg=`${d>21?'Dealer busts! ':''}You win! +${money(win)}`}else if(p===d){win=bjBet;msg='Push — bet returned'}else msg='Dealer wins';
const won=win>bjBet;if(won){state.stats.bjWins++;state.bjStreak++;track('bjwin');if(state.bjStreak===2)track('bjstreak2')}else if(win<bjBet)state.bjStreak=0;
pay(win);earnXP(won?40:20);
if(won){if(natural){await overlay('BLACKJACK!',`+${money(win)} coins`,'🂡')}else await celebrate(win,bjBet,$('#player'));
  let bonus=0;if(state.bjStreak===3)bonus=500;if(state.bjStreak===5)bonus=1500;if(bonus){pay(bonus);msg+=` • 🔥 ${state.bjStreak} streak +${money(bonus)}`;coinBurst(20)}}
else if(win<bjBet){sfx.lose();buzz(30);if(p>21)shake(1)}
$('#result').textContent=msg;save();checkAch();busy=false;buttons()}

/* ---------- rewards ---------- */
const WHEEL_PRIZES=[500,1000,750,2500,1500,5000,1000,10000];const WHEEL_W=[22,20,20,10,14,6,20,2];
function streakMult(){return 1+(Math.min(state.daily.streak,7)-1)*.15}
function rewards(){ensureMissions();const ready=state.daily.last!==today();const nextStreak=ready?(state.daily.last===yesterday()?state.daily.streak+1:1):state.daily.streak;const seg=360/WHEEL_PRIZES.length;
app.innerHTML=`${header()}<section class="hero"><div class="eyebrow">COME BACK DAILY</div><h1>Your rewards.</h1></section>
<article class="card daily" style="text-align:center"><span class="tag">DAILY WHEEL</span><div class="streak">${[1,2,3,4,5,6,7].map(d=>`<i class="${d<=Math.min(nextStreak,7)?'on':''}">${d}</i>`).join('')}</div><p class="muted">Day ${nextStreak} streak • prizes ×${(1+(Math.min(nextStreak,7)-1)*.15).toFixed(2)}</p>
<div class="wheel-wrap small"><div class="pointer">▼</div><div class="prize-wheel" id="pwheel" style="background:conic-gradient(${WHEEL_PRIZES.map((_,i)=>`${['#ff3aa7','#7b3fff','#36e7ff','#ffd36a'][i%4]} ${i*seg}deg ${(i+1)*seg}deg`).join(',')})">${WHEEL_PRIZES.map((p,i)=>`<span style="transform:rotate(${(i+.5)*seg}deg)">${p>=1000?p/1000+'K':p}</span>`).join('')}</div></div>
<button class="button" id="claim" ${ready?'':'disabled'}>${ready?'SPIN THE WHEEL':'COME BACK TOMORROW'}</button></article>
<h2 class="section-title">Daily missions</h2>${state.missions.list.map(m=>{const d=MISSION_POOL.find(x=>x.id===m.id),done=m.prog>=d.goal;return `<article class="card mission"><div class="row"><div style="flex:1"><h3>${d.text}</h3><div class="progress"><i style="width:${Math.floor(m.prog/d.goal*100)}%"></i></div><small class="muted">${money(m.prog)}/${money(d.goal)} • +${money(d.coins)} coins +${d.xp} XP</small></div><button class="button ${done&&!m.claimed?'':'secondary'}" data-claim="${m.id}" ${done&&!m.claimed?'':'disabled'}>${m.claimed?'✓':done?'CLAIM':'…'}</button></div></article>`}).join('')}
${ADS.enabled?`<div class="grid" style="margin-top:12px">${adCard()}</div>`:''}
<h2 class="section-title">Achievements ${Object.keys(state.ach).length}/${ACH.length}</h2><div class="ach">${ACH.map(([id,name,desc,,coins,ic])=>`<div class="badge ${state.ach[id]?'got':''}"><b>${ic}</b><span>${name}</span><small>${desc} • ${money(coins)}</small></div>`).join('')}</div>
<p class="notice">Rewards are virtual coins with no cash value. No purchase is required. Daily rewards reset using your device's date.</p>${nav('rewards')}`;
$('#claim').onclick=spinDaily;$$('[data-claim]').forEach(b=>b.onclick=()=>{const m=state.missions.list.find(x=>x.id===b.dataset.claim),d=MISSION_POOL.find(x=>x.id===m.id);m.claimed=true;pay(d.coins);coinBurst(22,b);sfx.win();earnXP(d.xp);rewards();wire()});wireAd()}
async function spinDaily(){if(busy||state.daily.last===today())return;busy=true;$('#claim').disabled=true;let n=rand(WHEEL_W.reduce((a,b)=>a+b,0)),i=0;for(;i<WHEEL_W.length;i++){if(n<WHEEL_W[i])break;n-=WHEEL_W[i]}
const seg=360/WHEEL_PRIZES.length,rot=360*5+(360-(i+.5)*seg);const w=$('#pwheel');w.style.transition='transform 3.6s cubic-bezier(.15,.75,.2,1)';w.style.transform=`rotate(${rot}deg)`;
let t=0,gap=50;while(t<3400){await wait(gap);t+=gap;gap*=1.08;sfx.tick(1.1)}await wait(300);
state.daily.streak=state.daily.last===yesterday()?state.daily.streak+1:1;state.daily.last=today();const prize=Math.round(WHEEL_PRIZES[i]*streakMult());pay(prize);save();busy=false;checkAch();
await new Promise(r=>bigWinBanner(prize>=5000?'MEGA WIN':'DAILY BONUS',prize,r));
if(ADS.enabled&&rewardStatus(state).ok){const el=document.createElement('div');el.className='modal';el.innerHTML=`<div class="card"><h2>Double it?</h2><p class="muted">Watch a short ad to get another ◈ ${money(prize)}.</p><div class="stack"><button class="button pink" id="dbl">▶ DOUBLE MY PRIZE</button><button class="button secondary" id="no">No thanks</button></div></div>`;document.body.appendChild(el);el.querySelector('#no').onclick=()=>{el.remove();render()};el.querySelector('#dbl').onclick=()=>{el.remove();rewardedCoins(prize,'Prize doubled!')}}else render()}

/* ---------- store ---------- */
function store(){app.innerHTML=`${header()}<section class="hero"><div class="eyebrow">STORE PREVIEW</div><h1>Coin vault.</h1><p>Coin purchases are disabled in this version. Earn free coins from the daily wheel, missions, achievements and ads.</p></section>
<div class="grid">${adCard()}</div><br>
<article class="card store-item"><div><h3>Remove ads</h3><span class="muted">One-time purchase • no more interstitials</span></div><button class="button" id="noads" ${removeAdsAvailable()?'':'disabled'}>${state.noAds?'OWNED':removeAdsAvailable()?'BUY':'SOON'}</button></article>
${[['Starter Stack','10,000 coins','$0.99'],['Lucky Vault','65,000 coins','$4.99'],['High Roller','150,000 coins','$9.99']].map(x=>`<article class="card store-item"><div><h3>${x[0]}</h3><span class="muted">${x[1]}</span></div><button class="button demo-buy secondary" data-name="${x[0]}">${x[2]}</button></article>`).join('')}
<p class="notice">Virtual currency has no monetary value and cannot be transferred, redeemed, or exchanged for cash or prizes.</p>${nav('store')}`;
$$('.demo-buy').forEach(x=>x.onclick=()=>notify(`${x.dataset.name}: purchases are disabled in this version`));wireAd()}

/* ---------- profile ---------- */
function profile(){const s=state.stats,ad=adsState();app.innerHTML=`${header()}<section class="hero"><div class="eyebrow">PLAYER PROFILE</div><h1>Level ${state.level}</h1><p>${money(state.xp)}/${money(need(state.level))} XP to next level • max bet ${money(maxBet())}</p></section>
<article class="card">${[['Total slot spins',state.totalSpins],['Slot wins',s.slotWins],['Blackjack wins',s.bjWins],['Roulette wins',s.rouletteWins],['Big wins',s.bigWins],['Best single win',money(s.bestWin)],['Login streak',state.daily.streak+' days'],['Current balance',money(state.coins)]].map(([a,b])=>`<div class="row stat"><span>${a}</span><b>${b}</b></div>`).join('')}</article>
<h2 class="section-title">Settings</h2><article class="card"><label class="row"><span>Sound effects</span><input type="checkbox" id="snd" ${state.settings.sound?'checked':''}></label><br><label class="row"><span>Vibration</span><input type="checkbox" id="hap" ${state.settings.haptics?'checked':''}></label>${ad.privacyRequired?'<br><button class="button secondary" id="privacy">Ad privacy choices</button>':''}</article>
<h2 class="section-title">Responsible play</h2><article class="card"><label class="row"><span>Break reminder</span><select id="reminder"><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option></select></label><br><button class="button secondary" id="reset">Reset my progress</button></article>
<p class="notice">For entertainment only. No real-money gambling or prizes. Practice or success at social casino gaming does not imply future success at real-money gambling. Take regular breaks.</p>${nav('profile')}`;
$('#reminder').value=state.limits.reminder;$('#reminder').onchange=e=>{state.limits.reminder=+e.target.value;save()};
$('#snd').onchange=e=>{state.settings.sound=e.target.checked;fxSettings(state.settings);save()};$('#hap').onchange=e=>{state.settings.haptics=e.target.checked;fxSettings(state.settings);save();buzz(30)};
const p=$('#privacy');if(p)p.onclick=showPrivacyOptions;
$('#reset').onclick=()=>{if(confirm('Reset coins, level, and progress?')){state=fresh();fxSettings(state.settings);save();render()}}}

/* ---------- boot ---------- */
let reminded=0;setInterval(()=>{const mins=(Date.now()-sessionStart)/6e4,step=state.limits.reminder;if(Math.floor(mins/step)>reminded){reminded=Math.floor(mins/step);notify(`You've played ${Math.round(mins)} min — time for a break?`)}},3e4);
document.addEventListener('pointerdown',()=>{},{once:true});
ensureMissions();render();initAds();
if('serviceWorker' in navigator&&!window.Capacitor?.isNativePlatform?.())navigator.serviceWorker.register('sw.js').catch(()=>{});
// exported for tests
export { value, PAYS, MACHINES, BETS, WHEEL };
