// Media: uploads land on local disk under DATA_DIR/media/<tenantId>/.
// A dedicated server makes this the simple, right-sized answer (vs the
// presigned-URL contortions the serverless plan needed); swapping the two
// functions below for OSS put/get later is a contained change.
//
// Clients compress before upload (≤1600px JPEG) so files stay small; the
// server still enforces byte caps and validates magic bytes.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hexId } = require('./core');

const LIMITS = {
  photo: 3 * 1024 * 1024,      // 3 MB post-compression is already generous
  perTenantMb: 500,            // free-plan storage cap (entitlement lever)
};

const MAGIC = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: 'png', mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.length > 12 && b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
];
function sniff(buf) {
  for (const m of MAGIC) if (m.test(buf)) return m;
  return null;
}

function mediaRoot(dataDir) { return path.join(dataDir, 'media'); }

function saveBuffer(dataDir, tenantId, buf) {
  const kind = sniff(buf);
  if (!kind) return { error: 'unsupported image type (jpeg/png/webp)' };
  const dir = path.join(mediaRoot(dataDir), tenantId);
  fs.mkdirSync(dir, { recursive: true });
  const file = tenantId + '/' + hexId(9) + '.' + kind.ext;
  fs.writeFileSync(path.join(mediaRoot(dataDir), file), buf);
  return { file, bytes: buf.length, mime: kind.mime };
}

function removeFile(dataDir, file) {
  try { fs.unlinkSync(path.join(mediaRoot(dataDir), file)); } catch (e) {}
}

function tenantBytes(db, tenantId) {
  const r = db.prepare('SELECT COALESCE(SUM(bytes),0) AS b FROM media WHERE tenant_id = ?').get(tenantId);
  return (r && r.b) || 0;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
// GET /m/<tenantId>/<file> — immutable (filenames are random, replaced never edited)
function serve(dataDir, urlPath, res) {
  const rel = urlPath.replace(/^\/m\//, '');
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9]+\.(jpg|png|webp)$/.test(rel)) { res.writeHead(404); res.end(); return; }
  const abs = path.join(mediaRoot(dataDir), rel);
  fs.stat(abs, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      'content-type': MIME[rel.slice(rel.lastIndexOf('.') + 1)] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'public, max-age=2592000, immutable',
    });
    fs.createReadStream(abs).pipe(res);
  });
}

module.exports = { LIMITS, saveBuffer, removeFile, tenantBytes, serve };
