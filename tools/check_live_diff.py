#!/usr/bin/env python3
"""Will this deploy change only what I meant it to?

    python tools/check_live_diff.py dist/kmty-site --expect index.html,i18n.js

Fetches the text files the live site serves, compares each with the same file in
the folder you are about to upload, and exits 1 if anything differs that you did
not say would. It is the check that should have existed before the first deploy
from a second checkout: a build is only as current as the tree it came from, and
this site has already been deployed from a checkout that was never pushed.
Uploading a tree that is behind rolls back whatever the newer one had, and
nothing in `wrangler pages deploy` will say so.

Line endings are ignored, because a Windows checkout deploys CRLF and this repo
stores LF. Nothing else is: one changed byte is a difference.

What it cannot see, and says so:
  - the Worker (_worker.js, inventory-api.js) — never served as a file, so a
    Worker that is behind cannot be detected from outside. Only the checkout
    that produced the live site is known to have the current one.
  - binary assets (images, fonts) — compared by name and size only, via HEAD.
"""
import argparse, os, sys, urllib.request, urllib.error

# every text asset the upload carries and the live site serves as a plain file
TEXT = ['index.html', 'i18n.js', 'support.js', 'image-slot.js', 'terroir-geo.json',
        'inventory.html', 'inventory-admin.html', 'inventory-shared.js', 'xlsx-lite.js',
        'fonts/fonts.css']
# the upload names the page index.html; the clean URLs map to files
URL = {'index.html': '', 'inventory.html': 'inventory', 'inventory-admin.html': 'inventory-admin'}


def fetch(base, name):
    url = base.rstrip('/') + '/' + URL.get(name, name) + ('?_=cachebust' if name == 'index.html' else '')
    req = urllib.request.Request(url, headers={'User-Agent': 'kmty-deploy-check', 'Cache-Control': 'no-cache'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        return None if e.code == 404 else Exception('HTTP %d' % e.code)
    except Exception as e:
        return e


def lf(b):
    return b.replace(b'\r\n', b'\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder', help='the upload folder, e.g. dist/kmty-site')
    ap.add_argument('--expect', default='', help='comma-separated files this deploy is meant to change')
    ap.add_argument('--site', default='https://www.kmtyorchid.com')
    a = ap.parse_args()
    expect = {x.strip() for x in a.expect.split(',') if x.strip()}
    unknown = expect - set(TEXT)
    if unknown:
        sys.exit('--expect names files this check does not compare: ' + ', '.join(sorted(unknown)))

    print('comparing %s with %s\n' % (a.folder, a.site))
    bad = 0
    for name in TEXT:
        path = os.path.join(a.folder, name)
        mine = open(path, 'rb').read() if os.path.exists(path) else None
        live = fetch(a.site, name)
        if isinstance(live, Exception):
            print('  %-24s COULD NOT FETCH LIVE (%s)' % (name, live)); bad += 1; continue
        if mine is None and live is None:
            verdict = 'absent from both'
        elif mine is None:
            verdict, bad = 'LIVE HAS IT, THE UPLOAD DOES NOT — would be deleted', bad + 1
        elif live is None:
            verdict = 'new (live does not have it)' + ('' if name in expect else '   <-- UNEXPECTED')
            bad += name not in expect
        elif lf(mine) == lf(live):
            verdict = 'identical' + ('   <-- you said this would change' if name in expect else '')
            bad += name in expect
        else:
            sm, sl = len(lf(mine)), len(lf(live))
            if name in expect:
                verdict = 'changed, as expected (%+d bytes)' % (sm - sl)
            else:
                verdict = 'CHANGED, NOT EXPECTED (%+d bytes) — this tree is behind or ahead of live' % (sm - sl)
                bad += 1
        print('  %-24s %s' % (name, verdict))

    print('\nnot comparable from outside: _worker.js, inventory-api.js (never served), images, fonts (binary).')
    if bad:
        print('\n%d problem(s). Do not deploy this folder until each is explained.' % bad)
        sys.exit(1)
    print('\nOK: the deploy changes exactly what you said it would.')


if __name__ == '__main__':
    main()
