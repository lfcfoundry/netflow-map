/*!
 * Netflow Map app, part 9b: animated GIF and the one-page HTML report (Export tab). Copyright (c) 2026 LFC Foundry. MIT License.
 * Pictures are drawn on the page, then filtered and written to the GIF in background workers (src/gif-worker.js); timing and filters are in src/gifx.js.
 */
var GX_KEY = 'nfm-gif', GX = { opts: { size: 960, shape: '169', fps: 25, hold: 1.4, trans: 0.9, caption: true, key: true, theme: 'light', what: 'whole', ease: 'smooth', turns: 1, turnSec: 4, pause: 0, reverse: false, arc: 360, names: 'always', card: 'auto', small: 'small', keyPos: 'bl', legend: 'short', format: 'gif', filter: NFMGifFx.plainFilter() }, running: false, cancel: false, result: null, msg: '', prog: null, preview: null };
(function () { try { var o = JSON.parse(LS.get(GX_KEY) || 'null'); if (o && typeof o === 'object') { var d = GX.opts; ['size', 'fps', 'hold', 'trans', 'turns', 'turnSec', 'pause', 'arc'].forEach(function (k) { if (typeof o[k] === 'number' && isFinite(o[k])) d[k] = o[k]; }); ['shape', 'theme', 'what', 'ease', 'names', 'card', 'small', 'keyPos', 'legend', 'format'].forEach(function (k) { if (typeof o[k] === 'string' && o[k].length < 20) d[k] = o[k]; }); ['caption', 'key', 'reverse'].forEach(function (k) { if (typeof o[k] === 'boolean') d[k] = o[k]; }); d.filter = NFMGifFx.cleanFilter(o.filter); if (!NFMGifFx.EASES[d.ease]) d.ease = 'smooth'; if (!NFMGifFx.NAMES[d.names]) d.names = 'always'; if (d.card !== 'off') d.card = 'auto'; if (!NFMGifFx.SIZES[d.small]) d.small = 'small'; if (['bl', 'br', 'tl', 'tr'].indexOf(d.keyPos) < 0) d.keyPos = 'bl'; if (d.format !== 'video') d.format = 'gif'; if (['short', 'full', 'off'].indexOf(d.legend) < 0) d.legend = 'short'; if (o.key === false && typeof o.legend !== 'string') d.legend = 'off'; d.fps = clamp(d.fps, 5, 30); d.turns = clamp(Math.round(d.turns), 1, 12); d.turnSec = clamp(d.turnSec, 1, 20); d.pause = clamp(d.pause, 0, 10); d.arc = clamp(d.arc, 10, 360); } } catch (e) { /* defaults */ } })();
NFMGifFx.initWasm();   /* compile early, so the one-picture preview on the page has it too */
/** Gives other tasks a turn without the 4 ms wait that nested setTimeout(0) calls get; every ~80 ms it takes a real timer turn so the progress text can paint. */
var gifGive = (function () {
  var mc = null, q = [], last = 0;
  try { mc = new MessageChannel(); mc.port1.onmessage = function () { var f = q.shift(); if (f) f(); }; } catch (e) { mc = null; }
  return function () {
    var now = performance.now();
    if (!mc || now - last > 80) { last = now; return nextFrame(); }
    return new Promise(function (r) { q.push(r); mc.port2.postMessage(0); });
  };
})();
var saveGx = function () { LS.set(GX_KEY, JSON.stringify(GX.opts)); };
HOOKS.graph.push(function () { if (GX.result && GX.result.url) { try { URL.revokeObjectURL(GX.result.url); } catch (e) { /* gone */ } } GX.result = null; GX.msg = ''; });
function gifMode() { return hasStates() ? 'states' : (S.L && S.L.is3d ? 'spin' : ''); }
function gifSize(o, uw, uh) {
  var W = o.size, H;
  if (o.what === 'screen') H = Math.round(W * S.stageH / Math.max(1, S.stageW));
  else if (o.shape === '169') H = Math.round(W * 9 / 16); else if (o.shape === '43') H = Math.round(W * 3 / 4); else if (o.shape === 'sq') H = W; else H = Math.round(W * clamp(uh / Math.max(1, uw), 0.4, 1.4));
  return [W - (W % 2), Math.max(240, H - (H % 2))];
}
/** What to draw, in order: { L (or make()), caption, ms (time shown), names (0..1), key (a main picture, used for the palette), cam }. */
function gifPlan(o, frames) {
  var items = [], N, i, s, fx = NFMGifFx;
  if (frames) {
    N = frames.length;
    for (i = 0; i < N; i++) {
      items.push({ L: frames[i], caption: stateName(i), ms: Math.round((i === N - 1 ? o.hold * 1.6 : o.hold) * 1000), names: o.names === 'never' ? 0 : 1, key: true });
      if (i < N - 1) {
        var steps = Math.max(0, Math.round(o.trans * o.fps));
        for (s = 1; s <= steps; s++) (function (a, b, u) { items.push({ make: function () { return blend(frames[a], frames[b], fx.ease(o.ease, u)); }, caption: u < 0.5 ? stateName(a) : stateName(b), ms: 1000 / o.fps, names: fx.stateNames(o.names, u), key: false }); })(i, i + 1, s / (steps + 1));
      }
    }
  } else {
    var yaw0 = S.V.cam.yaw, sp = fx.spinPlan({ fps: o.fps, turns: o.turns, turnSec: o.turnSec, pauseSec: o.pause, reverse: o.reverse, ease: o.ease, arc: o.arc, names: o.names, fadeSec: 0.4 }), every = Math.max(1, Math.ceil(sp.length / 6));
    sp.forEach(function (f, k) { items.push({ L: S.L, caption: '', cam: Object.assign({}, S.V.cam, { yaw: yaw0 + f.yaw }), ms: f.ms, names: f.a, key: k % every === 0 || (f.phase === 'hold' && f.ms > 100) }); });
  }
  var cs = fx.delaysCs(items.map(function (p) { return p.ms; }));
  items.forEach(function (p, k) { p.ms = cs[k] * 10; });
  return items;
}
function gifScene(item, o) {
  var L = item.make ? item.make() : item.L; applyPins(L);
  var so = sceneOpts(); if (o.theme !== 'app') { so.theme = o.theme; so.palette = S.V.palette; so.ramp = S.V.ramp; } if (item.cam) so.cam = item.cam;
  var sc = NFMScene.make(L, so); editKey(sc);
  if (item.names !== undefined && item.names < 0.999) { if (item.names <= 0.01) sc.labels = []; else sc.labels.forEach(function (l) { l.a = (l.a === undefined ? 1 : l.a) * item.names; }); }
  return sc;
}
function gifCaption(ctx, sc, text, W, H) { NFMGifKey.drawCaption(ctx, sc, text, W, H, S.V.fmt.font); }
/** A few background workers (or one inline helper where workers are missing). Messages come back through pool.on(workerIndex, msg). */
function gifPool(n) {
  var pool = { n: 0, ws: [], inflight: [], on: null, inline: false, close: function () { pool.ws.forEach(function (w) { try { w.terminate(); } catch (e) { /* gone */ } }); pool.ws = []; } };
  var src = null, url = null;
  try { src = $('nfm-gif-src').textContent; url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); } catch (e) { src = null; }
  for (var i = 0; src && i < n; i++) (function (k) {
    try { var w = new Worker(url); w.onmessage = function (e) { pool.inflight[k]--; if (pool.on) pool.on(k, e.data); }; w.onerror = function (e) { if (pool.on) pool.on(k, { t: 'error', msg: String(e.message || 'worker failed') }); }; pool.ws.push(w); pool.inflight.push(0); } catch (e) { /* fewer workers */ }
  })(i);
  if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  if (!pool.ws.length) {   /* the same code on the page, one message at a time */
    pool.inline = true;
    pool.ws.push({ postMessage: function (m) { setTimeout(function () { NFMGifWorker.handle(m, function (r) { pool.inflight[0]--; if (pool.on) pool.on(0, r); }); }, 0); }, terminate: function () { /* nothing */ } }); pool.inflight.push(0);
  }
  pool.n = pool.ws.length; pool.card = -1;
  /** Starts one more worker that filters on the graphics card. Resolves true when it works; the pictures then go there first. Not used where workers are missing. */
  pool.initCard = function () {
    if (pool.inline || !src) return Promise.resolve(false);
    return new Promise(function (res) {
      var w, k = pool.ws.length, to = setTimeout(function () { fail(); }, 4000), fail = function () { clearTimeout(to); try { w.terminate(); } catch (e) { /* gone */ } pool.ws.length = k; pool.inflight.length = k; res(false); };
      try { var u = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); w = new Worker(u); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); } catch (e) { return res(false); }
      w.onerror = fail; w.onmessage = function (e) { if (e.data.t !== 'card') return; clearTimeout(to); if (!e.data.ok) return fail(); w.onmessage = function (ev) { pool.inflight[k]--; if (pool.on) pool.on(k, ev.data); }; w.onerror = function (ev) { if (pool.on) pool.on(k, { t: 'error', msg: String(ev.message || 'worker failed') }); }; pool.ws.push(w); pool.inflight.push(0); pool.n = pool.ws.length; pool.card = k; res(true); };
      w.postMessage({ t: 'card', id: 'c' });
    });
  };
  pool.post = function (k, m, tr) { pool.inflight[k]++; pool.ws[k].postMessage(m, tr || []); };
  return pool;
}
function gifWorkerCount() { return window.NFM_GIF_WORKERS > 0 ? window.NFM_GIF_WORKERS : clamp((navigator.hardwareConcurrency || 2) - 1, 1, 5); }
/** Makes the GIF. Resolves to { bytes, w, h, frames, ms, workers }. progress(done, total, text); stop() returns true to cancel. */
/** Drawing workers: the pictures of a 3D turn of a big map are drawn in background workers (src/draw-worker.js) while the page keeps its own work. Returns what the workers need,
 *  or null when the pictures are drawn here (preview, states, sankey, per-item text, short animations, small maps, fewer than 4 cores, no workers). o.drawWorkers true/false forces it (tests). */
function gifDrawJob(o, plan, W, H, view) {
  var V = S.V, auto = o.drawWorkers === undefined;
  if (o.preview || o.drawWorkers === false || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  if (gifMode() !== 'spin' || V.view === 'sankey' || V.labelCol || (V.linkLabels && V.linkLabels !== 'none')) return null;
  if (auto && (S.graph.nodes.length < 5000 || plan.length < 20 || (navigator.hardwareConcurrency || 1) < 4)) return null;
  var so = sceneOpts(); if (o.theme !== 'app') { so.theme = o.theme; so.palette = V.palette; so.ramp = V.ramp; }
  var cand = {}, add = function (k) { if (typeof k === 'string' && k.length < 80) cand[k] = 1; };
  ['sys:count', 'sys:flow', 'weight', 'label', 'group', 'id'].forEach(add);
  Object.keys(V).forEach(function (k) { if (typeof V[k] === 'string') add(V[k]); });
  (S.dg.nodes.slice(0, 300)).forEach(function (n) { if (n.attrs) Object.keys(n.attrs).forEach(add); });
  (S.dg.edges.slice(0, 300)).forEach(function (e) { if (e.attrs) Object.keys(e.attrs).forEach(add); });
  var chName = new Map(); Object.keys(cand).forEach(function (c) { chName.set(c, so.chName(c)); });
  var sm = computeStyles(), tables = { chName: chName, nodeStyle: sm.any ? sm.nodes : null, edgeStyle: sm.any ? sm.edges : null, nodeScale: V.fmt.nodeScale };
  ['chName', 'nodeStyle', 'linkStyle', 'labelFn', 'linkLabelFn'].forEach(function (k) { delete so[k]; });
  return { L: S.L, so: so, tables: tables, W: W, H: H, view: view, o: {}, fmt: V.fmt, themeName: themeName(), keyEdits: V.key.edits || {}, n: o.drawWorkerCount || Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 2)) };
}
/** The pool of drawing workers for one animation. ready() resolves when every worker has the layout; draw(p) gives the picture's pixels (RGBA buffer). */
function gifDrawPool(job) {
  var src = null, url = null, pool = { ws: [], inflight: [], n: 0, waits: {}, nid: 1, failed: null, drawn: 0, drawMs: 0, readyMs: 0 }, i;
  try { src = $('nfm-draw-src').textContent; url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); } catch (e) { return null; }
  var onmsg = function (k, m) { pool.inflight[k]--; if (m.t === 'error') pool.failed = new Error(m.msg); var w = pool.waits[m.id]; if (w) { delete pool.waits[m.id]; w(m); } };
  for (i = 0; i < job.n; i++) (function (k) {
    try { var w = new Worker(url); w.onmessage = function (e) { onmsg(k, e.data); }; w.onerror = function (e) { pool.failed = new Error(String(e.message || 'drawing worker failed')); Object.keys(pool.waits).forEach(function (q) { pool.waits[q]({ t: 'error', msg: pool.failed.message }); }); }; pool.ws.push(w); pool.inflight.push(0); } catch (e) { /* fewer workers */ }
  })(i);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  pool.n = pool.ws.length; if (!pool.n) return null;
  var ask = function (k, msg) { return new Promise(function (res, rej) { msg.id = 'd' + pool.nid++; pool.waits[msg.id] = function (m) { if (m.t === 'error') rej(new Error(m.msg)); else { if (m.ms) { pool.drawn++; pool.drawMs += m.ms; } res(m); } }; pool.inflight[k]++; pool.ws[k].postMessage(msg); }); };
  /** Sends the layout to each worker in turn (copying it takes the page a moment each time), so the page can paint between them. */
  pool.ready = async function () {
    var all = [], t0 = performance.now();
    for (var k = 0; k < pool.n; k++) { all.push(ask(k, { t: 'init', L: job.L, so: job.so, tables: job.tables, W: job.W, H: job.H, view: job.view, o: job.o, fmt: job.fmt, themeName: job.themeName, font: job.fmt.font, keyEdits: job.keyEdits })); await gifGive(); }
    await Promise.all(all); pool.readyMs = performance.now() - t0;
  };
  pool.draw = function (p) { var b = 0, q; for (q = 1; q < pool.n; q++) if (pool.inflight[q] < pool.inflight[b]) b = q; return ask(b, { t: 'draw', cam: p.cam, names: p.names, caption: p.caption }).then(function (m) { return m.buf; }); };
  pool.close = function () { pool.ws.forEach(function (w) { try { w.postMessage({ t: 'close' }); w.terminate(); } catch (e) { /* gone */ } }); pool.ws = []; };
  return pool;
}
function makeGif(o, progress, stop) {
  var t0 = performance.now(), mode = gifMode();
  var getFrames = mode === 'states' ? ensureFrames(function (i, n) { progress(0, 1, 'Preparing state ' + i + ' of ' + n + '…'); }) : Promise.resolve(null);
  return getFrames.then(function (frames) {
    var plan = gifPlan(o, frames), keys = plan.filter(function (p) { return p.key; }); if (o.preview) { plan = [keys[0]]; keys = plan; } var W, H, view, host, rend, filt = NFMGifFx.cleanFilter(o.filter), useFilter = !NFMGifFx.isPlainFilter(filt);
    var ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
    keys.forEach(function (p) { var sc = gifScene(p, o); ux0 = Math.min(ux0, sc.x0); uy0 = Math.min(uy0, sc.y0); ux1 = Math.max(ux1, sc.x0 + sc.w); uy1 = Math.max(uy1, sc.y0 + sc.h); });
    var uw = ux1 - ux0, uh = uy1 - uy0, sz = gifSize(o, uw, uh); W = sz[0]; H = sz[1];
    if (o.what === 'screen') { var f = W / Math.max(1, S.stageW); view = { k: S.view.k * f, tx: S.view.tx * f, ty: S.view.ty * f }; }
    else { var pad = Math.round(Math.min(W, H) * 0.05), k = Math.min((W - 2 * pad) / uw, (H - 2 * pad) / uh); view = { k: k, tx: (W - uw * k) / 2 - ux0 * k, ty: (H - uh * k) / 2 - uy0 * k }; }
    host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + W + 'px;height:' + H + 'px'; document.body.appendChild(host);
    return NFMRender.createCanvas2D(host, { cpu: true }).then(function (r) {
      rend = r; r.resize(W, H, 1);
      var out = document.createElement('canvas'); out.width = W; out.height = H; var x = out.getContext('2d', { willReadFrequently: true });
      var renderItem = function (p) {
        var sc = gifScene(p, o); r.setScene(sc); r.draw({ k: view.k, tx: view.tx, ty: view.ty, invalidate: function () { /* still picture */ } });
        x.fillStyle = sc.theme.hex.bg; x.fillRect(0, 0, W, H);
        for (var i = 0; i < host.children.length; i++) x.drawImage(host.children[i], 0, 0);
        if (o.legend !== 'off') drawKeyOn(x, sc, W, H, undefined, { pos: o.keyPos, full: o.legend === 'full' });
        if (o.caption) gifCaption(x, sc, p.caption, W, H);
        return x.getImageData(0, 0, W, H).data.buffer;
      };
      if (o.preview) {   /* one picture with the look applied, on the page (the person pressed a button and waits for one picture) */
        return NFMGifFx.initWasm().then(async function () { var pb = renderItem(plan[0]), pa = new Uint8ClampedArray(pb);
          if (o.twin) { var tj = gifDrawJob(Object.assign({}, o, { preview: false, drawWorkers: true }), [plan[0]], W, H, view), tp = tj && gifDrawPool(tj); if (tp) { await tp.ready(); var wb = await tp.draw(plan[0]); tp.close(); if (wb) { x.putImageData(new ImageData(new Uint8ClampedArray(wb), W, H), 0, 0); var ksc = gifScene(plan[0], o); if (o.legend !== 'off') drawKeyOn(x, ksc, W, H, undefined, { pos: o.keyPos, full: o.legend === 'full' }); if (o.caption) gifCaption(x, ksc, plan[0].caption, W, H); wb = x.getImageData(0, 0, W, H).data.buffer; } } try { rend.destroy(); } catch (e) { /* gone */ } host.remove(); return { twin: true, page: pb, worker: wb || null, w: W, h: H }; }   /* test only: the same picture drawn here and in a drawing worker */
          NFMGifFx.apply(pa, W, H, filt); x.putImageData(new ImageData(pa, W, H), 0, 0); var png = out.toDataURL('image/png'); try { rend.destroy(); } catch (e) { /* gone */ } host.remove(); return { png: png, w: W, h: H }; });
      }
      var pool = gifPool(useFilter ? gifWorkerCount() : 1), waits = {}, nid = 1, total = plan.length + keys.length, done = 0, failed = null;
      var finish = function () { pool.on = null; pool.close(); if (dpool) dpool.close(); try { rend.destroy(); } catch (e) { /* gone */ } host.remove(); };
      pool.on = function (k, m) { if (m.t === 'error') failed = new Error(m.msg); var w = waits[m.id !== undefined ? m.id : m.t]; if (w) { delete waits[m.id !== undefined ? m.id : m.t]; w(m); } else if (m.t === 'error') Object.keys(waits).forEach(function (q) { waits[q](m); }); };
      var ask = function (k, msg, tr, key) { return new Promise(function (res, rej) { waits[key] = function (m) { if (m.t === 'error') rej(failed); else res(m); }; pool.post(k, msg, tr); }); };
      var tick = function (text) { progress(done, total, text); return gifGive(); };
      var least = function () { if (pool.card >= 0 && pool.inflight[pool.card] < 3) return pool.card; var b = 0, q; for (q = 1; q < pool.n; q++) if (q !== pool.card && pool.inflight[q] < pool.inflight[b]) b = q; return b; };
      var filterBuf = function (buf) { if (!useFilter) return Promise.resolve(buf); var id = 'f' + nid++; return ask(least(), { t: 'filter', id: id, buf: buf, w: W, h: H, f: filt }, [buf], id).then(function (m) { return m.buf; }); };
      var cache = new Map();
      var vw = null;
      var djob = gifDrawJob(o, plan, W, H, view), dpool = null;   /* drawing workers, or null: draw here */
      var keySc = null;   /* the key and caption come from one scene made here (the key does not change between pictures); the workers draw only the map */
      var renderPic = function (p) {
        if (!dpool) return Promise.resolve(renderItem(p));
        if (!keySc) keySc = gifScene(keys[0], o);
        return dpool.draw(p).then(function (buf) {
          var tc = performance.now();
          x.putImageData(new ImageData(new Uint8ClampedArray(buf), W, H), 0, 0);
          if (o.legend !== 'off') drawKeyOn(x, keySc, W, H, undefined, { pos: o.keyPos, full: o.legend === 'full' });
          if (o.caption) gifCaption(x, keySc, p.caption, W, H);
          var gb = x.getImageData(0, 0, W, H).data.buffer; dpool.mainMs = (dpool.mainMs || 0) + performance.now() - tc; dpool.mainN = (dpool.mainN || 0) + 1; return gb;
        });
      };
      var run = async function () {   /* run.video: 'mp4' or 'webm' when the result is a video */
        var vfmt = null; vw = null;
        if (o.format === 'video') { var sup = await NFMVideo.support(W, H, o.fps); vfmt = sup.mp4 ? 'mp4' : sup.webm ? 'webm' : null; }   /* MP4 where the browser can make it, else WebM, else the GIF below */
        if (vfmt) { var bpp = { best: 0.2, small: 0.1, smallest: 0.05 }[o.small] || 0.1; vw = NFMVideo.createWriter({ w: W, h: H, fps: o.fps, format: vfmt, bitsPerPixel: bpp }); }
        else pool.ws[0].postMessage({ t: 'init', w: W, h: H });
        if (djob) { dpool = gifDrawPool(djob); if (dpool) { try { await dpool.ready(); } catch (e) { dpool.close(); dpool = null; } } }   /* if the workers cannot start, the pictures are drawn here as before */
        run.drawWorkers = dpool ? dpool.n : 0; run.dpool = dpool;
        if (useFilter && o.card !== 'off') await pool.initCard();   /* a worker that filters on the graphics card, where there is one */
        if (useFilter) await Promise.all(pool.ws.map(function (w, k) { return ask(k, { t: 'wasm', id: 'w' + k }, [], 'w' + k); }));   /* every worker compiles the WebAssembly filters first (plain JavaScript where it cannot) */
        /* pass 1: the main pictures give the colors */
        var shots = [], ki, kb;
        for (ki = 0; !vw && ki < keys.length; ki++) {
          if (stop()) throw new Error('cancelled'); if (failed) throw failed;
          kb = await filterBuf(await renderPic(keys[ki])); cache.set(keys[ki], kb); shots.push(kb.slice(0)); done++; await tick('Looking at the colors…');
        }
        var sz = NFMGifFx.SIZES[o.small] || NFMGifFx.SIZES.small; if (!vw) await ask(0, { t: 'palette', bufs: shots, colors: sz[1], tol: sz[2] }, shots, 'ready'); shots = null;
        /* pass 2: every picture in order, drawn here, filtered by the workers in turn, written by worker 0 */
        var ahead = [], next = 0, sent = 0, window_ = dpool ? Math.max(pool.n + 1, dpool.n * 2) : pool.n + 1, encP = [];
        while (sent < plan.length) {
          while (next < plan.length && ahead.length < window_) {
            if (stop()) throw new Error('cancelled'); if (failed) throw failed;
            var p = plan[next++], buf = cache.get(p), pr;
            if (buf) { cache.delete(p); pr = Promise.resolve(buf); } else if (dpool) { pr = renderPic(p).then(filterBuf); } else { pr = filterBuf(renderItem(p)); await gifGive(); }
            ahead.push({ p: p, pr: pr });
          }
          var it = ahead.shift(), data = await it.pr, id = 'e' + nid++;
          if (vw) { if (!sent) run.poster = gifPoster(data, W, H); encP.push(vw.add(data, it.p.ms, W)); } else encP.push(ask(0, { t: 'frame', id: id, buf: data, ms: it.p.ms }, [data], id)); sent++; done++;
          if (encP.length > 3) await encP.shift();
          progress(done, total, 'Frame ' + sent + ' of ' + plan.length + '…');
        }
        await Promise.all(encP);
        if (vw) { var vb = await vw.finish(); run.video = vfmt; return vb; }
        var fin = await ask(0, { t: 'finish' }, [], 'done');
        return new Uint8Array(fin.bytes);
      };
      return run().then(function (bytes) { finish(); return { bytes: bytes, w: W, h: H, frames: plan.length, ms: performance.now() - t0, mode: mode, video: run.video || '', poster: run.poster || '', asked: o.format, workers: pool.n, inline: pool.inline, card: pool.card >= 0, drawWorkers: run.drawWorkers || 0, drawStats: run.dpool ? { readyMs: Math.round(run.dpool.readyMs), avgWorkerMs: run.dpool.drawn ? Math.round(run.dpool.drawMs / run.dpool.drawn) : 0, avgPageMs: run.dpool.mainN ? Math.round(run.dpool.mainMs / run.dpool.mainN) : 0 } : null }; }, function (err) { if (vw) vw.cancel(); finish(); throw err; });
    });
  });
}
/** The first picture of a video as a small PNG, so there is something to look at here (the page does not play video). */
function gifPoster(buf, W, H) { try { var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.slice(0)), W, H), 0, 0); return c.toDataURL('image/png'); } catch (e) { return ''; } }
function b64(bytes) { if (typeof bytes.toBase64 === 'function') return bytes.toBase64(); var s = '', i, n = 0x8000; for (i = 0; i < bytes.length; i += n) s += String.fromCharCode.apply(null, bytes.subarray(i, i + n)); return btoa(s); }
/** One self-contained page: the animation, the key in words, the states and the biggest changes. */
function reportHtml(res) {
  var sc = S.scene, name = S.graph.name || 'Network', e = esc, rows = [];
  var legend = sc && sc.legend ? sc.legend.filter(function (l) { return l.t; }).map(function (l) { return '<li>' + e(l.t) + (l.lo ? ' (' + e(l.lo) + ' to ' + e(l.hi) + ')' : '') + '</li>'; }).join('') : '';
  var states = S.graph.states ? S.graph.states.names : [];
  var edges = S.graph.edges.filter(function (x) { return x.vals; }).map(function (x) { var v = x.vals.filter(function (q) { return q !== null; }); return { e: x, span: v.length ? Math.max.apply(null, v) - Math.min.apply(null, v) : 0 }; }).sort(function (a, b) { return b.span - a.span; }).slice(0, 12);
  if (edges.length) rows.push('<h2>Biggest changes</h2><table><thead><tr><th>Link</th>' + states.map(function (s) { return '<th>' + e(s) + '</th>'; }).join('') + '</tr></thead><tbody>' + edges.map(function (x) { return '<tr><td>' + e(labelOf(x.e.from) + ' → ' + labelOf(x.e.to)) + '</td>' + x.e.vals.map(function (v) { return '<td>' + (v === null ? '–' : e(NFMColumns.fmt(v))) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>');
  var css = 'body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;color:#1d2330;background:#fff}h1{margin:.2em 0;text-wrap:balance}h2{margin-top:1.6em;font-size:1.1em;text-wrap:balance}img{max-width:100%;height:auto;border:1px solid #d9dbe3;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #e5e7ee;padding:5px 8px;text-align:left}td:not(:first-child),th:not(:first-child){text-align:right}footer{margin-top:2em;color:#6a7183;font-size:13px}@media(prefers-color-scheme:dark){body{background:#12151c;color:#e8eaf0}img{border-color:#2b3140}th,td{border-color:#2b3140}footer{color:#9aa1b3}}';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e(name) + '</title><style>' + css + '</style></head><body>\n<h1>' + e(name) + '</h1>\n<p>' + e(plural(S.graph.nodes.length, word('item')) + ' and ' + plural(S.graph.edges.length, word('link')) + (states.length ? ', shown over ' + states.join(', ') : '') + '.') + '</p>\n' + (res.video ? '<video controls loop muted autoplay playsinline aria-label="' : '<img alt="') + e('Animated map of ' + name + (states.length ? ' over ' + states.join(', ') : '')) + '" src="data:' + (res.video ? 'video/' + res.video : 'image/gif') + ';base64,' + b64(res.bytes) + '" width="' + res.w + '" height="' + res.h + '">' + (res.video ? '</video>' : '') + '\n' + (legend ? '<h2>Key</h2><ul>' + legend + '</ul>' : '') + (states.length ? '<h2>States</h2><ol>' + states.map(function (s) { return '<li>' + e(s) + '</li>'; }).join('') + '</ol>' : '') + rows.join('') + '\n<footer>Made with Netflow Map, forged by LFC Foundry, version ' + e(APP_VERSION) + '. Nothing was uploaded; everything was made in the browser.</footer>\n</body></html>\n';
}
function gifCard() {
  var mode = gifMode(), o = GX.opts, fx = NFMGifFx, card = h('div', { class: 'card', id: 'gif-card' }, [h('h2', null, 'Animation (GIF)')]);
  if (!mode) { card.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, 'Two kinds of animation are possible. If your data has states (baseline, year 1 and so on; set them up in the Data tab), this makes a GIF that plays through them. If you pick a 3D arrangement on the Map, it makes a turn-around GIF.')); return card; }
  var needMap = !S.L; if (needMap) { card.appendChild(h('p', { class: 'muted small' }, 'Open the Map tab once first.')); return card; }
  var chg = function (k, conv) { return function (v) { o[k] = conv ? conv(v) : v; saveGx(); if (k === 'small' || k === 'format' || k === 'size' || k === 'shape' || k === 'ease' || k === 'reverse' || k === 'arc' || k === 'pause' || k === 'turns' || k === 'turnSec' || k === 'fps' || k === 'trans' || k === 'hold') updateEstimate(); }; };
  /* How many pictures, and about how big, before the person waits: the sizes per picture were measured on a busy 30,000-item map (the most a GIF of a map tends to take); a simple map is much smaller. */
  var estEl = h('p', { class: 'muted small', id: 'gif-est', 'aria-live': 'polite', style: { margin: '2px 0 6px' } });
  var updateEstimate = function () {
    var n = 0; if (mode === 'spin') { try { n = gifPlan(o, null).length; } catch (e) { n = 0; } } if (!n) { estEl.textContent = ''; return; }
    var wh = gifSize(o, 16, 9), px = wh[0] * wh[1], g = { best: 0.13, small: 0.10, smallest: 0.076 }[o.small] || 0.1, v = { best: 0.025, small: 0.0125, smallest: 0.0062 }[o.small] || 0.0125, mb = function (b) { return b < 1048576 * 0.95 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; };
    estEl.textContent = n + ' pictures, ' + (n / o.fps).toFixed(1) + ' seconds. On a busy map, up to about ' + mb(n * px * g) + ' as a GIF or ' + mb(n * px * v) + ' as video; a simple map takes much less.';
  };
  updateEstimate();
  card.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, mode === 'states' ? 'Plays through all ' + nStates() + ' states with a smooth change between them. Works in PowerPoint, Keynote, Google Slides, email and web pages.' : 'Turns the 3D picture around. Works in PowerPoint, Keynote, Google Slides, email and web pages.'));
  var easeOpts = Object.keys(fx.EASES).map(function (k) { return [k, fx.EASES[k][0]]; });
  card.appendChild(h('div', { class: 'maprow' }, [
    field('Width (pixels)', select([[640, '640 (small file)'], [960, '960 (slides)'], [1280, '1280 (sharp)']], o.size, chg('size', Number))),
    field('Shape', select([['169', 'Slide (16:9)'], ['43', 'Slide (4:3)'], ['sq', 'Square'], ['fit', 'Fit the map']], o.shape, chg('shape'))),
    field('What to show', select([['whole', 'The whole map'], ['screen', 'What I see now (zoomed)']], o.what, chg('what'))),
    field('Background', select([['light', 'Light (best for slides)'], ['dark', 'Dark'], ['app', 'Same as the map on screen (with my colors)']], o.theme, chg('theme'))),
    field('File type', select([['gif', 'GIF (plays everywhere, larger)'], ['video', 'Video (MP4, or WebM where MP4 is not available; much smaller)']], o.format, chg('format')), 'If this browser cannot make video, a GIF is made instead and the result says so.'),
    field('File size', select(Object.keys(fx.SIZES).map(function (k) { return [k, fx.SIZES[k][0]]; }), o.small, chg('small')), 'Fewer colors and ignoring tiny color changes make the file smaller. Big, busy maps gain the most.'),
    field('Smoothness', select([[6, 'Light (6 FPS)'], [10, 'Normal (10 FPS)'], [15, 'Smooth (15 FPS)'], [25, 'Very smooth (25 FPS)']], o.fps, chg('fps', Number)), o.fps >= 25 ? 'Each picture is shown for exactly 0.04 seconds. Files get bigger.' : ''), estEl]));
  if (mode === 'states') {
    card.appendChild(acc('Timing', [h('div', { class: 'maprow' }, [
      field('Seconds on each state', select([[0.6, '0.6'], [1, '1'], [1.4, '1.4'], [2, '2'], [3, '3'], [5, '5']], o.hold, chg('hold', Number))),
      field('Seconds of change between states', select([[0, 'None (cut)'], [0.5, '0.5'], [0.9, '0.9'], [1.5, '1.5'], [2.5, '2.5']], o.trans, chg('trans', Number))),
      field('How the change moves', select(easeOpts, o.ease, chg('ease')))])], true));
  } else {
    card.appendChild(acc('Turning', [h('div', { class: 'maprow' }, [
      field('Turns', select([1, 2, 3, 4, 6, 8].map(function (n) { return [n, String(n)]; }), o.turns, chg('turns', Number))),
      field('Seconds per turn', select([2, 3, 4, 6, 8, 12].map(function (n) { return [n, String(n)]; }), o.turnSec, chg('turnSec', Number))),
      field('How far each turn goes', select([[360, 'All the way around'], [180, 'Half way (180°)'], [90, 'A quarter (90°)'], [45, 'A small swing (45°)']], o.arc, function (v) { o.arc = +v; saveGx(); renderExport(); }), o.arc < 360 ? 'A short turn swings back and forth, so the loop has no jump.' : ''),
      field('Pause between turns (seconds)', select([[0, 'None'], [0.5, '0.5'], [1, '1'], [2, '2'], [3, '3'], [5, '5']], o.pause, chg('pause', Number))),
      field('How each turn moves', select(easeOpts, o.ease, chg('ease')), 'With no pause, Steady keeps the turning even.')]),
      check('Turn the other way after each pause', o.reverse || o.arc < 360, function (v) { o.reverse = v; saveGx(); renderExport(); }, { disabled: o.arc < 360 }),
      o.reverse || o.arc < 360 ? h('p', { class: 'muted small', style: { margin: 0 } }, 'Every pause turns the spin around, including the pause where the animation starts over, so the number of turns is rounded up to an even number' + (o.turns % 2 ? ' (' + o.turns + ' becomes ' + (o.turns + 1) + ').' : '.')) : null], true));
  }
  card.appendChild(acc('Names on the map', [field('When names show', select(Object.keys(fx.NAMES).map(function (k) { return [k, fx.NAMES[k]]; }), o.names, chg('names')), mode === 'states' ? '"Only when it holds still" and "When it slows down" fade names out while the map changes.' : 'With pauses, "Only when it holds still" fades names in at each pause and out when turning starts.')]));
  var F = o.filter, fset = function (k, v) { F[k] = v; saveGx(); };
  var sl = function (label, k, lo, hi, st, fmt) { return slider(label, F[k], lo, hi, st, function (v) { fset(k, v); }, fmt || function (v) { return v > 0 ? '+' + Math.round(v * 100) : Math.round(v * 100) + ''; }); };
  var pct = function (v) { return Math.round(v * 100) + '%'; };
  var prev = h('div', { id: 'gif-prev' }, GX.preview ? [h('img', { src: GX.preview, alt: 'One picture with the look applied', style: { maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--line)' } })] : []);
  card.appendChild(acc('Look of the animation (filters)', [
    field('Ready-made', select([['', 'Choose…']].concat(fx.FILTER_PRESETS.map(function (p, i) { return [String(i), p[0]]; })), '', function (v) { if (v === '') return; o.filter = fx.cleanFilter(fx.FILTER_PRESETS[+v][1]); saveGx(); renderExport(); })),
    sl('Brightness', 'brightness', -1, 1, 0.05), sl('Contrast', 'contrast', -1, 1, 0.05), sl('Color strength', 'saturation', -1, 1, 0.05), sl('Warm / cool', 'warmth', -1, 1, 0.05),
    slider('Shift colors (degrees)', F.hue, -180, 180, 5, function (v) { fset('hue', v); }, function (v) { return v + '°'; }),
    field('Color tone', select(Object.keys(fx.TONES).map(function (k) { return [k, fx.TONES[k]]; }), F.tone, function (v) { fset('tone', v); })),
    slider('Soften (blur)', F.blur, 0, 6, 0.5, function (v) { fset('blur', v); }, function (v) { return v ? v : 'off'; }),
    slider('Sharpen', F.sharpen, 0, 1, 0.05, function (v) { fset('sharpen', v); }, function (v) { return v ? pct(v) : 'off'; }),
    slider('Glow', F.glow, 0, 1, 0.05, function (v) { fset('glow', v); }, function (v) { return v ? pct(v) : 'off'; }),
    slider('Darker corners (vignette)', F.vignette, 0, 1, 0.05, function (v) { fset('vignette', v); }, function (v) { return v ? pct(v) : 'off'; }),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Glow, blur and darker corners add many shades, so the file gets bigger.'),
    field('Graphics card', select([['auto', 'Use it when it works (faster)'], ['off', 'Do not use it']], o.card, chg('card')), 'The card does the same arithmetic as the processor, so a picture may differ by a color shade or two between computers.'),
    h('div', { class: 'row tight' }, [h('button', { class: 'sm', id: 'gif-try', onclick: tryLook }, 'Try it on one picture'), h('button', { class: 'sm', onclick: function () { o.filter = fx.plainFilter(); saveGx(); renderExport(); } }, 'Reset the look')]), prev], false));
  card.appendChild(h('div', { class: 'maprow' }, [
    field('Legend', select([['short', 'Short (top groups, then "+ N more")'], ['full', 'Full (every group listed)'], ['off', 'Off']], o.legend, chg('legend')), 'A map with many groups gets a long legend; Short keeps it small and readable.'),
    field('Where the legend goes', select([['bl', 'Bottom left'], ['br', 'Bottom right'], ['tl', 'Top left'], ['tr', 'Top right']], o.keyPos, chg('keyPos')))]));
  if (mode === 'states') card.appendChild(h('div', { class: 'row' }, [check('Show the state name', o.caption, chg('caption'))]));
  var prog = h('div', { id: 'gif-prog', 'aria-live': 'polite' });
  var go = h('button', { class: 'primary', id: 'gif-go', onclick: runGif, disabled: GX.running }, GX.result ? 'Make it again' : 'Make the GIF'), cancel = h('button', { id: 'gif-cancel', hidden: !GX.running, onclick: function () { GX.cancel = true; } }, 'Cancel');
  card.appendChild(h('div', { class: 'row' }, [go, cancel]));
  card.appendChild(prog);
  card.appendChild(h('div', { id: 'gif-out' }, gifResultKids()));
  return card;
}
/** One picture with the look applied, so the person can judge it before waiting for the whole animation. */
function tryLook() {
  if (GX.running) return; var btn = $('gif-try'); if (btn) btn.disabled = true;
  ensureMap().then(function () { return makeGif(Object.assign({}, GX.opts, { preview: true }), function () { }, function () { return false; }); }).then(function (r) { GX.preview = r.png; var b = $('gif-prev'); if (b) mount(b, h('img', { src: r.png, alt: 'One picture with the look applied', style: { maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--line)' } })); }).catch(function (e) { toast('Could not make the preview: ' + e.message); }).then(function () { var b = $('gif-try'); if (b) b.disabled = false; });
}
function gifResultKids() {
  if (GX.msg && !GX.running) return [h('p', { class: 'muted' }, GX.msg)];
  var r = GX.result; if (!r) return [];
  var vid = r.video, mime = vid === 'mp4' ? 'video/mp4' : vid === 'webm' ? 'video/webm' : 'image/gif', ext = vid ? '.' + vid : '.gif';
  var kb = Math.round(r.bytes.length / 1024), size = kb > 1500 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
  return [h('p', { class: 'muted small', style: { margin: '6px 0 2px' } }, plural(r.frames, 'picture') + ', ' + r.w + ' × ' + r.h + ', ' + size + ', made in ' + (r.ms / 1000).toFixed(1) + ' seconds.' + (r.card ? ' The looks were done by the graphics card.' : '') + (vid ? ' ' + vid.toUpperCase() + ' video.' : r.asked === 'video' ? ' This browser cannot make video, so this is a GIF.' : '') + (kb > 8000 ? ' That is large for a slide. Try a smaller width or a lower FPS.' : '')),
    vid ? h('video', { src: r.url, poster: r.poster, controls: true, loop: true, muted: true, playsinline: true, preload: 'metadata', 'aria-label': 'Preview of the animation', style: { maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--line)' } }) : h('img', { src: r.url, alt: 'Preview of the animation', style: { maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--line)' } }),
    h('div', { class: 'row' }, [h('button', { class: 'primary', onclick: function () { download(fname(ext), new Blob([r.bytes], { type: mime }), mime); } }, vid ? 'Save the video' : 'Save the GIF'), h('button', { onclick: function () { download(fname('-report.html'), reportHtml(r), 'text/html'); } }, 'Save as a web page (HTML report)')])];
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
    res.url = URL.createObjectURL(new Blob([res.bytes], { type: res.video === 'mp4' ? 'video/mp4' : res.video === 'webm' ? 'video/webm' : 'image/gif' })); GX.result = res;
  }).catch(function (err) { GX.msg = err.message === 'cancelled' ? 'Canceled.' : err.message === 'changed' ? 'The data changed while the GIF was being made, so it was dropped. Make it again.' : err.message === 'superseded' ? 'The settings changed while working. Try again.' : 'The GIF could not be made: ' + err.message; }).then(function () {
    GX.running = false; if (S.tab === 'export') renderExport();
  });
}
