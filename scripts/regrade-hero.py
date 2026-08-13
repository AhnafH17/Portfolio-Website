#!/usr/bin/env python3
"""
Regenerate the palette-graded hero portraits.

    python3 scripts/regrade-hero.py        # writes the four variants
    python3 scripts/regrade-hero.py audit  # + reports leftover gold-hue pixels

Reads public/AhnafHussain.png (the master, shot against a warm gold ambient)
and writes public/AhnafHussain-<palette>.png for each palette.

Why a flood-filled silhouette and not a colour rule
---------------------------------------------------
The entire scene is lit by warm gold light, so the wall, the suit and the skin
all carry the same cast. No colour-only rule separates background from subject:
several were tried and each one left gold somewhere.

    Normalised warmth (R-B)/L was the worst offender. A bright beige panel sits
    at 0.16 — the same value as the grey suit — so gating out "neutral" pixels
    to protect the suit also skipped genuinely gold background. That is what
    left the gold patch behind his right shoulder.

Instead the background is found geometrically: his outline is a strong
luminance gradient, so flooding inward from the frame border through
low-gradient pixels fills the background and stops at him. Whatever the flood
cannot reach is the subject. Being independent of colour, it lets the entire
background be graded regardless of hue.

Run with `audit` to get a measured count of gold-hue pixels left in the region
the arch actually renders — eyeballing a thumbnail is not verification.

Requires: pillow, numpy.
"""

from PIL import Image, ImageFilter
import numpy as np
import sys
import os

SRC = 'public/AhnafHussain.png'
OUT = 'public'

# --accent-glow from app/globals.css
ACCENTS = {
    'crimson': (204, 24, 44),
    'teal':    (43, 178, 169),
    'amber':   (218, 150, 38),
    'purple':  (255, 1, 255),
}

# How fully the ambient takes the accent hue. The source ambient is only ~0.30
# saturated; much above 0.6 stops reading as a photograph.
SAT = 0.60

# Gradient below this is "flat enough to flood through". Higher leaks through
# his outline; lower strands pockets of background.
EDGE = 0.10

# The region the arch actually renders: object-fit cover + scale(1.35).
CROP = (219, 133, 805, 891)


def blur(m, radius):
    img = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255.0


def subject_mask(L):
    """Everything the background flood cannot reach — i.e. the person."""
    gx = np.zeros_like(L)
    gy = np.zeros_like(L)
    gx[:, 1:-1] = L[:, 2:] - L[:, :-2]
    gy[1:-1] = L[2:] - L[:-2]
    grad = blur(np.clip(np.sqrt(gx ** 2 + gy ** 2) * 4, 0, 1), 2)

    passable = grad < EDGE
    reach = np.zeros_like(passable)
    reach[0, :] = reach[-1, :] = reach[:, 0] = reach[:, -1] = True
    reach &= passable

    # Geodesic dilation: grow the border region through passable pixels until
    # it stops changing. MaxFilter(9) advances ~4px per pass.
    prev, iters = -1, 0
    while reach.sum() != prev and iters < 400:
        prev = reach.sum()
        grown = np.asarray(
            Image.fromarray((reach * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
        ) > 0
        reach = grown & passable
        iters += 1

    solid = (blur((~reach).astype(np.float32), 6) > 0.45).astype(np.float32)
    return blur(solid, 4)


def gold_hue(rgb01):
    """Pixels that still read as gold/amber to the eye."""
    mx, mn = rgb01.max(2), rgb01.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb01[..., 0], rgb01[..., 1], rgb01[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6,
                 np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return (h > 20) & (h < 65) & (sat > 0.15) & (mx > 0.15)


def main(audit=False):
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255.0
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

    subject = subject_mask(L)
    mask = (1.0 - subject)[..., None]
    gray = np.repeat(L[..., None], 3, axis=2)

    crop = np.zeros(L.shape, bool)
    crop[CROP[1]:CROP[3], CROP[0]:CROP[2]] = True

    for name, rgb in ACCENTS.items():
        acc = np.array(rgb, np.float32) / 255.0
        acc_lum = 0.299 * acc[0] + 0.587 * acc[1] + 0.114 * acc[2]
        # Scale the accent so it carries each pixel's own luminance
        tint = gray * (acc / acc_lum)[None, None, :]
        tint = gray + (tint - gray) * SAT
        out = np.clip(a * (1 - mask) + np.clip(tint, 0, 1) * mask, 0, 1)

        path = f'{OUT}/AhnafHussain-{name}.png'
        Image.fromarray((out * 255).round().astype(np.uint8)).save(path, optimize=True)
        line = f'  {path}  {os.path.getsize(path) // 1024}KB'

        if audit:
            gold = gold_hue(out) & crop
            outside = int((gold & (subject < 0.4)).sum())
            inside = int((gold & (subject >= 0.4)).sum())
            line += (f'  | gold-hue: {outside} outside subject'
                     f' ({100 * outside / crop.sum():.2f}%),'
                     f' {inside} on him (skin/suit, expected)')
        print(line)


if __name__ == '__main__':
    main(audit='audit' in sys.argv)
