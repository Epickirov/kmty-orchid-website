/* Whole-plant preview: the mix the visitor designed, on a whole plant, in a
   room — one plant in one pot, shot from one angle, the way the catalogue
   shoots it. Six scenes, six pots, six angles, six rooms.

   Everything here is canvas 2D — no SVG, by requirement.

   How the recolour works. Each scene ships as the photograph plus a mask of
   just its petals (build-scenes.py). At paint time we:
     1. draw the photograph whole — pot, leaves, room, lighting all untouched,
     2. take a copy of it and lay the visitor's swirl over that copy in 'color'
        blend mode, which replaces hue and saturation but keeps the
        photograph's luminance,
     3. clip the copy to the petal mask,
     4. drop it back over the photograph.
   Because luminance survives, the petals keep their real shading, veining and
   cast shadows — the flowers sit in the room's light rather than glowing like
   stickers. There is no cut-out and no re-compositing: the plant never leaves
   the photograph it was shot in.

   The engine's canvas is bloom-shaped with transparent corners, so it cannot be
   used directly as a colour field — it would punch holes in the petals. We
   mirror-tile it over a gradient of the chosen colours, which fills every pixel
   and keeps the marbling organic.

   Scenes load one at a time. A visitor who never opens the preview pays
   nothing; one who opens it pays for the scene they are looking at. */
'use strict';

function KMTYPlant(canvas, opts) {
  opts = opts || {};
  var base = opts.base || '/scenes/';
  var ctx = canvas.getContext('2d');

  /* Order matters: the first is what a visitor sees, so it is the cleanest
     composition. Labels name the room; the pot and the angle are visible. */
  var SCENES = opts.scenes || [
    { id: 'minimal', zh: '极简厅', en: 'grey cylinder pot' },
    { id: 'zen', zh: '禅意台', en: 'grey tapered pot' },
    { id: 'artisan', zh: '绿意居', en: 'grey pot, green room' },
    { id: 'window', zh: '窗边台', en: 'stone pot, window marble' },
    { id: 'terracotta', zh: '暖阳窗', en: 'terracotta pot' },
    { id: 'bright', zh: '明亮厅', en: 'white pot' }
  ];

  var loaded = {};          // id -> {photo, petals} once both images are in
  var inflight = {};        // id -> true while fetching
  var dead = {};            // id -> true if its files 404
  var idx = 0;
  var waiting = [];

  function fetchScene(id, cb) {
    if (loaded[id]) { cb(loaded[id]); return; }
    if (dead[id]) { cb(null); return; }
    waiting.push({ id: id, cb: cb });
    if (inflight[id]) return;
    inflight[id] = true;
    var got = {}, left = 2, bad = false;
    var done = function () {
      if (--left) return;
      inflight[id] = false;
      if (bad) dead[id] = true; else loaded[id] = got;
      var pending = waiting, keep = [];
      waiting = [];
      pending.forEach(function (w) {
        if (w.id === id) w.cb(loaded[id] || null); else keep.push(w);
      });
      waiting = keep.concat(waiting);
    };
    [['photo', id + '.webp'], ['petals', id + '-petals.webp']].forEach(function (p) {
      var im = new Image();
      im.onload = function () {
        got[p[0]] = im;
        if (p[0] === 'petals') got.box = maskBox(im);
        done();
      };
      im.onerror = function () { bad = true; done(); };
      im.src = base + p[1];
    });
  }

  /* Where in the frame the petals actually are, as fractions. A spike occupies
     maybe a third of the picture, so recolouring only its bounding box instead
     of the whole 880x1100 frame is the difference between holding 60fps during
     the re-swirl dissolve and not. Measured once per scene, off a thumbnail. */
  var probe = document.createElement('canvas');
  function maskBox(im) {
    var W = 110, H = Math.max(1, Math.round(W * im.height / im.width));
    probe.width = W; probe.height = H;
    var g = probe.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.drawImage(im, 0, 0, W, H);
    var d;
    try { d = g.getImageData(0, 0, W, H).data; } catch (e) { return [0, 0, 1, 1]; }
    var x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < x0) return [0, 0, 1, 1];
    var m = 2;   // a couple of probe pixels of slack for the feathered edge
    return [Math.max(0, (x0 - m) / W), Math.max(0, (y0 - m) / H),
            Math.min(1, (x1 + 1 + m) / W), Math.min(1, (y1 + 1 + m) / H)];
  }

  var field = document.createElement('canvas');   // the visitor's colours
  var tinted = document.createElement('canvas');  // recoloured petals

  function coverDraw(g, im, w, h) {
    var k = Math.max(w / im.width, h / im.height);
    var dw = im.width * k, dh = im.height * k;
    var x = (w - dw) / 2, y = (h - dh) / 2;
    g.drawImage(im, x, y, dw, dh);
    return [x, y, dw, dh];
  }

  /* Fill the frame with the visitor's colours: a gradient of the mix
     underneath, then the swirl mirror-tiled over it so the marbling never
     repeats visibly and never leaves a transparent gap. */
  function paintField(swirl, colours, w, h) {
    field.width = w; field.height = h;
    var g = field.getContext('2d');
    var grad = g.createLinearGradient(0, 0, w * 0.6, h);
    if (colours && colours.length) {
      colours.forEach(function (c, i) { grad.addColorStop(i / Math.max(1, colours.length - 1), c); });
    } else { grad.addColorStop(0, '#E7B7CF'); grad.addColorStop(1, '#8FB7E0'); }
    g.fillStyle = grad; g.fillRect(0, 0, w, h);

    if (!swirl) return field;
    var tw = w / 2, th = h / 2;
    for (var ty = 0; ty < 2; ty++) {
      for (var tx = 0; tx < 2; tx++) {
        g.save();
        g.translate(tx * tw + (tx ? tw : 0), ty * th + (ty ? th : 0));
        g.scale(tx ? -1 : 1, ty ? -1 : 1);
        g.globalAlpha = 0.96;
        g.drawImage(swirl, 0, 0, tw, th);
        g.restore();
      }
    }
    return field;
  }

  var lastSwirl = null, lastColours = null;

  var api = {
    scenes: function () { return SCENES.slice(); },
    scene: function () { return SCENES[idx]; },
    setScene: function (id, cb) {
      for (var i = 0; i < SCENES.length; i++) {
        if (SCENES[i].id === id) {
          idx = i;
          fetchScene(id, function () { api.paint(lastSwirl, lastColours); if (cb) cb(); });
          return api;
        }
      }
      if (cb) cb();
      return api;
    },
    nextScene: function (cb) {
      return api.setScene(SCENES[(idx + 1) % SCENES.length].id, cb);
    },
    /* Ready = the first scene is in. Later scenes stream in as they are picked;
       the frame keeps showing the previous one until the new one lands, which
       is quieter than blanking. */
    onReady: function (cb) { fetchScene(SCENES[idx].id, function () { cb(); }); return api; },
    /* False once the first scene has settled means its files are missing.
       Callers should hide the whole-plant view rather than show an empty frame. */
    ok: function () { return !!loaded[SCENES[idx].id] || !dead[SCENES[idx].id]; },
    ready: function (id) { return !!loaded[id || SCENES[idx].id]; },

    /* swirl: the engine's canvas. colours: hex strings of the chosen mix. */
    paint: function (swirl, colours) {
      lastSwirl = swirl; lastColours = colours;
      var W = canvas.width, H = canvas.height;
      var sc = loaded[SCENES[idx].id];
      if (!sc) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      var box = coverDraw(ctx, sc.photo, W, H);

      if (swirl) {
        // Work on the petals' bounding box only, in the drawn frame's own
        // coordinates. `bb` is the box as fractions of the photograph.
        var bb = sc.box || [0, 0, 1, 1];
        var dx = box[0] + box[2] * bb[0], dy = box[1] + box[3] * bb[1];
        var dw = box[2] * (bb[2] - bb[0]), dh = box[3] * (bb[3] - bb[1]);
        var w = Math.max(2, Math.round(dw)), h = Math.max(2, Math.round(dh));
        tinted.width = w; tinted.height = h;
        var t = tinted.getContext('2d');
        t.globalCompositeOperation = 'source-over';
        t.clearRect(0, 0, w, h);
        // Draw the photo and the mask at the size the WHOLE photograph occupies
        // in the frame, shifted so the box's top-left lands on 0,0. The tinted
        // canvas is 1:1 with the frame, so that size is box[2] x box[3] — not
        // the box's own size, and not the box's size divided by its fraction.
        var fw = box[2], fh = box[3];
        var ox = -bb[0] * fw, oy = -bb[1] * fh;
        t.drawImage(sc.photo, ox, oy, fw, fh);
        // 'color' takes hue and saturation from the swirl and leaves the
        // photograph's luminance alone — that is what keeps the petals shaded
        // and veined instead of flat.
        t.globalCompositeOperation = 'color';
        t.drawImage(paintField(swirl, colours, w, h), 0, 0);
        t.globalCompositeOperation = 'destination-in';
        t.drawImage(sc.petals, ox, oy, fw, fh);
        t.globalCompositeOperation = 'source-over';
        ctx.drawImage(tinted, dx, dy, dw, dh);
      }
    }
  };
  return api;
}
