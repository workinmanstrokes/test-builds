# Flags any game's sw.js that deletes caches it doesn't own.
# Every game on workinmanstrokes.github.io shares ONE cache storage, so a worker whose
# activate step deletes "every cache that isn't mine" wipes the offline files of every
# other game (and Hunter Duel's Unity data, and Fishing Almanac's saved map spots).
# Each worker must only delete caches that start with its own prefix, e.g.
#   keys.filter((k) => k.startsWith('mygame-') && k !== CACHE)
# Run after a sync: python3 tools/check-sw.py   (exit code 1 = something to fix)
import glob
import os
import re
import sys

ROOT = os.environ.get("TB_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bad = []
for path in sorted(glob.glob(os.path.join(ROOT, "*", "sw.js"))):
    for line in open(path, encoding="utf-8", errors="replace"):
        if "caches.delete" in line and not re.search(r"startsWith\(|indexOf\([^)]*\)\s*===\s*0", line):
            bad.append(os.path.relpath(path, ROOT))
            break
for p in bad:
    print(f"{p}: deletes caches without checking they belong to this game")
print(f"{len(bad)} worker(s) need a fix" if bad else "All service workers only clear their own caches.")
sys.exit(1 if bad else 0)
