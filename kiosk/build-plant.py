#!/usr/bin/env python3
"""Builds the whole-plant preview assets from a studio plant photograph.

Writes to ../plants/ at the repo root, not into kiosk/ — the exhibition kiosk
and the customer order page (constellation.html, 整株 tab) both serve them from
there. For each source plant:
  plant-<id>.webp        the plant cut off its studio background (RGBA)
  plant-<id>-petals.webp the petal-only mask, greyscale in the alpha channel
  plant-<id>-lum.webp    the petals' normalised luminance (see below)
plus env-<id>.webp, one per environment backdrop.

At runtime the browser paints the swirl through the petal mask and keeps the
photograph's own luminance, so the recoloured plant carries real petal shading,
veining and depth instead of looking like flat fill. Everything downstream is
canvas 2D — no SVG anywhere.

    python3 kiosk/build-plant.py
"""
import colorsys
import os
import sys

from PIL import Image, ImageFilter, ImageChops

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'plants')

# id -> (source file, longest edge to ship at)
SOURCES = {
    'magenta': ('images/pot-magenta.jpg', 1080),
}

# Environment plates the plant is composited into. Each is cropped to 16:9,
# then blurred and darkened: they are backdrop, not subject, and a sharp busy
# greenhouse behind a sharp plant reads as a collage rather than a photograph.
# id -> (source, blur px, darken 0-1, crop focus y as a fraction)
ENVIRONMENTS = {
    'greenhouse': ('images/greenhouse-1.jpg', 6, 0.42, 0.50),
    'market': ('images/rack-multicolor.jpg', 7, 0.46, 0.38),
    'field': ('images/field-cream.jpg', 6, 0.38, 0.55),
}
ENV_W, ENV_H = 1280, 720


def masks(im):
    """Return (plant_alpha, petal_mask) as 8-bit L images.

    Studio background is near-white and desaturated; petals are the only
    strongly-saturated magenta/pink region; leaves sit in green hues. Measured
    on the source: 74.9% background, 10.4% petals, 6.9% green.
    """
    w, h = im.size
    px = im.load()
    plant = Image.new('L', (w, h), 0)
    petal = Image.new('L', (w, h), 0)
    pp, tp = plant.load(), petal.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            deg = hh * 360
            # background: bright and colourless. Everything else is the plant.
            bg = v > 0.86 and s < 0.12
            if not bg:
                pp[x, y] = 255
            # petals: saturated, and in the magenta->pink->red arc rather than
            # the green of the foliage.
            if s > 0.22 and v > 0.15 and (deg >= 268 or deg <= 28):
                tp[x, y] = 255
    return plant, petal


def clean(mask, close=2, feather=1.2, open_first=0):
    """Optionally open (drop specks), then close pinholes, then feather so
    composited edges are not aliased."""
    for _ in range(open_first):
        mask = mask.filter(ImageFilter.MinFilter(3))
    for _ in range(open_first):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    for _ in range(close):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    for _ in range(close):
        mask = mask.filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(feather))


def build_environments():
    for eid, (rel, blur, dark, focus) in ENVIRONMENTS.items():
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print('  skip %s (missing %s)' % (eid, rel))
            continue
        im = Image.open(src).convert('RGB')
        # cover-crop to 16:9 around the focal band
        k = max(ENV_W / im.width, ENV_H / im.height)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        top = max(0, min(im.height - ENV_H, round(im.height * focus - ENV_H / 2)))
        left = max(0, (im.width - ENV_W) // 2)
        im = im.crop((left, top, left + ENV_W, top + ENV_H))
        im = im.filter(ImageFilter.GaussianBlur(blur))
        im = Image.blend(im, Image.new('RGB', im.size, (14, 12, 18)), dark)
        out = os.path.join(OUT, 'env-%s.webp' % eid)
        im.save(out, quality=82, method=6)
        print('  env-%-11s %dx%d  %d KB' % (eid, ENV_W, ENV_H, os.path.getsize(out) // 1024))


def main():
    os.makedirs(OUT, exist_ok=True)
    for pid, (rel, longest) in SOURCES.items():
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            sys.exit('missing source: ' + rel)
        im = Image.open(src).convert('RGB')
        if max(im.size) > longest:
            k = longest / max(im.size)
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

        plant, petal = masks(im)
        plant = clean(plant, close=3, feather=1.0)
        petal = clean(petal, close=2, feather=1.4, open_first=3)

        # Trim to the plant's bounding box so the browser is not compositing
        # large empty margins every frame.
        bbox = plant.point(lambda v: 255 if v > 24 else 0).getbbox()
        im, plant, petal = im.crop(bbox), plant.crop(bbox), petal.crop(bbox)

        cut = im.convert('RGBA')
        cut.putalpha(plant)
        cut.save(os.path.join(OUT, 'plant-%s.webp' % pid), quality=92, method=6)

        # Ship the petal mask in the alpha channel: WebP keeps 8-bit alpha and
        # a flat RGB payload compresses to almost nothing.
        pm = Image.new('RGBA', im.size, (255, 255, 255, 0))
        pm.putalpha(petal)
        pm.save(os.path.join(OUT, 'plant-%s-petals.webp' % pid), quality=90, method=6)

        # Normalised petal luminance. Compositing the raw photo in 'luminosity'
        # mode drags every mix toward mud, because the source petals are dark
        # magenta. Stretching the petal band's own 2nd-98th percentile into a
        # bright range keeps the shading and veining but lets the visitor's
        # colours read at full strength.
        lum = im.convert('L')
        vals = sorted(v for v, m in zip(lum.getdata(), petal.getdata()) if m > 140)
        if vals:
            lo, hi = vals[int(len(vals) * 0.02)], vals[int(len(vals) * 0.98)]
            lo, hi = float(lo), float(max(hi, lo + 1))
            LO, HI = 0.46, 1.06   # target range, in units of full white
            lut = []
            for v in range(256):
                t = (v - lo) / (hi - lo)
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                lut.append(max(0, min(255, round((LO + (HI - LO) * t) * 255))))
            lum = lum.point(lut)
            print('  petal luminance stretched from %d-%d to %d-%d' % (lo, hi, LO * 255, min(255, HI * 255)))
        lum.convert('RGB').save(os.path.join(OUT, 'plant-%s-lum.webp' % pid), quality=88, method=6)

        cov = sum(petal.point(lambda v: 1 if v > 128 else 0).getdata())
        area = im.width * im.height
        print('%-8s %dx%d  plant %d KB  petals %d KB  petal coverage %.1f%%' % (
            pid, im.width, im.height,
            os.path.getsize(os.path.join(OUT, 'plant-%s.webp' % pid)) // 1024,
            os.path.getsize(os.path.join(OUT, 'plant-%s-petals.webp' % pid)) // 1024,
            cov * 100.0 / area))


if __name__ == '__main__':
    main()
    build_environments()
