# Claude Code — project notes

Single-page marketing site: `KMTY Orchid v5.dc.html` + `i18n.js` (4 languages:
en/zh/ru/vi) + `support.js` runtime. Fully self-contained (no external calls at
runtime — mainland-China constraint). Live preview and deploy notes: README.
After editing `i18n.js`, bump the `i18n.js?v=N` cache marker in the HTML.

## Visual verification hygiene (important)

Screenshot reads accumulate in the conversation as base64 and are re-sent with
every subsequent request; a session that reads many full-size screenshots will
eventually hit the API's 32MB request cap ("Request too large"). Rules:

- Never read full-resolution screenshots. Downscale to ≤700px and save as JPEG
  (quality ~75, target <120KB) before any image read.
- Combine related views into ONE contact sheet and read that, instead of
  reading tiles one by one.
- Prefer numeric verification (pixel sampling, geometry probes, diff
  percentages via Playwright evaluate / PIL) over visual reads when a property
  can be measured.
- For broad visual sweeps (full-page walkthroughs), delegate to a subagent and
  have it return text conclusions only — keep media out of the main thread.
- Long visual-iteration work: prefer a fresh session; this repo's README and
  commit history carry the context needed to resume quickly.
