#!/usr/bin/env python3
"""Write the scene clip <section>s and total duration from assets/timing.js into index.html."""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OVERLAP = 0.6  # each scene lingers this long so the next one can cross-fade over it

src = open(os.path.join(ROOT, "assets", "timing.js")).read()
timing = json.loads(src.split("=", 1)[1].strip().rstrip(";"))
dur = timing["duration"]
scenes = timing["scenes"]

lines = []
for i, s in enumerate(scenes):
    start = s["start"]
    length = min(dur, s["end"] + OVERLAP) - start
    lines.append(
        f'      <section id="scene-{s["row"]}" class="clip" data-start="{start:.3f}" data-duration="{length:.3f}" '
        f'data-track-index="{i % 2}"><svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"></svg></section>'
    )
tl_start = next(s["start"] for s in scenes if s["row"] == 9)
tl_end = next(s["start"] for s in scenes if s["row"] == 17) + 0.5
lines.append(
    f'      <section id="timeline-band" class="clip" data-start="{tl_start:.3f}" data-duration="{tl_end - tl_start:.3f}" '
    f'data-track-index="2"><svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"></svg></section>'
)

path = os.path.join(ROOT, "index.html")
html = open(path).read()
html = re.sub(
    r"(<!-- clips:begin[^>]*-->\n).*?(\s*<!-- clips:end -->)",
    lambda m: m.group(1) + "\n".join(lines) + "\n      " + m.group(2).strip(),
    html,
    flags=re.S,
)
for el_id in ("caption-band", "captions", "narration-mix"):
    html = re.sub(rf'(id="{el_id}"[^>]*data-duration=")[\d.]+(")', rf"\g<1>{dur}\g<2>", html)
html = re.sub(r'(data-composition-id="main"[^>]*data-duration=")[\d.]+(")', rf"\g<1>{dur}\g<2>", html)
open(path, "w").write(html)
print(f"injected {len(scenes)} scenes + timeline band; duration {dur}s")
