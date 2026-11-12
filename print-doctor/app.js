import {SYMPTOMS,getSymptom} from './data.js';
import {addEntry,listEntries,deleteEntry} from './log.js';
const $=q=>document.querySelector(q), main=$('#main');
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function picker(){main.innerHTML=`<h2>What does your print look like?</h2><div class="grid">${SYMPTOMS.map(s=>`<button class="card" data-id="${s.id}">${s.svg}<b>${s.name}</b><small>${s.desc}</small></button>`).join('')}</div>`;
 main.querySelectorAll('.card').forEach(b=>b.onclick=()=>location.hash='#/s/'+b.dataset.id);}
function detail(id){const s=getSymptom(id);if(!s)return picker();
 main.innerHTML=`<a class="back" href="#/">‹ All symptoms</a><div class="hero">${s.svg}</div><h2>${s.name}</h2><p class="lead">${s.desc}</p>
 <p class="note">Values are safe ranges for the <b>Tina2S phone app's slicer</b>. Cura settings don't carry over. Change one thing at a time.</p>
 <h3 class="sec">Likely causes, try them in order</h3><ol class="causes">${s.causes.map((c,i)=>`<li><span class="n">${i+1}</span><div><b>${c.cause}</b><p>${c.fix}</p>${c.setting?`<div class="val"><span>${c.setting}</span><b>${c.range}</b></div>`:''}</div></li>`).join('')}</ol>`;}
async function log(){const es=await listEntries();
 main.innerHTML=`<h2>Print log</h2><form id="f"><label>Photo <input type="file" name="photo" accept="image/*" capture="environment"></label>
 <label>Symptom <select name="symptom"><option value="">None</option>${SYMPTOMS.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></label>
 <label>Nozzle °C <input name="temp" type="number"></label><label>Offset mm <input name="offset" type="number" step="0.01"></label>
 <label>Speed mm/s <input name="speed" type="number"></label><label>Retraction mm <input name="retract" type="number" step="0.1"></label>
 <label>Result <select name="result"><option>Good</option><option>OK</option><option>Failed</option></select></label>
 <label>Notes <input name="notes"></label><button>Save</button></form>
 <ul class="log">${es.map(e=>`<li>${e.photo?`<img src="${e.photo}" alt="">`:''}<div><b>${esc(e.result)}</b> ${esc(getSymptom(e.symptom)?.name||'')} · ${new Date(e.date).toLocaleString()}<br>${esc(e.temp)}°C · ${esc(e.offset)}mm · ${esc(e.speed)}mm/s · ${esc(e.retract)}mm<br>${esc(e.notes)}</div><button data-del="${e.id}">✕</button></li>`).join('')||'<li>No prints logged yet.</li>'}</ul>`;
 $('#f').onsubmit=async ev=>{ev.preventDefault();const d=Object.fromEntries(new FormData(ev.target));const f=d.photo;d.photo=f&&f.size?await toData(f):'';await addEntry(d);log();};
 main.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{await deleteEntry(+b.dataset.del);log();});}
function toData(f){return new Promise(r=>{const img=new Image();img.onload=()=>{const k=Math.min(1,800/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.8));};img.src=URL.createObjectURL(f);});}
function route(){const h=location.hash;document.querySelectorAll('.tabs a').forEach(t=>t.toggleAttribute('aria-current',t.dataset.tab===(h==='#/log'?'log':'s')));scrollTo(0,0);if(h.startsWith('#/s/'))detail(h.slice(4));else if(h==='#/log')log();else picker();}
addEventListener('hashchange',route);route();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js');
