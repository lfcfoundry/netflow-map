/*!
 * Netflow Map saved layouts: finished Network pictures kept in the browser's own storage (IndexedDB), so opening the same map a second time
 * skips the layout. Nothing leaves the computer and nothing is sent anywhere. Any trouble with storage (private window, full disk, blocked) means
 * "not saved" and the map is laid out as before. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMLayoutStore = (function () {
  'use strict';
  /** A backend is { get(key) -> Promise(record|null), put(key, record, meta) -> Promise, meta() -> Promise([{key, t, bytes}]), del(keys) -> Promise }. */
  function memoryBackend() {
    var recs = new Map(), meta = new Map();
    return {
      get: function (k) { return Promise.resolve(recs.get(k) || null); },
      put: function (k, r, m) { recs.set(k, r); meta.set(k, m); return Promise.resolve(); },
      meta: function () { return Promise.resolve(Array.from(meta.values())); },
      touch: function (k, t) { var m = meta.get(k); if (m) m.t = t; return Promise.resolve(); },
      del: function (ks) { ks.forEach(function (k) { recs.delete(k); meta.delete(k); }); return Promise.resolve(); }
    };
  }
  function idbBackend(name) {
    var dbP = null;
    function open() {
      if (dbP) return dbP;
      dbP = new Promise(function (res, rej) {
        if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
        var q = indexedDB.open(name || 'netflow-map-layouts', 1);
        q.onupgradeneeded = function () { q.result.createObjectStore('r'); q.result.createObjectStore('m'); };
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); }; q.onblocked = function () { rej(new Error('blocked')); };
      });
      return dbP;
    }
    function tx(stores, mode, f) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(stores, mode), out = f(t);
          t.oncomplete = function () { res(out && 'result' in out ? out.result : out); }; t.onerror = t.onabort = function () { rej(t.error || new Error('aborted')); };
        });
      });
    }
    return {
      get: function (k) { return tx(['r'], 'readonly', function (t) { return t.objectStore('r').get(k); }).then(function (v) { return v || null; }); },
      put: function (k, r, m) { return tx(['r', 'm'], 'readwrite', function (t) { t.objectStore('r').put(r, k); t.objectStore('m').put(m, k); }); },
      meta: function () { return tx(['m'], 'readonly', function (t) { return t.objectStore('m').getAll(); }); },
      touch: function (k, tm) { return tx(['m'], 'readwrite', function (t) { var s = t.objectStore('m'), g = s.get(k); g.onsuccess = function () { if (g.result) { g.result.t = tm; s.put(g.result, k); } }; }); },
      del: function (ks) { return tx(['r', 'm'], 'readwrite', function (t) { ks.forEach(function (k) { t.objectStore('r').delete(k); t.objectStore('m').delete(k); }); }); }
    };
  }
  /** Keeps at most maxEntries pictures and maxBytes in all; the least recently used go first. */
  function Store(backend, limits) {
    limits = limits || {};
    this.b = backend; this.maxEntries = limits.maxEntries || 24; this.maxBytes = limits.maxBytes || 120 * 1048576; this.hits = 0; this.misses = 0; this.saves = 0; this.errors = 0; this.last = '';
    this.now = limits.now || function () { return Date.now(); };
  }
  Store.prototype.get = function (key) {
    var self = this;
    return this.b.get(key).then(function (r) {
      if (r && r.key === key && r.xy && r.xy.length) { self.hits++; self.b.touch(key, self.now()).catch(function () { /* fine */ }); return r; }
      self.misses++; return null;
    }, function (e) { self.errors++; self.last = String(e && e.message || e); return null; });
  };
  Store.prototype.put = function (key, rec) {
    var self = this, im = rec.imp || null, bytes = rec.xy.byteLength + (im ? im.choke.byteLength + im.traffic.byteLength + im.depth.byteLength + im.idom.byteLength + 4 * (im.rpo.length + im.goal.length + im.spine.length) : 0);   /* imp: the importance answers of this map, kept so opening it again skips that step */
    if (bytes > this.maxBytes / 2) return Promise.resolve(false);
    return this.b.put(key, { key: key, xy: rec.xy, width: rec.width, height: rec.height, rough: false, startId: rec.startId, imp: im }, { key: key, t: this.now(), bytes: bytes }).then(function () { self.saves++; return self.prune(); }).then(function () { return true; }, function (e) { self.errors++; self.last = String(e && e.message || e); return false; });
  };
  Store.prototype.prune = function () {
    var self = this;
    return this.b.meta().then(function (all) {
      all.sort(function (a, b) { return b.t - a.t; });
      var keep = 0, bytes = 0, drop = [];
      all.forEach(function (m) { if (keep < self.maxEntries && bytes + m.bytes <= self.maxBytes) { keep++; bytes += m.bytes; } else drop.push(m.key); });
      return drop.length ? self.b.del(drop) : null;
    }).catch(function (e) { self.errors++; self.last = String(e && e.message || e); });
  };
  /** How many pictures are kept and how many bytes they take: { count, bytes }. */
  Store.prototype.info = function () { return this.b.meta().then(function (all) { var b = 0; all.forEach(function (m) { b += m.bytes; }); return { count: all.length, bytes: b }; }, function () { return { count: 0, bytes: 0, error: true }; }); };
  Store.prototype.clear = function () { var self = this; return this.b.meta().then(function (all) { return self.b.del(all.map(function (m) { return m.key; })); }).catch(function () { /* fine */ }); };
  function open(limits) { try { return new Store(idbBackend(), limits); } catch (e) { return null; } }
  var api = { Store: Store, memoryBackend: memoryBackend, idbBackend: idbBackend, open: open };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
