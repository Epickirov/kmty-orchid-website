"""Assemble the kmty-site upload folder for Cloudflare Pages.

    python build_deploy.py [outdir]        # default: dist/kmty-site

The marketing site and the Constellation order page live in one repo but
deploy to two different Pages projects, and the files that decide which is
which are named the same in both. Getting it wrong publishes the order page's
routing over the marketing site, so the choice is made here rather than by
hand in a file picker:

  * `_worker.js` in the upload folder must be `site-worker.js` (the kmty-site
    worker: static passthrough plus POST /api/lead). The `_worker.js` already
    in the repo root belongs to the order page and must never be copied.
  * `_redirects` stays behind for the same reason — /order, /admin and /stock
    are the order page's clean URLs and rewrite to files this project does not
    have.

The page is uploaded as `index.html` so the bare domain serves it, and the
one absolute URL in the markup (the og:image, which points at githack for the
preview builds) is repointed at the live domain, because a social card cannot
be a relative path.

Images are copied by reference, not wholesale: the repo carries far more than
the page uses, and the upload is the difference between about 17 MB and 94 MB.
Anything referenced but missing is a hard error — a silently absent image is
the kind of thing nobody notices until it is live.
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'kmty-site')

PAGE = 'KMTY Orchid v5.dc.html'
LIVE = 'https://www.kmtyorchid.com'
FILES = ['i18n.js', 'support.js', 'image-slot.js', 'terroir-geo.json', '_headers']
TREES = ['fonts', 'vendor']
WORKER = ('site-worker.js', '_worker.js')


def scan_images(text):
    """Every images/... path a served file refers to."""
    return set(re.findall(r'images/[A-Za-z0-9._/-]+\.(?:jpg|jpeg|png|webp|avif|gif|svg|mp4|webm)', text))


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    page = open(os.path.join(ROOT, PAGE), encoding='utf-8').read()
    before = page
    # the og:image has to be absolute, and on the live host rather than the
    # preview CDN the working branches point it at
    page = re.sub(r'https://raw(?:cdn)?\.githack\.com/Epickirov/kmty-orchid-website/[^"\')\s]*?/images/',
                  LIVE + '/images/', page)
    if page == before:
        print('note: no githack image URL found to repoint (already live?)')
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page)

    texts = [page]
    for f in FILES:
        src = os.path.join(ROOT, f)
        shutil.copy2(src, os.path.join(OUT, f))
        if f.endswith(('.js', '.json')):
            texts.append(open(src, encoding='utf-8').read())

    shutil.copy2(os.path.join(ROOT, WORKER[0]), os.path.join(OUT, WORKER[1]))

    for t in TREES:
        shutil.copytree(os.path.join(ROOT, t), os.path.join(OUT, t))

    wanted = set()
    for t in texts:
        wanted |= scan_images(t)

    missing = []
    for rel in sorted(wanted):
        src = os.path.join(ROOT, rel)
        if not os.path.isfile(src):
            missing.append(rel); continue
        dst = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    if missing:
        raise SystemExit('referenced but not in the repo:\n  ' + '\n  '.join(missing))

    n = size = 0
    for dirpath, _, names in os.walk(OUT):
        for name in names:
            n += 1
            size += os.path.getsize(os.path.join(dirpath, name))
    print('%s\n  %d files, %.1f MB\n  %d images referenced and copied' % (OUT, n, size / 1e6, len(wanted)))
    for bad in ('_redirects', 'constellation.html', 'admin.html', 'stock.html', 'reseller.html'):
        assert not os.path.exists(os.path.join(OUT, bad)), 'order-page file leaked into the bundle: ' + bad
    print('  order-page files kept out: ok')


if __name__ == '__main__':
    main()
