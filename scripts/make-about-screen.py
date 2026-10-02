#!/usr/bin/env python3
"""
Draw the About workspace monitor UI.

    python3 scripts/make-about-screen.py

Writes assets/about-workspace/screen-ui.png (2048x1024) and screen-ui.json,
both read by scripts/build-about-workspace.py.

The monitor is two halves side by side sharing one texture: a code editor on
the left, IDEAS / SYSTEMS / PRODUCTS on the right. It is drawn at the lit
area's true proportions (two LIT_W x LIT_H halves) and then squashed to
2048x1024; the UVs stretch it back, so text keeps its shape on the model.

The texture is greyscale on purpose. The site recolours the accent at runtime,
so any accent mark (active tab, gutter marker, the dash under PRODUCTS) is a
separate mesh in MAT_Accent_Emissive. Their rectangles are written to the
JSON in UV space (v up), which the Blender script turns into geometry.

Requires: pillow. Fonts: Consolas and Bahnschrift (both ship with Windows).
"""

import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "about-workspace")
FONTS = r"C:\Windows\Fonts"

# Must match LIT_W / LIT_H in build-about-workspace.py.
LIT_W, LIT_H = 0.639, 0.456
H = 1024
W = round(H * 2 * LIT_W / LIT_H)      # true-proportion canvas width (both halves)
HALF = W // 2
S = 2                                  # supersampling
OUT_SIZE = (2048, 1024)

BG, BAR, PANEL, LINE = "#0D131B", "#111923", "#0F1720", "#1E2833"
TEXT, WHITE, MID, DIM, FAINT = "#E6EAED", "#FFFFFF", "#AEB8C2", "#7D8894", "#4B5662"
COMMENT, PUNCT, ACTIVE = "#6C7783", "#8B96A2", "#16212D"

img = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(img)
accents = []


def font(name, size, variation=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size * S)
    if variation:
        f.set_variation_by_name(variation)
    return f


def rect(x0, y0, x1, y1, fill=None, outline=None, width=1):
    d.rectangle([x0 * S, y0 * S, x1 * S - 1, y1 * S - 1], fill=fill, outline=outline,
                width=width * S)


def text(x, y, s, f, fill, tracking=0):
    """Draw s with its baseline at y; returns the x after the last glyph."""
    cx = x * S
    for ch in s if tracking else [s]:
        d.text((cx, y * S), ch, font=f, fill=fill, anchor="ls")
        cx += f.getlength(ch) + tracking * S
    return cx / S


def accent(x0, y0, x1, y1):
    """Record an accent rectangle (canvas px) and leave a dark hole under it."""
    rect(x0, y0, x1, y1, fill=BG)
    accents.append({"u0": x0 / W, "u1": x1 / W, "v0": 1 - y1 / H, "v1": 1 - y0 / H})


def chevron(x, y, open_=True, fill=DIM):
    pts = [(x, y - 5), (x + 10, y - 5), (x + 5, y + 1)] if open_ else \
          [(x + 2, y - 9), (x + 8, y - 4), (x + 2, y + 1)]
    d.polygon([(px * S, py * S) for px, py in pts], fill=fill)


# ---------------------------------------------------------------- left: editor

mono = font("consola.ttf", 22)
mono_b = font("consolab.ttf", 22)
mono_s = font("consola.ttf", 18)

rect(0, 0, HALF, 52, fill=BAR)
for i, x in enumerate((26, 48, 70)):
    d.ellipse([(x - 7) * S, 19 * S, (x + 7) * S, 33 * S], fill="#3B4653")
tabs = [("systems.ts", True), ("scale.ts", False), ("team.tsx", False)]
x = 110
for name, active in tabs:
    w = 200
    if active:
        rect(x, 8, x + w, 52, fill=BG)
        accent(x, 8, x + w, 13)
    text(x + 24, 38, name, mono, TEXT if active else DIM)
    x += w + 8

rect(0, 52, 56, H - 40, fill=PANEL)
for y in (80, 136, 192, 248):
    rect(16, y, 40, y + 24, outline=FAINT, width=2)
rect(56, 52, 380, H - 40, fill=PANEL)
rect(379, 52, 380, H - 40, fill=LINE)
text(76, 86, "EXPLORER", font("consola.ttf", 17), DIM, tracking=2)

tree = [(0, "AURIXLAB-PORTFOLIO", "open"), (1, "app", "open"), (2, "layout.tsx", None),
        (2, "page.tsx", None), (1, "components", "open"), (2, "About.tsx", None),
        (2, "Showcase.tsx", None), (1, "systems", "open"), (2, "core.ts", None),
        (2, "systems.ts", "sel"), (2, "team.ts", None), (1, "lib", "closed"),
        (1, "public", "closed"), (1, "package.json", None), (1, "tsconfig.json", None)]
y = 128
for depth, name, kind in tree:
    if kind == "sel":
        rect(56, y - 25, 379, y + 9, fill=ACTIVE)
    x = 76 + depth * 20
    if kind in ("open", "closed"):
        chevron(x, y - 6, kind == "open", DIM)
        x += 18
    text(x, y, name, mono_s if depth else font("consolab.ttf", 18),
         TEXT if kind == "sel" else (MID if kind in ("open", "closed") else "#9AA4AE"))
    y += 34

CODE = """import { createSystem, scale } from "@aurix/core";
import type { Idea, Team } from "./types";

// Lead by role, architect by craft.
export async function build(idea: Idea, team: Team) {
  const system = await createSystem({
    name: idea.name,
    architecture: "modular",
    performance: { ttfb: 120, cls: 0 },
  });

  for (const feature of idea.features) {
    await system.ship(feature, { review: team.lead });
  }

  return scale(system, {
    regions: ["eu", "us", "apac"],
    users: Infinity,
  });
}

export default build;"""
KEYWORDS = {"import", "from", "export", "async", "function", "const", "await", "for",
            "of", "return", "default", "type"}
TOKEN = re.compile(r'//.*|"[^"]*"|\b\w+\b|\s+|.')
ACTIVE_LINE = 13

y0, lh = 92, 36
for n, line in enumerate(CODE.split("\n"), 1):
    base = y0 + (n - 1) * lh
    if n == ACTIVE_LINE:
        rect(380, base - 26, HALF - 100, base + 10, fill=ACTIVE)
        accent(380, base - 26, 385, base + 10)
    num = str(n)
    text(440 - mono.getlength(num) / S, base, num, mono, TEXT if n == ACTIVE_LINE else FAINT)
    x = 470
    for tok in TOKEN.findall(line):
        if tok.startswith("//"):
            f, c = mono, COMMENT
        elif tok.startswith('"'):
            f, c = mono, MID
        elif tok in KEYWORDS:
            f, c = mono_b, WHITE
        elif re.fullmatch(r"\w+", tok):
            f, c = mono, TEXT
        else:
            f, c = mono, PUNCT
        if tok.strip():
            text(x, base, tok, f, c)
        x += mono.getlength(tok) / S

# minimap
for n, line in enumerate(CODE.split("\n")):
    ln = len(line.rstrip())
    if ln:
        indent = len(line) - len(line.lstrip())
        rect(HALF - 84 + indent * 1.5, 70 + n * 9, HALF - 84 + min(70, ln * 1.4), 74 + n * 9,
             fill="#2A3440")
rect(HALF - 90, 60, HALF - 10, 270, outline=LINE, width=1)

rect(0, H - 40, HALF, H, fill=BAR)
x = 20
for part in ("main", "0 problems", "Ln 13, Col 51", "UTF-8", "TypeScript"):
    x = text(x, H - 13, part, mono_s, DIM) + 34


# ---------------------------------------------------------------- right: ideas

R = HALF
rect(R, 0, W, 52, fill=BAR)
text(R + 30, 34, "aurixlab.com / about", mono, DIM)
for i in range(3):
    rect(W - 120 + i * 32, 18, W - 104 + i * 32, 34, outline=FAINT, width=2)

big = font("bahnschrift.ttf", 128, "SemiBold")
for i, word in enumerate(("IDEAS", "SYSTEMS", "PRODUCTS")):
    text(R + 110, 250 + i * 160, word, big, TEXT, tracking=14)
accent(R + 114, 640, R + 254, 654)
text(R + 114, 712, "LEAD BY ROLE, ARCHITECT BY CRAFT.", font("bahnschrift.ttf", 26), DIM, tracking=6)

for i in range(4):                                         # small progress row
    rect(R + 114 + i * 78, 790, R + 180 + i * 78, 796, fill=TEXT if i < 3 else FAINT)
text(R + 114, 840, "v3.2  /  shipped 42 releases this year", mono_s, FAINT)

px0, px1 = W - 470, W - 40                                 # status panel
rect(px0, 90, px1, 980, fill=PANEL, outline=LINE, width=2)
text(px0 + 30, 140, "SYSTEM STATUS", font("bahnschrift.ttf", 24, "SemiBold"), MID, tracking=4)
accent(px1 - 48, 122, px1 - 32, 138)
rows = [("Uptime", "99.98%"), ("TTFB", "118 ms"), ("Deploys", "42 / wk"),
        ("Lighthouse", "100"), ("Team", "12"), ("Regions", "3")]
for i, (k, v) in enumerate(rows):
    y = 210 + i * 58
    rect(px0 + 30, y - 16, px0 + 44, y - 2, outline=FAINT, width=2)
    text(px0 + 60, y, k, mono, DIM)
    text(px1 - 30 - mono.getlength(v) / S, y, v, mono, TEXT)
    rect(px0 + 30, y + 18, px1 - 30, y + 19, fill=LINE)
gy0, gy1 = 620, 940                                        # throughput graph
for i in range(5):
    gy = gy0 + i * (gy1 - gy0) / 4
    rect(px0 + 30, gy, px1 - 30, gy + 1, fill=LINE)
vals = [0.32, 0.4, 0.36, 0.52, 0.48, 0.6, 0.58, 0.7, 0.66, 0.78, 0.82, 0.9]
pts = [(px0 + 30 + i * (px1 - px0 - 60) / (len(vals) - 1), gy1 - v * (gy1 - gy0))
       for i, v in enumerate(vals)]
d.line([(x * S, y * S) for x, y in pts], fill=TEXT, width=3 * S, joint="curve")
for x, y in pts[-1:]:
    d.ellipse([(x - 6) * S, (y - 6) * S, (x + 6) * S, (y + 6) * S], fill=WHITE)
text(px0 + 30, 600, "THROUGHPUT", font("bahnschrift.ttf", 18), FAINT, tracking=3)

rect(R - 3, 0, R + 3, H, fill="#080C11")                   # seam between halves

os.makedirs(OUT_DIR, exist_ok=True)
img.resize(OUT_SIZE, Image.LANCZOS).save(os.path.join(OUT_DIR, "screen-ui.png"), optimize=True)
with open(os.path.join(OUT_DIR, "screen-ui.json"), "w") as fh:
    json.dump({"lit_w": LIT_W, "lit_h": LIT_H, "canvas": [W, H], "accents": accents}, fh, indent=2)
print(f"canvas {W}x{H} -> {OUT_SIZE}, {len(accents)} accent marks")
