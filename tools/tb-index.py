# Regenerates index.html (test-builds landing page). R defaults to this repo's root; run, then commit index.html (+ thumbs/ if new).
import os, re, html, datetime
R=os.environ.get('TB_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))); E=html.escape
def title(d):
    try: m=re.search(r'<title>([^<]*)',open(os.path.join(R,d,'index.html'),encoding='utf8',errors='ignore').read()); return html.unescape(m.group(1)).strip() if m and m.group(1).strip() else None
    except FileNotFoundError: return None
def icon(d):
    for c in ['icon-192.png','icons/icon-192.png','icon-512.png','icon.svg','favicon.svg','apple-touch-icon.png']:
        if os.path.exists(os.path.join(R,d,c)): return f'{d}/{c}'
    base=d.rsplit('-',1)[0]
    return icon(base) if base!=d and os.path.isdir(os.path.join(R,base)) else None
TAG={'poki':'Poki build','crazygames':'CrazyGames build'}
APKMAP={'AetherSurge':'aether-surge','Brainrot':'brainrot-aura-rush','BrainrotAuraRush':'brainrot-aura-rush','WhosTheBrainrot':'whos-the-brainrot','CardScanner':'card-scanner','Period8':'period-8','PlusOneAura':'plus-one-aura','SpinAndDeal':'spin-and-deal','WingProtocol':'wing-protocol'}
games=[];extra=[]
for d in sorted(os.listdir(R)):
    if d.startswith('.') or d=='apk' or not os.path.exists(os.path.join(R,d,'index.html')): continue
    t=(title(d) or d.replace('-',' ').title()).split(' – ')[0].split(' | ')[0]
    if d.rsplit('-',1)[-1] in TAG: continue
    (extra if d=='iphone' else games).append((d,t,[(f'{d}-{k}',v) for k,v in TAG.items() if os.path.exists(os.path.join(R,f'{d}-{k}','index.html'))]))
def short(d):
    t=title(d) or d.replace('-',' ').title(); return t.split(':')[0].strip()
def card(href,name,sub,ic,cls=''):
    img=f'<img src="{E(ic)}" alt="" loading="lazy">' if ic else f'<span class="mono">{E(name[:1])}</span>'
    return f'<a class="card {cls}" href="{E(href)}">{img}<span class="t"><b>{E(name)}</b><small>{sub}</small></span></a>'
def gcard(d,t,vars_):
    ic=icon(d); th=f'thumbs/{d}.jpg' if os.path.exists(os.path.join(R,'thumbs',d+'.jpg')) else None
    img=f'<img class="ic" src="{E(ic)}" alt="" loading="lazy">' if ic else f'<span class="mono">{E(t[:1])}</span>'
    shot=f'<img class="thumb" src="{E(th)}" alt="{E(t)} screenshot" loading="lazy">' if th else ''
    chips=''.join(f'<a class="chip" href="{E(v)}/">{E(l.replace(" build",""))}</a>' for v,l in vars_)
    return f'<article class="game" data-k="{E(t.lower())}"><a class="hit" href="{E(d)}/" aria-label="Play {E(t)}"></a>{shot}<div class="gbody">{img}<span class="t"><b>{E(t)}</b><small>Play in browser</small></span></div>{f"<div class=chips>{chips}</div>" if chips else ""}</article>'
G=''.join(gcard(d,t,v) for d,t,v in games)
apks=[]
for f in sorted(os.listdir(R+'/apk')):
    if not f.endswith('.apk'): continue
    stem=f[:-4]; base,_,var=stem.partition('-'); d=APKMAP.get(stem) or APKMAP.get(base)
    name=re.sub(r'(?<=[a-z0-9])(?=[A-Z])',' ',base).replace('Plus One','+1').replace('Period8','Period 8').replace('Whos','Who’s')
    if d and base in ('SpinAndDeal','WhosTheBrainrot','PlusOneAura','Period8','CardScanner','WingProtocol'): name=short(d)
    sz=os.path.getsize(os.path.join(R,'apk',f))/1e6
    apks.append((name,d,var,f,sz))
grp={}
for name,d,var,f,sz in apks: grp.setdefault(name,[]).append((d,var,f,sz))
def acard(name,items):
    d=items[0][0]; ic=icon(d) if d else None
    img=f'<img src="{E(ic)}" alt="" loading="lazy">' if ic else f'<span class="mono">{E(name[:1])}</span>'
    items=sorted(items,key=lambda x:(x[1]!='latest',x[1]=='',x[1]))
    main=items[0]; rest=items[1:]
    chips=''.join(f'<a class="chip" href="apk/{E(f)}">{E(v.replace("-"," ") or "build")} · {sz:.0f} MB</a>' for _,v,f,sz in rest)
    return f'<article class="card apk" data-k="{E(name.lower())}"><a class="hit" href="apk/{E(main[2])}" aria-label="Download {E(name)}"></a>{img}<span class="t"><b>{E(name)}</b><small>{E(main[1].replace("-"," ")+" · ") if main[1] else ""}{main[3]:.0f} MB APK</small>{f"<span class=chips>{chips}</span>" if chips else ""}</span></article>'
apks=[acard(n,i) for n,i in grp.items()]
P=''.join(card('privacy/'+f,short(f[:-5]) if os.path.isdir(os.path.join(R,f[:-5])) else f[:-5].replace('-',' ').title(),'Privacy policy',icon(f[:-5])) for f in sorted(os.listdir(R+'/privacy')) if f.endswith('.html'))
X=''.join(card(d+'/',t,'Add games to your Home Screen',None) for d,t,_ in extra)
out=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Diddlerrr · Test Builds</title><meta name="robots" content="noindex"><meta name="theme-color" content="#0b0c1d">
<style>
html{{background:#0b0c1d}}*{{box-sizing:border-box}}body{{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#ecebff;background-color:#0b0c1d;background-image:radial-gradient(1200px 600px at 80% -10%,#3b1d7a55,transparent),radial-gradient(900px 500px at -10% 10%,#0e749044,transparent);background-attachment:fixed;min-height:100vh}}
main{{max-width:980px;margin:auto;padding:calc(28px + env(safe-area-inset-top)) 18px 40px}}
header h1{{margin:0;font-size:clamp(28px,6vw,40px);letter-spacing:-.02em;background:linear-gradient(90deg,#fff,#a5b4fc 60%,#67e8f9);-webkit-background-clip:text;background-clip:text;color:transparent}}
header p{{margin:6px 0 0;color:#a3a3c7}}
h2{{margin:34px 0 12px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8b8bd9;display:flex;align-items:center;gap:10px}}h2::after{{content:"";flex:1;height:1px;background:#ffffff14}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}}
.card{{display:flex;align-items:center;gap:12px;padding:12px;border-radius:16px;background:#ffffff0a;border:1px solid #ffffff12;color:inherit;text-decoration:none;transition:transform .15s,background .15s,border-color .15s}}
.card:hover,.card:focus-visible{{transform:translateY(-2px);background:#ffffff14;border-color:#a5b4fc66;outline:none}}
.card img,.mono{{width:52px;height:52px;border-radius:13px;flex:none;object-fit:cover;background:#1c1d3a;box-shadow:0 4px 14px #0006}}
.mono{{display:grid;place-items:center;font-weight:800;font-size:22px;color:#c7d2fe;background:linear-gradient(135deg,#312e81,#0e7490)}}
.t{{min-width:0}}.t b{{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}.t small{{color:#9a9ac4;font-size:12.5px}}
.game{{position:relative;border-radius:18px;overflow:hidden;background:#ffffff0a;border:1px solid #ffffff12;transition:transform .15s,border-color .15s}}.game:hover,.game:focus-within{{transform:translateY(-2px);border-color:#a5b4fc66}}
.hit{{position:absolute;inset:0;z-index:1}}.chip{{position:relative;z-index:2}}
.thumb{{display:block;width:100%;aspect-ratio:9/12;object-fit:cover;object-position:top;background:#1c1d3a}}
.gbody{{display:flex;align-items:center;gap:10px;padding:10px 12px}}.gbody .ic,.gbody .mono{{width:40px;height:40px;border-radius:11px;flex:none;object-fit:cover}}
.ggrid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}}
.chips{{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px}}.card .chips{{padding:6px 0 0}}
.chip{{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;background:#a5b4fc1f;border:1px solid #a5b4fc40;color:#dfe3ff;font-size:12.5px;font-weight:700;text-decoration:none}}
.card{{position:relative}}
.bar{{position:sticky;top:0;z-index:5;margin:18px -18px 0;padding:10px 18px calc(10px);background:#0b0c1dcc;backdrop-filter:blur(10px);display:flex;gap:8px;overflow-x:auto}}
.bar a{{flex:none;display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;background:#ffffff0f;border:1px solid #ffffff1a;color:#ecebff;text-decoration:none;font-weight:700;font-size:14px}}
.search{{width:100%;min-height:48px;margin-top:14px;padding:0 16px;border-radius:14px;border:1px solid #ffffff1f;background:#ffffff0a;color:#fff;font:inherit}}
.hide{{display:none!important}}
.apk .t small::before{{content:"⬇ ";color:#67e8f9}}
.note{{margin-top:12px;padding:12px 14px;border-radius:12px;background:#67e8f90f;border:1px solid #67e8f933;color:#bfe9f2;font-size:13.5px}}
footer{{margin-top:36px;color:#6f6f99;font-size:12.5px}}
@media (prefers-reduced-motion:reduce){{.card{{transition:none}}}}
</style></head><body><main>
<header><h1>Diddlerrr Test Builds</h1><p>Preview builds for testers. Play in your browser or install on Android.</p></header>
<input class="search" type="search" placeholder="Find a game…" aria-label="Find a game" oninput="const q=this.value.toLowerCase();document.querySelectorAll('[data-k]').forEach(e=>e.classList.toggle('hide',q&&!e.dataset.k.includes(q)))">
<nav class="bar"><a href="#web">Browser · {len(games)}</a><a href="#apk">Android · {len(apks)}</a><a href="#more">More</a></nav>
<h2 id="web">Play in browser</h2><div class="ggrid">{G}</div>
<h2 id="apk">Android APKs</h2><div class="grid">{''.join(apks)}</div>
<div class="note">Installing an APK: open the link on your Android phone, then allow “Install unknown apps” for your browser when asked.</div>
<h2 id="more">More</h2><div class="grid">{X}{P}</div>
<footer>Test builds only. Not final releases. Updated {datetime.date.today().strftime("%b %d, %Y")}.</footer>
</main></body></html>
'''
open(R+'/index.html','w').write(out)
