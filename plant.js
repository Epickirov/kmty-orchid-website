/* Whole-plant preview: takes the swirl the visitor designed and paints it onto
   a photograph of a real potted plant, standing in a real environment.

   Everything here is canvas 2D — no SVG, by requirement.

   How the recolour works. The plant photo is a magenta Phalaenopsis; the build
   step (build-plant.py) shipped it cut off its studio background plus a mask of
   just the petals. At paint time we:
     1. lay down the visitor's swirl as a colour field over the plant's box,
     2. composite the photograph onto it in 'luminosity' mode, which keeps the
        photograph's shading and takes hue/saturation from the swirl,
     3. clip that to the petal mask,
     4. drop it over the untouched plant so leaves, stems and pot stay real.
   The result carries genuine petal shading and veining rather than flat fill.

   The engine's canvas is bloom-shaped with transparent corners, so it cannot be
   used directly as a field — it would punch holes. We mirror-tile it and back
   it with a gradient of the chosen colours, which fills every pixel and keeps
   the marbling organic. */
'use strict';

function KMTYPlant(canvas, opts) {
  opts = opts || {};
  var base = opts.base || '/plants/';
  var ctx = canvas.getContext('2d');

  var ENVS = opts.envs || [
    { id: 'greenhouse', zh: '温室' },
    { id: 'market', zh: '花市' },
    { id: 'field', zh: '花田' },
    { id: 'studio', zh: '影棚' }   // drawn, not photographed — no plate to load
  ];

  var img = {};
  var pending = 0, loaded = 0, failed = 0;
  function load(key, src) {
    pending++;
    var i = new Image();
    i.onload = function () { loaded++; img[key] = i; tick(); };
    i.onerror = function () { failed++; tick(); };
    i.src = src;
  }
  var readyCbs = [];
  function tick() {
    if (loaded + failed < pending) return;
    readyCbs.splice(0).forEach(function (cb) { cb(); });
  }

  /* ~265KB of plates. With opts.lazy the order page pays for them only when a
     visitor actually asks for the whole-plant view — the single bloom, which is
     what most people come for, still loads on a phone as fast as it did. */
  var started = false;
  function begin() {
    if (started) return;
    started = true;
    load('plant', base + 'plant-magenta.webp');
    load('petals', base + 'plant-magenta-petals.webp');
    load('lum', base + 'plant-magenta-lum.webp');
    ENVS.forEach(function (e) { if (e.id !== 'studio') load('env-' + e.id, base + 'env-' + e.id + '.webp'); });
  }
  if (!opts.lazy) begin();

  var envIdx = 0;
  var field = document.createElement('canvas');   // swirl colour field
  var tinted = document.createElement('canvas');  // recoloured petals

  function coverDraw(g, im, w, h) {
    var k = Math.max(w / im.width, h / im.height);
    var dw = im.width * k, dh = im.height * k;
    g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /* Studio backdrop, drawn rather than loaded: a soft warm pool of light on the
     house aubergine, so there is always one environment even if a plate 404s. */
  function studio(g, w, h) {
    g.fillStyle = '#141018'; g.fillRect(0, 0, w, h);
    var rg = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, h * 0.85);
    rg.addColorStop(0, 'rgba(231,183,207,.20)');
    rg.addColorStop(0.55, 'rgba(60,44,66,.30)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }

  /* Fill `rect` with the visitor's colours: a gradient of the mix underneath,
     then the swirl mirror-tiled over it so the marbling never repeats visibly
     and never leaves a transparent gap. */
  function paintField(swirl, colours, w, h) {
    field.width = w; field.height = h;
    var g = field.getContext('2d');
    var grad = g.createLinearGradient(0, 0, w * 0.6, h);
    if (colours && colours.length) {
      colours.forEach(function (c, i) { grad.addColorStop(i / Math.max(1, colours.length - 1), c); });
    } else { grad.addColorStop(0, '#E7B7CF'); grad.addColorStop(1, '#8FB7E0'); }
    g.fillStyle = grad; g.fillRect(0, 0, w, h);

    if (!swirl) return field;
    // Two columns x two rows, alternate tiles mirrored — cheap seamless marble.
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

  var api = {
    environments: function () { return ENVS.slice(); },
    env: function () { return ENVS[envIdx]; },
    /* False once loading has settled means the plates are missing — a partial
       upload, say. Callers should hide the whole-plant view rather than show an
       empty frame; the environment plates are optional (studio is drawn). */
    ok: function () { return !!(img.plant && img.petals); },
    setEnv: function (id) {
      var i = ENVS.findIndex(function (e) { return e.id === id; });
      if (i >= 0) envIdx = i;
      return api;
    },
    nextEnv: function () { envIdx = (envIdx + 1) % ENVS.length; return ENVS[envIdx]; },
    /* Also the trigger for a lazy instance: nothing is fetched until something
       asks to paint. Note the load must be kicked off *before* the readiness
       test, or a lazy instance would report ready with nothing loaded. */
    onReady: function (cb) {
      begin();
      if (loaded + failed >= pending) cb(); else readyCbs.push(cb);
      return api;
    },

    /* swirl: the engine's canvas. colours: hex strings of the chosen mix. */
    paint: function (swirl, colours) {
      var W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      var e = ENVS[envIdx];
      var plate = img['env-' + e.id];
      if (plate) coverDraw(ctx, plate, W, H); else studio(ctx, W, H);

      var p = img.plant;
      if (!p) return;

      // Plant sits on the lower third, sized off the canvas height.
      var ph = H * 0.86, pw = ph * (p.width / p.height);
      if (pw > W * 0.72) { pw = W * 0.72; ph = pw * (p.height / p.width); }
      var px = (W - pw) / 2, py = H - ph - H * 0.05;

      // Contact shadow, so the pot sits in the scene instead of floating.
      var sy = py + ph * 0.985, sw = pw * 0.46, sh = ph * 0.045;
      var sg = ctx.createRadialGradient(W / 2, sy, 0, W / 2, sy, sw);
      sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.translate(W / 2, sy); ctx.scale(1, sh / sw); ctx.translate(-W / 2, -sy);
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W / 2, sy, sw, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.drawImage(p, px, py, pw, ph);

      var mask = img.petals;
      if (mask && swirl) {
        var w = Math.max(2, Math.round(pw)), h = Math.max(2, Math.round(ph));
        tinted.width = w; tinted.height = h;
        var t = tinted.getContext('2d');
        t.clearRect(0, 0, w, h);
        t.drawImage(paintField(swirl, colours, w, h), 0, 0);
        // Normalised petal luminance supplies the shading, the field supplies
        // the colour. Using the raw photo here makes every mix read muddy.
        t.globalCompositeOperation = 'luminosity';
        t.drawImage(img.lum || p, 0, 0, w, h);
        // keep petals only
        t.globalCompositeOperation = 'destination-in';
        t.drawImage(mask, 0, 0, w, h);
        t.globalCompositeOperation = 'source-over';
        ctx.drawImage(tinted, px, py, pw, ph);
      }

      // Vignette last, over everything, to seat the composite.
      var vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.25, W / 2, H * 0.5, H * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  };
  return api;
}
