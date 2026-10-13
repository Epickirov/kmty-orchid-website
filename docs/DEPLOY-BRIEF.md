# Deploy brief — kmty-site

For a **local** Claude Code session on the operator's own machine. The cloud
session that wrote this has no Cloudflare credentials, and `wrangler login`
cannot complete there (its OAuth callback lands on the container's localhost,
not the operator's browser). Locally it works, so **no API token needs to exist
at all**.

---

## ⚠ Read this first: do not deploy this branch as it stands

The live site is **ahead of this repository.** It serves `i18n.js?v=38`; this
branch had `v=33` until it was synced. Live has a Japanese translation, an
Availability button, per-language nav tuning, hand edits to content, and
inventory pages three to four times the size of the ones in this repo. That
work was deployed from a local checkout and **was never pushed to GitHub**.

`python build_deploy.py` on this branch therefore builds a folder that is
*behind* live, and `wrangler pages deploy` will publish it without a word.
The inventory pages alone would shrink by about 250 KB, 132 KB and 133 KB.
That is a rollback of someone's production work, and it reports success.

What this branch **does** carry that matches live: the marketing page, its
translations and fonts (commit "Sync the marketing page…", a build from which
reproduces live byte for byte). What it does **not**: the inventory pages, the
Worker, images, `_headers`.

### So: deploy from the checkout that produced the live site

Not from a fresh clone of this branch. Concretely:

1. **Find your tree.** In your own checkout:
   ```bash
   grep -o 'i18n\.js?v=[0-9]*' "KMTY Orchid v5.dc.html"
   curl -s 'https://www.kmtyorchid.com/?x=1' | grep -o 'i18n\.js?v=[0-9]*'
   ```
   They must match. If your tree's number is **lower** than live's, your tree is
   behind too — stop and say so; do not deploy.

2. **Bring in this release as commits, not as a checkout.** The release is the
   commit(s) after "Sync the marketing page…" on branch
   `claude/githack-preview-link-9nykre`. In your tree:
   ```bash
   git fetch origin claude/githack-preview-link-9nykre
   git log --oneline origin/claude/githack-preview-link-9nykre | head   # find the commit(s) after "Sync the marketing page…"
   git cherry-pick <those commits>        # NOT the sync commit: your tree already has that content
   git checkout origin/claude/githack-preview-link-9nykre -- tools/check_live_diff.py
   ```
   A conflict in `KMTY Orchid v5.dc.html` or `i18n.js` means your tree differs
   from live in the nav area. Resolve it by hand and say so; do not force it.

3. **Build, then let the guard decide.**
   ```bash
   python build_deploy.py
   python tools/check_live_diff.py dist/kmty-site --expect index.html,i18n.js
   ```
   It exits 0 only if the upload changes **exactly** those two files and nothing
   else. Anything else it flags means the tree you built from is not the tree
   that produced live. **Do not deploy.** Report what it flagged.

   (It cannot see the Worker, which is never served as a file. That is another
   reason to build from the checkout that produced live: it is the only tree
   known to have the Worker that live is running.)

   Also confirm:
   - `build_deploy.py` printed **`order-page files kept out: ok`**. That line is
     the check against publishing the Constellation order page's routing over the
     marketing site — the worst outcome available. No line, no deploy.
   - `ls dist/kmty-site/xlsx-lite.js` exists (the staff page's Excel reader).

---

## What this release is

**Desktop navigation** (computer browsers only; the phone layout is unchanged):

- Top-bar links — Story / Grow / Products / Ship — larger, bolder, higher contrast.
- **Contact us** added to the top bar and to the side navigation.
- Side navigation: larger text, readable on both light and dark sections, and
  labels in all five languages through the same path as every other string.
- Fix: the side navigation's highlight never lit **How we grow** (the section is
  3.5 screens tall and the observer wanted 40% of it visible) and ran a section
  behind elsewhere. It now follows where you are reading.

It touches exactly two files: `KMTY Orchid v5.dc.html` and `i18n.js`, and bumps
the marker to **`i18n.js?v=39`**.

---

## Authenticate

Prefer OAuth — it leaves no long-lived secret anywhere:

```bash
npx wrangler login      # sign in as Kmtybio@gmail.com
npx wrangler whoami     # confirm you landed on the right account
```

If OAuth is unusable, a token: My Profile → API Tokens → Custom Token →
**Account · Cloudflare Pages · Edit** only, account **Kmtybio@gmail.com**,
expiry today. `export CLOUDFLARE_API_TOKEN=...` in that shell only; never in a
file, profile, `.env` or the repo; delete it in the dashboard as soon as the
checks below pass, whatever the outcome.

## Deploy

```bash
npx wrangler pages deploy dist/kmty-site --project-name=kmty-site --branch=main
```

`--branch=main` is what makes it Production. Without it the upload is a preview,
wrangler still reports success, and `www.kmtyorchid.com` does not change.
`--project-name=kmty-site` — **never** `constellation`.

## Confirm it is live

```bash
curl -s 'https://www.kmtyorchid.com/?x=1' > /tmp/live.html
grep -o 'i18n\.js?v=[0-9]*' /tmp/live.html                       # i18n.js?v=39
grep -c 'data-navcontact' /tmp/live.html                         # >= 1  (Contact us in the top bar)
grep -c 'data-lang="ja"' /tmp/live.html                          # 1     (Japanese survived)
grep -c 'data-navinv' /tmp/live.html                             # >= 1  (Availability survived)
curl -s -o /dev/null -w '%{http_code}\n' https://www.kmtyorchid.com/inventory   # 200
curl -s https://www.kmtyorchid.com/api/inv/items                                # {"error":"locked"}
python tools/check_live_diff.py dist/kmty-site                   # exit 0: live now equals what you built
```

The last line is the real check: after a deploy, the build and the live site
must be identical, and the guard says so.

If the marker still reads `v=38`, the CDN is serving cache. Wait, and re-check
with a cache-buster. Then open the site on a desktop browser and switch through
**EN / 中文 / РУ / VI / 日本語** while scrolling: the side navigation's label
should change language and should light for *every* section, including
**How we grow**.

## Then hand back

1. **`ADMIN_PASS`** must exist under kmty-site → Settings → Variables and
   Secrets. A Pages token cannot read secrets, so this cannot be checked from
   the CLI. Report whether it was already set.
2. The buyer access code is set at `/inventory-admin → 访问码`.

## Hard constraints

- **Never touch DNS.** The apex and MX records stay at 凡科; the company's email
  runs on those MX rows.
- **Never upload this folder to `constellation`**, or that folder to `kmty-site`.
- **Do not merge this branch to `main`** without first reverting `netlify.toml`
  (`publish = "netlify-demo"` → `"."`). Deploying does not require the merge.
- Secrets are never committed.
- **Push your own checkout to GitHub.** The reason this brief opens the way it
  does is that a deploy was made from a tree nobody else could see. Whatever
  you deploy from, push it, so the next person starts from what is live.

## If it goes wrong

Pages keeps every deployment. Dashboard → kmty-site → Deployments → the
previous Production entry → Rollback. Faster and safer than fixing forward.

Report back: the deployment URL wrangler prints, the guard's output (both runs),
the live checks, and whether `ADMIN_PASS` was already set.
