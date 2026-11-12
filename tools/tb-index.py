# Regenerates index.html (test-builds landing page). R defaults to this repo's root; run, then commit index.html (+ thumbs/ if new).
import datetime
import html
import os
import re

ROOT = os.environ.get("TB_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESCAPE = html.escape
TAG = {"poki": "Poki", "crazygames": "CrazyGames"}
APK_MAP = {
    "AetherSurge": "aether-surge",
    "Brainrot": "brainrot-aura-rush",
    "BrainrotAuraRush": "brainrot-aura-rush",
    "WhosTheBrainrot": "whos-the-brainrot",
    "CardScanner": "card-scanner",
    "Period8": "period-8",
    "PlusOneAura": "plus-one-aura",
    "SpinAndDeal": "spin-and-deal",
    "WingProtocol": "wing-protocol",
}


def normalize_search(value):
    text = html.unescape(value or "")
    text = text.lower().replace("&", " and ").replace("+", " plus ").replace("’", "'")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def title(directory):
    path = os.path.join(ROOT, directory, "index.html")
    try:
        with open(path, encoding="utf-8", errors="ignore") as page:
            match = re.search(r"<title>([^<]*)", page.read(), re.IGNORECASE)
    except FileNotFoundError:
        return None
    value = html.unescape(match.group(1)).strip() if match else ""
    return value or None


def display_title(directory):
    value = title(directory) or directory.replace("-", " ").title()
    return value.split(" – ")[0].split(" | ")[0]


def icon(directory):
    for candidate in (
        "icon-192.png", "icons/icon-192.png", "icon-512.png", "icon.svg",
        "favicon.svg", "apple-touch-icon.png",
    ):
        if os.path.exists(os.path.join(ROOT, directory, candidate)):
            return f"{directory}/{candidate}"
    base = directory.rsplit("-", 1)[0]
    if base != directory and os.path.isdir(os.path.join(ROOT, base)):
        return icon(base)
    return None


def image_or_letter(path, label, class_name=""):
    if path:
        return f'<img{f" class=\"{class_name}\"" if class_name else ""} src="{ESCAPE(path)}" alt="" loading="lazy">'
    return f'<span class="mono">{ESCAPE(label[:1])}</span>'


def simple_card(href, name, subtitle, image=None):
    return (
        f'<a class="card" href="{ESCAPE(href)}">'
        f'{image_or_letter(image, name)}'
        f'<span class="t"><b>{ESCAPE(name)}</b><small>{ESCAPE(subtitle)}</small></span></a>'
    )


def browser_card(directory, name, variants):
    image = icon(directory)
    thumb_path = os.path.join(ROOT, "thumbs", directory + ".jpg")
    thumb = f"thumbs/{directory}.jpg" if os.path.exists(thumb_path) else None
    screenshot = (
        f'<img class="thumb" src="{ESCAPE(thumb)}" alt="{ESCAPE(name)} screenshot" loading="lazy">'
        if thumb else ""
    )
    search_terms = normalize_search(" ".join([name, *(label for _, label in variants)]))
    chips = "".join(
        f'<a class="chip" href="{ESCAPE(path)}/">{ESCAPE(label)}</a>'
        for path, label in variants
    )
    chip_markup = f'<div class="chips">{chips}</div>' if chips else ""
    return (
        f'<article class="game" data-k="{ESCAPE(search_terms)}">'
        f'<a class="hit" href="{ESCAPE(directory)}/" aria-label="Play {ESCAPE(name)}"></a>'
        f'{screenshot}<div class="gbody">{image_or_letter(image, name, "ic")}'
        f'<span class="t"><b>{ESCAPE(name)}</b><small>Play in browser</small></span></div>'
        f'{chip_markup}</article>'
    )


# Discover browser builds and group portal variants under the primary game.
games = []
extras = []
for directory in sorted(os.listdir(ROOT)):
    if directory.startswith(".") or directory == "apk":
        continue
    if not os.path.isfile(os.path.join(ROOT, directory, "index.html")):
        continue
    if directory.rsplit("-", 1)[-1] in TAG:
        continue
    variants = [
        (f"{directory}-{portal}", label)
        for portal, label in TAG.items()
        if os.path.isfile(os.path.join(ROOT, f"{directory}-{portal}", "index.html"))
    ]
    entry = (directory, display_title(directory), variants)
    (extras if directory == "iphone" else games).append(entry)

browser_html = "".join(browser_card(directory, name, variants) for directory, name, variants in games)

# Group APK aliases by their canonical game directory rather than the filename's
# humanized prefix (e.g. Brainrot-latest and BrainrotAuraRush.apk are one game).
apk_directory = os.path.join(ROOT, "apk")
apk_groups = {}
if os.path.isdir(apk_directory):
    for filename in sorted(os.listdir(apk_directory)):
        if not filename.lower().endswith(".apk"):
            continue
        stem = filename[:-4]
        base, separator, variant = stem.partition("-")
        directory = APK_MAP.get(stem) or APK_MAP.get(base)
        if directory:
            name = display_title(directory)
            group_key = directory
        else:
            name = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", base)
            group_key = name.casefold()
        size_mb = os.path.getsize(os.path.join(apk_directory, filename)) / 1_000_000
        apk_groups.setdefault(group_key, {"name": name, "items": []})["items"].append(
            (variant if separator else "", filename, size_mb, directory)
        )


def apk_card(group):
    name = group["name"]
    items = group["items"]
    # Prefer an explicitly latest build, then an unversioned build, then a
    # versioned/variant build. This makes the primary tap the newest usual build.
    items.sort(key=lambda item: (item[0] != "latest", item[0] != "", item[0]))
    main = items[0]
    directory = main[3] or next((item[3] for item in items if item[3]), None)
    image = icon(directory) if directory else None
    alternatives = "".join(
        f'<a class="chip" href="apk/{ESCAPE(filename)}">'
        f'{ESCAPE(variant.replace("-", " ") or "build")} · {size:.0f} MB</a>'
        for variant, filename, size, _ in items[1:]
    )
    chips = f'<span class="chips">{alternatives}</span>' if alternatives else ""
    searchable = normalize_search(" ".join([name, *(item[0] for item in items)]))
    subtitle = (f'{main[0].replace("-", " ")} · ' if main[0] else "") + f'{main[2]:.0f} MB APK'
    return (
        f'<article class="card apk" data-k="{ESCAPE(searchable)}">'
        f'<a class="hit" href="apk/{ESCAPE(main[1])}" aria-label="Download {ESCAPE(name)}"></a>'
        f'{image_or_letter(image, name)}<span class="t"><b>{ESCAPE(name)}</b>'
        f'<small>{ESCAPE(subtitle)}</small>{chips}</span></article>'
    )


apk_html = [apk_card(group) for group in apk_groups.values()]
privacy_dir = os.path.join(ROOT, "privacy")
privacy_html = []
if os.path.isdir(privacy_dir):
    for filename in sorted(os.listdir(privacy_dir)):
        if not filename.endswith(".html"):
            continue
        directory = filename[:-5]
        privacy_html.append(simple_card(
            f"privacy/{filename}", display_title(directory), "Privacy policy", icon(directory)
        ))
extra_html = [
    simple_card(directory + "/", name, "Add games to your Home Screen")
    for directory, name, _ in extras
]

page = f'''<!doctype html>
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
.bar{{position:sticky;top:0;z-index:5;margin:18px -18px 0;padding:10px 18px;background:#0b0c1dcc;backdrop-filter:blur(10px);display:flex;gap:8px;overflow-x:auto}}
.bar a{{flex:none;display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;background:#ffffff0f;border:1px solid #ffffff1a;color:#ecebff;text-decoration:none;font-weight:700;font-size:14px}}
.search{{width:100%;min-height:48px;margin-top:14px;padding:0 16px;border-radius:14px;border:1px solid #ffffff1f;background:#ffffff0a;color:#fff;font:inherit}}
.hide{{display:none!important}}.apk .t small::before{{content:"⬇ ";color:#67e8f9}}
.note{{margin-top:12px;padding:12px 14px;border-radius:12px;background:#67e8f90f;border:1px solid #67e8f933;color:#bfe9f2;font-size:13.5px}}
footer{{margin-top:36px;color:#6f6f99;font-size:12.5px}}
@media (prefers-reduced-motion:reduce){{.card,.game{{transition:none}}}}
</style></head><body><main>
<header><h1>Diddlerrr Test Builds</h1><p>Preview builds for testers. Play in your browser or install on Android.</p></header>
<input class="search" type="search" placeholder="Find a game…" aria-label="Find a game" oninput="const q=(this.value||'').toLowerCase().replace(/&/g,' and ').replace(/\+/g,' plus ').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();document.querySelectorAll('[data-k]').forEach(e=>{const k=(e.dataset.k||'').toLowerCase().replace(/&/g,' and ').replace(/\+/g,' plus ').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();e.classList.toggle('hide',q&& !k.includes(q));})">
<nav class="bar"><a href="#web">Browser · {len(games)}</a><a href="#apk">Android · {len(apk_html)}</a><a href="#more">More</a></nav>
<h2 id="web">Play in browser</h2><div class="ggrid">{browser_html}</div>
<h2 id="apk">Android APKs</h2><div class="grid">{"".join(apk_html)}</div>
<div class="note">Installing an APK: open the link on your Android phone, then allow “Install unknown apps” for your browser when asked.</div>
<h2 id="more">More</h2><div class="grid">{"".join(extra_html)}{"".join(privacy_html)}</div>
<footer>Test builds only. Not final releases. Updated {datetime.date.today().strftime("%b %d, %Y")}.</footer>
</main></body></html>
'''

with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as output:
    output.write(page)
