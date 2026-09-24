#!/usr/bin/env python3
"""Generate the warm parchment background texture (assets/img/paper.jpg)."""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1920, 1080
rng = np.random.default_rng(11)


def smooth_noise(scale, octaves=4):
    out = np.zeros((H, W))
    amp = 1.0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        small = rng.standard_normal((H // s + 2, W // s + 2))
        img = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-9) * 255).astype(np.uint8))
        img = img.resize((W + 2 * s, H + 2 * s), Image.BICUBIC).crop((s, s, W + s, H + s))
        out += (np.asarray(img, dtype=np.float64) / 255 - 0.5) * amp
        amp *= 0.5
    return out


base = np.array([239, 226, 196], dtype=np.float64)  # parchment beige
edge = np.array([214, 190, 146], dtype=np.float64)  # toasted edge

yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / np.sqrt(2)
vig = np.clip((d - 0.35) / 0.65, 0, 1) ** 1.6

blotch = smooth_noise(260)
img = base[None, None, :] * (1 - vig[..., None]) + edge[None, None, :] * vig[..., None]
img += blotch[..., None] * np.array([16, 14, 12])

# fine grain
grain = rng.standard_normal((H, W)) * 3.2
img += grain[..., None]

# paper fibres: short faint strokes
fib = Image.new("L", (W, H), 0)
from PIL import ImageDraw

dr = ImageDraw.Draw(fib)
for _ in range(1400):
    x, y = rng.uniform(0, W), rng.uniform(0, H)
    a = rng.uniform(0, np.pi)
    ln = rng.uniform(8, 40)
    dr.line([(x, y), (x + np.cos(a) * ln, y + np.sin(a) * ln)], fill=int(rng.uniform(20, 60)), width=1)
fib = np.asarray(fib.filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float64) / 255
img -= fib[..., None] * np.array([26, 24, 20])

img = np.clip(img, 0, 255).astype(np.uint8)
os.makedirs(os.path.join(ROOT, "assets", "img"), exist_ok=True)
Image.fromarray(img).save(os.path.join(ROOT, "assets", "img", "paper.jpg"), quality=90)
print("wrote assets/img/paper.jpg")
