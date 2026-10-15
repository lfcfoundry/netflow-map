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
    return new Promise(function (res) { var done = false, t = setTimeout(function () { if (!done) { done = true; res(false); } }, 1000); requestAnimationFrame(function () { if (!done) { done = true; clearTimeout(t); res(true); } }); });
  }
  function nowMs() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

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
  /**
   * env: { makeScene(kind: 'sample'|'stress') -> scene, onStep(text) }
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
        else if (r.ok) say(true, nm + ' works' + (r.device ? ' (' + r.device + ')' : '') + '.');
        else say(null, nm + ' is not usable here' + (r.why ? ': ' + r.why : '') + '.');
      });
      var names = ['canvas2d']; if (c.webgl2.ok && !c.webgl2.software) names.push('webgl2'); if (c.webgpu.ok && !c.webgpu.software) names.push('webgpu');
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
              return r.flush().then(function () { return nextRefresh(); }).then(function (ok) {
                if (!ok) { hidden = true; return; }
                if (frames === 3) t1 = nowMs(); else if (frames > 3) counted++;
                if (nowMs() - start < 1300 && frames < 600) return loop();
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
      return chain.then(function () {
        var rounded = typeof EnvProbes !== 'undefined' && EnvProbes.timerRounded && EnvProbes.timerRounded();
        results.forEach(function (r) {
          var nm = r.n === 'webgpu' ? 'WebGPU' : r.n === 'webgl2' ? 'WebGL 2' : 'Basic drawing';
          say(r.fps >= 45 ? true : r.fps >= 20 ? null : false, nm + ': about ' + (r.fps >= 100 ? Math.round(r.fps / 10) * 10 : Math.round(r.fps)) + ' pictures per second on a large map (' + stress.nodes.length.toLocaleString('en-US') + ' items, ' + (stress.curves.length + stress.ribbons.length).toLocaleString('en-US') + ' links).' + (rounded ? ' This browser blurs its clock, so treat this as a rough number.' : ''));
        });
        if (soft) say(null, 'Speed for the graphics paths that run on the processor is not reported, because it would say little about a real graphics chip.');
        var best = results.slice().sort(function (a, b) { return b.fps - a.fps; })[0], canvasOk = data.canary.canvas2d.ok;
        var verdict, headline;
        if (!canvasOk) { verdict = 'limited'; headline = 'Drawing is restricted in this browser, so maps may look slightly off.'; }
        else if (!best) { verdict = 'okay'; headline = 'Maps will work. I could not time them (the page may be in the background), so run the check again with this page in front.'; }
        else if (best.fps >= 45) { verdict = 'good'; headline = 'This device handles big maps smoothly. It will draw with ' + (best.n === 'webgpu' ? 'WebGPU' : best.n === 'webgl2' ? 'WebGL 2' : 'basic drawing') + '.'; }
        else if (best.fps >= 20) { verdict = 'okay'; headline = 'This device handles medium maps well and big ones a bit slowly. Panning a huge map may stutter.'; }
        else { verdict = 'limited'; headline = 'Big maps will be slow here. Small and medium maps are fine; for a huge one, filter it down first.'; }
        data.seconds = (nowMs() - t0) / 1000; data.best = best && best.n; data.verdict = verdict;
        return { verdict: verdict, headline: headline, lines: lines, data: data };
      });
    });
  }

  return { canary: canary, check: check, fitView: fitView, testCanvas2D: testCanvas2D, testWebGL2: testWebGL2, testWebGPU: testWebGPU, testWorker: testWorker };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMProbe;
