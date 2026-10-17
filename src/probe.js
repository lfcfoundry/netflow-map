/*!
 * Net Flow Map capability check. canary(): a quick real test of each drawing path (never "does the browser say it can").
 * check(): the one-button device check with plain-words answers. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMProbe = (function () {
  'use strict';
  var SOFT = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen|cpu/i;
  function withTimeout(p, ms, what) {
    return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error(what + ' took too long')); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); });
  }
  function nextRefresh() {
    /* false only when the page is really hidden (or nothing came for 10 s): a slow picture on a visible page is waited for, not mistaken for a background tab */
    return new Promise(function (res) {
      var done = false, t0 = nowMs(), t = 0;
      var tick = function () { if (done) return; var hid = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden'); if (hid || nowMs() - t0 > 10000) { done = true; res(false); } else t = setTimeout(tick, 500); };
      t = setTimeout(tick, 1000);
      requestAnimationFrame(function () { if (!done) { done = true; clearTimeout(t); res(true); } });
    });
  }
  function nowMs() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  /** What a one-picture-per-refresh loop waits on after draw(): WebGPU lets up to three pictures be in flight (pace); the others have only flush(). */
  function wait(r) { return r.pace ? r.pace(3) : Promise.resolve(); }   /* WebGL 2 is not waited for after a picture: the app does not either (a wait there forces the card to finish each picture alone) */

  function testCanvas2D() {
    try {
      var c = document.createElement('canvas'); c.width = 8; c.height = 8;
      var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = 'rgb(10,200,30)'; x.fillRect(0, 0, 8, 8);
      var d = x.getImageData(2, 2, 1, 1).data;
      var ok = Math.abs(d[0] - 10) < 3 && Math.abs(d[1] - 200) < 3 && Math.abs(d[2] - 30) < 3;
      return { ok: ok, why: ok ? '' : 'the browser changes canvas pixels (privacy protection), so drawings may look slightly off' };
    } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
  }
  function testWebGL2() {
    try {
      var c = document.createElement('canvas'); c.width = 4; c.height = 4;
      var gl = c.getContext('webgl2', { alpha: false, antialias: false, failIfMajorPerformanceCaveat: false });
      if (!gl) return { ok: false, why: 'WebGL 2 is not available' };
      var mk = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      var p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 c=vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*4.-1.;gl_Position=vec4(c,0.,1.);}'));
      gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(1.,.5,0.,1.);}'));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      gl.useProgram(p); gl.viewport(0, 0, 4, 4); gl.drawArrays(gl.TRIANGLES, 0, 3);
      var px = new Uint8Array(4); gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var dev = ''; try { var e = gl.getExtension('WEBGL_debug_renderer_info'); if (e) dev = String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL) || ''); } catch (x) { /* hidden */ }
      var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      var ok = px[0] > 250 && Math.abs(px[1] - 128) < 4 && px[2] < 4;
      return { ok: ok, why: ok ? '' : 'a test drawing came back with the wrong colors', software: SOFT.test(dev), device: dev };
    } catch (err) { return { ok: false, why: String(err && err.message || err) }; }
  }
  function testWebGPU() {
    if (typeof navigator === 'undefined' || !navigator.gpu) return Promise.resolve({ ok: false, why: 'WebGPU is not available in this browser' });
    var dev = null;
    return withTimeout(navigator.gpu.requestAdapter(), 4000, 'asking for a graphics adapter').then(function (adapter) {
      if (!adapter) throw new Error('no graphics adapter');
      var info = adapter.info || {}, name = [info.vendor, info.architecture, info.description].filter(Boolean).join(' ');
      var soft = !!adapter.isFallbackAdapter || SOFT.test(name);
      return withTimeout(adapter.requestDevice(), 4000, 'opening the graphics device').then(function (device) {
        dev = device;
        var buf = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        var rb = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        var mod = device.createShaderModule({ code: '@group(0) @binding(0) var<storage, read_write> o: array<u32>;\n@compute @workgroup_size(1) fn main() { o[0] = 1234u; o[1] = o[0] * 2u; }' });
        var pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
        var bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] });
        var enc = device.createCommandEncoder(), pass = enc.beginComputePass();
        pass.setPipeline(pipe); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(1); pass.end();
        enc.copyBufferToBuffer(buf, 0, rb, 0, 16); device.queue.submit([enc.finish()]);
        return withTimeout(rb.mapAsync(GPUMapMode.READ), 4000, 'reading the test answer back').then(function () {
          var v = new Uint32Array(rb.getMappedRange().slice(0)); rb.unmap();
          var ok = v[0] === 1234 && v[1] === 2468;
          return { ok: ok, why: ok ? '' : 'the test calculation came back wrong', software: soft, device: name };
        });
      });
    }).catch(function (err) { return { ok: false, why: String(err && err.message || err) }; }).then(function (r) { try { if (dev) dev.destroy(); } catch (e) { /* done */ } return r; });
  }
  function testWorker() {
    return new Promise(function (resolve) {
      try {
        var url = URL.createObjectURL(new Blob(['self.onmessage=function(e){self.postMessage(e.data*2)}'], { type: 'text/javascript' })), w = new Worker(url);
        URL.revokeObjectURL(url);
        var t = setTimeout(function () { w.terminate(); resolve({ ok: false, why: 'the helper did not answer' }); }, 2500);
        w.onmessage = function (e) { clearTimeout(t); w.terminate(); resolve({ ok: e.data === 42, why: e.data === 42 ? '' : 'the helper answered wrongly' }); };
        w.onerror = function (e) { clearTimeout(t); resolve({ ok: false, why: 'helpers are blocked here' }); };
        w.postMessage(21);
      } catch (err) { resolve({ ok: false, why: String(err && err.message || err) }); }
    });
  }
  /** Quick, silent. Resolves to { canvas2d, webgl2, webgpu, worker }, each { ok, why, software, device }. */
  function canary() {
    return Promise.all([testWebGPU(), testWorker()]).then(function (r) {
      return { canvas2d: testCanvas2D(), webgl2: testWebGL2(), webgpu: r[0], worker: r[1] };
    });
  }

  /* ---------------------------------------------------------------- the one-button check */
  function diff(a, b) {
    var n = Math.min(a.data.length, b.data.length), sum = 0, bad = 0, px = 0;
    for (var i = 0; i < n; i += 4) {
      var d = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
      sum += d; px++; if (d > 40) bad++;
    }
    return { mean: sum / Math.max(1, px), badShare: bad / Math.max(1, px) };
  }
  function fitView(S, w, h) {
    var k = Math.min(w / S.w, h / S.h) * 0.96;
    return { k: k, tx: (w - S.w * k) / 2 - S.x0 * k, ty: (h - S.h * k) / 2 - S.y0 * k };
  }
  /** The page the test draws on. Normally it sits almost invisible in the corner of the window; when the tester hands over a box (opts.live) it sits scaled down inside that box, so the person can watch the map being turned while it is timed. */
  function mkHost(W, H, opts) {
    var host = document.createElement('div');
    if (opts && opts.live) { var sc = (opts.live.clientWidth || 360) / W; host.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;transform-origin:0 0;transform:scale(' + sc + ');pointer-events:none'; opts.live.style.height = Math.ceil(H * sc) + 'px'; opts.live.appendChild(host); }
    else { host.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;opacity:.01;pointer-events:none;z-index:-1'; document.body.appendChild(host); }
    return host;
  }
  /**
   * Speed of turning a 3D map: one picture per screen refresh, each from a new angle and zoom, for about 1.3 seconds.
   * opts: { backend: 'webgpu'|'webgl2'|'canvas2d', makeScene(yaw, pitch) -> scene (built the way the page builds it for a new angle), W, H, ms }
   * Resolves to { backend, fps, sceneMs, drawMs, uploadMs, frames } (sceneMs: working out the new picture; drawMs: handing it to the screen, which includes uploadMs, the copy into graphics memory; all per picture), or { backend, skipped }.
   * The loop does not wait for the graphics card after every picture (see wait()), only when more than three pictures are still being worked on.
   */
  function turning(opts) {
    var W = opts.W || 900, H = opts.H || 600, n = opts.backend, host = mkHost(W, H, opts);
    var make = n === 'webgpu' ? NFMRender.createWebGPU : n === 'webgl2' ? NFMRender.createWebGL2 : NFMRender.createCanvas2D;
    var gone = function (res) { try { host.remove(); } catch (e) { /* none */ } return res; };
    return withTimeout(make(host, {}), 6000, 'starting ' + n).then(function (r) {
      r.resize(W, H, 1);
      var frames = 0, counted = 0, t1 = 0, start = nowMs(), sceneT = 0, drawT = 0, upT = 0, hidden = false, budget = opts.ms || 1300, rigSc = null, preMs = 0;
      /* opts.rigScene(yaw, pitch): the map is put on the card once and each picture is only a new angle (what the app does for a big 3D map) */
      var ready = opts.rigScene ? new Promise(function (ok) {
        if (!r.rigPrepare) { ok('this way of drawing cannot turn a map on the card'); return; }
        var sc0 = opts.rigScene(0.6, 0.35); r.setScene(sc0); r.rigPrepare();
        if (!sc0.turnTo) { ok('this map cannot be turned on the card (too few links, or arrows, dashes or bends)'); return; }
        var tries = 0, poll = function () { if (r.rigOK) { rigSc = sc0; ok(null); } else if (++tries > 40) ok('the card could not set up turning'); else setTimeout(poll, 25); }; poll();
      }) : Promise.resolve(null);
      var loop = function () {
        var f = frames / 90, yaw = 0.6 + 6.2832 * f, pitch = 0.35 + 0.3 * Math.sin(6.2832 * f), z = opts.zoomSweep ? Math.pow(16, 0.5 * Math.sin(6.2832 * frames / 60)) : 1 + 0.35 * Math.sin(6.2832 * f * 0.5);
        var a = nowMs(), sc, b;
        if (rigSc) { sc = rigSc; sc.turnTo({ yaw: yaw, pitch: pitch, persp: 2.4 }, 4); b = nowMs(); } else { sc = opts.makeScene(yaw, pitch); b = nowMs(); r.setScene(sc); }
        var u = nowMs(); var v = fitView(sc, W, H); v.k *= z; v.tx = W / 2 - (W / 2 - v.tx) * z; v.ty = H / 2 - (H / 2 - v.ty) * z; r.draw(v);
        var c = nowMs(); frames++;
        if (frames > 3) { sceneT += b - a; drawT += c - b; upT += u - b; }
        return wait(r).then(function () { return nextRefresh(); }).then(function (ok) {
          if (!ok) { hidden = true; return; }
          if (frames === 3) t1 = nowMs(); else if (frames > 3) counted++;
          if (nowMs() - start < budget && frames < 600) return loop();
        });
      };
      return ready.then(function (why) {
        if (why) { r.destroy(); return gone({ backend: n, skipped: why }); }
        var warm = async function () {   /* the first pictures of a big map on the card pay for the one-time upload; they are timed apart so they do not read as slow turning */
          var pre0 = nowMs(); if (r.rigWarm) { r.rigWarm(); try { await r.flush(); } catch (e) { /* none */ } } preMs = nowMs() - pre0;   /* the app does this a moment after a map appears: the pre-load */
          var w0 = nowMs();
          for (var wi = 0; wi < 24; wi++) { rigSc.turnTo({ yaw: 0.6 + 0.07 * wi, pitch: 0.35, persp: 2.4 }, 4); var wv = fitView(rigSc, W, H); r.draw(wv); await wait(r); if (!(await nextRefresh())) return -1; }
          return nowMs() - w0;
        };
        return (rigSc ? warm() : Promise.resolve(0)).then(function (warmMs) {
        if (warmMs < 0) { r.destroy(); return gone({ backend: n, skipped: 'the page was in the background' }); }
        if (warmMs > 1500) budget = Math.max(budget, 3000);   /* a slow stand-in needs longer to show enough pictures */
        start = nowMs();   /* the time budget counts from here: building a big map for the card can take longer than the whole budget */
        return loop().then(function () {
          var secs = Math.max(0.05, (nowMs() - t1) / 1000); r.destroy();
          return gone(hidden ? { backend: n, skipped: 'the page was in the background' } : counted < 4 ? { backend: n, skipped: 'too few pictures could be drawn to time them' } : { backend: n, fps: counted / secs, sceneMs: sceneT / counted, drawMs: drawT / counted, uploadMs: upT / counted, frames: counted, onCard: !!rigSc, warmMs: warmMs, preloadMs: preMs });
        });
        });
      });
    }).catch(function (err) { return gone({ backend: n, skipped: String(err && err.message || err) }); });
  }
  /**
   * Splits the time of turning a big map on the card into its parts: the diagnostic behind the tester's "where the time goes at the largest size".
   * opts: { backend: 'webgpu'|'webgl2', rigScene(yaw, pitch) -> scene (as for turning), W, H }
   * Ways with a screen refresh per picture (fps and the spread of picture times): full (angle math + drawing, as the app does it), angle (angle math only, nothing drawn),
   * still (drawing only, the same angle each time). Ways that only time the card (each picture waited for, no refresh): g_all, g_links, g_items, g_names, g_half.
   * Resolves to { backend, n, ways: [{ id, label, fps, gapMed, gapP95, gapMax, slow, angleMed, angleMax, drawMed, ms }] } or { backend, skipped }.
   */
  var SPLIT = [
    ['full', 'Everything, the way the app turns it', { turn: 1, draw: 1, sync: 1 }],
    ['angle', 'Angle math only (nothing drawn)', { turn: 1, sync: 1 }],
    ['still', 'Drawing only (the same angle every time)', { draw: 1, sync: 1 }],
    ['keep', 'Angle math and drawing, paint order not re-sent (wrong order; timing only)', { turn: 1, draw: 1, sync: 1, dbg: { keepOrder: true } }],
    ['tex', 'Everything, with the paint order sent through a texture (WebGL 2 only)', { turn: 1, draw: 1, sync: 1, dbg: { orderVia: 'texture' }, glOnly: 1 }],
    ['ring', 'Everything, with the paint order sent to a ring of three card buffers (WebGPU only)', { turn: 1, draw: 1, sync: 1, dbg: { orderVia: 'ring' }, gpuOnly: 1 }],
    ['map', 'Everything, with the paint order written straight into staging buffers (WebGPU only)', { turn: 1, draw: 1, sync: 1, dbg: { orderVia: 'map' }, gpuOnly: 1 }],
    ['g_all', 'Card time per picture: everything', { draw: 1, fence: 1 }],
    ['g_links', 'Card time per picture: links only', { draw: 1, fence: 1, dbg: { noItems: true, noNames: true } }],
    ['g_items', 'Card time per picture: items only', { draw: 1, fence: 1, dbg: { noLinks: true, noNames: true } }],
    ['g_names', 'Card time per picture: names only (the text)', { draw: 1, fence: 1, dbg: { noLinks: true, noItems: true } }],
    ['g_half', 'Card time per picture: everything at half size', { draw: 1, fence: 1, half: 1 }]
  ];
  function pct(a, p) { if (!a.length) return 0; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; }
  function turnSplit(opts) {
    var W = opts.W || 900, H = opts.H || 600, n = opts.backend, host = mkHost(W, H, opts);
    var make = n === 'webgpu' ? NFMRender.createWebGPU : NFMRender.createWebGL2;
    var gone = function (res) { try { host.remove(); } catch (e) { /* none */ } return res; };
    return withTimeout(make(host, {}), 6000, 'starting ' + n).then(function (r) {
      r.resize(W, H, 1);
      if (!r.rigPrepare) { r.destroy(); return gone({ backend: n, skipped: 'this way of drawing cannot turn a map on the card' }); }
      var sc = opts.rigScene(0.6, 0.35); r.setScene(sc); r.rigPrepare();
      if (!sc.turnTo) { r.destroy(); return gone({ backend: n, skipped: 'this map cannot be turned on the card' }); }
      var cam = function (i) { var f = i / 90; return { yaw: 0.6 + 6.2832 * f, pitch: 0.35 + 0.3 * Math.sin(6.2832 * f), persp: 2.4 }; };
      var view = function (i, w, h) { var z = 1 + 0.35 * Math.sin(6.2832 * i / 180), v = fitView(sc, w, h); v.k *= z; v.tx = w / 2 - (w / 2 - v.tx) * z; v.ty = h / 2 - (h / 2 - v.ty) * z; return v; };
      var runWay = async function (cfg) {
        r.rigDebug = cfg.dbg || null;
        var w = cfg.half ? Math.round(W / 2) : W, h = cfg.half ? Math.round(H / 2) : H; r.resize(w, h, 1);
        var gaps = [], angles = [], draws = [], last = 0, want = 100, hidden = false;
        sc.turnTo(cam(0), 4);
        if (cfg.fence) {
          /* the card's time per picture, from two batch sizes: a batch of 20 and a batch of 120 pictures, each sent back to back and waited for once. The difference divided by 100 leaves out
             every fixed wait (about 100 ms for WebGPU's "done" signal, the screen refresh for others), which a single small batch cannot do. */
          var timeOf = async function (K) { var s0 = nowMs(); for (var j = 0; j < K; j++) r.draw(view(j, w, h)); await r.flush(); return nowMs() - s0; };
          await timeOf(4);
          var t1 = await timeOf(20), t2 = t1 > 4000 ? t1 * 6 : await timeOf(120);
          r.rigDebug = null;
          return { ms: Math.max(0, (t2 - t1) / 100), msMax: Math.max(0, (t2 - t1) / 100) };
        }
        if (cfg.dbg && cfg.draw) { for (var wi = 0; wi < 6; wi++) { if (cfg.turn) sc.turnTo(cam(wi), 4); r.draw(view(wi, w, h)); await wait(r); await nextRefresh(); } }   /* a way's own buffers are made on its first pictures: not timed */
        for (var i = 0; i < want + 3; i++) {
          var a = nowMs(); if (cfg.turn) sc.turnTo(cam(i), 4); var b = nowMs();
          if (cfg.draw) r.draw(view(i, w, h)); var c = nowMs();
          if (cfg.draw) await wait(r);
          var ok = await nextRefresh(), t = nowMs(); if (!ok) { hidden = true; break; }
          if (i >= 3) { if (last) gaps.push(t - last); angles.push(b - a); draws.push(c - b); } last = t;
        }
        r.rigDebug = null; if (hidden) return null;
        var sum = function (x) { var q = 0; for (var k = 0; k < x.length; k++) q += x[k]; return q; };
        return { fps: gaps.length ? 1000 * gaps.length / sum(gaps) : 0, gapMed: pct(gaps, 0.5), gapP95: pct(gaps, 0.95), gapMax: pct(gaps, 1), slow: gaps.filter(function (g) { return g > 20; }).length / Math.max(1, gaps.length), angleMed: pct(angles, 0.5), angleMax: pct(angles, 1), drawMed: pct(draws, 0.5) };
      };
      return (async function () {
        var ready = false; for (var k = 0; k < 40 && !ready; k++) { if (r.rigOK) ready = true; else await new Promise(function (ok) { setTimeout(ok, 25); }); }
        if (!ready) { r.destroy(); return gone({ backend: n, skipped: 'the card could not set up turning' }); }
        await runWay({ turn: 1, draw: 1, sync: 1 });   /* warm-up, not reported */
        var ways = [];
        for (var q = 0; q < SPLIT.length; q++) {
          if ((SPLIT[q][2].glOnly && n === 'webgpu') || (SPLIT[q][2].gpuOnly && n !== 'webgpu')) continue;
          var res = await runWay(SPLIT[q][2]);
          if (!res) { r.destroy(); return gone({ backend: n, skipped: 'the page was in the background' }); }
          res.id = SPLIT[q][0]; res.label = SPLIT[q][1]; ways.push(res);
        }
        /* a laptop has its own pauses from run to run, so the ways that differ only in how the order is sent are run three times in turn and the middle run is reported */
        var REP = ['full', 'keep', 'tex', 'ring', 'map'], rounds = {};
        ways.forEach(function (w) { if (REP.indexOf(w.id) >= 0) rounds[w.id] = [w]; });
        for (var rd = 0; rd < 2; rd++) {
          for (var q2 = 0; q2 < SPLIT.length; q2++) {
            var id = SPLIT[q2][0]; if (!rounds[id]) continue;
            var again = await runWay(SPLIT[q2][2]);
            if (!again) { r.destroy(); return gone({ backend: n, skipped: 'the page was in the background' }); }
            again.id = id; again.label = SPLIT[q2][1]; rounds[id].push(again);
          }
        }
        ways = ways.map(function (w) {
          var all = rounds[w.id]; if (!all) return w;
          var fpsAll = all.map(function (x) { return x.fps; }), sorted = all.slice().sort(function (x, y) { return x.fps - y.fps; }), mid = sorted[Math.floor(sorted.length / 2)];
          mid.fpsAll = fpsAll; mid.worstMax = pct(all.map(function (x) { return x.gapMax; }), 1); return mid;
        });
        r.destroy(); return gone({ backend: n, ways: ways });
      })();
    }).catch(function (err) { return gone({ backend: n, skipped: String(err && err.message || err) }); });
  }
  /**
   * Turns turnSplit results into plain words: { level, say, lines, cause } (cause: 'smooth' | 'angle' | 'card' | 'hiccups' | 'unclear' | null).
   */
  function explainSplit(res, items) {
    var runsOf = function (w) { return w && w.fpsAll && w.fpsAll.length > 1 ? ' (three runs: ' + w.fpsAll.map(function (x) { return Math.round(x); }).join(', ') + ')' : ''; };
    var lines = [], f0 = function (v) { return String(Math.round(v)); }, ms1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
    var nm = res && res.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2', big = items ? items.toLocaleString() + '-item' : 'largest';
    if (!res || res.skipped || !res.ways) return { level: 'warn', say: nm + ' was skipped: ' + ((res && res.skipped) || 'not usable here') + '.', lines: lines, cause: null };
    var by = {}; res.ways.forEach(function (w) { by[w.id] = w; });
    var keep = by.keep, full = by.full, angle = by.angle, still = by.still, all = by.g_all, links = by.g_links, itemsW = by.g_items, names = by.g_names, half = by.g_half;
    lines.push('Turning as the app does it: ' + f0(full.fps) + ' FPS' + runsOf(full) + '; a picture took ' + ms1(full.gapMed) + ' ms in the middle, ' + ms1(full.gapP95) + ' ms for the slower 1 in 20, ' + ms1(full.gapMax) + ' ms for the slowest' + (full.slow > 0 ? ' (' + Math.round(full.slow * 100) + '% took over 20 ms)' : '') + '.');
    lines.push('Angle math alone: ' + ms1(angle.angleMed) + ' ms of work per angle (slowest ' + ms1(angle.angleMax) + ' ms); with nothing drawn the screen refresh still ran at ' + f0(angle.fps) + ' FPS.');
    lines.push('Drawing alone, the same angle each time: ' + f0(still.fps) + ' FPS.');
    if (by.tex) lines.push('Sending the paint order through a texture instead: ' + f0(by.tex.fps) + ' FPS' + runsOf(by.tex) + (by.tex.fps > full.fps + 3 ? ' (faster than the current way, ' + f0(full.fps) + ')' : by.tex.fps < full.fps - 3 ? ' (slower than the current way, ' + f0(full.fps) + ')' : ' (about the same as the way the app uses)') + '.');
    ['ring', 'map'].forEach(function (id) {
      var w = by[id]; if (!w) return;
      lines.push('Sending the paint order ' + (id === 'ring' ? 'to a ring of three card buffers' : 'through staging buffers written directly') + ': ' + f0(w.fps) + ' FPS' + runsOf(w) + ', slowest 1 in 20 ' + ms1(w.gapP95) + ' ms, slowest ' + ms1(w.gapMax) + ' ms' + (w.fps > full.fps + 1 || w.gapP95 + 3 < full.gapP95 ? ' (steadier than the way the app uses)' : w.fps < full.fps - 1 || w.gapP95 > full.gapP95 + 3 ? ' (worse than the way the app uses)' : ' (about the same as the way the app uses)') + '.');
    });
    if (keep) lines.push('Angle math and drawing without re-sending the paint order: ' + f0(keep.fps) + ' FPS.');
    lines.push('Time the card needs per picture: ' + ms1(all.ms) + ' ms for everything; links alone ' + ms1(links.ms) + ' ms; items alone ' + ms1(itemsW.ms) + ' ms; names alone ' + ms1(names.ms) + ' ms; everything at half size ' + ms1(half.ms) + ' ms.');
    var noisyList = [], noisy = false;
    ['full', 'keep', 'ring', 'map', 'tex'].forEach(function (id) { var w = by[id]; if (w && w.fpsAll && w.fpsAll.length > 1 && Math.max.apply(null, w.fpsAll) - Math.min.apply(null, w.fpsAll) > 12) { noisy = true; noisyList.push(id === 'full' ? 'current way ' : id + ' ') ; noisyList[noisyList.length - 1] += w.fpsAll.map(function (x) { return Math.round(x); }).join('/'); } });
    var say = 'Turning the ' + big + ' map with ' + nm + ' ran at ' + f0(full.fps) + ' FPS. ', cause, level;
    if (full.fps >= 58) { cause = 'smooth'; level = 'ok'; say += 'That is a steady 60: nothing to fix.'; }
    else if (noisy) { cause = 'hiccups'; level = full.fps >= 45 ? 'ok' : 'warn'; say += 'The speed changes a lot from run to run (' + noisyList + '), and the ways of sending the paint order do not rank the same way twice, so no single part of our drawing is the cause. These are pauses from the browser or the graphics driver (slowest picture ' + ms1(full.gapMax) + ' ms; our own angle math takes only ' + ms1(angle.angleMed) + ' ms). Drawing with WebGL 2 is usually steadier on such a computer.'; }
    else if (keep && keep.fps >= 57 && (keep.fps >= full.fps + 2 || keep.slow + 0.03 < full.slow || keep.gapP95 + 5 < full.gapP95)) { cause = 'order'; level = full.fps >= 45 ? 'ok' : 'warn'; say += 'The cost is sending each new paint order to the card: with that left out (the picture comes out in the wrong order, for timing only) it ran at ' + f0(keep.fps) + ' FPS' + (full.slow > 0 ? ' with no pauses' : '') + '. The angle math (' + ms1(angle.angleMed) + ' ms) and the card (' + ms1(all.ms) + ' ms) are not the limit.'; }
    else if ((keep ? keep.fps : angle.fps) < 57) { cause = 'angle'; level = full.fps >= 45 ? 'ok' : 'warn'; say += 'The limit is on the main thread: even with the paint order left out, only ' + f0(keep ? keep.fps : angle.fps) + ' FPS got through (' + ms1(angle.angleMed) + ' ms of angle work each).'; }
    else if (keep && keep.fps >= full.fps + 5) { cause = 'order'; level = full.fps >= 45 ? 'ok' : 'warn'; say += 'The cost is sending each new paint order to the card: with that left out (the picture comes out in the wrong order, for timing only) it ran at ' + f0(keep.fps) + ' FPS. The angle math (' + ms1(angle.angleMed) + ' ms) and the card (' + ms1(all.ms) + ' ms) are not the limit.'; }
    else if (all.ms > 14) {
      cause = 'card'; level = full.fps >= 45 ? 'ok' : 'warn';
      var parts = [['the links', links.ms], ['the items', itemsW.ms], ['the names', names.ms]].sort(function (a, b) { return b[1] - a[1]; });
      say += 'The limit is the graphics card: one picture takes it ' + ms1(all.ms) + ' ms, and most of that is ' + parts[0][0] + ' (' + ms1(parts[0][1]) + ' ms). ' + (half.ms < all.ms * 0.65 ? 'A half-size picture is much quicker, so the cost follows the number of pixels.' : 'A half-size picture is not much quicker, so the cost follows the number of links and items, not the pixels.');
    }
    else if (full.gapP95 > 20 || full.slow > 0.04) { cause = 'hiccups'; level = full.fps >= 45 ? 'ok' : 'warn'; say += 'The average work fits easily (angle ' + ms1(angle.angleMed) + ' ms, card ' + ms1(all.ms) + ' ms), but now and then a picture takes much longer (slowest ' + ms1(full.gapMax) + ' ms): that is a pause, usually the browser tidying memory, not steady work.'; }
    else { cause = 'unclear'; level = full.fps >= 45 ? 'ok' : 'warn'; say += 'No single part is the limit: angle math ' + ms1(angle.angleMed) + ' ms and card ' + ms1(all.ms) + ' ms both fit in 16.7 ms on their own. The combination or the browser\'s own step of putting the picture on screen is what costs the rest.'; }
    return { level: level, say: say, lines: lines, cause: cause };
  }
  /**
   * Where the time goes when one picture per screen refresh is drawn: the diagnostic behind the tester's "Where the drawing time goes" step.
   * opts: { backend, makeScene(yaw, pitch) -> scene, W, H, frames (default 60), ms (time cap per way, default 700) }
   * Runs the same turning loop several ways on one renderer and times each phase of every picture:
   *   scene = working out the new angle (main thread), upload = scene copied into graphics memory (setScene), draw = encoding and handing over the commands,
   *   fence = waiting for the card's "done" signal (or for the oldest of three pictures in flight), raf = waiting for the next screen refresh.
   * WebGPU ways: old (new buffers every picture, wait for the card after every picture), reuse (buffers kept, wait every picture), nowait (no wait), every4 (wait every 4th),
   *   pace (up to 3 pictures in flight, what the loops in this file use), blank (nothing drawn, no wait: the cost of just putting a picture on screen), half (half-size picture, no wait).
   * Other backends: wait, nowait, blank.
   * Resolves to { backend, device, software, ways: [{ id, label, fps, frames, scene, upload, draw, fence, raf }] } or { backend, skipped }.
   */
  var WAYS = {
    old: 'Old way: new buffers and a wait for the card after every picture',
    reuse: 'Buffers kept, wait for the card after every picture',
    nowait: 'Buffers kept, never wait for the card',
    every4: 'Buffers kept, wait for the card every 4th picture',
    pace: 'Buffers kept, up to 3 pictures in flight (the new default)',
    blank: 'Blank picture, never wait (cost of the screen step alone)',
    half: 'Half-size picture, never wait',
    wait: 'Wait for the card after every picture',
    cnowait: 'Never wait for the card'
  };
  function frameTiming(opts) {
    var W = opts.W || 900, H = opts.H || 600, n = opts.backend, gpu = n === 'webgpu', host = mkHost(W, H, opts), maxFrames = opts.frames || 60, cap = opts.ms || 700;
    var make = n === 'webgpu' ? NFMRender.createWebGPU : n === 'webgl2' ? NFMRender.createWebGL2 : NFMRender.createCanvas2D;
    var gone = function (res) { try { host.remove(); } catch (e) { /* none */ } return res; };
    var plan = gpu ? [['old', { legacy: true, wait: 'every' }], ['reuse', { wait: 'every' }], ['nowait', { wait: 'none' }], ['every4', { wait: 4 }], ['pace', { wait: 'pace' }], ['blank', { wait: 'none', blank: true }], ['half', { wait: 'none', half: true }]]
      : [['wait', { wait: 'every' }], ['nowait', { wait: 'none' }], ['blank', { wait: 'none', blank: true }]];
    return withTimeout(make(host, {}), 6000, 'starting ' + n).then(function (r) {
      var base = opts.makeScene(0.6, 0.35), blank = Object.assign({}, base, { rects: [], dots: [], curves: [], ribbons: [], polys: [], labels: [], icons: [] });
      var runWay = async function (cfg, frames, ms) {
        var w = cfg.half ? Math.round(W / 2) : W, h = cfg.half ? Math.round(H / 2) : H, settle = 2, acc = { scene: 0, upload: 0, draw: 0, fence: 0, raf: 0 }, counted = 0, tStart = 0, tEnd = 0;
        if ('legacyBuffers' in r) r.legacyBuffers = !!cfg.legacy;
        r.resize(w, h, 1); await r.flush();
        for (var i = 0; i < 400; i++) {
          var f = i / 90, z = 1 + 0.35 * Math.sin(6.2832 * f * 0.5), t0 = nowMs();
          var sc = cfg.blank ? blank : opts.makeScene(0.6 + 6.2832 * f, 0.35 + 0.3 * Math.sin(6.2832 * f)), t1 = nowMs();
          r.setScene(sc); var t2 = nowMs(), v = fitView(sc, w, h); v.k *= z; v.tx = w / 2 - (w / 2 - v.tx) * z; v.ty = h / 2 - (h / 2 - v.ty) * z; r.draw(v); var t3 = nowMs();
          var p = cfg.wait === 'every' ? r.flush() : cfg.wait === 'pace' ? (r.pace ? r.pace(3) : r.flush()) : typeof cfg.wait === 'number' ? (i % cfg.wait === 0 ? r.flush() : null) : null;
          if (p) await p;
          var t4 = nowMs(), ok = await nextRefresh(), t5 = nowMs();
          if (!ok) return { hidden: true };
          if (i === settle) tStart = t5;
          else if (i > settle) { counted++; tEnd = t5; acc.scene += t1 - t0; acc.upload += t2 - t1; acc.draw += t3 - t2; acc.fence += t4 - t3; acc.raf += t5 - t4; }
          /* a slow way (a huge map: half a second a picture) is given the time to show three pictures, up to 6 s, instead of being thrown away */
          if (counted >= frames || (i > settle && ((counted >= 3 && t5 - tStart >= ms) || t5 - tStart >= 6000))) break;
        }
        if (counted < 1) return { slow: true };
        var secs = Math.max(0.001, (tEnd - tStart) / 1000);
        return { fps: counted / secs, frames: counted, scene: acc.scene / counted, upload: acc.upload / counted, draw: acc.draw / counted, fence: acc.fence / counted, raf: acc.raf / counted };
      };
      return (async function () {
        var ways = [], hidden = false, tooSlow = false;
        var warmUp = await runWay({ wait: 'none' }, 5, 500); if (warmUp.hidden) hidden = true;   /* warm-up: compile the programs, fill the caches; not reported */
        for (var q = 0; q < plan.length && !hidden && !tooSlow; q++) {
          var res = await runWay(plan[q][1], maxFrames, cap);
          if (res.hidden) { hidden = true; break; }
          if (res.slow) { tooSlow = true; break; }
          res.id = plan[q][0]; res.label = WAYS[!gpu && res.id === 'nowait' ? 'cnowait' : res.id]; ways.push(res);
        }
        var info = { device: r.device || '', software: !!r.software };
        r.destroy();
        return gone(hidden ? { backend: n, skipped: 'the page was in the background' } : !ways.length ? { backend: n, skipped: 'too slow to time: not even one picture could be drawn' } : { backend: n, device: info.device, software: info.software, ways: ways, partial: tooSlow || undefined });
      })();
    }).catch(function (err) { return gone({ backend: n, skipped: String(err && err.message || err) }); });
  }
  /**
   * Turns frameTiming results into plain words. gpu = result for WebGPU, ctl = result for WebGL 2 (or null).
   * Returns { level: 'ok'|'warn'|'bad', say, lines: [text], dominant: { phase, ms, share } | null, fastest: id | null }.
   */
  var PHASES = { scene: 'working out each new angle on the main thread', upload: 'copying the new picture into graphics memory', draw: 'handing the drawing commands over', fence: 'waiting for the graphics card to say it had finished', raf: 'waiting for the next screen refresh', other: 'other waiting inside the browser' };
  function explainTiming(gpu, ctl) {
    var lines = [], f0 = function (v) { return v >= 100 ? String(Math.round(v / 10) * 10) : v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1); }, ms1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
    if (!gpu || gpu.skipped || !gpu.ways || !gpu.ways.length) return { level: 'warn', say: 'WebGPU timing was skipped: ' + ((gpu && gpu.skipped) || 'WebGPU is not usable here') + '.', lines: lines, dominant: null, fastest: null };
    var by = {}; gpu.ways.forEach(function (w) { by[w.id] = w; });
    var old = by.old || gpu.ways[0], real = gpu.ways.filter(function (w) { return w.id !== 'blank' && w.id !== 'half'; });
    var fast = real.slice().sort(function (a, b) { return b.fps - a.fps; })[0], say = '';
    var period = 1000 / old.fps, parts = { scene: old.scene, upload: old.upload, draw: old.draw, fence: old.fence, raf: old.raf };
    parts.other = Math.max(0, period - parts.scene - parts.upload - parts.draw - parts.fence - parts.raf);
    var dom = Object.keys(parts).sort(function (a, b) { return parts[b] - parts[a]; })[0], share = parts[dom] / period;
    if (gpu.software) say += 'This WebGPU runs on the processor (a software stand-in), so these numbers show the code path, not your graphics chip. ';
    say += 'The old way drew ' + f0(old.fps) + ' FPS, ' + ms1(period) + ' ms each; most of that time (' + ms1(parts[dom]) + ' ms, ' + Math.round(100 * share) + '%) was spent ' + PHASES[dom] + '. ';
    say += 'The fastest way on this computer was "' + fast.label.toLowerCase() + '" at ' + f0(fast.fps) + ' FPS' + (fast.id === old.id ? '.' : (fast.fps > old.fps * 1.1 ? ', ' + (fast.fps / old.fps).toFixed(1) + ' times the old way.' : ', about the same as the old way.'));
    if (by.blank && fast.fps < 40 && by.blank.fps <= fast.fps * 1.3) say += ' Even a blank picture only reaches ' + f0(by.blank.fps) + ' FPS, so the limit is the browser\'s own step of putting a WebGPU picture on screen, not how much is drawn.';
    else if (by.half && by.nowait && by.half.fps >= by.nowait.fps * 1.5 && by.nowait.fps < 40) say += ' A half-size picture runs at ' + f0(by.half.fps) + ' FPS, so the cost follows the number of pixels.';
    if (ctl && ctl.ways && ctl.ways.length) {
      var cw = ctl.ways.slice().sort(function (a, b) { return b.fps - a.fps; })[0], cb = ctl.ways.filter(function (w) { return w.id === 'blank'; })[0];
      say += ' For comparison WebGL 2 reached ' + f0(cw.fps) + ' FPS' + (cb ? ' (blank: ' + f0(cb.fps) + ')' : '') + '.' + (cw.fps > fast.fps * 1.5 && !gpu.software ? ' WebGL 2 is the better choice on this computer.' : '');
    }
    if (by.old && by.reuse) lines.push('Keeping the buffers instead of making new ones: ' + f0(by.old.fps) + ' to ' + f0(by.reuse.fps) + ' FPS.');
    if (by.reuse && by.nowait) lines.push('Not waiting for the card after every picture: ' + f0(by.reuse.fps) + ' to ' + f0(by.nowait.fps) + ' FPS. The card\'s "done" signal took ' + ms1(by.reuse.fence) + ' ms to come back on average.');
    if (by.pace) lines.push('Letting up to three pictures be in flight (the new default): ' + f0(by.pace.fps) + ' FPS.');
    if (fast.id === 'nowait' && by.pace) say += ' Never waiting lets pictures pile up on a slow card, so the app loops allow three at a time instead; that reached ' + f0(by.pace.fps) + ' FPS.';
    var level = fast.fps >= 45 ? 'ok' : fast.fps >= 20 ? 'warn' : 'bad';
    if (gpu.software) level = 'warn';
    return { level: level, say: say, lines: lines, dominant: { phase: dom, ms: parts[dom], share: share }, fastest: fast.id };
  }
  /**
   * env: { makeScene(kind: 'sample'|'stress') -> scene, onStep(text), makeTurnScene() -> function (yaw, pitch) -> scene [optional: adds the 3D turning test] }
   * Resolves to { verdict: 'good'|'okay'|'limited', headline, lines: [{ok, text}], data }
   */
  function check(env) {
    var lines = [], data = { backends: {} }, step = function (t) { if (env.onStep) env.onStep(t); };
    var say = function (ok, text) { lines.push({ ok: ok, text: text }); };
    var t0 = nowMs();
    step('Testing each way of drawing…');
    return canary().then(function (c) {
      data.canary = c;
      say(c.canvas2d.ok, c.canvas2d.ok ? 'Basic drawing works.' : 'Basic drawing has a problem: ' + c.canvas2d.why + '.');
      say(c.worker.ok, c.worker.ok ? 'Background helper works, so big maps will not freeze the page while they are worked out.' : 'The background helper is not available (' + c.worker.why + '). Maps will still work, but a big one can freeze the page for a moment.');
      ['webgpu', 'webgl2'].forEach(function (n) {
        var r = c[n], nm = n === 'webgpu' ? 'WebGPU' : 'WebGL 2';
        if (r.ok && r.software) say(null, nm + ' is there but runs on the processor, not a graphics chip. It is skipped; the map uses the faster path.');
        else if (r.ok) say(true, nm + ' works' + (r.device ? ' (' + r.device + ')' : '') + '.' + (n === 'webgpu' && !(NFMRender.webgpuDrawing && NFMRender.webgpuDrawing()) ? ' The map does not draw with it (it paused for up to two seconds on one laptop that was measured); the graphics card uses it for the big-arrangement math.' : ''));
        else say(null, nm + ' is not usable here' + (r.why ? ': ' + r.why : '') + '.');
      });
      var names = ['canvas2d']; if (c.webgl2.ok && !c.webgl2.software) names.push('webgl2'); if (c.webgpu.ok && !c.webgpu.software && NFMRender.webgpuDrawing && NFMRender.webgpuDrawing()) names.push('webgpu');
      return names;
    }).then(function (names) {
      step('Drawing a sample map three ways and comparing…');
      var sample = env.makeScene('sample'), W = 480, H = 320, ref = null, chain = Promise.resolve();
      names.forEach(function (n) {
        chain = chain.then(function () {
          var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + W + 'px;height:' + H + 'px';
          document.body.appendChild(host);
          var make = n === 'webgpu' ? NFMRender.createWebGPU : n === 'webgl2' ? NFMRender.createWebGL2 : NFMRender.createCanvas2D;
          return withTimeout(make(host, {}), 6000, 'starting ' + n).then(function (r) {
            r.setScene(sample); r.resize(W, H, 1); r.draw(fitView(sample, W, H));
            var snap = r.snapshot(); /* must be taken in the same task as the drawing, or a graphics canvas hands back a blank picture */
            return r.flush().then(function () {
              r.destroy(); host.remove();
              if (n === 'canvas2d') { ref = snap; data.backends[n] = { ok: true }; }
              else {
                var d = diff(ref, snap), ok = d.mean <= 1.5 && d.badShare < 0.01;
                data.backends[n] = { ok: ok, mean: d.mean, badShare: d.badShare };
                say(ok, (n === 'webgpu' ? 'WebGPU' : 'WebGL 2') + ' draws the same picture as basic drawing (average difference ' + d.mean.toFixed(2) + ' out of 255).' + (ok ? '' : ' That is too different, so it will not be used automatically.'));
              }
            });
          }).catch(function (err) { try { host.remove(); } catch (e) { /* none */ } data.backends[n] = { ok: false, why: String(err && err.message || err) }; if (n !== 'canvas2d') say(null, (n === 'webgpu' ? 'WebGPU' : 'WebGL 2') + ' could not draw the sample (' + (err && err.message) + ').'); });
        });
      });
      return chain.then(function () { return names; });
    }).then(function (names) {
      step('Timing a large map…');
      var stress = env.makeScene('stress'), W = 900, H = 600, results = [], chain = Promise.resolve(), soft = (data.canary.webgl2.software || data.canary.webgpu.software);
      names.filter(function (n) { return data.backends[n] && data.backends[n].ok; }).forEach(function (n) {
        chain = chain.then(function () {
          var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;opacity:.01;pointer-events:none;z-index:-1';
          document.body.appendChild(host);
          var make = n === 'webgpu' ? NFMRender.createWebGPU : n === 'webgl2' ? NFMRender.createWebGL2 : NFMRender.createCanvas2D;
          return make(host, {}).then(function (r) {
            r.setScene(stress); r.resize(W, H, 1);
            /* one picture per screen refresh, as the real map does: this measures what a person would see, and it cannot flood the graphics queue */
            var v = fitView(stress, W, H), frames = 0, counted = 0, start = nowMs(), t1 = 0, hidden = false;
            var loop = function () {
              v.tx += (frames % 2 ? 3 : -3); r.draw(v); frames++;
              return wait(r).then(function () { return nextRefresh(); }).then(function (ok) {
                if (!ok) { hidden = true; return; }
                if (frames === 3) t1 = nowMs(); else if (frames > 3) counted++;
                if (nowMs() - start < (env.ms || 1300) && frames < 600) return loop();
              });
            };
            return loop().then(function () {
              var secs = Math.max(0.05, (nowMs() - t1) / 1000), fps = counted / secs; r.destroy(); host.remove();
              if (!hidden && counted > 3) { results.push({ n: n, fps: fps }); data.backends[n].fps = fps; }
              else data.backends[n].fps = null;
            });
          }).catch(function () { try { host.remove(); } catch (e) { /* none */ } });
        });
      });
      var turn = null;
      chain = chain.then(function () {
        var top = results.slice().sort(function (a, b) { return b.fps - a.fps; })[0];
        if (!env.makeTurnScene || !top) return null;
        step('Turning a 3D map…');
        return turning({ backend: top.n, makeScene: env.makeTurnScene(), W: W, H: H, ms: env.ms }).then(function (t) { turn = t; });
      });
      return chain.then(function () {
        var rounded = typeof EnvProbes !== 'undefined' && EnvProbes.timerRounded && EnvProbes.timerRounded();
        results.forEach(function (r) {
          var nm = r.n === 'webgpu' ? 'WebGPU' : r.n === 'webgl2' ? 'WebGL 2' : 'Basic drawing';
          say(r.fps >= 45 ? true : r.fps >= 20 ? null : false, nm + ': about ' + (r.fps >= 100 ? Math.round(r.fps / 10) * 10 : Math.round(r.fps)) + ' FPS on a large map (' + stress.nodes.length.toLocaleString('en-US') + ' items, ' + (stress.curves.length + stress.ribbons.length).toLocaleString('en-US') + ' links).' + (rounded ? ' This browser blurs its clock, so treat this as a rough number.' : ''));
        });
        if (turn && turn.fps) {
          var tf = turn.fps >= 100 ? Math.round(turn.fps / 10) * 10 : Math.round(turn.fps);
          say(turn.fps >= 45 ? true : turn.fps >= 20 ? null : false, 'Turning a 3D map: about ' + tf + ' FPS' + (turn.fps < 45 ? ' (working out each new angle takes ' + turn.sceneMs.toFixed(1) + ' ms and drawing it ' + turn.drawMs.toFixed(1) + ' ms)' : '') + '. ' + (turn.fps >= 45 ? 'Rotating and zooming will feel smooth.' : turn.fps >= 20 ? 'Rotating works but will feel a little steppy on big maps.' : 'Rotating a big 3D map will feel choppy here.'));
          data.turn = { backend: turn.backend, fps: turn.fps, sceneMs: turn.sceneMs, drawMs: turn.drawMs };
        } else if (turn && turn.skipped) data.turn = { backend: turn.backend, skipped: turn.skipped };
        if (soft) say(null, 'Speed for the graphics paths that run on the processor is not reported, because it would say little about a real graphics chip.');
        var best = results.slice().sort(function (a, b) { return b.fps - a.fps; })[0], canvasOk = data.canary.canvas2d.ok;
        var verdict, headline;
        if (!canvasOk) { verdict = 'limited'; headline = 'Drawing is restricted in this browser, so maps may look slightly off.'; }
        else if (!best) { verdict = 'okay'; headline = 'Maps will work. I could not time them (the page may be in the background), so run the check again with this page in front.'; }
        else if (best.fps >= 45) { verdict = 'good'; headline = 'This device handles big maps smoothly. It will draw with ' + (best.n === 'webgpu' ? 'WebGPU' : best.n === 'webgl2' ? 'WebGL 2' : 'basic drawing') + '.'; }
        else if (best.fps >= 20) { verdict = 'okay'; headline = 'This device handles medium maps well and big ones a bit slowly. Panning a huge map may stutter.'; }
        else { verdict = 'limited'; headline = 'Big maps will be slow here. Small and medium maps are fine; for a huge one, filter it down first.'; }
        data.best = best && best.n;
        if (!env.cardCheck) { data.seconds = (nowMs() - t0) / 1000; data.verdict = verdict; return { verdict: verdict, headline: headline, lines: lines, data: data }; }
        /* the graphics card as a calculator: does the big-arrangement path work and pay off here? */
        step('Timing a big arrangement on the graphics card…');
        return env.cardCheck().then(function (cc) {
          data.card = cc.data || null; cc.lines.forEach(function (l) { say(l.ok, l.text); });
          if (cc.problem) { if (verdict === 'good') verdict = 'okay'; headline += ' ' + cc.problem; }
          data.seconds = (nowMs() - t0) / 1000; data.verdict = verdict;
          return { verdict: verdict, headline: headline, lines: lines, data: data };
        }, function (err) { say(null, 'The graphics-card arrangement test could not run (' + String(err && err.message || err).slice(0, 100) + ').'); data.seconds = (nowMs() - t0) / 1000; data.verdict = verdict; return { verdict: verdict, headline: headline, lines: lines, data: data }; });
      });
    });
  }

  return { canary: canary, check: check, turning: turning, turnSplit: turnSplit, explainSplit: explainSplit, frameTiming: frameTiming, explainTiming: explainTiming, fitView: fitView, testCanvas2D: testCanvas2D, testWebGL2: testWebGL2, testWebGPU: testWebGPU, testWorker: testWorker };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMProbe;
