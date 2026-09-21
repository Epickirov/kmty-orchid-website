/* ============================================================================
   xlsx-lite — read an .xlsx workbook in the browser, with no dependency.

   Staff keep their availability in Excel and always will. The alternative to
   reading it here is asking them to re-key it, or to save-as-CSV and lose the
   sheet they actually work in; both are how an inventory page stops being used
   after a fortnight.

   SheetJS would do this in one line and cost ~800KB. It is not worth it: an
   .xlsx is a ZIP of XML, the browser has had raw-deflate since 2023 in
   `DecompressionStream`, and it can parse XML itself. What is left is the ZIP
   directory, the shared-string table and the cell grid — the three hundred
   lines below. Nothing is fetched at runtime, which this site requires: it
   has to work behind the Great Firewall with no external call at all.

   Reads, never writes. Returns every sheet as a dense grid of strings, which
   is what a column mapper wants — the caller decides what a column means, so
   this layer must not guess.

   window.XLSXLite.read(arrayBuffer) -> Promise<{sheets:[{name, rows}]}>
   window.XLSXLite.supported()       -> boolean
============================================================================ */
(function () {
  'use strict';

  var DEC = new TextDecoder('utf-8');

  function supported() {
    return typeof DecompressionStream !== 'undefined' &&
           typeof DOMParser !== 'undefined';
  }

  /* ---------------- ZIP ----------------
     Only what an .xlsx uses: no encryption, no multi-disk, no ZIP64. A file
     big enough to need ZIP64 is a sheet nobody is hand-maintaining, and
     guessing at it would be worse than saying so. */

  function u16(d, o) { return d.getUint16(o, true); }
  function u32(d, o) { return d.getUint32(o, true); }

  function findEocd(d) {
    /* The end-of-central-directory record is last, but a trailing comment can
       push it up to 64KB from the end, so scan back rather than assume. */
    var max = Math.min(d.byteLength, 65557);
    for (var i = d.byteLength - 22; i >= d.byteLength - max; i--) {
      if (i >= 0 && u32(d, i) === 0x06054b50) return i;
    }
    return -1;
  }

  function directory(buf) {
    var d = new DataView(buf);
    var eocd = findEocd(d);
    if (eocd < 0) throw new Error('not-zip');
    var count = u16(d, eocd + 10);
    var start = u32(d, eocd + 16);
    if (start === 0xffffffff || count === 0xffff) throw new Error('zip64');

    var out = {}, p = start;
    for (var i = 0; i < count; i++) {
      if (u32(d, p) !== 0x02014b50) throw new Error('bad-directory');
      var method = u16(d, p + 10);
      var csize = u32(d, p + 20);
      var nameLen = u16(d, p + 28), extraLen = u16(d, p + 30), cmtLen = u16(d, p + 32);
      var local = u32(d, p + 42);
      var name = DEC.decode(new Uint8Array(buf, p + 46, nameLen));
      out[name] = { method: method, csize: csize, local: local };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return out;
  }

  function entryBytes(buf, e) {
    var d = new DataView(buf);
    if (u32(d, e.local) !== 0x04034b50) throw new Error('bad-entry');
    /* The local header repeats the name and extra-field lengths, and they can
       differ from the central directory's — the data starts after the local
       copy, so these are the ones to trust. */
    var nameLen = u16(d, e.local + 26), extraLen = u16(d, e.local + 28);
    var at = e.local + 30 + nameLen + extraLen;
    return new Uint8Array(buf, at, e.csize);
  }

  function inflate(bytes, method) {
    if (method === 0) return Promise.resolve(bytes);          // stored
    if (method !== 8) return Promise.reject(new Error('zip-method-' + method));
    var s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function readText(buf, dir, name) {
    var e = dir[name];
    if (!e) return Promise.resolve('');
    return inflate(entryBytes(buf, e), e.method).then(function (b) { return DEC.decode(b); });
  }

  /* ---------------- cells ---------------- */

  function colIndex(ref) {
    // "BC7" -> 54. Letters only; the row number is not our business here.
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  /* Excel keeps a date as a day count from 1899-12-31, with a deliberate bug:
     it believes 1900 was a leap year, so everything from 1900-03-01 on is one
     too high. Serial 60 is that phantom 29 February. Growers do put dates in
     these sheets — a start week is often typed as the Monday — so a date is
     handed back as YYYY-MM-DD and the caller can read a week out of it. */
  function serialToDate(n) {
    if (!(n > 0) || n > 2958466) return null;                 // outside 1900..9999
    var days = Math.floor(n);
    if (days === 60) return '1900-02-29';                     // the date that never was
    if (days > 60) days -= 1;
    var ms = Date.UTC(1899, 11, 31) + days * 86400000;
    var d = new Date(ms);
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }

  /* A cell is a date only because its number format says so. Excel's built-in
     formats 14-22 and 45-47 are dates and times; a custom format is a date if
     it uses the date tokens outside a quoted run. */
  function dateFormats(stylesXml) {
    var isDate = {};
    if (!stylesXml) return isDate;
    var doc = new DOMParser().parseFromString(stylesXml, 'application/xml');
    var custom = {};
    var fmts = doc.getElementsByTagName('numFmt');
    for (var i = 0; i < fmts.length; i++) {
      var id = +fmts[i].getAttribute('numFmtId');
      var code = fmts[i].getAttribute('formatCode') || '';
      var bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
      custom[id] = /[dmyhs]/i.test(bare) && !/^[^dmy]*$/i.test(bare);
    }
    function builtinIsDate(id) {
      return (id >= 14 && id <= 22) || (id >= 45 && id <= 47);
    }
    /* cellXfs is the style table a cell's `s` attribute indexes into. */
    var xfs = doc.getElementsByTagName('cellXfs')[0];
    if (!xfs) return isDate;
    var list = xfs.getElementsByTagName('xf');
    for (var j = 0; j < list.length; j++) {
      var nid = +(list[j].getAttribute('numFmtId') || 0);
      isDate[j] = builtinIsDate(nid) || !!custom[nid];
    }
    return isDate;
  }

  function sharedStrings(xml) {
    var out = [];
    if (!xml) return out;
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var si = doc.getElementsByTagName('si');
    for (var i = 0; i < si.length; i++) {
      /* A string can be split across runs when part of it is styled, so join
         every <t> under this <si> rather than taking the first. */
      var ts = si[i].getElementsByTagName('t'), s = '';
      for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
      out.push(s);
    }
    return out;
  }

  function cellRef(ref) {
    var m = /^([A-Z]+)(\d+)$/.exec(String(ref || '').toUpperCase());
    return m ? { c: colIndex(m[1]), r: +m[2] - 1 } : null;
  }

  /* Merged cells. In xlsx only the TOP-LEFT cell of a merge holds the value;
     every other cell in the range is simply absent. A grower merges the code
     down the weeks it covers all the time, so without this the grid comes back
     full of holes and every row but the first fails validation for a value the
     operator can plainly see on screen.

     A real value is never overwritten. A malformed file can declare a merge
     across cells that do have values, and the values are the truth. */
  function applyMerges(doc, grid) {
    var els = doc.getElementsByTagName('mergeCell');
    for (var i = 0; i < els.length; i++) {
      var ref = els[i].getAttribute('ref') || '';
      var parts = ref.split(':');
      if (parts.length !== 2) continue;
      var a = cellRef(parts[0]), b = cellRef(parts[1]);
      if (!a || !b) continue;
      var r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
      var c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
      var src = (grid[r0] && grid[r0][c0]) || '';
      if (src === '') continue;
      for (var r = r0; r <= r1; r++) {
        if (!grid[r]) continue;
        for (var c = c0; c <= c1; c++) {
          if (c < grid[r].length && grid[r][c] === '') grid[r][c] = src;
        }
      }
    }
  }

  function sheetRows(xml, shared, isDate) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var rowEls = doc.getElementsByTagName('row');
    var rows = [], width = 0;
    for (var i = 0; i < rowEls.length; i++) {
      /* Rows and columns are both sparse — an empty row is simply absent, and
         so is an empty cell. Place by the r= reference, never by order, or a
         sheet with a gap in it silently shifts every column after the gap. */
      var rIdx = +(rowEls[i].getAttribute('r') || (i + 1)) - 1;
      var cells = rowEls[i].getElementsByTagName('c');
      var row = [];
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        var ref = c.getAttribute('r') || '';
        var col = ref ? colIndex(ref) : j;
        if (col < 0) col = j;
        var t = c.getAttribute('t') || 'n';
        var v = '';
        if (t === 'inlineStr') {
          var is = c.getElementsByTagName('t'), s = '';
          for (var k = 0; k < is.length; k++) s += is[k].textContent;
          v = s;
        } else {
          var vEl = c.getElementsByTagName('v')[0];
          var raw = vEl ? vEl.textContent : '';
          if (t === 's') v = shared[+raw] == null ? '' : shared[+raw];
          else if (t === 'b') v = raw === '1' ? 'TRUE' : 'FALSE';
          else if (t === 'e') v = '';                          // #N/A and friends: empty
          else {
            var sIdx = c.getAttribute('s');
            if (raw !== '' && sIdx != null && isDate[+sIdx]) {
              v = serialToDate(+raw) || raw;
            } else v = raw;
          }
        }
        row[col] = v;
        if (col + 1 > width) width = col + 1;
      }
      rows[rIdx] = row;
    }
    // densify: every row the same width, every hole an empty string
    var out = [];
    for (var r = 0; r < rows.length; r++) {
      var src = rows[r] || [], dst = [];
      for (var cc = 0; cc < width; cc++) dst.push(src[cc] == null ? '' : String(src[cc]).trim());
      out.push(dst);
    }
    // merges fill holes, so they have to run before trailing rows are judged empty
    applyMerges(doc, out);
    while (out.length && out[out.length - 1].every(function (x) { return x === ''; })) out.pop();
    return out;
  }

  /* ---------------- workbook ---------------- */

  function read(buf) {
    return Promise.resolve().then(function () {
      if (!supported()) throw new Error('unsupported');
      var dir = directory(buf);
      if (!dir['xl/workbook.xml']) throw new Error('not-xlsx');
      return Promise.all([
        readText(buf, dir, 'xl/workbook.xml'),
        readText(buf, dir, 'xl/_rels/workbook.xml.rels'),
        readText(buf, dir, 'xl/sharedStrings.xml'),
        readText(buf, dir, 'xl/styles.xml'),
      ]).then(function (parts) {
        var wb = new DOMParser().parseFromString(parts[0], 'application/xml');
        var relsDoc = new DOMParser().parseFromString(parts[1], 'application/xml');
        var shared = sharedStrings(parts[2]);
        var isDate = dateFormats(parts[3]);

        var rels = {};
        var rEls = relsDoc.getElementsByTagName('Relationship');
        for (var i = 0; i < rEls.length; i++) {
          var target = rEls[i].getAttribute('Target') || '';
          // targets are relative to xl/, and may be written with a leading /
          rels[rEls[i].getAttribute('Id')] = target.charAt(0) === '/'
            ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
        }

        var sheetEls = wb.getElementsByTagName('sheet');
        var jobs = [], names = [];
        for (var j = 0; j < sheetEls.length; j++) {
          var name = sheetEls[j].getAttribute('name') || ('Sheet' + (j + 1));
          /* The r:id attribute is namespaced; getAttribute with the prefix
             works in every browser's XML parser and avoids having to know the
             namespace URI, which older writers get wrong anyway. */
          var rid = sheetEls[j].getAttribute('r:id') ||
                    sheetEls[j].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
          var path = rels[rid] || ('xl/worksheets/sheet' + (j + 1) + '.xml');
          if (!dir[path]) continue;
          names.push(name);
          jobs.push(readText(buf, dir, path));
        }
        if (!jobs.length) throw new Error('no-sheets');
        return Promise.all(jobs).then(function (xmls) {
          return {
            sheets: xmls.map(function (xml, k) {
              return { name: names[k], rows: sheetRows(xml, shared, isDate) };
            }),
          };
        });
      });
    });
  }

  /* `sheetFromXml` is the pure half and it is where every parsing bug lives —
     shared strings, merges, sparse refs. Exposed so it can be tested against
     XML string literals with no ZIP, no file and no fixture on disk. */
  function sheetFromXml(sheetXml, sharedXml, stylesXml) {
    return sheetRows(sheetXml, sharedStrings(sharedXml || ''), dateFormats(stylesXml || ''));
  }

  window.XLSXLite = {
    read: read, supported: supported,
    sheetFromXml: sheetFromXml, serialToDate: serialToDate,
  };
})();
