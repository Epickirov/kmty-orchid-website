# Cutover checklist — order.kmtyorchid.com → Aliyun ECS

Two phases: **prep now** (while the ICP is under review, ~10 working days) and
**verdict day**. Everything in prep is safe to do today; nothing goes live for
buyers until the DNS step.

## Prep now (before the ICP verdict)

1. **Buy the ECS** (Aliyun console → ECS): 2 vCPU / 2–4 GB, Ubuntu 22.04,
   region **Kunming/Chengdu/Shenzhen** (any mainland region; pick close to
   sellers), assign a public IP. Open security-group ports **80, 443, 22**.
2. **Sync the app** from the repo branch to the server:
   ```bash
   rsync -av --exclude saas/data --exclude images/_src \
     ./ root@<ECS-IP>:/opt/kmty/
   ```
   (Minimum set: `saas/`, `constellation.html`, `stock.html`, plus the image/
   font/vendor assets the constellation page references.)
3. **Run part 1** on the server: `bash /opt/kmty/saas/deploy/bootstrap.sh part1`
   — installs Node (npmmirror), the systemd service, nginx (HTTP), acme.sh
   (gitee). Sets the platform ADMIN_PASS.
4. **Seed + smoke-test via IP** (no domain needed):
   ```bash
   cd /opt/kmty/saas && DATA_DIR=data /opt/node22/bin/node seed.js
   ```
   Then from any browser: `http://<ECS-IP>/seller` (create a test shop,
   product, photo, order), `http://<ECS-IP>/admin`, `http://<ECS-IP>/`
   (constellation page). Delete test rows after, or wipe `data/` and re-seed.
5. **While waiting** (both are console tasks, no beian required):
   - Activate **内容安全 (Content Moderation)** in the Aliyun console so the
     image-scan hook can be wired at deploy (`saas/lib/notify.js` →
     `scanImageHook`).
   - Prepare **DirectMail**: create the sending domain `mail.kmtyorchid.com`,
     add its TXT/CNAME records at 凡科 (**additive records only — never touch
     the `@` MX rows, company email lives on them**). Verification can complete
     before the ICP does.
   - ⚠ If the filing gets **rejected** citing 网站已开通访问 (some provincial
     reviewers require the domain to be unreachable during a first filing),
     temporarily park www/order and resubmit — then this checklist resumes
     unchanged. Also: answer calls from Aliyun/管局 — they phone to verify.

## Verdict day (ICP passed)

6. **Export Cloudflare KV** (needs a Cloudflare API token — create a fresh
   one, scope: KV read). On any machine:
   ```bash
   npx wrangler kv key list --namespace-id=<KMTY_CONFIG id> > keys.json
   # dump every key's value into the {entries:[{key,value}]} shape:
   node -e '
     const {execSync}=require("child_process");const keys=require("./keys.json");
     const entries=keys.map(k=>({key:k.name,value:execSync(
       `npx wrangler kv key get --namespace-id=<id> ${JSON.stringify(k.name)}`
     ).toString()}));
     require("fs").writeFileSync("dump.json",JSON.stringify({entries}));'
   ```
7. **Import on the ECS**:
   ```bash
   cd /opt/kmty/saas
   DATA_DIR=data /opt/node22/bin/node migrate.js dump.json --dry   # review counts
   DATA_DIR=data /opt/node22/bin/node migrate.js dump.json
   systemctl restart kmty
   ```
   Existing resellers keep their `/r/<id>` links and current passwords.
8. **DNS** at 凡科 (the only record touched — **do not modify the `@` MX
   records**): change `order` from the CNAME to `<pages-project>.pages.dev`
   to an **A record → <ECS-IP>** (TTL as low as offered). Cloudflare stays
   deployed — rollback = revert this one record.
9. **TLS**: once `order.kmtyorchid.com` resolves to the ECS:
   `bash /opt/kmty/saas/deploy/bootstrap.sh part2`
10. **Set the ICP number in the storefront footer** (command printed by
    part2) and put the 备案号 on the marketing site footer too.
11. **Verify**: `https://order.kmtyorchid.com/` (constellation), `/r/<an old
    reseller id>` (branding intact), `/seller` login with an imported
    reseller's old password, `/admin`, a test inquiry end-to-end, WeCom ping.
12. **Within 30 days**: file 公安备案 (beian.gov.cn) for the domain.

## After a quiet week

- Decommission the Cloudflare **order** Pages project (keep `kmty-site`
  until www also moves), then **delete the Cloudflare API token**.
- Revoke the old Netease SMTP 授权码 (unused since the Resend switch; fully
  dead once DirectMail handles lead mail).
- Switch the marketing site's `/api/lead` sender to DirectMail when www moves.

## Rollback (any point after step 8)

Revert the `order` record at 凡科 to `<pages-project>.pages.dev`. The
Cloudflare deployment is untouched and resumes serving as before; KV was only
ever read, never written, by this migration.
