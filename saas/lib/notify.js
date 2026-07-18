// Outbound notifications. WeCom (企业微信) group-robot webhooks are the one
// channel that needs no beian, no signup, no fees: a seller creates a robot in
// their own WeCom group, pastes the webhook URL into 设置, and new inquiries
// ping the group instantly. Strict URL allowlist (SSRF guard) — only the real
// WeCom endpoint is ever fetched. Fire-and-forget: a dead webhook must never
// slow down or fail an order.
'use strict';

const WECOM_PREFIX = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send';

function validWecomHook(url) {
  return typeof url === 'string' && url.startsWith(WECOM_PREFIX) && url.length < 300 && !/\s/.test(url);
}

function postWeCom(url, text) {
  if (!validWecomHook(url)) return;
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: String(text).slice(0, 1800) } }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});   // notifications are best-effort by design
}

// Hook point for Aliyun 内容安全 (Green) post-publish image scanning.
// Wire at deploy: call the Green image-moderation API with the file, then
// UPDATE media SET scan='clean'|'flagged'. Until credentials exist this is a
// no-op and every row stays scan='none'. Flagged rows surface in /admin 动态.
function scanImageHook(/* dataDir, db, mediaRow, env */) {}

module.exports = { validWecomHook, postWeCom, scanImageHook, WECOM_PREFIX };
