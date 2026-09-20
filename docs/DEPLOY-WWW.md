# Deploying www.kmtyorchid.com

Runbook for publishing the marketing site to the Cloudflare Pages project
**`kmty-site`**. For the wider project context — the two systems, the account,
the other project — read `docs/HANDOFF.md` first.

**Pushing to GitHub does not deploy anything.** `kmty-site` has no Git
connection; every release is a manual upload of a folder. That has caught
people out before.

---

## 0. The one thing that can go badly wrong

The marketing site and the Constellation order page deploy to two different
Pages projects out of this one repo, and the files that decide which is which
have the same names in both:

| In the repo root | Belongs to | In the `kmty-site` upload |
|---|---|---|
| `_worker.js` | the **order page** | must **not** be uploaded |
| `site-worker.js` | the **marketing site** | uploaded, renamed `_worker.js` |
| `_redirects` | the **order page** | must **not** be uploaded |

`_redirects` rewrites `/order`, `/admin`, `/stock` and `/reseller` to files
this project does not contain, so uploading it breaks those paths on the live
domain. `build_deploy.py` makes both choices for you and asserts the order-page
files stayed out — which is the reason to use it rather than picking files by
hand in the dashboard.

Never upload this folder to the order-page project, or that project's folder
here.

---

## 1. Get the repo

```bash
git clone https://github.com/Epickirov/kmty-orchid-website
cd kmty-orchid-website
git checkout claude/githack-preview-link-9nykre
git pull
```

The work is on that branch, **not** on `main`. `main` is 55 commits behind and
is not what is live.

## 2. Build the upload folder

```bash
python build_deploy.py          # → dist/kmty-site
```

Expect roughly:

```
dist/kmty-site
  129 files, 19.2 MB
  74 images referenced and copied
  order-page files kept out: ok
```

The script uploads the page as `index.html`, repoints the og:image (absolute
by necessity, and aimed at githack on preview branches) to the live domain,
copies only the images the page actually references — the difference between
19 MB and the 94 MB `images/` tree — and treats a referenced-but-missing image
as a hard error rather than a blank space nobody notices until it is live.

## 3. Look at it before uploading

```bash
cd dist/kmty-site && python -m http.server 8321
# open http://127.0.0.1:8321/
```

Check, in the hero and the two sections this release touches:

- **#varieties** — every one of the 18 blooms has a code under its name
  (`TWL-114`, `TPL-411`, `TXL-349`, …). Before this release the live site had
  none.
- **#shipping** — four isometric carton drawings, one beside each row, plus
  the freight-facts line above the small print.
- the hero is the photograph and the headline, with **no globe** — that was
  built and then removed at the owner's request.
- no horizontal scrollbar at any width.

## 4. Upload

Either path publishes the same folder. Direct Upload is what has actually been
used in production.

**Dashboard (no token needed).** dash.cloudflare.com → Workers & Pages →
**kmty-site** → Create deployment → drag `dist/kmty-site` → deploy to
**Production**. Drag the *folder*, not the zip, and not the files inside it.

**Wrangler.** Needs a Cloudflare API token with **Pages: Edit** on the
`Kmtybio@gmail.com` account. Create it at My Profile → API Tokens, use it,
delete it afterwards — do not keep it in the repo, in a shell profile, or in
any agent container.

```bash
export CLOUDFLARE_API_TOKEN=...        # Pages: Edit
npx wrangler pages deploy dist/kmty-site --project-name=kmty-site --branch=main
```

`--branch=main` is what marks the deployment as Production. Without it the
upload becomes a preview and the live domain does not change.

## 5. Confirm it is live

```bash
curl -s https://www.kmtyorchid.com/ > /tmp/live.html
grep -c 'tabular-nums;">' /tmp/live.html      # 18  (variety codes)
grep -c 'viewBox="0 0 100 51"' /tmp/live.html # 4   (carton drawings)
grep -o 'i18n\.js?v=[0-9]*' /tmp/live.html    # i18n.js?v=31
grep -c 'data-globe' /tmp/live.html           # 0   (no globe)
```

Before this release those read `0`, `0`, `v=30`, `0`. If they still read the
old values, the CDN is serving cache — wait, then re-check with a cache-buster
(`curl -s 'https://www.kmtyorchid.com/?x=1'`). Also open the site in a browser
and switch through EN / 中文 / РУ / VI: the three new strings (`sh.wt`,
`sh.ctr`, `v.note`) exist in all four languages.

Do not touch DNS. The apex and MX records stay at 凡科 — the company's email
runs on those MX rows.

---

## What this release changes

Measured against what was live when it was written: the same nine sections,
zero images added or removed, three new i18n keys (`sh.wt`, `sh.ctr`,
`v.note`), and about 7 KB more markup — the carton drawings and the variety
codes. Nothing else, despite the branch being 55 commits ahead of `main`.
