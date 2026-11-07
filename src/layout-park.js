/*!
 * Netflow Map idle layout park. Copyright (c) 2026 LFC Foundry. MIT License.
 * When a big map has been left alone for a few seconds, the layout's list of links (`L.edges`) is packed by memory-compression (vendor/memory-compression.js) and the plain objects are let go.
 * Reading `L.edges` brings the objects back exactly (the same fields and values), `L.edgeAt(i)` reads one link without bringing the rest back, and the park starts again after the next quiet spell.
 * The item list (`L.nodes`) is left alone on purpose: the picture's items point at those very objects, so packing them frees nothing (measured: +4 MB at 30,000 items).
 * Nothing about the picture changes: a packed list is checked against the originals on a sample before the originals are let go, and anything that does not match is left alone.
 */
(function (root) {
  'use strict';
  var KEYS = ['edges'], CHUNK = 25000, SAMPLE = 400;

  function sameValue(a, b) { return a === b || (a !== a && b !== b); }
  function sameRow(a, b, depth) {
    if (sameValue(a, b)) return a === 0 && b === 0 ? 1 / a === 1 / b : true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || depth > 6) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b), i;
    if (ka.length !== kb.length) return false;
    for (i = 0; i < ka.length; i++) { if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !sameRow(a[ka[i]], b[ka[i]], depth + 1)) return false; }
    return true;
  }

  /** o: { delay: ms quiet before packing, min: smallest list to bother with, alive(): is this layout still the one on screen, hold(): true while something is using the objects, done(): called after packing } */
  var WARMED = false;
  function attach(L, o) {
    var MC = root.MemoryCompression || (typeof globalThis !== "undefined" ? globalThis.MemoryCompression : null);
    if (!L || !MC || !MC.pack || L.parked) return null;
    o = o || {};
    var live = { edges: L.edges }, K = null, packed = false, busy = false, refused = false, timer = 0, touchedAt = Date.now(), views = {}, cnt = {}, gone = false;
    var delay = o.delay || 4000, min = o.min || 20000;

    function size() { return live.edges ? live.edges.length : 0; }
    function touch() { touchedAt = Date.now(); }
    /* a short slice (under 16 rows) cannot be viewed; it is small, so it is opened whole */
    function chunkView(nm) { try { return MC.view(K[nm]); } catch (e) { var arr = MC.unpack(K[nm]); return { get: function (i) { return arr[i]; } }; } }
    function names(k) { var out = [], c = Math.ceil(cnt[k] / CHUNK), i; for (i = 0; i < c; i++) out.push(k + ':' + i); return out; }

    function wake() {
      if (!packed) return;
      KEYS.forEach(function (k) {
        var out = new Array(cnt[k]), at = 0;
        names(k).forEach(function (nm) { var part = MC.unpack(K[nm]), i; for (i = 0; i < part.length; i++) out[at++] = part[i]; });
        live[k] = out;
      });
      views = {}; K = null; packed = false; touch(); schedule();
    }
    /* The same wake in slices that never hold the page long (MemoryCompression.unpackAsync opens each 25,000-link piece a column at a time): a promise for true when the objects are back, false when nothing was parked, a read woke it first, or this copy has no unpackAsync. A read in the meantime still wakes everything at once, as before. */
    var waking = null;
    function wakeAsync() {
      if (!packed) return Promise.resolve(false);
      if (!MC.unpackAsync) return Promise.resolve(false);
      if (waking) return waking;
      var K0 = K, ks = names('edges'), out = new Array(cnt.edges), at = 0;
      function step(i) {
        if (i >= ks.length) return Promise.resolve();
        return MC.unpackAsync(K0[ks[i]]).then(function (part) {
          if (K !== K0) throw new Error('woken by a read');
          for (var j = 0; j < part.length; j++) out[at++] = part[j];
          return step(i + 1);
        });
      }
      waking = step(0).then(function () {
        waking = null;
        if (!packed || K !== K0) return false;
        live.edges = out; views = {}; K = null; packed = false; touch(); schedule(); return true;
      }, function () { waking = null; return false; });
      return waking;
    }
    function read(k) { if (packed) wake(); touch(); return live[k]; }
    function write(k, v) { if (packed) wake(); touch(); live[k] = v; }
    function one(k, i) {
      if (!packed) return live[k][i];
      touch();
      var c = Math.floor(i / CHUNK), nm = k + ':' + c, v = views[nm] || (views[nm] = chunkView(nm));
      return v.get(i - c * CHUNK);
    }

    function dropPartial() { K = null; busy = false; }
    function schedule() { if (gone || timer || refused) return; timer = setTimeout(tick, 1000); if (timer && timer.unref) timer.unref(); }
    function tick() {
      timer = 0;
      if (gone || (o.alive && !o.alive())) { gone = true; return; }
      if (packed || refused) return;
      if (!WARMED && MC.warm && size() >= min && Date.now() - touchedAt >= delay / 2 && !(o.hold && o.hold())) { WARMED = true; try { MC.warm().catch(function () { /* a failed warm-up costs nothing */ }); } catch (e) { /* none */ } }   /* once a page, while it is quiet and a big pack is due: the first pack then skips cold-start work */
      if (Date.now() - touchedAt >= delay && size() >= min && !(o.hold && o.hold())) startPack(); else schedule();
    }
    function startPack() {
      var jobs = [], t0 = touchedAt, mine = {};
      K = mine; busy = true;
      KEYS.forEach(function (k) { cnt[k] = live[k].length; for (var i = 0; i < live[k].length; i += CHUNK) jobs.push({ k: k, from: i }); });
      (function next() {
        if (K !== mine) { busy = false; return; }   /* parkNow or a wake took over while this was waiting for its next turn: the store it finished or dropped is not this one */
        if (gone || touchedAt !== t0 || (o.hold && o.hold())) { dropPartial(); schedule(); return; }
        var j = jobs.shift();
        if (!j) { finish(); return; }
        try { K[j.k + ':' + Math.floor(j.from / CHUNK)] = MC.pack(live[j.k].slice(j.from, j.from + CHUNK), { mode: 'fast' }); } catch (e) { refused = true; dropPartial(); return; }
        setTimeout(next, 0);
      })();
    }
    function finish() {
      /* check the packed copy against the originals on a sample before the originals go */
      var ok = true;
      KEYS.forEach(function (k) {
        var n = live[k].length, step = Math.max(1, Math.floor(n / SAMPLE)), i, c, vs = {}, at = function (j) { var q = Math.floor(j / CHUNK), nm = k + ':' + q; return (vs[nm] || (vs[nm] = chunkView(nm))).get(j - q * CHUNK); };
        for (i = 0; i < n && ok; i += step) { if (!sameRow(live[k][i], at(i), 0)) ok = false; }
        if (ok && n && !sameRow(live[k][n - 1], at(n - 1), 0)) ok = false;
      });
      if (!ok) { refused = true; dropPartial(); return; }
      live = { edges: null }; packed = true; busy = false; views = {};
      if (o.done) o.done();
    }
    function parkNow() {
      if (packed || refused) return packed;
      var save = o.hold; o.hold = null; touchedAt = 0; startNowSync(); o.hold = save; return packed;
    }
    function startNowSync() {
      K = {};
      try { KEYS.forEach(function (k) { cnt[k] = live[k].length; for (var i = 0; i < live[k].length; i += CHUNK) K[k + ':' + Math.floor(i / CHUNK)] = MC.pack(live[k].slice(i, i + CHUNK), { mode: 'fast' }); }); } catch (e) { refused = true; dropPartial(); return; }
      finish();
    }

    KEYS.forEach(function (k) {
      Object.defineProperty(L, k, { configurable: true, enumerable: true, get: function () { return read(k); }, set: function (v) { write(k, v); } });
    });
    Object.defineProperty(L, 'parked', { configurable: true, enumerable: false, value: function () { return packed; } });
    Object.defineProperty(L, 'edgeAt', { configurable: true, enumerable: false, value: function (i) { return one('edges', i); } });
    Object.defineProperty(L, 'parkNow', { configurable: true, enumerable: false, value: parkNow });
    Object.defineProperty(L, 'wakeAsync', { configurable: true, enumerable: false, value: wakeAsync });
    Object.defineProperty(L, 'wake', { configurable: true, enumerable: false, value: wake });
    Object.defineProperty(L, 'parkBytes', { configurable: true, enumerable: false, value: function () { var t = 0, nm; if (packed) for (nm in K) t += K[nm].length; return t; } });
    schedule();
    return L;
  }

  var NFMPark = { attach: attach };
  root.NFMPark = NFMPark;
  if (typeof module !== 'undefined' && module.exports) module.exports = NFMPark;
})(typeof self !== 'undefined' ? self : this);
