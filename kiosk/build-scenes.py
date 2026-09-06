#!/usr/bin/env python3
"""Builds the whole-plant preview scenes from the site's own art-catalogue cards.

Each card in `images/` is already the shot we want: ONE plant, one pot, one
camera angle, one room. So we do not cut the plant out and re-composite it —
we keep the photograph whole and recolour only its petals. That preserves the
pot, the leaves, the lighting and the room exactly as photographed.

Writes to ../scenes/ at the repo root (the order page and the exhibition kiosk
both serve them from there), two files per scene:

  <id>.webp          the photograph, cropped out of its catalogue card
  <id>-petals.webp   the petal mask, 8-bit in the alpha channel

At runtime the browser draws the photograph, then paints the visitor's swirl
through the petal mask in canvas 'color' blend mode — hue and saturation come
from the swirl, luminance stays the photograph's, so the petals keep their real
shading, veining and cast shadows. No luminance layer is shipped because these
petals are already bright (median 175-238); the earlier studio-plant source
needed one only because its dark magenta dragged every mix toward mud.
Everything downstream is canvas 2D — no SVG anywhere.

    python3 kiosk/build-scenes.py

Segmenting the petals, in two passes.

SEEDS, from three signals, because no one of them is enough:
  · brightness  — petals are light, leaves are dark. Fails on white walls.
  · focus       — the plant is sharp, the room is blurred. Fails on hard-edged
                  architecture: window frames, door reveals, blind shadows.
  · chroma      — a poured petal varies in HUE across a few pixels; walls and
                  blinds vary only in brightness. Measured separation runs
                  4.5-17.6x across these scenes.
plus a hand-authored zone per scene, which keeps the far side of the room out of
the search. The zones are generous: they are there to exclude, not to trim.

GROWTH, because thresholding always lost the lower blooms — they hang in the
plant's own shadow, so they fail a brightness test the lit ones pass, while
being painted in exactly the same colours. So the seeds train a colour model,
the rest of the zone trains a background model, and pixels the first explains
better join the mask. Three guards keep the room out: a pixel must also be in
focus, be marbled, and lie within 70px of a seed — a missed petal is beside the
petals we found, a door reveal across the room is not.

Both passes use heavy morphology only to decide WHICH regions are the plant,
then intersect back to the per-pixel result. Skipping that intersection paints
rectangles of wall into the gaps between blooms, which is what it looks like.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage as nd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'scenes')

# Ship at 4:5. Every scene is normalised to this so the preview frame does not
# jump as the visitor flips between them.
W, H = 880, 1100

# id -> source card, the zone the flower spike lives in, the mask rule, the
# Chinese chip label, and what makes the scene different.
#
# A zone is one (x0,x1,y0,y1) box in fractions of the cropped photo, or a list
# of them where one rectangle cannot describe where the spike is — an arcing
# spike leaves an empty corner, and that corner is exactly where a bright
# window or a picture frame gets mistaken for a petal.
#
# `rule` is (mode, sharp factor, value percentile, chroma factor):
#   'and'    focus AND poured — the strictest, for rooms whose walls carry some
#            colour of their own
#   'or'     focus OR poured — for pale, low-chroma flowers (the aurora spike)
#   'focus'  focus alone — where the room is uniformly out of focus
# These were chosen by sweeping every combination and scoring each against
# blur-bleed and leaf-bleed (see the module docstring), not by eye.
#
# `images/constellation-wall.webp` is deliberately absent: its sunlit wall is
# both in focus and warmly coloured, so no rule separates it from the pale
# petals in front of it. Six scenes still give six pots, angles and rooms.
SCENES = [
    ('minimal',    'images/art-03-blue.webp',   (.22, .97, .08, .84), ('and',   .52, 70, .45), '极简厅', 'grey cylinder pot, minimal interior'),
    ('zen',        'images/art-02-yellow.webp', (.16, 1.0, .00, .74), ('and',   .52, 54, .45), '禅意台', 'grey tapered pot, marble counter'),
    ('artisan',    'images/art-04-pink.webp',   (.45, 1.0, .00, .82), ('and',   .52, 54, .45), '绿意居', 'grey pot, green-walled room'),
    ('window',     'images/art-07-aurora.jpg',  (.36, 1.0, .00, .78), ('or',    .52, 54, .65), '窗边台', 'grey stone pot, window marble'),
    ('terracotta', 'images/art-06-peach.jpg',   (.20, .90, .00, .78), ('and',   .30, 54, .65), '暖阳窗', 'terracotta pot, warm interior'),
    # 'focus' not 'and': this spike is pale cream and lime, so its chroma barely
    # varies and the strict rule leaves almost no seeds (measured: 0.2% coverage).
    # two boxes: this spike arcs down-left, so the top-right corner holds only
    # room. Left as one box, 13% of that corner came back as "petal".
    ('bright',     'images/art-05-white.webp',  [(.14, .93, .22, .78),
                                                 (.14, .72, .02, .22)], ('focus', .40, 70, .45), '明亮厅', 'white pot, bright living room'),
]


def hsv(a):
    """Vectorised RGB->HSV. h in degrees, s and v in 0..1."""
    a = a.astype(np.float32) / 255.0
    mx = a.max(2); mn = a.min(2); d = mx - mn
    v = mx
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    i = m & (mx == r); h[i] = ((g - b)[i] / d[i]) % 6
    i = m & (mx == g); h[i] = ((b - r)[i] / d[i]) + 2
    i = m & (mx == b); h[i] = ((r - g)[i] / d[i]) + 4
    return h * 60, s, v


def chroma_var(im, win=11):
    """Local variation in hue, with brightness cancelled out. Opponent axes
    (red-green, yellow-blue) rather than HSV hue, which is unstable near grey."""
    a = np.asarray(im).astype(np.float32)
    rg = a[:, :, 0] - a[:, :, 1]
    yb = (a[:, :, 0] + a[:, :, 1]) * 0.5 - a[:, :, 2]
    out = 0
    for c in (rg, yb):
        m1 = nd.uniform_filter(c, win)
        m2 = nd.uniform_filter(c * c, win)
        out = out + np.maximum(m2 - m1 * m1, 0)
    return np.sqrt(out)


def tick_bottom(im):
    """These cards carry a green approval tick baked into the bottom-right.
    Return the y fraction to crop above it, or 0.955 if this card has none."""
    a = np.asarray(im)
    hh, s, v = hsv(a)
    h, w = v.shape
    box = np.zeros_like(v, dtype=bool)
    box[int(h * 0.80):, int(w * 0.68):] = True
    t = box & (s > 0.55) & (v > 0.35) & (hh >= 95) & (hh <= 155)
    if t.sum() < 200:
        return 0.955
    return max(0.60, np.nonzero(t.any(1))[0].min() / h - 0.014)


def uncard(im):
    """Lift the photograph out of its catalogue card: drop the printed border,
    the DIGITAL CATALOG line, the caption, and the tick."""
    w, h = im.size
    bot = tick_bottom(im)
    im = im.crop((int(w * 0.108), int(h * 0.064), int(w * 0.952), int(h * (bot - 0.012))))
    return ImageOps.fit(im, (W, H), Image.LANCZOS)


def zone_mask(zone, h, w):
    """One box or several, unioned into a boolean mask."""
    boxes = zone if isinstance(zone, list) else [zone]
    m = np.zeros((h, w), dtype=bool)
    for x0, x1, y0, y1 in boxes:
        m[int(h * y0):int(h * y1), int(w * x0):int(w * x1)] = True
    return m


def petal_mask(im, zone, rule):
    mode, sharp_f, val_p, chroma_f = rule
    a = np.asarray(im)
    hue, sat, val = hsv(a)
    lum = np.asarray(im.convert('L'), dtype=np.float32)
    m1 = nd.uniform_filter(lum, 9)
    m2 = nd.uniform_filter(lum * lum, 9)
    sharp = nd.maximum_filter(np.sqrt(np.maximum(m2 - m1 * m1, 0)), 7)
    cvar = nd.maximum_filter(chroma_var(im), 5)
    h, w = lum.shape

    inzone = zone_mask(zone, h, w)

    leaf = (hue >= 55) & (hue <= 180) & (sat > 0.22) & (val < 0.55)
    bright = val > max(0.44, np.percentile(val, val_p))
    focus = sharp > max(2.4, np.percentile(sharp, 80) * sharp_f)
    poured = cvar > max(5.0, np.percentile(cvar, 88) * chroma_f)
    core = {'and': focus & poured, 'or': focus | poured, 'focus': focus}[mode]

    raw = inzone & bright & ~leaf & core
    raw = nd.binary_opening(raw, np.ones((7, 7)))
    # Closing this hard is only to decide WHICH regions are the plant: a spike is
    # a chain of blooms with gaps between them, and nothing short of a big kernel
    # joins them into one thing to reason about. The silhouette it produces is
    # far too fat — blocks of wall between the blooms — so it is used for
    # connectivity and then thrown away (see the intersection below).
    cand = nd.binary_fill_holes(nd.binary_closing(raw, np.ones((25, 25))))

    lab, n = nd.label(cand)
    if not n:
        return np.zeros((h, w), np.uint8)
    # The card frame and any wall run to the edge of the photo; a potted plant
    # never does. Drop anything touching the border, then keep the big pieces —
    # a spike breaks into several blobs because the stem between them is thin
    # and dark, so this cannot be "largest component only".
    edge = set(np.unique(np.concatenate([
        lab[:3].ravel(), lab[-3:].ravel(), lab[:, :3].ravel(), lab[:, -3:].ravel()]))) - {0}
    sizes = {i: int((lab == i).sum()) for i in range(1, n + 1) if i not in edge}
    if not sizes:
        return np.zeros((h, w), np.uint8)
    biggest = max(sizes.values())
    kept = [i for i, s in sizes.items() if s > biggest * 0.14]

    # Anything still standing that is soft all the way through is a piece of the
    # room, not a flower: these are shallow-depth-of-field shots, so the plant is
    # the only thing genuinely in focus. Judge each blob on its own median.
    focus_of = {i: float(np.median(sharp[lab == i])) for i in kept}
    sharpest = max(focus_of.values())
    kept = [i for i in kept if focus_of[i] > sharpest * 0.55]

    # Back to the real silhouette: keep only pixels that passed the per-pixel
    # test AND fell inside a region the connectivity pass vouched for.
    seeds = raw & np.isin(lab, kept)
    seeds = nd.binary_opening(seeds, np.ones((5, 5)))
    seeds = nd.binary_closing(seeds, np.ones((7, 7)))
    return nd.binary_fill_holes(seeds)


def grow(im, zone, seeds):
    """Learn what this scene's petals look like from the seeds, then find the
    rest of them.

    Thresholding alone always lost the lower blooms: they hang in the plant's
    own shadow, so they fail a brightness test that the lit ones pass. But they
    are painted in the same colours. So take the seeds as a sample of "petal",
    take the rest of the zone as a sample of "room", build a coarse colour
    histogram of each, and keep the pixels the petal model explains better.
    Classic histogram back-projection with a background model — it recovers the
    shadowed blooms without opening the door to the wall behind them."""
    a = np.asarray(im).astype(np.float32)
    hue, sat, val = hsv(np.asarray(im))
    h, w = val.shape

    # Opponent chroma, normalised by brightness so a shadowed petal lands in the
    # same bin as a lit one. That is the whole point.
    norm = np.maximum(a.sum(2), 1.0)
    rg = (a[:, :, 0] - a[:, :, 1]) / norm
    yb = ((a[:, :, 0] + a[:, :, 1]) * 0.5 - a[:, :, 2]) / norm
    B = 24
    bi = np.clip(((rg + 0.5) * B).astype(int), 0, B - 1)
    bj = np.clip(((yb + 0.5) * B).astype(int), 0, B - 1)
    bk = np.clip((val * 6).astype(int), 0, 5)
    idx = (bi * B + bj) * 6 + bk

    inzone = zone_mask(zone, h, w)
    # "room" = the zone minus the seeds and a wide margin around them, so petal
    # pixels the seeds merely missed do not end up training the negative model
    near = nd.binary_dilation(seeds, np.ones((41, 41)))
    room = inzone & ~near

    n = B * B * 6
    pos = np.bincount(idx[seeds].ravel(), minlength=n).astype(np.float32)
    neg = np.bincount(idx[room].ravel(), minlength=n).astype(np.float32)
    pos /= max(pos.sum(), 1.0)
    neg /= max(neg.sum(), 1.0)
    ratio = (pos + 1e-6) / (neg + 1e-6)
    like = ratio[idx]

    # A focus floor, low enough that a bloom hanging in shadow still clears it —
    # depth of field is about distance, not brightness — but high enough to drop
    # the blurred room. Without it the colour model paints rectangles of wall
    # wherever the room happens to share a hue with the flowers.
    lum = np.asarray(im.convert('L'), dtype=np.float32)
    m1 = nd.uniform_filter(lum, 9)
    m2 = nd.uniform_filter(lum * lum, 9)
    sharp = nd.maximum_filter(np.sqrt(np.maximum(m2 - m1 * m1, 0)), 7)
    infocus = sharp > max(2.0, np.percentile(sharp, 80) * 0.20)

    # Colour alone is not enough to admit a new pixel: a wall a metre behind the
    # spike can share a hue with the petals, and the negative model never sees
    # the wall immediately around the seeds. Require the marbling too — a bloom
    # in shadow is still poured, a wall is smooth no matter how it is lit. This
    # is what stops rectangles of room appearing beside the flowers.
    cvar = nd.maximum_filter(chroma_var(im), 5)
    poured = cvar > max(4.0, np.percentile(cvar, 88) * 0.35)

    # Growth exists to pick up the parts of a flower the seeds missed, and those
    # are by definition beside the parts they found. A door reveal on the far
    # side of the room is not a missed petal, however well it matches, so cap how
    # far the model is allowed to reach.
    reach = nd.distance_transform_edt(~seeds) < 70

    leaf = (hue >= 55) & (hue <= 180) & (sat > 0.22) & (val < 0.55)
    raw = inzone & ~leaf & (val > 0.30) & infocus & (((like > 4.0) & poured & reach) | seeds)
    raw = nd.binary_opening(raw, np.ones((7, 7)))

    # Same two-step as the seed pass: dilate hard to work out which blobs belong
    # to the plant, then intersect back so the edge follows the petal and not the
    # kernel. Skipping the intersection paints rectangles of wall between the
    # blooms, which is exactly what it looks like.
    linked = nd.binary_fill_holes(nd.binary_closing(raw, np.ones((17, 17))))
    lab, k = nd.label(linked)
    if not k:
        return seeds
    vouched = set(np.unique(lab[seeds])) - {0}
    keep = raw & np.isin(lab, list(vouched))
    keep = nd.binary_closing(keep, np.ones((9, 9)))
    keep = nd.binary_fill_holes(keep)
    keep = nd.binary_opening(keep, np.ones((5, 5)))

    # Last sweep: a bloom is a big thing. Anything left that is a fraction of the
    # size of the real ones is a scrap of room, and a stray recoloured patch
    # floating beside the plant is worse on an order page than a missed petal.
    lab2, k2 = nd.label(keep)
    if k2 > 1:
        sizes = nd.sum(keep, lab2, range(1, k2 + 1))
        keep = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.08])
    return keep


def feather(mask):
    m = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(m.filter(ImageFilter.GaussianBlur(2.0)))


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for sid, rel, zone, rule, zh, note in SCENES:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print('  skip %-11s (missing %s)' % (sid, rel))
            continue
        photo = uncard(Image.open(src).convert('RGB'))
        mask = feather(grow(photo, zone, petal_mask(photo, zone, rule)))

        photo.save(os.path.join(OUT, '%s.webp' % sid), quality=84, method=6)
        pm = Image.new('RGBA', (W, H), (255, 255, 255, 0))
        pm.putalpha(Image.fromarray(mask))
        pm.save(os.path.join(OUT, '%s-petals.webp' % sid), quality=90, method=6)

        cov = (mask > 128).mean() * 100
        hue, sat, val = hsv(np.asarray(photo))
        leaf = (hue >= 55) & (hue <= 180) & (sat > 0.22) & (val < 0.55)
        bleed = (leaf & (mask > 128)).sum() / max(1, (mask > 128).sum()) * 100
        kb = (os.path.getsize(os.path.join(OUT, '%s.webp' % sid))
              + os.path.getsize(os.path.join(OUT, '%s-petals.webp' % sid))) // 1024
        total += kb
        print('%-11s %-3s petals %4.1f%%  leaf-bleed %4.1f%%  %3d KB   %s'
              % (sid, zh, cov, bleed, kb, note))
    print('\n%d scenes, %d KB total (the page fetches one at a time)' % (len(SCENES), total))


if __name__ == '__main__':
    sys.exit(main())
