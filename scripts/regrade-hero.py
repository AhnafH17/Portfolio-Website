#!/usr/bin/env python3
"""
Regenerate the palette-graded hero portraits.

    python3 scripts/regrade-hero.py

Reads public/AhnafHussain.png (the master, shot against a warm gold ambient)
and writes public/AhnafHussain-<palette>.png for each palette.

The source's gold ambient clashed with every palette except amber. Rather than
cutting the subject out — which needs alpha matting we don't have, and which
fails on hair against a dark background — this re-grades only the ambient,
preserving each pixel's luminance so texture and the arch's vignette survive.

The mask is built from normalised warmth (R-B)/L, which separates the scene
three ways:

    grey suit / white shirt   0.10 - 0.13   (neutral, must not shift)
    wall + halo               0.31 - 0.39   (the target)
    skin                      0.43 - 0.83   (strongly red-dominant, protect)

Luminance alone does not work: the bright core of the halo behind the head sits
in the same range as lit skin, so a luminance gate either leaves a gold smudge
or tints the face.

Requires: pillow, numpy.
"""

from PIL import Image, ImageFilter
import numpy as np
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


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def blur(m, radius):
    img = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255.0


def skin_mask(L, warm):
    """Face/neck and hands, grown outward from unambiguously-skin pixels.

    Only skin needs protecting spatially. Suit and shirt protect themselves by
    being neutral — warmth 0.07-0.25, against the glow's 0.22-0.60 — and
    folding them into a silhouette caused more trouble than it solved.

    Shadowed skin cannot be found by colour: the shadowed jaw sits at warmth
    0.44 against the wall's 0.40. It has to be reached by growing outward from
    lit skin far enough to cover it (~46px) while stopping short of the glow,
    which is ~150px away.

    Head and hands grow separately — the hands are a thin horizontal band and
    dissolve under a radius large enough for the head.
    """
    conf = ((warm > 0.62) & (L > 0.15)).astype(np.float32)
    head = conf.copy()
    head[700:] = 0
    hands = conf.copy()
    hands[:700] = 0
    grown = np.maximum(
        (blur(head, 46) > 0.14).astype(np.float32),
        (blur(hands, 26) > 0.13).astype(np.float32),
    )
    return blur(grown, 10)


def main():
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255.0
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    L = 0.299 * R + 0.587 * G + 0.114 * B
    warm = (R - B) / (L + 1e-3)

    # Grade what is actually warm, and keep it off skin. There is deliberately
    # no upper warmth bound: the earlier "exclude skin" gate at 0.40-0.62 also
    # excluded the bright core of the glow, which lives at 0.50-0.60 — that was
    # the gold that survived behind his head.
    mask = smoothstep(0.26, 0.36, warm) * (1 - skin_mask(L, warm))
    # Along the hair/wall boundary single pixels alternate between hair and
    # wall, so the mask alternates too and the grade speckles. A small blur
    # resolves it into a clean edge.
    mask = blur(mask, 3)[..., None]

    gray = np.repeat(L[..., None], 3, axis=2)

    for name, rgb in ACCENTS.items():
        acc = np.array(rgb, np.float32) / 255.0
        acc_lum = 0.299 * acc[0] + 0.587 * acc[1] + 0.114 * acc[2]
        # Scale the accent so it carries each pixel's own luminance
        tint = gray * (acc / acc_lum)[None, None, :]
        tint = gray + (tint - gray) * SAT
        out = a * (1 - mask) + np.clip(tint, 0, 1) * mask

        path = f'{OUT}/AhnafHussain-{name}.png'
        Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8)).save(
            path, optimize=True
        )
        print(f'  {path}  {os.path.getsize(path) // 1024}KB')


if __name__ == '__main__':
    main()
