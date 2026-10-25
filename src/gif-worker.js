/*!
 * Netflow Map GIF worker: filters pictures and writes the GIF off the main thread. The same handler runs in a real worker and, where workers are missing, on the page.
 * Needs NFMGif (gif.js) and NFMGifFx (gifx.js) in the same scope; NFMGifGl (gifgl.js) is optional. Copyright (c) 2026 LFC Foundry. MIT License.
 * Messages in:  wasm {id} | card {id} | init {w,h} | filter {id,buf,w,h,f} | palette {bufs} | frame {id,buf,ms} | finish
 * Messages out: wasm {id,ok} | card {id,ok} | filtered {id,buf} | ready | ack {id} | done {bytes}
 */
var NFMGifWorker = (function () {
  'use strict';
  var W = 0, H = 0, enc = null, gl = null;
  function handle(m, post) {
    var a;
    switch (m.t) {
      case 'wasm': NFMGifFx.initWasm().then(function (ok) { post({ t: 'wasm', id: m.id, ok: ok }); }); break;
      case 'card': try { gl = typeof NFMGifGl !== 'undefined' && typeof OffscreenCanvas !== 'undefined' ? NFMGifGl.create() : null; } catch (e) { gl = null; } post({ t: 'card', id: m.id, ok: !!gl }); break;
      case 'init': W = m.w; H = m.h; enc = null; break;
      case 'filter': a = new Uint8ClampedArray(m.buf); if (gl) { var keep = a.slice(); if (!gl.apply(a, m.w, m.h, m.f)) { a.set(keep); gl = null; NFMGifFx.apply(a, m.w, m.h, m.f); } } else NFMGifFx.apply(a, m.w, m.h, m.f); post({ t: 'filtered', id: m.id, buf: a.buffer }, [a.buffer]); break;
      case 'palette': enc = NFMGif.createEncoder(W, H, NFMGif.makePalette(m.bufs.map(function (b) { return new Uint8ClampedArray(b); }), 255), { loop: true }); post({ t: 'ready' }); break;
      case 'frame': enc.add(new Uint8ClampedArray(m.buf), m.ms); post({ t: 'ack', id: m.id }); break;
      case 'finish': a = enc.finish(); post({ t: 'done', bytes: a.buffer }, [a.buffer]); break;
    }
  }
  if (typeof importScripts === 'function' && typeof document === 'undefined') self.onmessage = function (e) { handle(e.data, function (msg, tr) { self.postMessage(msg, tr || []); }); };
  return { handle: handle };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGifWorker;
