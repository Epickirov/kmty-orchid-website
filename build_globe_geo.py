"""Shrink the film's world outline for a hero-sized globe.

    python build_globe_geo.py <film geo.json> globe-geo.json

The input is the trade-show film's country outline — its `geo/geo.json`,
241 countries as [lon, lat] rings, 443 KB. That file belongs to the film's
working folder, not to this repo, so the checked-in artefacts are the output:
the GEO constant in globe.js and the <svg data-globe-still> in the hero, both
of which regenerate byte-for-byte from the command above. This script's output
is also what build_globe_still.py draws the flat fallback from.

The film drew 30k points onto a 2048px texture for a 900px globe on a 1080p
wall. The hero globe fills most of the right of the page — up to about 900 CSS
px, so up to ~760px of sphere, which puts a degree of latitude at ~4px and
makes a third of a degree the point at which more detail stops showing. Three
things shrink the payload:

  * Douglas-Peucker, gently on the nine markets and China (they carry a lit
    edge, so their shape has to survive) and hard on everything else, which is
    only ever a flat wash.
  * rings smaller than a pixel on the texture are dropped outright.
  * names go away: the draw only ever asks "market, home, or land?", so the
    countries are emitted as three groups of rings and nothing else.

Output is one compact JSON array of integers in tenths of a degree, delta
encoded along each ring, which gzips far better than float pairs.
"""
import json, math, sys

MARKETS = {'South Korea', 'Vietnam', 'Philippines', 'Thailand', 'Singapore',
           'United Arab Emirates', 'Oman', 'Brunei', 'Hong Kong'}
HOME = 'China'


def perp(p, a, b):
    """Point-to-segment distance in degrees; good enough as a planar metric."""
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        worst, wi = -1.0, -1
        for k in range(i + 1, j):
            d = perp(pts[k], pts[i], pts[j])
            if d > worst:
                worst, wi = d, k
        if worst > tol:
            keep[wi] = True
            stack.append((i, wi)); stack.append((wi, j))
    return [p for p, k in zip(pts, keep) if k]


def clean(ring, tol, minspan):
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring = ring[:-1]
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    if not xs or max(xs) - min(xs) < minspan and max(ys) - min(ys) < minspan:
        return None
    r = dp(ring + [ring[0]], tol)[:-1]
    # round to a tenth of a degree, then drop points the rounding made equal
    out, last = [], None
    for x, y in r:
        q = (round(x * 10), round(y * 10))
        if q != last:
            out.append(q); last = q
    if len(out) > 2 and out[0] == out[-1]:
        out.pop()
    return out if len(out) >= 3 else None


def encode(rings):
    """[n, x0, y0, dx, dy, ...] per ring, flattened."""
    flat = []
    for r in rings:
        flat.append(len(r))
        px = py = 0
        for x, y in r:
            flat.append(x - px); flat.append(y - py)
            px, py = x, y
    return flat


if __name__ == '__main__':
    SRC = sys.argv[1]
    src = json.load(open(SRC))
    groups = {'mkt': [], 'home': [], 'land': []}
    for c in src:
        if c['n'] in MARKETS:
            key, tol, minspan = 'mkt', 0.12, 0.10
        elif c['n'] == HOME:
            key, tol, minspan = 'home', 0.25, 0.30
        else:
            key, tol, minspan = 'land', 0.30, 0.45
        for ring in c['p']:
            r = clean(ring, tol, minspan)
            if r:
                groups[key].append(r)

    out = {k: encode(v) for k, v in groups.items()}
    blob = json.dumps(out, separators=(',', ':'))
    open(sys.argv[2], 'w').write(blob)

    import gzip
    print('rings   ', {k: len(v) for k, v in groups.items()})
    print('points  ', {k: sum(len(r) for r in v) for k, v in groups.items()},
          'total', sum(sum(len(r) for r in v) for v in groups.values()))
    print('raw     ', len(blob), 'bytes')
    print('gzip    ', len(gzip.compress(blob.encode())), 'bytes')
