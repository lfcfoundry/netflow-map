/*!
 * Netflow Map GIF worker: filters pictures and writes the GIF off the main thread. The same handler runs in a real worker and, where workers are missing, on the page.
 * Needs NFMGif (gif.js) and NFMGifFx (gifx.js) in the same scope; NFMGifGl (gifgl.js) is optional. Copyright (c) 2026 LFC Foundry. MIT License.
 * Messages in:  wasm {id} | card {id} | init {w,h} | filter {id,buf,w,h,f} | palette {bufs,colors,tol} | frame {id,buf,ms} | finish
 *   filtern {id,buf,w,h,f,n}: n pictures stacked one under the other in buf, filtered with one card call
 * Messages out: wasm {id,ok} | card {id,ok} | filtered {id,buf} | ready | ack {id} | done {bytes}
 */
var NFMGifWorker = (function () {
  'use strict';
  var W = 0, H = 0, enc = null, gl = null;
  /** n stacked pictures: one card call, or (no card, or the card gave up) each picture on its own. */
  function filterStack(a, m) {
    var keep = gl ? a.slice() : null, sz = m.w * m.h * 4, i;
    if (gl && gl.apply(a, m.w, m.h, m.f, m.n)) return;
    if (keep) { a.set(keep); gl = null; }
    for (i = 0; i < m.n; i++) NFMGifFx.apply(a.subarray(i * sz, (i + 1) * sz), m.w, m.h, m.f);
  }
  function handle(m, post) {
    var a;
    switch (m.t) {
      case 'wasm': NFMGifFx.initWasm().then(function (ok) { post({ t: 'wasm', id: m.id, ok: ok }); }); break;
      case 'card': try { gl = typeof NFMGifGl !== 'undefined' && typeof OffscreenCanvas !== 'undefined' ? NFMGifGl.create() : null; } catch (e) { gl = null; } post({ t: 'card', id: m.id, ok: !!gl }); break;
      case 'init': W = m.w; H = m.h; enc = null; break;
      case 'filter': a = new Uint8ClampedArray(m.buf); if (gl) { var keep = a.slice(); if (!gl.apply(a, m.w, m.h, m.f)) { a.set(keep); gl = null; NFMGifFx.apply(a, m.w, m.h, m.f); } } else NFMGifFx.apply(a, m.w, m.h, m.f); post({ t: 'filtered', id: m.id, buf: a.buffer }, [a.buffer]); break;
      case 'filtern': a = new Uint8ClampedArray(m.buf); filterStack(a, m); post({ t: 'filtered', id: m.id, buf: a.buffer }, [a.buffer]); break;
      case 'palette': enc = NFMGif.createEncoder(W, H, NFMGif.makePalette(m.bufs.map(function (b) { return new Uint8ClampedArray(b); }), m.colors || 255), { loop: true, tolerance: m.tol || 0 }); post({ t: 'ready' }); break;
      case 'frame': enc.add(new Uint8ClampedArray(m.buf), m.ms); post({ t: 'ack', id: m.id }); break;
      case 'finish': a = enc.finish(); post({ t: 'done', bytes: a.buffer }, [a.buffer]); break;
    }
  }
  if (typeof importScripts === 'function' && typeof document === 'undefined') self.onmessage = function (e) { handle(e.data, function (msg, tr) { self.postMessage(msg, tr || []); }); };
  return { handle: handle };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGifWorker;
