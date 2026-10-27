// Values are safe starting ranges for the Tina2S phone app's built-in slicer.
// Cura profiles/settings do NOT carry over; enter these in the Tina2S app directly.
const s = (body) => `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" role="img"><rect width="120" height="80" rx="8" fill="#eef3f8"/><rect x="10" y="66" width="100" height="6" fill="#8a99a8"/>${body}</svg>`;
export const SYMPTOMS = [
 { id:'stringing', name:'Stringing', desc:'Thin hairs or webs between parts.',
   svg:s('<rect x="20" y="30" width="18" height="36" fill="#4a90d9"/><rect x="82" y="30" width="18" height="36" fill="#4a90d9"/><path d="M38 36 Q60 46 82 38 M38 46 Q60 56 82 48 M38 56 Q60 62 82 58" stroke="#d94a4a" fill="none"/>'),
   causes:[
    {cause:'Nozzle too hot', fix:'Lower nozzle temp in 5 °C steps.', setting:'Nozzle temp', range:'190–205 °C (PLA)'},
    {cause:'Retraction too short/slow', fix:'Increase retraction length a little.', setting:'Retraction', range:'1.0–3.0 mm at 25–40 mm/s (direct drive)'},
    {cause:'Wet filament', fix:'Dry filament (e.g. 45–50 °C for 4–6 h) and store sealed.', setting:null, range:null},
    {cause:'Slow travel moves', fix:'Raise travel speed if the app allows.', setting:'Speed', range:'Travel 60–100 mm/s'}]},
 { id:'elephant-foot', name:'Elephant foot', desc:'Bottom layers bulge out wider than the rest.',
   svg:s('<path d="M40 20 H80 V58 L88 66 H32 L40 58 Z" fill="#4a90d9"/><path d="M32 66 L40 58 M88 66 L80 58" stroke="#d94a4a" stroke-width="2"/>'),
   causes:[
    {cause:'Nozzle too close on first layer', fix:'Raise the first-layer offset slightly.', setting:'First-layer offset', range:'+0.02 to +0.08 mm from current'},
    {cause:'Bed too hot (if heated bed upgrade)', fix:'Lower bed temp 5 °C.', setting:'Bed temp', range:'45–55 °C (PLA)'},
    {cause:'First layer too slow/thick', fix:'Use a normal first-layer speed.', setting:'Speed', range:'First layer 15–25 mm/s'}]},
 { id:'fused-first-layer', name:'Fused / squished first layer', desc:'First layer is see-through thin, rough, or ridged; nozzle scrapes.',
   svg:s('<rect x="20" y="60" width="80" height="6" fill="#4a90d9"/><path d="M22 60 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4" stroke="#d94a4a" fill="none"/><path d="M56 30 h8 l-4 26 z" fill="#555"/>'),
   causes:[
    {cause:'Nozzle too close to bed', fix:'Re-level using paper, then raise offset.', setting:'First-layer offset', range:'+0.05 to +0.10 mm'},
    {cause:'Bed not level', fix:'Run the Tina2S auto/assisted leveling again with a clean nozzle.', setting:null, range:null},
    {cause:'Over-extrusion on first layer', fix:'Lower first-layer flow if available.', setting:'Flow', range:'95–100 %'}]},
 { id:'warping', name:'Warping', desc:'Corners lift and curl off the bed.',
   svg:s('<path d="M24 50 Q30 62 40 62 H80 Q90 62 96 50 V30 H24 Z" fill="#4a90d9"/><path d="M20 54 l6 4 M100 54 l-6 4" stroke="#d94a4a" stroke-width="2"/>'),
   causes:[
    {cause:'Poor first-layer grip', fix:'Clean bed with isopropyl alcohol; lower offset slightly.', setting:'First-layer offset', range:'-0.02 to -0.05 mm'},
    {cause:'Drafts / cold room', fix:'Shield the printer from fans and windows.', setting:null, range:null},
    {cause:'No brim', fix:'Add a brim if the app allows.', setting:'Brim', range:'3–8 mm'},
    {cause:'Fan too strong early', fix:'Keep part fan off for the first 2–3 layers.', setting:'Fan', range:'0 % for layers 1–3'}]},
 { id:'under-extrusion', name:'Under-extrusion', desc:'Gaps, thin walls, missing lines.',
   svg:s('<g fill="#4a90d9"><rect x="20" y="58" width="80" height="6"/><rect x="20" y="50" width="30" height="6"/><rect x="60" y="50" width="40" height="6"/><rect x="20" y="42" width="15" height="6"/><rect x="45" y="42" width="20" height="6"/><rect x="80" y="42" width="20" height="6"/></g>'),
   causes:[
    {cause:'Partial nozzle clog', fix:'Cold pull or clean nozzle; check filament path.', setting:null, range:null},
    {cause:'Printing too fast', fix:'Lower print speed.', setting:'Speed', range:'30–45 mm/s'},
    {cause:'Nozzle too cold', fix:'Raise nozzle temp 5 °C.', setting:'Nozzle temp', range:'195–210 °C (PLA)'},
    {cause:'Tangled/binding spool', fix:'Check spool turns freely.', setting:null, range:null}]},
 { id:'layer-shift', name:'Layer shift', desc:'Layers suddenly offset sideways.',
   svg:s('<rect x="30" y="46" width="40" height="20" fill="#4a90d9"/><rect x="46" y="22" width="40" height="24" fill="#4a90d9"/><path d="M70 46 h-24" stroke="#d94a4a" stroke-width="2"/>'),
   causes:[
    {cause:'Speed/acceleration too high', fix:'Lower print and travel speed.', setting:'Speed', range:'Print 30–40, travel 60–80 mm/s'},
    {cause:'Nozzle hitting curled parts', fix:'Fix warping first; enable z-hop if available.', setting:'Z-hop', range:'0.2–0.4 mm'},
    {cause:'Loose belt or obstruction', fix:'Check belts and that nothing blocks the bed/head.', setting:null, range:null}]},
 { id:'bed-adhesion', name:'Poor bed adhesion', desc:'Print detaches or first layer won\'t stick.',
   svg:s('<rect x="34" y="34" width="52" height="24" fill="#4a90d9" transform="rotate(-8 60 46)"/><path d="M30 62 h60" stroke="#d94a4a" stroke-dasharray="4 3"/>'),
   causes:[
    {cause:'Nozzle too far from bed', fix:'Lower first-layer offset.', setting:'First-layer offset', range:'-0.03 to -0.08 mm'},
    {cause:'Dirty bed', fix:'Wash/wipe bed with isopropyl alcohol; avoid touching it.', setting:null, range:null},
    {cause:'First layer too fast', fix:'Slow first layer.', setting:'Speed', range:'15–20 mm/s'},
    {cause:'Nozzle too cold on first layer', fix:'Raise first-layer temp 5 °C.', setting:'Nozzle temp', range:'200–210 °C (PLA)'}]}
];
export const getSymptom = (id) => SYMPTOMS.find(x => x.id === id);
