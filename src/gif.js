/*!
 * Net Flow Map GIF writer: palette from a few key pictures, frame differencing, LZW. No DOM; runs in the page or in Node.
 * Copyright (c) 2026 JNFoo. MIT License.
 */
var NFMGif = (function () {
  'use strict';

  /** Up to maxColors colors that stand for the pictures (median cut over the exact colors, weighted by how many pixels use them). */
  function makePalette(pictures, maxColors) {
    maxColors = Math.min(255, maxColors || 255);
    var count = new Map(), p, i;
    for (p = 0; p < pictures.length; p++) {
      var d = pictures[p], step = d.length > 4 * 600000 ? 8 : 4;
      for (i = 0; i < d.length; i += step) { var k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; count.set(k, (count.get(k) || 0) + 1); }
    }
    var items = [];
    count.forEach(function (c, k) { items.push({ r: k >> 16, g: (k >> 8) & 255, b: k & 255, c: c }); });
    if (items.length <= maxColors) return items.map(function (x) { return [x.r, x.g, x.b]; });
    var boxes = [items];
    var range = function (box) {
      var lo = [255, 255, 255], hi = [0, 0, 0];
      box.forEach(function (x) { if (x.r < lo[0]) lo[0] = x.r; if (x.r > hi[0]) hi[0] = x.r; if (x.g < lo[1]) lo[1] = x.g; if (x.g > hi[1]) hi[1] = x.g; if (x.b < lo[2]) lo[2] = x.b; if (x.b > hi[2]) hi[2] = x.b; });
      return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    };
    while (boxes.length < maxColors) {
      var bi = -1, bs = 0, bc = 0, q;
      for (q = 0; q < boxes.length; q++) {
        if (boxes[q].length < 2) continue;
        var rg = range(boxes[q]), mx = Math.max(rg[0], rg[1], rg[2]), tot = 0; boxes[q].forEach(function (x) { tot += x.c; });
        var score = mx * Math.sqrt(tot);
        if (score > bs) { bs = score; bi = q; bc = rg[0] >= rg[1] && rg[0] >= rg[2] ? 'r' : rg[1] >= rg[2] ? 'g' : 'b'; }
      }
      if (bi < 0) break;
      var box = boxes[bi]; box.sort(function (a, b) { return a[bc] - b[bc]; });
      var all = 0; box.forEach(function (x) { all += x.c; });
      var run = 0, cut = 1;
      for (q = 0; q < box.length - 1; q++) { run += box[q].c; if (run >= all / 2) { cut = q + 1; break; } cut = q + 1; }
      boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
    }
    return boxes.map(function (box) {
      var r = 0, g = 0, b = 0, t = 0; box.forEach(function (x) { r += x.r * x.c; g += x.g * x.c; b += x.b * x.c; t += x.c; });
      return [Math.round(r / t), Math.round(g / t), Math.round(b / t)];
    });
  }

  /** LZW for GIF. indices: Uint8Array of palette numbers. Returns the code bytes (not yet cut into blocks). */
  var TABLE = null, STAMP = null, EPOCH = 0;
  function lzw(indices, minCode) {
    if (!TABLE) { TABLE = new Int32Array(1 << 20); STAMP = new Int32Array(1 << 20); }
    var clearCode = 1 << minCode, eoi = clearCode + 1, next = eoi + 1, size = minCode + 1, out = [], cur = 0, shift = 0, i;
    var emit = function (code) { cur |= code << shift; shift += size; while (shift >= 8) { out.push(cur & 255); cur >>>= 8; shift -= 8; } };
    EPOCH++; emit(clearCode);
    var prefix = indices[0];
    for (i = 1; i < indices.length; i++) {
      var k = indices[i], key = (prefix << 8) | k;
      if (STAMP[key] === EPOCH) { prefix = TABLE[key]; continue; }
      emit(prefix);
      if (next === 4096) { emit(clearCode); next = eoi + 1; size = minCode + 1; EPOCH++; }
      else { if (next >= (1 << size)) size++; TABLE[key] = next++; STAMP[key] = EPOCH; }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (shift > 0) out.push(cur & 255);
    return out;
  }

  /**
   * A streaming writer: createEncoder(width, height, palette, { loop }) then add(rgba, delayMs) for each picture, then finish().
   * Pixels that did not change since the last picture are left transparent, so still parts cost almost nothing.
   */
  function createEncoder(width, height, palette, opts) {
    opts = opts || {};
    var pal = palette.slice(0, 255), TRANS = 255, frames = [], prev = null, cache = new Map();
    var nearest = function (r, g, b) {
      var key = (r << 16) | (g << 8) | b, hit = cache.get(key);
      if (hit !== undefined) return hit;
      var best = 0, bd = 1e9;
      for (var j = 0; j < pal.length; j++) { var dr = pal[j][0] - r, dg = pal[j][1] - g, db = pal[j][2] - b, dd = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (dd < bd) { bd = dd; best = j; if (!dd) break; } }
      cache.set(key, best); if (cache.size > 400000) cache.clear();
      return best;
    };
    return {
      add: function (rgba, delayMs) {
        var n = width * height, idx = new Uint8Array(n), i;
        for (i = 0; i < n; i++) idx[i] = nearest(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
        var x0 = 0, y0 = 0, w = width, h = height, data = idx;
        if (prev) {
          var minx = width, miny = height, maxx = -1, maxy = -1, x, y;
          for (y = 0; y < height; y++) for (x = 0; x < width; x++) if (idx[y * width + x] !== prev[y * width + x]) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
          if (maxx < 0) { frames[frames.length - 1].delay += delayMs; return; }
          x0 = minx; y0 = miny; w = maxx - minx + 1; h = maxy - miny + 1; data = new Uint8Array(w * h);
          for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var o = (y + y0) * width + x + x0; data[y * w + x] = idx[o] === prev[o] ? TRANS : idx[o]; }
        }
        prev = idx;
        frames.push({ x: x0, y: y0, w: w, h: h, data: data, delay: delayMs, trans: frames.length > 0 });
      },
      finish: function () {
        var out = [], i, le = function (v) { out.push(v & 255, (v >> 8) & 255); };
        'GIF89a'.split('').forEach(function (c) { out.push(c.charCodeAt(0)); });
        le(width); le(height); out.push(0xF7, 0, 0);
        for (i = 0; i < 256; i++) { var c = pal[i] || [0, 0, 0]; out.push(c[0], c[1], c[2]); }
        if (opts.loop !== false) { out.push(0x21, 0xFF, 11); 'NETSCAPE2.0'.split('').forEach(function (ch) { out.push(ch.charCodeAt(0)); }); out.push(3, 1, 0, 0, 0); }
        frames.forEach(function (f) {
          out.push(0x21, 0xF9, 4, (1 << 2) | (f.trans ? 1 : 0)); le(Math.max(2, Math.round(f.delay / 10))); out.push(TRANS, 0);
          out.push(0x2C); le(f.x); le(f.y); le(f.w); le(f.h); out.push(0);
          out.push(8);
          var bytes = lzw(f.data, 8);
          for (var p = 0; p < bytes.length; p += 255) { var len = Math.min(255, bytes.length - p); out.push(len); for (var q = 0; q < len; q++) out.push(bytes[p + q]); }
          out.push(0);
        });
        out.push(0x3B);
        return Uint8Array.from(out);
      },
      count: function () { return frames.length; }
    };
  }
  return { makePalette: makePalette, createEncoder: createEncoder, lzw: lzw };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGif;
