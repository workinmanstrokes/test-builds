// Print Doctor (ported from workinmanstrokes/print-doctor): offline symptom picker, fixes and print log.
import { SYMPTOMS, getSymptom } from '../doctor/data.js';
import { addEntry, listEntries, deleteEntry } from '../doctor/log.js';
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seg = on => `<div class="seg"><a href="#/doctor" class="${on === 'p' ? 'on' : ''}">Symptoms</a><a href="#/doctor/log" class="${on === 'l' ? 'on' : ''}">Print log</a></div>`;
export function doctor(main, path) {
  if (path.startsWith('s/')) return detail(main, path.slice(2));
  if (path === 'log') return log(main);
  main.innerHTML = `<h1>Print Doctor</h1><p class="sub">What does your print look like? Works offline.</p>${seg('p')}
  <div class="dgrid">${SYMPTOMS.map(s => `<button class="dcard" data-id="${s.id}">${s.svg}<b>${s.name}</b><small>${s.desc}</small></button>`).join('')}</div>`;
  main.querySelectorAll('.dcard').forEach(b => b.onclick = () => location.hash = '#/doctor/s/' + b.dataset.id);
}
function detail(main, id) {
  const s = getSymptom(id); if (!s) return doctor(main, '');
  main.innerHTML = `<a class="back" href="#/doctor">‹ Symptoms</a><h1>${s.name}</h1><p class="sub">${s.desc}</p><div class="dhero">${s.svg}</div>
  <p class="note">Values are safe ranges for the <b>Tina2S phone app's slicer</b>. Cura settings don't carry over. Change one thing at a time.</p>
  <h2>Most likely causes first</h2><ol class="causes">${s.causes.map(c => `<li><b>${c.cause}</b><br>${c.fix}${c.setting ? `<div class="val">${c.setting}: <b>${c.range}</b></div>` : ''}</li>`).join('')}</ol>
  <a class="btn ghost block" href="#/doctor/log">Log a print</a>`;
}
async function log(main) {
  const es = await listEntries();
  main.innerHTML = `<h1>Print Doctor</h1><p class="sub">Keep track of what you changed and how it printed.</p>${seg('l')}
  <form id="f" class="card dform"><label class="f wide"><span>Photo</span><input type="file" name="photo" accept="image/*" capture="environment"></label>
  <label class="f wide"><span>Symptom</span><select name="symptom"><option value="">None</option>${SYMPTOMS.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label>
  <label class="f"><span>Nozzle °C</span><input name="temp" type="number" inputmode="numeric"></label><label class="f"><span>Offset mm</span><input name="offset" type="number" step="0.01" inputmode="decimal"></label>
  <label class="f"><span>Speed mm/s</span><input name="speed" type="number" inputmode="numeric"></label><label class="f"><span>Retraction mm</span><input name="retract" type="number" step="0.1" inputmode="decimal"></label>
  <label class="f"><span>Result</span><select name="result"><option>Good</option><option>OK</option><option>Failed</option></select></label><label class="f"><span>Notes</span><input name="notes"></label>
  <button class="btn primary wide">Save to log</button></form>
  <ul class="dlog">${es.map(e => `<li>${e.photo ? `<img src="${e.photo}" alt="">` : ''}<div><b>${esc(e.result)}</b> ${esc(getSymptom(e.symptom)?.name || '')}<br><small>${new Date(e.date).toLocaleString()}<br>${[e.temp && esc(e.temp) + ' °C', e.offset && esc(e.offset) + ' mm offset', e.speed && esc(e.speed) + ' mm/s', e.retract && esc(e.retract) + ' mm retract'].filter(Boolean).join(' · ')}</small>${e.notes ? `<br>${esc(e.notes)}` : ''}</div><button data-del="${e.id}" aria-label="Delete">✕</button></li>`).join('') || '<li class="empty" style="display:block">No prints logged yet.</li>'}</ul>`;
  main.querySelector('#f').onsubmit = async ev => { ev.preventDefault(); const d = Object.fromEntries(new FormData(ev.target)); const f = d.photo; d.photo = f && f.size ? await toData(f) : ''; await addEntry(d); log(main); };
  main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await deleteEntry(+b.dataset.del); log(main); });
}
function toData(f) { return new Promise(r => { const img = new Image(); img.onload = () => { const k = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .8)); }; img.src = URL.createObjectURL(f); }); }
