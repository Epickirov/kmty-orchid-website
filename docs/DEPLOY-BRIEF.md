# Deploy brief — kmty-site

For a **local** Claude Code session with the repo checked out on the operator's
own machine. Written by the cloud session that produced this work, which cannot
deploy: it holds no Cloudflare credentials, and `wrangler login` cannot complete
there because the OAuth callback lands on the container's localhost rather than
the operator's browser. Locally that callback works, so **no API token needs to
exist at all** — see step 3.

Nothing here requires reading the whole repo. The deep background, if you want
it, is `docs/DEPLOY-WWW.md`; this brief is self-contained.

---

## 0. What is being shipped

Branch **`claude/githack-preview-link-9nykre`**, at its head. Deliberately not
pinned to a commit hash here — the branch has gained commits more than once
since this file was written, and a stale hash is worse than none. Step 1
verifies by content instead, which is what actually matters.

What the branch adds over what is live:

| area | what |
|---|---|
| Buyer calendar | Flower colour read off the code's second letter; KMTY mark in the header; C and X bars drawn as polka dots / rainbow diagonals |
| Staff page | **Excel import with column mapping**, and a **variety library** (品种库 tab) |
| Marketing page | **Constellation and cut-flower carton specs** in the shipping table — two new rows with drawings, counts and dimensions, in all four languages |

Two of those bring new files or new storage: `xlsx-lite.js` (the in-browser
.xlsx reader, added to `build_deploy.py`'s manifest) and the KV keys
`var:<CODE>`, `varimg:<CODE>`, `varimg2:<CODE>`.

Tests on the branch head: 334 assertions across 21 suites, 0 failures. They
run against a local `wrangler pages dev`, never against production, so there
is nothing to re-run here.

## 1. Get the code

```bash
git fetch origin claude/githack-preview-link-9nykre
git checkout claude/githack-preview-link-9nykre
git pull --ff-only
```

Verify by content, not by hash — all four must pass:

```bash
test -f xlsx-lite.js && echo "xlsx reader: ok"
grep -c "'sh.r5.d1'" i18n.js          # 4  (carton specs, one per language)
grep -o 'i18n\.js?v=[0-9]*' "KMTY Orchid v5.dc.html"   # i18n.js?v=33
grep -c '品种库' inventory-admin.html  # >= 1  (variety library tab)
grep -c "'sh.spb'" i18n.js            # 4  (stems / box, the cut-flower unit)
```

If any of those disagree, stop and say so rather than deploying — it means the
checkout is not the branch this brief describes.

## 2. Build the upload folder

```bash
python build_deploy.py
```

Expected tail:

```
  134 files, 19.5 MB
  74 images referenced and copied
  order-page files kept out: ok
```

Then confirm the new file actually made it in — this is the single most likely
way for this particular release to go wrong:

```bash
ls -l dist/kmty-site/xlsx-lite.js       # must exist, ~13 KB
grep -c 'xlsx-lite' dist/kmty-site/inventory-admin.html   # 1
```

**`order-page files kept out: ok` must appear.** The marketing site and the
Constellation order page live in one repo and their `_worker.js` and
`_redirects` are named identically. Publishing the order page's routing over
the marketing site is the worst outcome available here, and that line is the
check against it.

---

## 3. Authenticate

Prefer OAuth — it leaves no long-lived secret anywhere:

```bash
npx wrangler login
```

This opens a browser. Sign in as the **`Kmtybio@gmail.com`** account. If the
machine has several Cloudflare logins, check you landed on the right one:

```bash
npx wrangler whoami
```

If OAuth is not usable, fall back to a token: My Profile → API Tokens → Create
Custom Token → permission **Account · Cloudflare Pages · Edit** only, account
resource **Kmtybio@gmail.com**, expiry set to today.

```bash
export CLOUDFLARE_API_TOKEN=...        # this shell only
```

Do not write it to a file, a shell profile, `.env`, or the repo. **Delete it in
the dashboard as soon as step 5 passes**, whatever the outcome.

---

## 4. Deploy

```bash
npx wrangler pages deploy dist/kmty-site --project-name=kmty-site --branch=main
```

`--branch=main` is what marks it Production. Without it the upload becomes a
preview and `www.kmtyorchid.com` does not change — the command still reports
success, so this is easy to get wrong and not notice.

`--project-name=kmty-site`. Never `constellation`.

---

## 5. Confirm it is live

```bash
curl -s 'https://www.kmtyorchid.com/?x=1' > /tmp/live.html
grep -c 'tabular-nums;">' /tmp/live.html      # 18
grep -o 'i18n\.js?v=[0-9]*' /tmp/live.html    # i18n.js?v=33
curl -s -o /dev/null -w '%{http_code}\n' https://www.kmtyorchid.com/inventory   # 200
curl -s -o /dev/null -w '%{http_code}\n' https://www.kmtyorchid.com/xlsx-lite.js # 200
grep -c 'sh.r5.d1' /tmp/live.html             # 1   (Constellation carton row)
grep -c 'sh.r6.d1' /tmp/live.html             # 1   (cut-flower carton row)
curl -s https://www.kmtyorchid.com/api/inv/items                                 # {"error":"locked"}
```

The `xlsx-lite.js` line proves the Excel import will work; a 404 there means
step 2's manifest check was skipped. The two `sh.r` lines prove the new carton
rows shipped. `i18n.js?v=33` proves the translations are not being served from
cache — if it still reads `v=32`, the marketing page is stale and the carton
rows will show in English for every language.

`{"error":"locked"}` from `/api/inv/items` is correct — it means the buyer gate
is doing its job, not that something is broken.

The `?x=1` is a cache-buster. If the figures read as they did before the
release, that is the CDN, not a failed deploy: wait, then re-check.

---

## 6. Then hand back to the operator

Two things this deploy cannot do, both needing the Cloudflare dashboard:

1. **`ADMIN_PASS` must exist** under kmty-site → Settings → Variables and
   Secrets. A Pages: Edit token cannot read or write secrets, so it cannot be
   checked from the CLI. Without it nobody can log into `/inventory-admin` —
   including to do (2).
2. **The buyer access code** is set at `/inventory-admin → 访问码`. Until it is
   set, `/inventory` tells buyers the calendar is not open yet.

Then a two-minute smoke test of what this release actually adds, which no
automated check covers because it needs a real spreadsheet:

- `/inventory-admin` → the **品种库** tab exists, and its badge counts codes
  that are in use but have no variety yet.
- Create one variety with both photos. Every batch of that code should pick up
  its name and photograph without being edited.
- The marketing page's **Shipping spec** section now has six rows, ending in
  **星空 / Constellation** (3.5″, 20 a carton) and **切花 / Cut Flower** (10–12
  stems a box). Switch language and check both read correctly in 中文 / РУ / VI
  — if they show in English, the i18n marker is being served from cache.
- **批量导入** → upload a real availability sheet. The columns should be listed
  with sample values and a dropdown each; Chinese headers should map themselves.
  Fix any that guessed wrong, check the preview, import.
- Upload the same sheet again: it should come back already mapped.

---

## Hard constraints

- **Never touch DNS.** The apex and MX records stay at 凡科 — the company's
  email runs on those MX rows. Deploying Pages does not require any DNS change.
- **Never upload this folder to the `constellation` project**, or the
  Constellation folder to `kmty-site`.
- **Do not merge this branch to `main`** without first reverting `netlify.toml`
  (`publish = "netlify-demo"` → `"."`). Deploying does not require the merge.
- Secrets are never committed. The Resend key and `ADMIN_PASS` live only in the
  Cloudflare project.

## If it goes wrong

Pages keeps every deployment. Roll back in the dashboard: kmty-site →
Deployments → the previous Production entry → Rollback. That is faster and
safer than trying to fix forward, and it is why deploying a tested commit
unchanged matters more than deploying quickly.

Report back: the deployment URL wrangler prints, the six check results from
step 5, and whether `ADMIN_PASS` was already present.
