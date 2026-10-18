/*!
 * Netflow Map app, part 9b: animated GIF and the one-page HTML report (Export tab). Copyright (c) 2026 LFC Foundry. MIT License.
 */
var GX = { opts: { size: 960, shape: '169', fps: 10, hold: 1.4, trans: 0.9, caption: true, key: true, theme: 'light', what: 'whole' }, running: false, cancel: false, result: null, msg: '', prog: null };
HOOKS.graph.push(function () { if (GX.result && GX.result.url) { try { URL.revokeObjectURL(GX.result.url); } catch (e) { /* gone */ } } GX.result = null; GX.msg = ''; });
function gifMode() { return hasStates() ? 'states' : (S.L && S.L.is3d ? 'spin' : ''); }
function gifSize(o, uw, uh) {
  var W = o.size, H;
  if (o.what === 'screen') H = Math.round(W * S.stageH / Math.max(1, S.stageW));
  else if (o.shape === '169') H = Math.round(W * 9 / 16); else if (o.shape === '43') H = Math.round(W * 3 / 4); else if (o.shape === 'sq') H = W; else H = Math.round(W * clamp(uh / Math.max(1, uw), 0.4, 1.4));
  return [W - (W % 2), Math.max(240, H - (H % 2))];
}
/** What to draw, in order: { L (or make()), caption, delay (ms), key (a main picture, used for the palette), cam }. */
function gifPlan(o, frames) {
  var items = [], N, i, s;
  if (frames) {
    N = frames.length;
    for (i = 0; i < N; i++) {
      items.push({ L: frames[i], caption: stateName(i), delay: Math.round((i === N - 1 ? o.hold * 1.6 : o.hold) * 1000), key: true });
      if (i < N - 1) {
        var steps = Math.max(0, Math.round(o.trans * o.fps));
        for (s = 1; s <= steps; s++) (function (a, b, u) { items.push({ make: function () { return blend(frames[a], frames[b], ease(u)); }, caption: u < 0.5 ? stateName(a) : stateName(b), delay: Math.round(1000 / o.fps), key: false }); })(i, i + 1, s / (steps + 1));
      }
    }
  } else {
    var n = Math.max(12, Math.round(o.hold * 6 * o.fps / 2)), yaw0 = S.V.cam.yaw;
    for (i = 0; i < n; i++) items.push({ L: S.L, caption: '', cam: Object.assign({}, S.V.cam, { yaw: yaw0 + 2 * Math.PI * i / n }), delay: Math.round(1000 / o.fps), key: i % Math.ceil(n / 4) === 0 });
  }
  return items;
}
function gifScene(item, o) {
  var L = item.make ? item.make() : item.L; applyPins(L);
  var so = sceneOpts(); so.theme = o.theme === 'app' ? themeName() : o.theme; if (item.cam) so.cam = item.cam;
  var sc = NFMScene.make(L, so); editKey(sc); return sc;
}
function gifCaption(ctx, sc, text, W, H) {
  if (!text) return;
  var fs = Math.max(14, Math.round(H / 16)), pad = fs * 0.55;
  ctx.save(); ctx.font = '700 ' + fs + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; ctx.textBaseline = 'middle';
  var tw = ctx.measureText(text).width, x = fs * 0.6, y = fs * 0.6;
  ctx.fillStyle = NFMScene.css(NFMScene.alpha(sc.theme.box, 0.92)); ctx.strokeStyle = NFMScene.css(NFMScene.alpha(sc.theme.boxLine, 0.8));
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, tw + pad * 2, fs + pad * 1.4, fs * 0.4); else ctx.rect(x, y, tw + pad * 2, fs + pad * 1.4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = NFMScene.css(sc.theme.fg); ctx.fillText(text, x + pad, y + (fs + pad * 1.4) / 2); ctx.restore();
}
/** Makes the GIF. Resolves to { bytes, w, h, frames, ms }. progress(done, total, text); stop() returns true to cancel. */
function makeGif(o, progress, stop) {
  var t0 = performance.now(), mode = gifMode();
  var getFrames = mode === 'states' ? ensureFrames(function (i, n) { progress(0, 1, 'Preparing state ' + i + ' of ' + n + '…'); }) : Promise.resolve(null);
  return getFrames.then(function (frames) {
    var plan = gifPlan(o, frames), keys = plan.filter(function (p) { return p.key; }), W, H, view, host, rend, cache = new Map();
    /* the picture frame: the union of all the main pictures */
    var ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
    keys.forEach(function (p) { var sc = gifScene(p, o); ux0 = Math.min(ux0, sc.x0); uy0 = Math.min(uy0, sc.y0); ux1 = Math.max(ux1, sc.x0 + sc.w); uy1 = Math.max(uy1, sc.y0 + sc.h); });
    var uw = ux1 - ux0, uh = uy1 - uy0, sz = gifSize(o, uw, uh); W = sz[0]; H = sz[1];
    if (o.what === 'screen') { var f = W / Math.max(1, S.stageW); view = { k: S.view.k * f, tx: S.view.tx * f, ty: S.view.ty * f }; }
    else { var pad = Math.round(Math.min(W, H) * 0.05), k = Math.min((W - 2 * pad) / uw, (H - 2 * pad) / uh); view = { k: k, tx: (W - uw * k) / 2 - ux0 * k, ty: (H - uh * k) / 2 - uy0 * k }; }
    host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + W + 'px;height:' + H + 'px'; document.body.appendChild(host);
    return NFMRender.createCanvas2D(host, {}).then(function (r) {
      rend = r; r.resize(W, H, 1);
      var out = document.createElement('canvas'); out.width = W; out.height = H; var x = out.getContext('2d', { willReadFrequently: true });
      var renderItem = function (p) {
        var sc = gifScene(p, o); r.setScene(sc); r.draw({ k: view.k, tx: view.tx, ty: view.ty, invalidate: function () { /* still picture */ } });
        x.fillStyle = sc.theme.hex.bg; x.fillRect(0, 0, W, H);
        for (var i = 0; i < host.children.length; i++) x.drawImage(host.children[i], 0, 0);
        if (o.key) drawKeyOn(x, sc, W, H);
        if (o.caption) gifCaption(x, sc, p.caption, W, H);
        return x.getImageData(0, 0, W, H).data;
      };
      var finish = function () { try { rend.destroy(); } catch (e) { /* gone */ } host.remove(); };
      var total = plan.length + keys.length, done = 0, tick = function (text) { progress(done, total, text); return nextFrame(); };
      /* pass 1: the main pictures give the colors */
      var ki = 0, shots = [];
      var pass1 = function () {
        if (ki >= keys.length) return Promise.resolve();
        if (stop()) return Promise.reject(new Error('cancelled'));
        var d = renderItem(keys[ki]); cache.set(keys[ki], new Uint8ClampedArray(d)); shots.push(cache.get(keys[ki])); ki++; done++;
        return tick('Looking at the colors…').then(pass1);
      };
      return pass1().then(function () {
        var pal = NFMGif.makePalette(shots, 255), enc = NFMGif.createEncoder(W, H, pal, { loop: true }), pi = 0;
        var pass2 = function () {
          if (pi >= plan.length) return Promise.resolve();
          if (stop()) return Promise.reject(new Error('cancelled'));
          var p = plan[pi], d = cache.get(p) || renderItem(p); cache.delete(p); enc.add(d, p.delay); pi++; done++;
          return tick('Frame ' + pi + ' of ' + plan.length + '…').then(pass2);
        };
        return pass2().then(function () { var bytes = enc.finish(); finish(); return { bytes: bytes, w: W, h: H, frames: plan.length, ms: performance.now() - t0, mode: mode }; });
      }).catch(function (err) { finish(); throw err; });
    });
  });
}
function b64(bytes) { if (typeof bytes.toBase64 === 'function') return bytes.toBase64(); var s = '', i, n = 0x8000; for (i = 0; i < bytes.length; i += n) s += String.fromCharCode.apply(null, bytes.subarray(i, i + n)); return btoa(s); }
/** One self-contained page: the animation, the key in words, the states and the biggest changes. */
function reportHtml(res) {
  var sc = S.scene, name = S.graph.name || 'Network', e = esc, rows = [];
  var legend = sc && sc.legend ? sc.legend.filter(function (l) { return l.t; }).map(function (l) { return '<li>' + e(l.t) + (l.lo ? ' (' + e(l.lo) + ' to ' + e(l.hi) + ')' : '') + '</li>'; }).join('') : '';
  var states = S.graph.states ? S.graph.states.names : [];
  var edges = S.graph.edges.filter(function (x) { return x.vals; }).map(function (x) { var v = x.vals.filter(function (q) { return q !== null; }); return { e: x, span: v.length ? Math.max.apply(null, v) - Math.min.apply(null, v) : 0 }; }).sort(function (a, b) { return b.span - a.span; }).slice(0, 12);
  if (edges.length) rows.push('<h2>Biggest changes</h2><table><thead><tr><th>Link</th>' + states.map(function (s) { return '<th>' + e(s) + '</th>'; }).join('') + '</tr></thead><tbody>' + edges.map(function (x) { return '<tr><td>' + e(labelOf(x.e.from) + ' → ' + labelOf(x.e.to)) + '</td>' + x.e.vals.map(function (v) { return '<td>' + (v === null ? '–' : e(NFMColumns.fmt(v))) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>');
  var css = 'body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;color:#1d2330;background:#fff}h1{margin:.2em 0;text-wrap:balance}h2{margin-top:1.6em;font-size:1.1em;text-wrap:balance}img{max-width:100%;height:auto;border:1px solid #d9dbe3;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #e5e7ee;padding:5px 8px;text-align:left}td:not(:first-child),th:not(:first-child){text-align:right}footer{margin-top:2em;color:#6a7183;font-size:13px}@media(prefers-color-scheme:dark){body{background:#12151c;color:#e8eaf0}img{border-color:#2b3140}th,td{border-color:#2b3140}footer{color:#9aa1b3}}';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e(name) + '</title><style>' + css + '</style></head><body>\n<h1>' + e(name) + '</h1>\n<p>' + e(plural(S.graph.nodes.length, word('item')) + ' and ' + plural(S.graph.edges.length, word('link')) + (states.length ? ', shown over ' + states.join(', ') : '') + '.') + '</p>\n<img alt="' + e('Animated map of ' + name + (states.length ? ' over ' + states.join(', ') : '')) + '" src="data:image/gif;base64,' + b64(res.bytes) + '" width="' + res.w + '" height="' + res.h + '">\n' + (legend ? '<h2>Key</h2><ul>' + legend + '</ul>' : '') + (states.length ? '<h2>States</h2><ol>' + states.map(function (s) { return '<li>' + e(s) + '</li>'; }).join('') + '</ol>' : '') + rows.join('') + '\n<footer>Made with Netflow Map, forged by LFC Foundry, version ' + e(APP_VERSION) + '. Nothing was uploaded; everything was made in the browser.</footer>\n</body></html>\n';
}
function gifCard() {
  var mode = gifMode(), o = GX.opts, card = h('div', { class: 'card', id: 'gif-card' }, [h('h2', null, 'Animation (GIF)')]);
  if (!mode) { card.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, 'Two kinds of animation are possible. If your data has states (baseline, year 1 and so on; set them up in the Data tab), this makes a GIF that plays through them. If you pick a 3D arrangement on the Map, it makes a turn-around GIF.')); return card; }
  var needMap = !S.L; if (needMap) { card.appendChild(h('p', { class: 'muted small' }, 'Open the Map tab once first.')); return card; }
  card.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, mode === 'states' ? 'Plays through all ' + nStates() + ' states with a smooth change between them. Works in PowerPoint, Keynote, Google Slides, email and web pages.' : 'A full turn of the 3D picture. Works in PowerPoint, Keynote, Google Slides, email and web pages.'));
  card.appendChild(h('div', { class: 'maprow' }, [
    field('Width (pixels)', select([[640, '640 (small file)'], [960, '960 (slides)'], [1280, '1280 (sharp)']], o.size, function (v) { o.size = +v; })),
    field('Shape', select([['169', 'Slide (16:9)'], ['43', 'Slide (4:3)'], ['sq', 'Square'], ['fit', 'Fit the map']], o.shape, function (v) { o.shape = v; })),
    field('What to show', select([['whole', 'The whole map'], ['screen', 'What I see now (zoomed)']], o.what, function (v) { o.what = v; })),
    field('Background', select([['light', 'Light (best for slides)'], ['dark', 'Dark'], ['app', 'Same as the app']], o.theme, function (v) { o.theme = v; })),
    field(mode === 'states' ? 'Seconds on each state' : 'Seconds per turn (about)', select([[0.6, '0.6'], [1, '1'], [1.4, '1.4'], [2, '2'], [3, '3']], o.hold, function (v) { o.hold = +v; })),
    mode === 'states' ? field('Seconds of change between states', select([[0, 'None (cut)'], [0.5, '0.5'], [0.9, '0.9'], [1.5, '1.5']], o.trans, function (v) { o.trans = +v; })) : null,
    field('Smoothness', select([[6, 'Light (6 FPS)'], [10, 'Normal (10 FPS)'], [15, 'Smooth (15 FPS)']], o.fps, function (v) { o.fps = +v; }))]));
  card.appendChild(h('div', { class: 'row' }, [check('Include the key', o.key, function (on) { o.key = on; }), mode === 'states' ? check('Show the state name', o.caption, function (on) { o.caption = on; }) : null]));
  var prog = h('div', { id: 'gif-prog', 'aria-live': 'polite' });
  var go = h('button', { class: 'primary', id: 'gif-go', onclick: runGif, disabled: GX.running }, GX.result ? 'Make it again' : 'Make the GIF'), cancel = h('button', { id: 'gif-cancel', hidden: !GX.running, onclick: function () { GX.cancel = true; } }, 'Cancel');
  card.appendChild(h('div', { class: 'row' }, [go, cancel]));
  card.appendChild(prog);
  card.appendChild(h('div', { id: 'gif-out' }, gifResultKids()));
  return card;
}
function gifResultKids() {
  if (GX.msg && !GX.running) return [h('p', { class: 'muted' }, GX.msg)];
  var r = GX.result; if (!r) return [];
  var kb = Math.round(r.bytes.length / 1024), size = kb > 1500 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
  return [h('p', { class: 'muted small', style: { margin: '6px 0 2px' } }, plural(r.frames, 'picture') + ', ' + r.w + ' × ' + r.h + ', ' + size + ', made in ' + (r.ms / 1000).toFixed(1) + ' seconds.' + (kb > 8000 ? ' That is large for a slide. Try a smaller width or a lower FPS.' : '')),
    h('img', { src: r.url, alt: 'Preview of the animation', style: { maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--line)' } }),
    h('div', { class: 'row' }, [h('button', { class: 'primary', onclick: function () { download(fname('.gif'), new Blob([r.bytes], { type: 'image/gif' }), 'image/gif'); } }, 'Save the GIF'), h('button', { onclick: function () { download(fname('-report.html'), reportHtml(r), 'text/html'); } }, 'Save as a web page (HTML report)')])];
}
function runGif() {
  if (GX.running) return;
  GX.running = true; GX.cancel = false; GX.msg = ''; var box = $('gif-card'), prog = $('gif-prog'), gv = S.gver;
  if (GX.result && GX.result.url) { try { URL.revokeObjectURL(GX.result.url); } catch (e) { /* gone */ } } GX.result = null;
  $('gif-go').disabled = true; $('gif-cancel').hidden = false; mount($('gif-out'), []);
  var bar = h('progress', { max: 1, value: 0, 'aria-label': 'Progress' }), txt = h('p', { class: 'muted small', style: { margin: '2px 0 0' } }, 'Starting…'); mount(prog, [bar, txt]);
  /* the map is built first when the data changed since it was open; and a GIF is only kept when the data is still the data it was made from */
  var changed = function () { return gv !== S.gver; };
  ensureMap().then(function () {
    if (changed()) throw new Error('changed');
    return makeGif(Object.assign({}, GX.opts), function (d, t, text) { bar.max = Math.max(1, t); bar.value = d; txt.textContent = text; }, function () { return GX.cancel; });
  }).then(function (res) {
    if (changed()) throw new Error('changed');
    res.url = URL.createObjectURL(new Blob([res.bytes], { type: 'image/gif' })); GX.result = res;
  }).catch(function (err) { GX.msg = err.message === 'cancelled' ? 'Canceled.' : err.message === 'changed' ? 'The data changed while the GIF was being made, so it was dropped. Make it again.' : err.message === 'superseded' ? 'The settings changed while working. Try again.' : 'The GIF could not be made: ' + err.message; }).then(function () {
    GX.running = false; if (S.tab === 'export') renderExport();
  });
}
