"""Draw one frame of the hero globe as a flat SVG.

    python build_globe_still.py globe-geo.json still.svg

The output is pasted into the hero in KMTY Orchid v5.dc.html as the
<svg data-globe-still> element. Input is build_globe_geo.py's output.

Two audiences never get the WebGL globe: phones, where half a megabyte of
three.js for a decoration behind the headline is indefensible, and anyone who
has asked the system for reduced motion. Both are owed the same picture, just
still — so it is generated here from the very same outline the live globe
wraps on its sphere, at the very same camera the live globe starts from, in
the same palette. Keep the fills below in step with globe.js: the two are seen
at the same size, and a drawing dimmer than the sphere it stands in for reads
as a mistake.

Orthographic, because that is what a sphere looks like from far enough away and
the live camera is at 4.55 radii with a 30 degree lens — close enough that
nobody will hold the two side by side and find the difference.

Rings are clipped at the terminator: a run of points facing the viewer is
carried to the horizon and closed along it, which is all the fidelity this
needs — the drawing is a few hundred pixels across at most.
"""
import json, math, sys

sys.path.insert(0, __import__('os').path.dirname(__file__))
from build_globe_geo import clean  # same simplifier, run harder for a still

GEO = json.load(open(sys.argv[1]))
OUT = sys.argv[2]

VIEW_LAT, VIEW_LON = 16.0, 96.0
HOME = (25.04, 102.72)
DEST = [(37.57, 126.98), (21.03, 105.85), (14.60, 120.98), (13.75, 100.50),
        (1.35, 103.82), (4.90, 114.94), (25.20, 55.27), (23.59, 58.41), (22.32, 114.17)]
S = 100.0          # viewBox is 0..220; the globe is a 200-unit circle in the middle
CX = CY = 110.0


def v3(lat, lon, r=1.0):
    p, l = math.radians(lat), math.radians(lon)
    return (r * math.cos(p) * math.sin(l), r * math.sin(p), r * math.cos(p) * math.cos(l))


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    m = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / m, a[1] / m, a[2] / m)


EYE = norm(v3(VIEW_LAT, VIEW_LON))
AX = norm(cross((0.0, 1.0, 0.0), EYE))      # screen right
AY = cross(EYE, AX)                          # screen up


# the live globe rolls its camera by the axial tilt (see globe.js); the same
# roll applied to the projected point keeps this drawing the same frame
TILT = math.radians(23.4)
_CT, _ST = math.cos(TILT), math.sin(TILT)


def proj(p):
    x, y = dot(p, AX) * S, -dot(p, AY) * S
    return (CX + x * _CT - y * _ST, CY + x * _ST + y * _CT)


def f(n):
    s = ('%.1f' % n).rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def slerp_to_limb(a, b):
    """Point on the great circle a->b where the surface turns away from us."""
    da, db = dot(a, EYE), dot(b, EYE)
    if da == db:
        return a
    t = da / (da - db)
    p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
    return norm(p)


def ring_paths(ring):
    """Visible runs of one ring, each already closed along the horizon."""
    pts = [v3(la, lo) for lo, la in ring]
    vis = [dot(p, EYE) > 0 for p in pts]
    if not any(vis):
        return []
    if all(vis):
        return [pts]
    runs, cur, n = [], None, len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        va, vb = vis[i], vis[(i + 1) % n]
        if va:
            if cur is None:
                cur = []
            cur.append(a)
            if not vb:
                cur.append(slerp_to_limb(a, b)); runs.append(cur); cur = None
        elif vb:
            cur = [slerp_to_limb(a, b)]
    if cur:
        if runs:
            runs[0] = cur + runs[0]          # the ring wrapped past index 0
        else:
            runs.append(cur)
    return [r for r in runs if len(r) >= 3]


def decode(flat):
    out, i = [], 0
    while i < len(flat):
        n = flat[i]; i += 1
        r, x, y = [], 0, 0
        for _ in range(n):
            x += flat[i]; y += flat[i + 1]; i += 2
            r.append((x / 10.0, y / 10.0))
        out.append(r)
    return out


def d_for(flat, tol):
    d = []
    for ring in decode(flat):
        r = clean(ring, tol, tol * 1.6)
        if not r:
            continue
        for run in ring_paths([(x / 10.0, y / 10.0) for x, y in r]):
            xy = [proj(p) for p in run]
            d.append('M' + ' '.join('%s %s' % (f(x), f(y)) for x, y in xy) + 'Z')
    return ''.join(d)


# graticule: only the arcs facing us, every thirty degrees for a still this small
def graticule():
    d = []
    for la in range(-60, 61, 30):
        seg = []
        for lo in range(0, 361, 5):
            p = v3(la, lo)
            if dot(p, EYE) > 0:
                seg.append(proj(p))
            elif seg:
                d.append(seg); seg = []
        if seg:
            d.append(seg)
    for lo in range(0, 360, 30):
        seg = []
        for la in range(-90, 91, 5):
            p = v3(la, lo)
            if dot(p, EYE) > 0:
                seg.append(proj(p))
            elif seg:
                d.append(seg); seg = []
        if seg:
            d.append(seg)
    return ''.join('M' + ' '.join('%s %s' % (f(x), f(y)) for x, y in s) for s in d if len(s) > 1)


def arcs():
    a = v3(*HOME)
    d = []
    for lat, lon in DEST:
        b = v3(lat, lon)
        om = math.acos(max(-1.0, min(1.0, dot(a, b)))); s = math.sin(om)
        lift = 0.05 + 0.3 * (om / math.pi)
        seg, run = [], []
        for i in range(37):
            t = i / 36.0
            k1, k2 = math.sin((1 - t) * om) / s, math.sin(t * om) / s
            p = (a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2)
            r = 1 + lift * math.sin(math.pi * t)
            p = (p[0] * r, p[1] * r, p[2] * r)
            if dot(norm(p), EYE) > -0.02:
                run.append(proj(p))
            elif run:
                seg.append(run); run = []
        if run:
            seg.append(run)
        d += [s for s in seg if len(s) > 1]
    return ''.join('M' + ' '.join('%s %s' % (f(x), f(y)) for x, y in s) for s in d)


def dots():
    out = []
    for lat, lon in DEST:
        p = v3(lat, lon, 1.004)
        if dot(norm(p), EYE) > 0.02:
            x, y = proj(p)
            out.append('<circle cx="%s" cy="%s" r="1.5" fill="#E7B7CF"/>' % (f(x), f(y)))
    hx, hy = proj(v3(*HOME, 1.004))
    out.append('<circle cx="%s" cy="%s" r="2.6" fill="none" stroke="#C6952F" stroke-width=".8" opacity=".6"/>' % (f(hx), f(hy)))
    out.append('<circle cx="%s" cy="%s" r="1.8" fill="#F3EEE4"/>' % (f(hx), f(hy)))
    return ''.join(out)


svg = (
    '<svg data-globe-still viewBox="0 0 220 220" aria-hidden="true" focusable="false" '
    'style="position:absolute;inset:0;width:100%;height:100%;transition:opacity .6s ease;">'
    '<defs><radialGradient id="kmtyGlobeRim" cx="50%" cy="50%" r="50%">'
    '<stop offset="91%" stop-color="#C6952F" stop-opacity="0"/>'
    '<stop offset="100%" stop-color="#C6952F" stop-opacity=".5"/></radialGradient></defs>'
    '<circle cx="110" cy="110" r="100" fill="#1B1522"/>'
    '<path d="' + d_for(GEO['land'], 0.9) + '" fill="rgba(198,149,47,.26)"/>'
    '<path d="' + d_for(GEO['home'], 0.5) + '" fill="rgba(231,183,207,.38)"/>'
    '<path d="' + d_for(GEO['mkt'], 0.22) + '" fill="rgba(198,149,47,.72)" '
    'stroke="rgba(255,232,170,.9)" stroke-width=".4" stroke-linejoin="round"/>'
    '<path d="' + graticule() + '" fill="none" stroke="#C6952F" stroke-opacity=".2" stroke-width=".35"/>'
    '<path d="' + arcs() + '" fill="none" stroke="#DBA95F" stroke-opacity=".9" stroke-width=".9" stroke-linecap="round"/>'
    + dots() +
    '<circle cx="110" cy="110" r="101" fill="url(#kmtyGlobeRim)"/>'
    '<circle cx="110" cy="110" r="100" fill="none" stroke="#C6952F" stroke-opacity=".3" stroke-width="1"/>'
    '</svg>'
)
open(OUT, 'w').write(svg)
print('svg', len(svg), 'bytes')
import gzip
print('gz ', len(gzip.compress(svg.encode())), 'bytes')
