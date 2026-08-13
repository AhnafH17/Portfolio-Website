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


def subject_mask(L, warm):
    """Rough silhouette of the person, used to keep the grade off him entirely.

    Warmth alone cannot protect shadowed skin: the shadowed jaw sits at 0.44
    and the wall at 0.40, and a spatial grow from confident skin does not
    separate them either — that jaw is as far from lit skin as the wall is.
    But the subject is a single solid region and the wall is not, so seeding
    on "brighter than the wall or clearly skin" and closing the holes gives a
    silhouette that covers shadowed skin, the collar and the suit.

    Closing the holes inflates the outline past his edge, which would leave a
    gold band hugging him, so it is eroded back before a tight feather.
    """
    seed = ((L > 0.32) | (warm > 0.55)).astype(np.float32)
    solid = (blur(seed, 26) > 0.42).astype(np.float32)   # close glasses/hair/shadow
    solid = (blur(solid, 18) > 0.40).astype(np.float32)  # smooth the outline
    solid = (blur(solid, 12) > 0.88).astype(np.float32)  # erode back onto him
    return blur(solid, 3)                                # tight feather


def main():
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32) / 255.0
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    L = 0.299 * R + 0.587 * G + 0.114 * B
    warm = (R - B) / (L + 1e-3)

    mask = (
        smoothstep(0.24, 0.36, warm)          # exclude neutral fabric
        * (1 - smoothstep(0.40, 0.62, warm))  # exclude skin
        * (1 - smoothstep(0.50, 0.72, L))     # exclude highlights
        * (1 - subject_mask(L, warm))         # exclude the subject outright
    )
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
