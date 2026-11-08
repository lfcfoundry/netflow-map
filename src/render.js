/*!
 * Netflow Map drawing backends: WebGPU, WebGL2 and Canvas2D draw the same scene (see scene.js) and look the same.
 * Shapes are drawn as signed-distance quads (a 1-pixel soft edge instead of MSAA); lines and ribbons are triangle strips
 * with the same soft edge. Labels always go on a 2D overlay canvas. Picking is done on the CPU (scene.js).
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMRender = (function () {
  'use strict';
  var css = NFMScene.css, SHAPE_STRIDE = 16, MESH_STRIDE = 10;
  var labelFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';   /* the type family of every map label; the page sets it from the person's look */

  /* ---------------------------------------------------------------- shared: geometry lists for the GPU */
  function bezPts(P, line) {
    var out = [], segs = (P.length - 2) / 6;
    out.push(P[0], P[1]);
    for (var s = 0; s < segs; s++) {
      var o = s * 6, x0 = P[o], y0 = P[o + 1], x1 = P[o + 2], y1 = P[o + 3], x2 = P[o + 4], y2 = P[o + 5], x3 = P[o + 6], y3 = P[o + 7];
      var len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
      var n = line ? 1 : Math.max(8, Math.min(48, Math.ceil(len / 9)));
      for (var i = 1; i <= n; i++) {
        var u = i / n, m = 1 - u;
        out.push(m * m * m * x0 + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x3, m * m * m * y0 + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y3);
      }
    }
    return out;
  }
  /** Half widths along a polyline that shrink from h0 to h1 by the length so far (tapered links). */
  function taperHalf(pts, h0, h1) {
    var n = pts.length / 2, cum = new Float64Array(n), i, tot = 0;
    for (i = 1; i < n; i++) { tot += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]); cum[i] = tot; }
    var out = new Float64Array(n); for (i = 0; i < n; i++) out[i] = h0 + (h1 - h0) * (tot > 0 ? cum[i] / tot : 0);
    return out;
  }
  var SEG = new Float64Array(18), MESHBUF = null;
  var NODBG = {};
  /** A link that is one straight piece with no dashes (the common case on a big network). */
  function isSeg(c) { return c.line && !c.dash && c.P.length === 8; }
  /** One item's dot as the 16 numbers the shape buffer holds (position, size, shape kind, outline width, fill, outline); the same numbers tessellate writes for every dot. */
  function dotRec(out, d) {
    var k = d.kind === undefined ? 1 : d.kind, a = d.a === undefined ? 1 : d.a, f = d.fill, s = d.stroke;
    out[0] = d.cx; out[1] = d.cy; out[2] = d.r; out[3] = d.r; out[4] = k === 0 ? Math.min(3, d.r) : d.r; out[5] = k; out[6] = d.sw; out[7] = 0;
    out[8] = f[0]; out[9] = f[1]; out[10] = f[2]; out[11] = f[3] * a; out[12] = s[0]; out[13] = s[1]; out[14] = s[2]; out[15] = s[3] * a;
  }
  /** A plain straight link as the 6 corner records (60 numbers) of its quad, written at o in mesh; returns the new o. */
  function segRec(mesh, o, c) {
    var a = c.a === undefined ? 1 : c.a, hw = c.w / 2, col = c.color, P = c.P, xa = P[0], ya = P[1], xb = P[6], yb = P[7], tx = xb - xa, ty = yb - ya, d = Math.hypot(tx, ty) || 1, nx = -ty / d, ny = tx / d, i;
    var r0 = col[0], r1 = col[1], r2 = col[2], r3 = col[3] * a, V = SEG;
    V[0] = xa; V[1] = ya; V[2] = -1; V[3] = xa; V[4] = ya; V[5] = 1; V[6] = xb; V[7] = yb; V[8] = -1; V[9] = xb; V[10] = yb; V[11] = -1; V[12] = xa; V[13] = ya; V[14] = 1; V[15] = xb; V[16] = yb; V[17] = 1;
    for (i = 0; i < 18; i += 3) { mesh[o++] = V[i]; mesh[o++] = V[i + 1]; mesh[o++] = nx; mesh[o++] = ny; mesh[o++] = hw; mesh[o++] = V[i + 2]; mesh[o++] = r0; mesh[o++] = r1; mesh[o++] = r2; mesh[o++] = r3; }
    return o;
  }
  /** A plain straight link as the 9 numbers the card builds its quad from (two end points, half width, color): 36 bytes where the six corner records are 240. */
  function instRec(out, o, c) {
    var a = c.a === undefined ? 1 : c.a, col = c.color, P = c.P;
    out[o] = P[0]; out[o + 1] = P[1]; out[o + 2] = P[6]; out[o + 3] = P[7]; out[o + 4] = c.w / 2; out[o + 5] = col[0]; out[o + 6] = col[1]; out[o + 7] = col[2]; out[o + 8] = col[3] * a;
  }
  var INST_STRIDE = 9, INSTBUF = null, EMPTY = new Float32Array(0);
  var PATCH = new Float32Array(MESH_STRIDE * 6), PATCH_MAX = 4000, PATCH_I = new Float32Array(INST_STRIDE);
  /** Rewrites just the dots and links that were moved (dirty = {dots, curves}: sets of positions in S.dots and S.curves) straight into the graphics-memory buffers. write(which, byteOffset, Float32Array) does the send. False when the picture is not laid out so that this works (then the page sends it all). */
  function patchBuffers(S, T, dirty, write) {
    if (!T || !T.uni || !dirty || T.nDots !== S.dots.length || T.nCurves !== (S.curveCount ? S.curveCount() : S.curves.length) || dirty.dots.size + dirty.curves.size > PATCH_MAX) return false;
    var dr = new Float32Array(SHAPE_STRIDE), cs = S.curveView ? null : S.curves;
    dirty.dots.forEach(function (i) { dotRec(dr, S.dots[i]); write('front', (T.dot0 + i) * SHAPE_STRIDE * 4, dr); });
    if (T.inst) dirty.curves.forEach(function (j) { instRec(PATCH_I, 0, cs ? cs[j] : S.curveView(j)); write('inst', j * INST_STRIDE * 4, PATCH_I); });
    else dirty.curves.forEach(function (j) { segRec(PATCH, 0, cs ? cs[j] : S.curveView(j)); write('mesh', j * 6 * MESH_STRIDE * 4, PATCH); });
    return true;
  }
  /** Turns a scene into flat arrays: back shapes, mesh (lines, arrows, ribbons), front shapes. a = item alpha from restyle. */
  function tessellate(S, opts) {
    var back = [], front = [], i;
    var shape = function (list, cx, cy, hw, hh, rad, kind, sw, fill, stroke, a) {
      list.push(cx, cy, hw, hh, rad, kind, sw, 0, fill[0], fill[1], fill[2], fill[3] * a, stroke[0], stroke[1], stroke[2], stroke[3] * a);
    };
    S.rects.forEach(function (r) { shape(r.layer === 0 ? back : front, r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, Math.min(r.r, r.w / 2, r.h / 2), 0, r.sw, r.fill, r.stroke, r.a === undefined ? 1 : r.a); });
    S.dots.forEach(function (d) { var k = d.kind === undefined ? 1 : d.kind; shape(front, d.cx, d.cy, d.r, d.r, k === 0 ? Math.min(3, d.r) : d.r, k, d.sw, d.fill, d.stroke, d.a === undefined ? 1 : d.a); });
    /* a network of nothing but plain straight links (no arrows, ribbons or hulls) can go to the card as 9 numbers a link, the quad built by its vertex shader (opts.inst, WebGL 2); anything else keeps the corner records below */
    var packedSeg = !!(S.curvesPacked && S.curvesPacked() && S.curvesStraight()), nC = packedSeg ? S.curveCount() : S.curves.length;   /* packed straight links are read without making an object each */
    var uni = !S.ribbons.length && !(S.polys && S.polys.length) && (packedSeg || S.curves.every(function (c) { return isSeg(c) && !c.arrow; })), dot0 = 0;
    S.rects.forEach(function (r) { if (r.layer !== 0) dot0++; });
    if (opts && opts.inst && uni && nC) {
      var nI = nC, needI = nI * INST_STRIDE;
      if (!INSTBUF || INSTBUF.length < needI) INSTBUF = new Float32Array(needI + (needI >> 2));
      if (packedSeg) S.eachCurveView(function (c, j) { instRec(INSTBUF, j * INST_STRIDE, c); }); else for (i = 0; i < nI; i++) instRec(INSTBUF, i * INST_STRIDE, S.curves[i]);
      return { back: new Float32Array(back), front: new Float32Array(front), mesh: EMPTY, inst: INSTBUF.subarray(0, needI), nInst: nI, nBack: back.length / SHAPE_STRIDE, nFront: front.length / SHAPE_STRIDE, nMesh: 0, uni: true, dot0: dot0, nDots: S.dots.length, nCurves: nI };
    }
    /* mesh */
    var verts = 0, plan = [], solidK = Infinity;
    S.ribbons.forEach(function (r) { var n = Math.max(10, Math.min(40, Math.ceil(Math.abs(r.x1 - r.x0) / 10))); plan.push(r); verts += n * 6; });
    var polyTris = 0;
    (S.polys || []).forEach(function (p) { polyTris += p.pts.length / 2; });
    verts += polyTris * 3;
    if (packedSeg) verts += 6 * nC; else S.curves.forEach(function (c) {
      if (isSeg(c)) { verts += 6 + (c.arrow ? 3 : 0); return; }
      var pts = c.pts || (c.pts = bezPts(c.P, c.line));
      c.solidDot = 0;
      if (c.dash === 1 && opts && opts.k) {   /* dots closer than 2 pixels cannot be told apart: a thin solid line with the same average ink replaces them until the view is zoomed in (the card re-cuts the dots then) */
        var dOn = Math.max(0.6, c.w * 0.5), dOff = Math.max(3, c.w * 2.2), kNeed = 2 / (dOn + dOff);
        if (opts.k < kNeed) { c.solidDot = dOn / (dOn + dOff); solidK = Math.min(solidK, kNeed); }
      }
      c.dashed = c.dash && !c.solidDot ? dashPieces(pts, c.w, c.dash) : null;
      var n = c.dashed ? c.dashed.reduce(function (a, q) { return a + q.length / 2 - 1; }, 0) : pts.length / 2 - 1;
      verts += n * 6 + (c.arrow ? 3 : 0);
    });
    /* One buffer kept between pictures (a big map is a couple of megabytes of it, and a new one every picture means a lot to clear and collect). The result is copied to the card at once, so nothing keeps a reference. */
    var need = verts * MESH_STRIDE;
    if (!MESHBUF || MESHBUF.length < need) MESHBUF = new Float32Array(need + (need >> 2));
    var mesh = MESHBUF, o = 0;
    var put = function (x, y, nx, ny, hw, side, c, a) { mesh[o++] = x; mesh[o++] = y; mesh[o++] = nx; mesh[o++] = ny; mesh[o++] = hw; mesh[o++] = side; mesh[o++] = c[0]; mesh[o++] = c[1]; mesh[o++] = c[2]; mesh[o++] = c[3] * a; };
    S.ribbons.forEach(function (r) {
      var a = r.a === undefined ? 1 : r.a, n = Math.max(10, Math.min(40, Math.ceil(Math.abs(r.x1 - r.x0) / 10))), c = r.color, c2 = r.color2, cAt = c2 ? function (u) { return [c[0] + (c2[0] - c[0]) * u, c[1] + (c2[1] - c[1]) * u, c[2] + (c2[2] - c[2]) * u, c[3]]; } : null;
      var ptsAt = function (ya0, ya1, u) { var m = 1 - u, y = m * m * m * ya0 + 3 * m * m * u * ya0 + 3 * m * u * u * ya1 + u * u * u * ya1, x = m * m * m * r.x0 + 3 * m * m * u * r.xm + 3 * m * u * u * r.xm + u * u * u * r.x1; return [x, y]; };
      for (var k = 0; k < n; k++) {
        var u0 = k / n, u1 = (k + 1) / n, t0 = ptsAt(r.y0a, r.y1a, u0), t1 = ptsAt(r.y0a, r.y1a, u1), b0 = ptsAt(r.y0b, r.y1b, u0), b1 = ptsAt(r.y0b, r.y1b, u1);
        var cc0 = cAt ? cAt(u0) : c, cc1 = cAt ? cAt(u1) : c;
        put(t0[0], t0[1], 0, 0, -1, 0, cc0, a); put(b0[0], b0[1], 0, 0, -1, 0, cc0, a); put(t1[0], t1[1], 0, 0, -1, 0, cc1, a);
        put(t1[0], t1[1], 0, 0, -1, 0, cc1, a); put(b0[0], b0[1], 0, 0, -1, 0, cc0, a); put(b1[0], b1[1], 0, 0, -1, 0, cc1, a);
      }
    });
    (S.polys || []).forEach(function (p) {
      var a = (p.a === undefined ? 1 : p.a), n = p.pts.length / 2, cx = p.c[0], cy = p.c[1];
      for (var q = 0; q < n; q++) { var q2 = (q + 1) % n; put(cx, cy, 0, 0, -1, 0, p.fill, a); put(p.pts[q * 2], p.pts[q * 2 + 1], 0, 0, -1, 0, p.fill, a); put(p.pts[q2 * 2], p.pts[q2 * 2 + 1], 0, 0, -1, 0, p.fill, a); }
    });
    var strip = function (pts, hw, col, a, hw1) {
      var n = pts.length / 2, nr = new Array(n * 2), i, hs = null;
      for (i = 0; i < n; i++) {
        var p0 = Math.max(0, i - 1), p1 = Math.min(n - 1, i + 1), tx = pts[p1 * 2] - pts[p0 * 2], ty = pts[p1 * 2 + 1] - pts[p0 * 2 + 1], d = Math.hypot(tx, ty) || 1;
        nr[i * 2] = -ty / d; nr[i * 2 + 1] = tx / d;
      }
      if (hw1 !== undefined) {   /* a tapered link: the half width goes from hw at the start to hw1 at the end, by the length so far */
        hs = taperHalf(pts, hw, hw1);
      }
      for (i = 0; i + 1 < n; i++) {
        var xa = pts[i * 2], ya = pts[i * 2 + 1], xb = pts[i * 2 + 2], yb = pts[i * 2 + 3], ha = hs ? hs[i] : hw, hb = hs ? hs[i + 1] : hw;
        put(xa, ya, nr[i * 2], nr[i * 2 + 1], ha, -1, col, a); put(xa, ya, nr[i * 2], nr[i * 2 + 1], ha, 1, col, a); put(xb, yb, nr[i * 2 + 2], nr[i * 2 + 3], hb, -1, col, a);
        put(xb, yb, nr[i * 2 + 2], nr[i * 2 + 3], hb, -1, col, a); put(xa, ya, nr[i * 2], nr[i * 2 + 1], ha, 1, col, a); put(xb, yb, nr[i * 2 + 2], nr[i * 2 + 3], hb, 1, col, a);
      }
    };
    if (packedSeg) S.eachCurveView(function (c) { o = segRec(mesh, o, c); }); else S.curves.forEach(function (c) {
      var a = c.a === undefined ? 1 : c.a, hw = c.w / 2, col = c.color;
      if (isSeg(c)) {
        /* A plain straight link (every link on a big network): one quad written straight into the buffer, the same numbers the general path gives. */
        o = segRec(mesh, o, c);
      } else if (c.dashed) c.dashed.forEach(function (q) { strip(q, hw, col, a); }); else if (c.solidDot) strip(c.pts, hw, col, a * c.solidDot); else strip(c.pts, hw, col, a, c.w1 !== undefined ? c.w1 / 2 : undefined);
      if (c.arrow) { var t = NFMScene.arrowTri(c); for (i = 0; i < 3; i++) put(t[i * 2], t[i * 2 + 1], 0, 0, -1, 0, col, a); }
    });
    /* where things sit, so an item that was moved can be rewritten in place (see patchBuffers): every link a plain straight piece, none with an arrow, no ribbons or hulls, so link j starts at vertex 6 * j */
    return { back: new Float32Array(back), front: new Float32Array(front), mesh: mesh.subarray(0, o), nBack: back.length / SHAPE_STRIDE, nFront: front.length / SHAPE_STRIDE, nMesh: o / MESH_STRIDE, solidDotK: solidK, uni: uni, dot0: dot0, nDots: S.dots.length, nCurves: nC };
  }
  /** Cuts a polyline into dashes: kind 1 = dots, 2 = short dashes, 3 = long dashes. Returns a list of flat polylines. */
  function dashPieces(pts, w, kind) {
    var on = kind === 1 ? Math.max(0.6, w * 0.5) : kind === 3 ? w * 6 + 6 : w * 3 + 4, off = kind === 1 ? Math.max(3, w * 2.2) : kind === 3 ? w * 3 + 5 : w * 2 + 4, out = [], cur = [], draw = true, left = on;
    cur.push(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) {
      var x0 = pts[i - 2], y0 = pts[i - 1], dx = pts[i] - x0, dy = pts[i + 1] - y0, len = Math.hypot(dx, dy), pos = 0;
      while (len - pos > left) {
        pos += left; var px = x0 + dx * pos / len, py = y0 + dy * pos / len;
        if (draw) { cur.push(px, py); out.push(cur); cur = []; } else { cur = [px, py]; }
        draw = !draw; left = draw ? on : off;
      }
      left -= len - pos;
      if (draw) cur.push(pts[i], pts[i + 1]);
    }
    if (draw && cur.length >= 4) out.push(cur);
    return out;
  }

  /* ---------------------------------------------------------------- labels (2D overlay, used by every backend) */
  function drawLabels(ctx, S, view, w, h, dpr) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var k = view.k, T = S.theme, drawn = 0, lastFont = '', bg = css(NFMScene.alpha(T.bg, 0.82));
    ctx.textBaseline = 'alphabetic';
    drawIcons(ctx, S, view);
    for (var i = 0; i < S.labels.length && drawn < 2500; i++) {
      var l = S.labels[i], px = l.size * k;
      if (k < l.minK || px < 6.5) continue;
      var x = l.x * k + view.tx, y = l.y * k + view.ty;
      if (!l.rot && (x < -300 || x > w + 300 || y < -40 || y > h + 40)) continue;
      if (l.rot && (x < -400 || x > w + 400 || y < -400 || y > h + 400)) continue;
      var font = (l.bold ? '700 ' : '500 ') + Math.min(px, 60).toFixed(1) + 'px ' + labelFamily;
      if (font !== lastFont) { ctx.font = font; lastFont = font; }
      ctx.globalAlpha = l.a === undefined ? 1 : l.a;
      ctx.textAlign = l.align === 'l' ? 'left' : l.align === 'r' ? 'right' : 'center';
      if (l.rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(l.rot * Math.PI / 180); x = 0; y = 0; }
      if (l.bg) { var tw = ctx.measureText(l.t).width; ctx.fillStyle = bg; ctx.fillRect(x - tw / 2 - 2, y - px, tw + 4, px + 3); }
      if (l.halo) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, 0.28 * Math.min(px, 60)); ctx.strokeStyle = css(l.halo); ctx.strokeText(l.t, x, y); }   /* a background-colored outline so the name reads over the bands behind it (Sankey middle columns) */
      ctx.fillStyle = css(l.color);
      ctx.fillText(l.t, x, y);
      if (l.rot) ctx.restore();
      drawn++;
    }
    ctx.globalAlpha = 1;
    if (S.overlayDraw) { ctx.save(); S.overlayDraw(ctx, view); ctx.restore(); }
  }
  /* pictures and icons on the node positions; drawn on the 2D overlay with the labels */
  var IMG_CACHE = new Map(), PATH_CACHE = {};
  function imageFor(url, invalidate) {
    var im = IMG_CACHE.get(url);
    if (!im) { im = new Image(); im.decoding = 'async'; im.onload = function () { im._ok = true; if (invalidate) invalidate(); }; im.onerror = function () { im._bad = true; }; im.src = url; IMG_CACHE.set(url, im); if (IMG_CACHE.size > 200) IMG_CACHE.delete(IMG_CACHE.keys().next().value); }
    return im;
  }
  function drawIcons(ctx, S, view) {
    if (!S.icons || !S.icons.length) return;
    var k = view.k, w = view.w || 99999, h = view.h || 99999;
    for (var i = 0; i < S.icons.length; i++) {
      var ic = S.icons[i], px = ic.cx * k + view.tx, py = ic.cy * k + view.ty, r = ic.r * k;
      if (k < (ic.minK || 0) || r < 4 || px < -r || py < -r || px > w + r || py > h + r) continue;
      ctx.globalAlpha = ic.a === undefined ? 1 : ic.a;
      if (ic.img) {
        var im = imageFor(ic.img, view.invalidate);
        if (im._ok) { var iw = im.naturalWidth || 1, ih = im.naturalHeight || 1, sc = Math.min(2 * r / iw, 2 * r / ih); ctx.drawImage(im, px - iw * sc / 2, py - ih * sc / 2, iw * sc, ih * sc); }
      } else if (NFMScene.ICONS[ic.icon]) {
        var path = PATH_CACHE[ic.icon] || (PATH_CACHE[ic.icon] = new Path2D(NFMScene.ICONS[ic.icon]));
        ctx.save(); ctx.translate(px - r, py - r); ctx.scale(r * 2 / 24, r * 2 / 24); ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = css([ic.color[0], ic.color[1], ic.color[2], 1]); ctx.stroke(path); ctx.restore();
      } else if (ic.icon) {
        ctx.font = Math.round(r * 1.25) + 'px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = css([ic.color[0], ic.color[1], ic.color[2], 1]); ctx.fillText(ic.icon, px, py + r * 0.05); ctx.textBaseline = 'alphabetic';
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- host: two stacked canvases */
  function newCanvas() { return typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1); }
  /* A spare canvas whose WebGL 2 context the page's idle start test already built and checked with the same settings the drawing uses (see probe.js, spareTest). The next WebGL 2 renderer adopts it instead of making a new one, so the browser's first-context cost is paid once. Used at most once; a lost context is never adopted. */
  var spare = null;
  function setSpare(c) { spare = c || null; }
  function takeSpare() {
    var c = spare; spare = null;
    try { if (c && c.__nfmGL && !c.__nfmGL.isContextLost()) return c; } catch (e) { /* gone */ }
    return null;
  }
  function makeHost(host, cpu, adopt) {
    if (!host || host.offscreen) {   /* in a worker (no page): two off-screen canvases, nothing to put on a page */
      var oa = new OffscreenCanvas(1, 1), ob = new OffscreenCanvas(1, 1);
      return { main: oa, over: ob, ctx2: ob.getContext('2d', cpu ? { willReadFrequently: true } : undefined) };
    }
    host.textContent = '';
    var a = adopt || document.createElement('canvas'), b = document.createElement('canvas');
    [a, b].forEach(function (c) { c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none'; });
    a.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-hidden', 'true'); b.style.pointerEvents = 'none';
    host.appendChild(a); host.appendChild(b);
    return { main: a, over: b, ctx2: b.getContext('2d', cpu ? { willReadFrequently: true } : undefined) };
  }
  function sizeCanvases(H, w, h, dpr) {
    var pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (H.main.width !== pw || H.main.height !== ph) { H.main.width = pw; H.main.height = ph; }
    if (H.over.width !== pw || H.over.height !== ph) { H.over.width = pw; H.over.height = ph; }
  }

  /* ---------------------------------------------------------------- Canvas2D */
  function rrect(ctx, x, y, w, h, r) {
    if (r <= 0.01) { ctx.rect(x, y, w, h); return; }
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function createCanvas2D(host, hooks) {
    var cpu = !!(hooks && hooks.cpu), H = makeHost(host, cpu), ctx = H.main.getContext('2d', cpu ? { alpha: false, willReadFrequently: true } : { alpha: false }), S = null, W = 1, Hh = 1, dpr = 1;   /* cpu: the picture is kept in memory and read back (GIF pictures), which avoids a slow card read-back per picture */
    if (!ctx) throw new Error('no 2D canvas');
    /* Moving the camera over a map that is slow to draw: the picture kept from the last full draw is slid and scaled to the new camera (a few ms), and the real picture is drawn again 140 ms after the camera stops, so at rest the picture is exactly what a full draw gives. Only used when the last full draw took over FAST_MS (a small map is always drawn in full). */
    var FAST_MS = 16, SETTLE_MS = 140, cache = null, cacheScene = null, cacheW = 0, cacheH = 0, fullView = null, fullFresh = false, lastFullMs = 0, settleT = 0, fastForce = null, lastDrawAt = 0, slowMotion = false;
    function fastDraw(view) {
      var sc = view.k / fullView.k;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = css(S.theme.bg); ctx.fillRect(0, 0, H.main.width, H.main.height);
      ctx.drawImage(cache, dpr * (view.tx - sc * fullView.tx), dpr * (view.ty - sc * fullView.ty), cacheW * sc, cacheH * sc);
      drawLabels(H.ctx2, S, view, W, Hh, dpr);
      fullFresh = false;
      settleT = setTimeout(function () { settleT = 0; if (view.invalidate) view.invalidate(); }, SETTLE_MS);
    }
    function tryFast(view) {
      if (!view.moved || !fullView || fastForce === false || (fastForce !== true && lastFullMs <= FAST_MS && !slowMotion)) return false;
      if (fullFresh) {   /* the canvas still holds the last full picture: keep it */
        if (!cache) cache = newCanvas();
        if (cache.width !== H.main.width || cache.height !== H.main.height) { cache.width = H.main.width; cache.height = H.main.height; }
        cache.getContext('2d').drawImage(H.main, 0, 0); cacheScene = S; cacheW = H.main.width; cacheH = H.main.height;
      } else if (!cache || cacheScene !== S || cacheW !== H.main.width || cacheH !== H.main.height) return false;
      fastDraw(view); return true;
    }
    var out = {
      name: 'canvas2d', label: 'Canvas 2D',
      patch: function (s) { return s === S; },   /* nothing is kept on a card: the next draw reads the scene as it now is */
      fastMove: function (v) { fastForce = v; },   /* test hook: true always slides the kept picture while the camera moves, false never, null by speed */
      setScene: function (s) { S = s; fullFresh = false; cacheScene = null; slowMotion = false; if (S && !(S.curvesPacked && S.curvesPacked())) S.curves.forEach(function (c) { if (c.bb === undefined) { var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (var i = 0; i < c.P.length; i += 2) { x0 = Math.min(x0, c.P[i]); x1 = Math.max(x1, c.P[i]); y0 = Math.min(y0, c.P[i + 1]); y1 = Math.max(y1, c.P[i + 1]); } c.bb = [x0 - 12, y0 - 12, x1 + 12, y1 + 12]; } }); },
      resize: function (w, h, d) { W = w; Hh = h; dpr = d; sizeCanvases(H, w, h, d); },
      draw: function (view) {
        if (!S) return;
        if (settleT) { clearTimeout(settleT); settleT = 0; }
        var tNow = performance.now(); if (view.moved && lastDrawAt && tNow - lastDrawAt > 40 && tNow - lastDrawAt < 400) slowMotion = true;   /* the browser finishes the drawing later, so the call itself looked cheap but the frames come slowly */
        lastDrawAt = tNow;
        if (tryFast(view)) return;
        var t00 = tNow, k = view.k, vx0 = -view.tx / k, vy0 = -view.ty / k, vx1 = (W - view.tx) / k, vy1 = (Hh - view.ty) / k;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = css(S.theme.bg); ctx.fillRect(0, 0, H.main.width, H.main.height);
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.tx, dpr * view.ty);
        var rect = function (r) {
          if (r.x > vx1 || r.y > vy1 || r.x + r.w < vx0 || r.y + r.h < vy0) return;
          var a = r.a === undefined ? 1 : r.a;
          ctx.beginPath(); rrect(ctx, r.x, r.y, r.w, r.h, Math.min(r.r, r.w / 2, r.h / 2));
          ctx.globalAlpha = a * r.fill[3]; ctx.fillStyle = css([r.fill[0], r.fill[1], r.fill[2], 1]); ctx.fill();
          if (r.sw > 0 && r.stroke[3] > 0) { ctx.globalAlpha = a * r.stroke[3]; ctx.lineWidth = r.sw; ctx.strokeStyle = css([r.stroke[0], r.stroke[1], r.stroke[2], 1]); ctx.stroke(); }
        };
        S.rects.forEach(function (r) { if (r.layer === 0) rect(r); });
        (S.polys || []).forEach(function (p) {
          ctx.beginPath(); for (var q = 0; q < p.pts.length; q += 2) { if (q) ctx.lineTo(p.pts[q], p.pts[q + 1]); else ctx.moveTo(p.pts[q], p.pts[q + 1]); } ctx.closePath();
          var pa = p.a === undefined ? 1 : p.a; ctx.globalAlpha = pa * p.fill[3]; ctx.fillStyle = css([p.fill[0], p.fill[1], p.fill[2], 1]); ctx.fill();
          ctx.globalAlpha = pa * p.stroke[3]; ctx.lineWidth = 1.5 / k; ctx.strokeStyle = css([p.stroke[0], p.stroke[1], p.stroke[2], 1]); ctx.stroke();
        });
        ctx.globalAlpha = 1;
        S.ribbons.forEach(function (r) {
          if (Math.max(r.x0, r.x1) < vx0 || Math.min(r.x0, r.x1) > vx1) return;
          ctx.globalAlpha = (r.a === undefined ? 1 : r.a) * r.color[3]; ctx.fillStyle = css([r.color[0], r.color[1], r.color[2], 1]);
          if (r.color2) { var gr = ctx.createLinearGradient(r.x0, 0, r.x1, 0); gr.addColorStop(0, css([r.color[0], r.color[1], r.color[2], 1])); gr.addColorStop(1, css([r.color2[0], r.color2[1], r.color2[2], 1])); ctx.fillStyle = gr; }
          ctx.beginPath(); ctx.moveTo(r.x0, r.y0a); ctx.bezierCurveTo(r.xm, r.y0a, r.xm, r.y1a, r.x1, r.y1a); ctx.lineTo(r.x1, r.y1b); ctx.bezierCurveTo(r.xm, r.y1b, r.xm, r.y0b, r.x0, r.y0b); ctx.closePath(); ctx.fill();
        });
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        var pr = -1, pg = -1, pb = -1, pcol = '', pa = -1, pw = -1;
        (S.eachCurveView ? S.eachCurveView : S.curves.forEach.bind(S.curves)).call(S, function (c) {
          var bb = c.bb; if (bb[0] > vx1 || bb[2] < vx0 || bb[1] > vy1 || bb[3] < vy0) return;
          var P = c.P, cc = c.color, a = (c.a === undefined ? 1 : c.a) * cc[3], w = Math.max(c.w, 1.4 / k), col;
          /* the pen is only set again when it changes (links come in a few styles, so most links change nothing): the same picture, without a color text and three settings for every link */
          if (cc[0] !== pr || cc[1] !== pg || cc[2] !== pb) { pr = cc[0]; pg = cc[1]; pb = cc[2]; pcol = css([pr, pg, pb, 1]); ctx.strokeStyle = pcol; }
          col = pcol;
          if (a !== pa) { pa = a; ctx.globalAlpha = a; }
          if (w !== pw) { pw = w; ctx.lineWidth = w; }
          if (c.dash) { var lw = ctx.lineWidth; ctx.setLineDash(c.dash === 1 ? [0.01, lw * 2.2 + 2] : c.dash === 3 ? [lw * 6 + 6, lw * 3 + 5] : [lw * 3 + 4, lw * 2 + 4]); ctx.lineCap = c.dash === 1 ? 'round' : 'butt'; }
          if (c.w1 !== undefined) {   /* tapered: a filled shape, thick at the start and thin at the end */
            var tp = c.pts || (c.pts = bezPts(c.P, c.line)), th = taperHalf(tp, c.w / 2, c.w1 / 2), tn = tp.length / 2, tq, tx0, ty0, tl = [], tr = [];
            for (tq = 0; tq < tn; tq++) { var pa = Math.max(0, tq - 1), pb = Math.min(tn - 1, tq + 1); tx0 = tp[pb * 2] - tp[pa * 2]; ty0 = tp[pb * 2 + 1] - tp[pa * 2 + 1]; var td = Math.hypot(tx0, ty0) || 1; tl.push(tp[tq * 2] - ty0 / td * th[tq], tp[tq * 2 + 1] + tx0 / td * th[tq]); tr.push(tp[tq * 2] + ty0 / td * th[tq], tp[tq * 2 + 1] - tx0 / td * th[tq]); }
            ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(tl[0], tl[1]); for (tq = 1; tq < tn; tq++) ctx.lineTo(tl[tq * 2], tl[tq * 2 + 1]); for (tq = tn - 1; tq >= 0; tq--) ctx.lineTo(tr[tq * 2], tr[tq * 2 + 1]); ctx.closePath(); ctx.fill();
            return;
          }
          ctx.beginPath(); ctx.moveTo(P[0], P[1]);
          if (c.line && !c.dash && P.length === 8) ctx.lineTo(P[6], P[7]);   /* a straight link is drawn as a line, not as a curve that happens to be straight: 17 to 25% less drawing time, the edge pixels differ by at most a few levels of 255 (99.98% of color values within 5) */
          else for (var i = 2; i < P.length; i += 6) ctx.bezierCurveTo(P[i], P[i + 1], P[i + 2], P[i + 3], P[i + 4], P[i + 5]);
          ctx.stroke();
          if (c.dash) { ctx.setLineDash([]); ctx.lineCap = 'butt'; }
          if (c.arrow) { var t = NFMScene.arrowTri(c); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[2], t[3]); ctx.lineTo(t[4], t[5]); ctx.closePath(); ctx.fill(); }
        });
        S.rects.forEach(function (r) { if (r.layer === 1) rect(r); });
        S.dots.forEach(function (d) {
          if (d.cx + d.r < vx0 || d.cx - d.r > vx1 || d.cy + d.r < vy0 || d.cy - d.r > vy1) return;
          var a = d.a === undefined ? 1 : d.a;
          ctx.beginPath(); var kd = d.kind === undefined ? 1 : d.kind;
          if (kd === 1) ctx.arc(d.cx, d.cy, d.r, 0, 6.2832); else if (kd === 0) rrect(ctx, d.cx - d.r, d.cy - d.r, 2 * d.r, 2 * d.r, Math.min(3, d.r)); else { var sp = NFMScene.shapePts(kd, d.cx, d.cy, d.r); ctx.moveTo(sp[0], sp[1]); for (var q = 2; q < sp.length; q += 2) ctx.lineTo(sp[q], sp[q + 1]); ctx.closePath(); }
          ctx.globalAlpha = a * d.fill[3]; ctx.fillStyle = css([d.fill[0], d.fill[1], d.fill[2], 1]); ctx.fill();
          if (d.sw > 0 && d.stroke[3] > 0) { ctx.globalAlpha = a * d.stroke[3]; ctx.lineWidth = d.sw; ctx.strokeStyle = css([d.stroke[0], d.stroke[1], d.stroke[2], 1]); ctx.stroke(); }
        });
        ctx.globalAlpha = 1;
        drawLabels(H.ctx2, S, view, W, Hh, dpr);
        lastFullMs = performance.now() - t00; fullView = { k: view.k, tx: view.tx, ty: view.ty }; fullFresh = true;
      },
      flush: function () { return Promise.resolve(); },
      snapshot: function () { return ctx.getImageData(0, 0, H.main.width, H.main.height); },
      layers: function () { return [H.main, H.over]; },   /* the two canvases, bottom first (a drawing worker puts them together itself) */
      destroy: function () { host.textContent = ''; }
    };
    return Promise.resolve(out);
  }

  /* ---------------------------------------------------------------- WebGL2 */
  var GL_SHAPE_VS = '#version 300 es\nprecision highp float;\nlayout(location=0) in vec4 iA;layout(location=1) in vec4 iB;layout(location=2) in vec4 iFill;layout(location=3) in vec4 iStroke;\n' +
    'uniform vec4 uV;uniform vec2 uRes;out vec2 vL;flat out vec4 vA;flat out vec4 vB;flat out vec4 vF;flat out vec4 vS;\n' +
    'void main(){vec2 c=vec2(0.,0.);int id=gl_VertexID;if(id==1||id==3)c=vec2(1.,0.);else if(id==2||id==5)c=vec2(0.,1.);else if(id==4)c=vec2(1.,1.);\n' +
    'vec2 q=c*2.-1.;float pad=iB.z*.5+2./uV.x;vec2 loc=q*(iA.zw+pad);vec2 w=iA.xy+loc;vec2 px=w*uV.x+uV.yz;\n' +
    'gl_Position=vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);vL=loc;vA=iA;vB=iB;vF=iFill;vS=iStroke;}';
  var GL_SHAPE_FS = '#version 300 es\nprecision highp float;in vec2 vL;flat in vec4 vA;flat in vec4 vB;flat in vec4 vF;flat in vec4 vS;uniform vec4 uV;out vec4 o;\n' +
    'void main(){float d;int kd=int(vB.y+.5);float r=vA.z;if(kd==1){d=length(vL)-r;}else if(kd==2){d=(abs(vL.x)+abs(vL.y)-r)*.70710678;}\n' +
    'else if(kd==3){vec2 p=abs(vL);const vec3 k=vec3(-.866025404,.5,.577350269);float ri=r*.866025404;p-=2.*min(dot(k.xy,p),0.)*k.xy;p-=vec2(clamp(p.x,-k.z*ri,k.z*ri),ri);d=length(p)*sign(p.y);}\n' +
    'else if(kd==4){float kk=1.7320508;float ri=r*.866025404;vec2 p=vec2(vL.x,-vL.y);p.x=abs(p.x)-ri;p.y=p.y+ri/kk;if(p.x+kk*p.y>0.)p=vec2(p.x-kk*p.y,-kk*p.x-p.y)/2.;p.x-=clamp(p.x,-2.*ri,0.);d=-length(p)*sign(p.y);}\n' +
    'else{vec2 q=abs(vL)-(vA.zw-vB.x);d=length(max(q,0.))+min(max(q.x,q.y),0.)-vB.x;}\n' +
    'float px=1./uV.x;float fc=clamp(.5-d/px,0.,1.);float sc=vB.z>0.?clamp(.5-(abs(d)-vB.z*.5)/px,0.,1.):0.;\n' +
    'vec4 f=vec4(vF.rgb*vF.a,vF.a)*fc;vec4 s=vec4(vS.rgb*vS.a,vS.a)*sc;o=s+f*(1.-s.a);}';
  var GL_MESH_VS = '#version 300 es\nprecision highp float;layout(location=0) in vec2 aP;layout(location=1) in vec2 aN;layout(location=2) in vec2 aHS;layout(location=3) in vec4 aC;\n' +
    'uniform vec4 uV;uniform vec2 uRes;out vec4 vC;out float vSide;out float vHw;out float vSolid;\n' +
    'void main(){float solid=aHS.x<0.?1.:0.;float hw=max(aHS.x,.7/uV.x);vec2 w=aP+aN*aHS.y*hw*(1.-solid);vec2 px=w*uV.x+uV.yz;\n' +
    'gl_Position=vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);vC=aC;vSide=aHS.y;vHw=hw*uV.x;vSolid=solid;}';
  /* the same quad from one instance (two end points, half width, color) and gl_VertexID 0..3 of a TRIANGLE_STRIP: corner = end (VertexID >= 2) and side (even = -1, odd = +1), the very numbers segRec writes, so the fragment shader below and the picture are the same */
  var GL_INST_VS = '#version 300 es\nprecision highp float;layout(location=0) in vec4 iP;layout(location=1) in vec4 iHC;layout(location=2) in float iA;\n' +
    'uniform vec4 uV;uniform vec2 uRes;out vec4 vC;out float vSide;out float vHw;out float vSolid;\n' +
    'void main(){int v=gl_VertexID;vec2 a=iP.xy,b=iP.zw;vec2 t=b-a;float d=length(t);if(d==0.)d=1.;vec2 n=vec2(-t.y,t.x)/d;\n' +
    'float side=((v&1)==0)?-1.:1.;float hw=max(iHC.x,.7/uV.x);vec2 w=(v>=2?b:a)+n*side*hw;vec2 px=w*uV.x+uV.yz;\n' +
    'gl_Position=vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);vC=vec4(iHC.yzw,iA);vSide=side;vHw=hw*uV.x;vSolid=0.;}';
  var GL_MESH_FS = '#version 300 es\nprecision highp float;in vec4 vC;in float vSide;in float vHw;in float vSolid;out vec4 o;\n' +
    'void main(){float cov=vSolid>.5?1.:clamp(vHw-abs(vSide)*vHw+.5,0.,1.);o=vec4(vC.rgb*vC.a,vC.a)*cov;}';


  /* ---------------------------------------------------------------- turning a big 3D map on the card: the same drawing, with the 3D math done by the vertex shaders.
     The items and links live in the card (textures in WebGL 2, storage buffers in WebGPU); a new angle is only a few numbers and a depth order. The pixels are
     worked out by the very same fragment shaders as the ordinary picture, so the two cannot look different. */
  var GL_RIG_HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;\nuniform sampler2D tN;uniform sampler2D tNS;uniform sampler2D tE;uniform sampler2D tES;\n' +
    'uniform vec4 uV;uniform vec2 uRes;uniform vec4 uCam;uniform vec4 uC3;uniform vec4 uFd;uniform vec4 uGold;uniform vec4 uBoxS;uniform vec4 uAcc;\n' +
    'vec4 F(sampler2D t,int i){return texelFetch(t,ivec2(i&2047,i>>11),0);}\n' +
    'struct Pn{vec2 p;float r;float f;float fd;};\n' +
    'Pn projP(vec4 a){float x1=a.x*uCam.x+a.z*uCam.y,z1=-a.x*uCam.y+a.z*uCam.x,y2=a.y*uCam.z-z1*uCam.w,z2=a.y*uCam.w+z1*uCam.z;float f=uC3.z/(uC3.z+z2);\n' +
    'Pn o;o.p=vec2(uC3.x+x1*f,uC3.y+y2*f);o.r=a.w*f;o.f=f;o.fd=uC3.w>.5?.42+.58*(1.-(z2-uFd.x)*uFd.y):1.;return o;}\n' +
    'Pn proj(int q){return projP(F(tN,q*4));}\n';
  var GL_RIG_EDGE_VS = GL_RIG_HEAD + 'out vec4 vC;out float vSide;out float vHw;out float vSolid;\n' +
    'void main(){int e=gl_InstanceID,v=gl_VertexID;vec4 EA=F(tE,e*4),EB=F(tE,e*4+1),E0=F(tE,e*4+2),E1=F(tE,e*4+3),ES=F(tES,e);Pn s=projP(EA),t=projP(EB);\n' +
    'vec2 dv=t.p-s.p;float d=sqrt(dot(dv,dv));if(d==0.)d=1.;vec2 en=t.p-dv/d*t.r,sn=s.p+dv/d*s.r;\n' +
    'float w=E0.x*(s.f+t.f)*.5;vec4 col=vec4(E1.rgb,E1.a*(s.fd+t.fd)*.5);float a=ES.x;if(ES.y>.5){w=max(w*1.8,w+2.);col=uAcc;a=1.;}\n' +
    'vec2 tv=en-sn;float dd=length(tv);if(dd==0.)dd=1.;vec2 nn=vec2(-tv.y,tv.x)/dd;\n' +
    'bool atB=(v>=2);float side=((v&1)==0)?-1.:1.;vec2 b=atB?en:sn;float hw=max(w*.5,.7/uV.x);vec2 wp=b+nn*side*hw;vec2 px=wp*uV.x+uV.yz;\n' +
    'gl_Position=vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);vC=vec4(col.rgb,col.a*a);vSide=side;vHw=hw*uV.x;vSolid=0.;}';
  var GL_RIG_DOT_VS = GL_RIG_HEAD + 'layout(location=0) in uint iId;out vec2 vL;flat out vec4 vA;flat out vec4 vB;flat out vec4 vF;flat out vec4 vS;\n' +
    'void main(){int q=int(iId>>1),which=int(iId&1u);Pn p=proj(q);vec4 N1=F(tN,q*4+1),N2=F(tN,q*4+2),N3=F(tN,q*4+3),S0=F(tNS,q*2),S1=F(tNS,q*2+1);\n' +
    'vec2 c;float r,kind,sw;vec4 fill,stroke;\n' +
    'if(which==0){c=p.p;r=p.r;kind=N3.y;sw=N3.x;float fa=mod(N3.z,2.)>.5?.15:N1.a*p.fd;fill=vec4(N1.rgb,fa);stroke=N2;if(S0.y>.5&&r>4.&&fa>.1){stroke=S1;sw=max(sw,4.);}}\n' +
    'else{c=p.p+vec2(p.r*.72,-p.r*.72);r=max(2.5,p.r*.3);kind=1.;sw=1.;fill=uGold;stroke=uBoxS;if(S0.y>.5&&r>4.&&uGold.a>.1){stroke=S1;sw=max(1.,4.);}}\n' +
    'float rad=kind<.5?min(3.,r):r;fill.a*=S0.x;stroke.a*=S0.x;\n' +
    'int id=gl_VertexID;vec2 cc=vec2(0.,0.);if(id==1||id==3)cc=vec2(1.,0.);else if(id==2||id==5)cc=vec2(0.,1.);else if(id==4)cc=vec2(1.,1.);\n' +
    'vec2 q2=cc*2.-1.;float pad=sw*.5+2./uV.x;vec2 loc=q2*(vec2(r)+pad);vec2 w=c+loc;vec2 px=w*uV.x+uV.yz;\n' +
    'gl_Position=vec4(px.x/uRes.x*2.-1.,1.-px.y/uRes.y*2.,0.,1.);vL=loc;vA=vec4(c,r,r);vB=vec4(rad,kind,sw,0.);vF=fill;vS=stroke;}';

  /* the same item shader, reading the paint order from a texture (4 ids per texel) instead of a per-instance attribute: another way to send the order each picture */
  var GL_RIG_DOT_VS_T = GL_RIG_DOT_VS.replace('layout(location=0) in uint iId;', 'uniform highp usampler2D tO;').replace('void main(){int q=', 'void main(){int ii=gl_InstanceID,tx=ii>>2;uvec4 tv=texelFetch(tO,ivec2(tx&2047,tx>>11),0);uint iId=(ii&3)==0?tv.x:(ii&3)==1?tv.y:(ii&3)==2?tv.z:tv.w;int q=');

  function glProgram(gl, vs, fs) {
    var mk = function (t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
    var p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  function createWebGL2(host, hooks) {
    var sp = (host && !host.offscreen) ? takeSpare() : null, H = makeHost(host, false, sp), gl = H.main.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no WebGL2');
    var lost = false, destroyed = false;
    /* destroy() loses the context on purpose; that late event must not tell the manager the graphics were lost (it would tear down the renderer that replaced this one, and three of them in a minute switch WebGL 2 off) */
    H.main.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; if (!destroyed && hooks && hooks.onLost) hooks.onLost('webgl2'); });
    var pS = glProgram(gl, GL_SHAPE_VS, GL_SHAPE_FS), pM = glProgram(gl, GL_MESH_VS, GL_MESH_FS);
    var uS = { v: gl.getUniformLocation(pS, 'uV'), r: gl.getUniformLocation(pS, 'uRes') }, uM = { v: gl.getUniformLocation(pM, 'uV'), r: gl.getUniformLocation(pM, 'uRes') };
    var mkVao = function (layout, buf, divisor) {
      var vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      layout.forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, a[3], a[2] * 4); if (divisor) gl.vertexAttribDivisor(a[0], 1); });
      gl.bindVertexArray(null); return vao;
    };
    var bBack = gl.createBuffer(), bFront = gl.createBuffer(), bMesh = gl.createBuffer(), bInst = gl.createBuffer(), pI = null, uI = null, vaoInst = null, instOn = null;
    /* plain straight links as 9 numbers each (see GL_INST_VS); if the program does not build, the corner-record path below is used as before */
    try {
      pI = glProgram(gl, GL_INST_VS, GL_MESH_FS); uI = { v: gl.getUniformLocation(pI, 'uV'), r: gl.getUniformLocation(pI, 'uRes') };
      vaoInst = gl.createVertexArray(); gl.bindVertexArray(vaoInst); gl.bindBuffer(gl.ARRAY_BUFFER, bInst);
      [[0, 4, 0], [1, 4, 4], [2, 1, 8]].forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, INST_STRIDE * 4, a[2] * 4); gl.vertexAttribDivisor(a[0], 1); });
      gl.bindVertexArray(null);
    } catch (e) { pI = null; if (hooks && hooks.onError) hooks.onError('webgl2', 'straight links on the card: ' + e.message); }
    /* Whether 9-number links are faster on this card is measured once, the first time a big enough network of straight links comes (as gpustress does for the 3D turn): 50,000 short random links drawn both ways far out of view (so only the vertex stage and the one-instance-per-link set-up are measured, not the pixels) into a small off-screen picture, each read back to wait for the card; the new way is kept unless it is more than 5% (and 1 ms) slower. A card that draws in software, where the shader does the extra work on the processor, takes the old way. instOn: null = not measured yet, true/false = decided (instLinks sets it by hand for the tests). */
    var probe = function () {
      var fb = null, rb = null;
      try {
        var N = 50000, rnd = 7, r = function () { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
        var inst = new Float32Array(N * INST_STRIDE), mesh = new Float32Array(N * 6 * MESH_STRIDE), c = { P: [0, 0, 0, 0, 0, 0, 0, 0], w: 1.5, color: [0.3, 0.4, 0.8, 0.6], a: 1 };
        for (var i = 0; i < N; i++) { var x = r() * 400, y = r() * 400; c.P[0] = c.P[2] = x; c.P[1] = c.P[3] = y; c.P[4] = c.P[6] = x + (r() - 0.5) * 30; c.P[5] = c.P[7] = y + (r() - 0.5) * 30; c.w = 1 + (i % 4) * 0.5; instRec(inst, i * INST_STRIDE, c); segRec(mesh, i * 6 * MESH_STRIDE, c); }
        var tI = gl.createBuffer(), tM = gl.createBuffer(); up(tI, inst); up(tM, mesh);
        var vI = gl.createVertexArray(); gl.bindVertexArray(vI); gl.bindBuffer(gl.ARRAY_BUFFER, tI);
        [[0, 4, 0], [1, 4, 4], [2, 1, 8]].forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, INST_STRIDE * 4, a[2] * 4); gl.vertexAttribDivisor(a[0], 1); });
        var vM = mkVao([[0, 2, 0, 40], [1, 2, 2, 40], [2, 2, 4, 40], [3, 4, 6, 40]], tM, false);
        fb = gl.createFramebuffer(); rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, 512, 512); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
        var px = new Uint8Array(4), prevVp = gl.getParameter(gl.VIEWPORT);
        gl.viewport(0, 0, 512, 512); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        var run = function (way, tx) {
          gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
          var t0 = performance.now();
          if (way) { gl.useProgram(pI); gl.uniform4f(uI.v, 1, tx, 0, 0); gl.uniform2f(uI.r, 512, 512); gl.bindVertexArray(vI); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N); }
          else { gl.useProgram(pM); gl.uniform4f(uM.v, 1, tx, 0, 0); gl.uniform2f(uM.r, 512, 512); gl.bindVertexArray(vM); gl.drawArrays(gl.TRIANGLES, 0, N * 6); }
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          return performance.now() - t0;
        };
        run(true, 0); run(false, 0);   /* the first of each includes compiling and moving data */
        var a = [0, 0, 0], b = [0, 0, 0]; for (var k = 0; k < 3; k++) { a[k] = run(true, -9000); b[k] = run(false, -9000); }
        a.sort(function (p, q) { return p - q; }); b.sort(function (p, q) { return p - q; });
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3]); gl.bindVertexArray(null);
        gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); gl.deleteBuffer(tI); gl.deleteBuffer(tM); gl.deleteVertexArray(vI); gl.deleteVertexArray(vM);
        out.instProbe = { inst: a[1], corners: b[1] };
        return a[1] <= b[1] * 1.05 + 1;   /* the clock is whole milliseconds in some browsers */
      } catch (e) { try { gl.bindFramebuffer(gl.FRAMEBUFFER, null); } catch (x) { /* gone */ } return false; }
    };
    var lastK = 0;   /* the zoom of the last picture; before the first one, the zoom that fits the map */
    var tess = function (s, k) {
      var want = false;
      if (pI && s && (s.curveCount ? s.curveCount() : s.curves.length)) { if (instOn === null && (s.curveCount ? s.curveCount() : s.curves.length) >= 2000) instOn = probe(); want = instOn === true; }
      var o = want ? { inst: true } : {}; o.k = k || lastK || (s && s.w && s.h ? Math.min(W / s.w, Hh / s.h) * 0.96 : 0); return tessellate(s, o);
    };
    var send = function () { up(bBack, T.back); up(bFront, T.front); if (T.inst) up(bInst, T.inst); else up(bMesh, T.mesh); };
    var sl = [[0, 4, 0, 64], [1, 4, 4, 64], [2, 4, 8, 64], [3, 4, 12, 64]], vaoBack = mkVao(sl, bBack, true), vaoFront = mkVao(sl, bFront, true);
    var vaoMesh = mkVao([[0, 2, 0, 40], [1, 2, 2, 40], [2, 2, 4, 40], [3, 4, 6, 40]], bMesh, false);
    var T = null, S = null, W = 1, Hh = 1, dpr = 1;
    var up = function (buf, data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); };
    /* turning a big 3D map: items and links stay in textures; each picture sends only the camera numbers and the paint order (see GL_RIG_* above) */
    var RG = null, rigState = { id: 0, style: -1, ver: -1 };
    var rigPrepare = function () {
      if (RG !== null) return !!RG;
      try {
        var pe = glProgram(gl, GL_RIG_EDGE_VS, GL_MESH_FS), pd = glProgram(gl, GL_RIG_DOT_VS, GL_SHAPE_FS), pdT = glProgram(gl, GL_RIG_DOT_VS_T, GL_SHAPE_FS), names = ['uV', 'uRes', 'uCam', 'uC3', 'uFd', 'uGold', 'uBoxS', 'uAcc', 'tN', 'tNS', 'tE', 'tES', 'tO'];
        var loc = function (p) { var o = {}; names.forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; };
        /* the paint order is sent for every new angle: three buffers taken in turn, each made once at full size and then only written into (making a new one every picture stalled big maps) */
        var seqBufs = [], vaoSeqs = [];
        for (var sb = 0; sb < 3; sb++) { var sbuf = gl.createBuffer(), sv = gl.createVertexArray(); gl.bindVertexArray(sv); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 4, 0); gl.vertexAttribDivisor(0, 1); gl.bindVertexArray(null); seqBufs.push(sbuf); vaoSeqs.push(sv); }
        var tex = function () { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
        RG = { pe: pe, pd: pd, pdT: pdT, le: loc(pe), ld: loc(pd), ldT: loc(pdT), tO: tex(), seqBufs: seqBufs, vaoSeqs: vaoSeqs, vaoNone: gl.createVertexArray(), tN: tex(), tNS: tex(), tE: tex(), tES: tex() };
      } catch (e) { RG = false; if (hooks && hooks.onError) hooks.onError('webgl2', 'turning on the card: ' + e.message); }
      out.rigOK = !!RG; return !!RG;
    };
    /* writes `floats` (4 per texel) into a 2048-wide float texture, as many rows as needed */
    var putTex = function (t, floats) {
      var texels = Math.max(1, Math.ceil(floats.length / 4)), rows = Math.ceil(texels / 2048), data = floats;
      if (floats.length !== 2048 * rows * 4) { data = new Float32Array(2048 * rows * 4); data.set(floats); }
      gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 2048, rows, 0, gl.RGBA, gl.FLOAT, data);
    };
    var rigSync = function () {
      var rig = S.rig;
      if (rigState.id !== rig.id) { putTex(RG.tN, rig.nodeF); putTex(RG.tE, rig.edgeG); rigState.id = rig.id; rigState.style = -1; rigState.sid2 = null; for (var sb = 0; sb < 3; sb++) { gl.bindBuffer(gl.ARRAY_BUFFER, RG.seqBufs[sb]); gl.bufferData(gl.ARRAY_BUFFER, rig.n * 8, gl.DYNAMIC_DRAW); } rigState.ring = 0; rigState.rowsO = Math.max(1, Math.ceil(Math.ceil(rig.n * 2 / 4) / 2048)); rigState.scratch = null; rigState.verT = -1; gl.bindTexture(gl.TEXTURE_2D, RG.tO); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, 2048, rigState.rowsO, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, null); }
      if (rigState.style !== S.styleVer || rigState.sid !== S) { var st = NFMScene.rigStyle(S); putTex(RG.tNS, st.node); putTex(RG.tES, st.edge); rigState.style = S.styleVer; rigState.sid = S; }
    };
    var drawRig = function (view) {
      var tu = S.turn, rig = S.rig; rigSync();
      var dbg0 = out.rigDebug || NODBG;
      var via = dbg0.orderVia || out.orderVia || 'attrib';
      if (via === 'texture') {
        if ((rigState.verT !== tu.ver || rigState.sidT !== S) && !dbg0.keepOrder) {
          var rowsU = Math.max(1, Math.ceil(Math.ceil(tu.nseq / 4) / 2048)), need = rowsU * 8192;
          if (!rigState.scratch) rigState.scratch = new Uint32Array(rigState.rowsO * 8192);
          rigState.scratch.set(tu.seq.subarray(0, tu.nseq));
          gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, RG.tO); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 2048, rowsU, gl.RGBA_INTEGER, gl.UNSIGNED_INT, rigState.scratch.subarray(0, need)); gl.activeTexture(gl.TEXTURE0);
          rigState.verT = tu.ver; rigState.sidT = S;
        }
      } else if ((rigState.ver !== tu.ver || rigState.sid2 !== S) && !dbg0.keepOrder) { rigState.ring = (rigState.ring + 1) % 3; gl.bindBuffer(gl.ARRAY_BUFFER, RG.seqBufs[rigState.ring]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, tu.seq.subarray(0, tu.nseq)); rigState.ver = tu.ver; rigState.sid2 = S; }
      var bind = function (p, l) {
        gl.useProgram(p); gl.uniform4f(l.uV, view.k, view.tx, view.ty, 0); gl.uniform2f(l.uRes, W, Hh); gl.uniform4f(l.uCam, tu.cy, tu.sy, tu.cp, tu.sp); gl.uniform4f(l.uC3, tu.c3x, tu.c3y, tu.D3, tu.fadeOn); gl.uniform4f(l.uFd, tu.dmin, tu.inv, 0, 0);
        gl.uniform4fv(l.uGold, tu.gold); gl.uniform4fv(l.uBoxS, tu.boxS); gl.uniform4fv(l.uAcc, tu.accent);
        gl.uniform1i(l.tN, 0); gl.uniform1i(l.tNS, 1); gl.uniform1i(l.tE, 2); gl.uniform1i(l.tES, 3);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RG.tN); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RG.tNS); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RG.tE); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, RG.tES);
      };
      var dbg = out.rigDebug || NODBG;   /* the tester switches parts off to find which one costs the time */
      if (rig.m && !dbg.noLinks) { bind(RG.pe, RG.le); gl.bindVertexArray(RG.vaoNone); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rig.m); }
      if (tu.nseq && !dbg.noItems) {
        if (via === 'texture') { bind(RG.pdT, RG.ldT); gl.uniform1i(RG.ldT.tO, 4); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, RG.tO); gl.bindVertexArray(RG.vaoNone); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, tu.nseq); }
        else { bind(RG.pd, RG.ld); gl.bindVertexArray(RG.vaoSeqs[rigState.ring]); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, tu.nseq); }
      }
      gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    };
    var info = (function () { try { var e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (x) { return ''; } })();
    var out = {
      name: 'webgl2', label: 'WebGL 2', device: info,
      setScene: function (s) { S = s; T = s ? tess(s) : null; if (T) send(); },
      restyle: function () { if (S && !(S.turn && S.turn.on)) { T = tess(S); send(); } },
      /* test hook: false draws straight links from the six corner records as before (the pictures must match), true from 9 numbers each; takes effect from the next setScene */
      instLinks: function (on) { instOn = on === null ? null : !!on; },
      usesInst: function () { return !!(T && T.nInst); },
      patch: function (s, dirty) {
        if (s !== S || (S.turn && S.turn.on)) return false;
        return patchBuffers(S, T, dirty, function (which, at, data) { var b = which === 'front' ? bFront : which === 'inst' ? bInst : bMesh; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, at, data); });
      },
      rigPrepare: rigPrepare, rigOK: false,
      /* Puts a big 3D map on the card ahead of the first drag: the item and link textures are uploaded and each rig program is used once, drawing nothing (a zero-size scissor), so the driver finishes compiling and moving data now instead of during the first turn. */
      rigWarm: function () {
        if (!RG || !S || !S.rig || lost) return false;
        try {
          rigSync();
          var wp = function (p, l, vao, mode, cnt) {
            gl.useProgram(p); gl.uniform4f(l.uV, 1, 0, 0, 0); gl.uniform2f(l.uRes, W, Hh); gl.uniform1i(l.tN, 0); gl.uniform1i(l.tNS, 1); gl.uniform1i(l.tE, 2); gl.uniform1i(l.tES, 3);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RG.tN); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RG.tNS); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RG.tE); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, RG.tES);
            gl.bindVertexArray(vao); gl.drawArraysInstanced(mode, 0, cnt, 1);
          };
          /* into a one-pixel picture of its own, not the screen's buffer: a draw into the screen's buffer after the map was shown makes the browser show that buffer again, and it is empty (the map went black on big 3D maps until Fit) */
          var wfb = gl.createFramebuffer(), wrb = gl.createRenderbuffer();
          gl.bindRenderbuffer(gl.RENDERBUFFER, wrb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, 1, 1); gl.bindFramebuffer(gl.FRAMEBUFFER, wfb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, wrb);
          var vp = gl.getParameter(gl.VIEWPORT); gl.viewport(0, 0, 1, 1); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 0, 0);
          wp(RG.pe, RG.le, RG.vaoNone, gl.TRIANGLE_STRIP, 4);
          wp(RG.pd, RG.ld, RG.vaoSeqs[rigState.ring || 0], gl.TRIANGLES, 6);
          gl.disable(gl.SCISSOR_TEST); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(vp[0], vp[1], vp[2], vp[3]); gl.deleteFramebuffer(wfb); gl.deleteRenderbuffer(wrb);
          return true;
        } catch (e) { try { gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null); } catch (x) { /* none */ } return false; }
      },
      resize: function (w, h, d) { W = w; Hh = h; dpr = d; sizeCanvases(H, w, h, d); },
      draw: function (view) {
        if (!S || lost) return;
        gl.viewport(0, 0, H.main.width, H.main.height);
        var bg = S.theme.bg; gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        if (S.turn && S.turn.on && S.rig && RG) { drawRig(view); if (!(out.rigDebug && out.rigDebug.noNames)) drawLabels(H.ctx2, S, view, W, Hh, dpr); return; }
        lastK = view.k; if (T && T.solidDotK && view.k >= T.solidDotK) { T = tess(S, view.k); send(); }   /* zoomed in until the dots can be told apart: cut them again */
        var shapes = function (vao, n) { if (!n) return; gl.useProgram(pS); gl.uniform4f(uS.v, view.k, view.tx, view.ty, 0); gl.uniform2f(uS.r, W, Hh); gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n); };
        shapes(vaoBack, T.nBack);
        if (T.nInst) { gl.useProgram(pI); gl.uniform4f(uI.v, view.k, view.tx, view.ty, 0); gl.uniform2f(uI.r, W, Hh); gl.bindVertexArray(vaoInst); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, T.nInst); }
        if (T.nMesh) { gl.useProgram(pM); gl.uniform4f(uM.v, view.k, view.tx, view.ty, 0); gl.uniform2f(uM.r, W, Hh); gl.bindVertexArray(vaoMesh); gl.drawArrays(gl.TRIANGLES, 0, T.nMesh); }
        shapes(vaoFront, T.nFront);
        gl.bindVertexArray(null);
        drawLabels(H.ctx2, S, view, W, Hh, dpr);
      },
      flush: function () { var px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Promise.resolve(); },
      snapshot: function () { return copyViaCanvas(H.main); },
      destroy: function () { destroyed = true; try { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* gone */ } host.textContent = ''; }
    };
    return Promise.resolve(out);
  }
  function copyViaCanvas(src) {
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
    return x.getImageData(0, 0, c.width, c.height);
  }

  /* ---------------------------------------------------------------- WebGPU */
  var WGSL_COMMON = 'struct U { v: vec4<f32>, res: vec2<f32>, pad: vec2<f32> };\n@group(0) @binding(0) var<uniform> u: U;\n';
  var WGSL_SHAPE_VO = 'struct VO { @builtin(position) pos: vec4<f32>, @location(0) loc: vec2<f32>, @location(1) @interpolate(flat) a: vec4<f32>, @location(2) @interpolate(flat) b: vec4<f32>, @location(3) @interpolate(flat) f: vec4<f32>, @location(4) @interpolate(flat) s: vec4<f32> };\n';
  var WGSL_SHAPE = WGSL_COMMON + WGSL_SHAPE_VO +
    '@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) a: vec4<f32>, @location(1) b: vec4<f32>, @location(2) f: vec4<f32>, @location(3) s: vec4<f32>) -> VO {\n' +
    ' var cs = array<vec2<f32>,6>(vec2<f32>(0.,0.),vec2<f32>(1.,0.),vec2<f32>(0.,1.),vec2<f32>(1.,0.),vec2<f32>(1.,1.),vec2<f32>(0.,1.));\n' +
    ' let q = cs[vi]*2.-1.; let pad = b.z*.5 + 2./u.v.x; let loc = q*(a.zw+pad); let w = a.xy+loc; let px = w*u.v.x + u.v.yz;\n' +
    ' var o: VO; o.pos = vec4<f32>(px.x/u.res.x*2.-1., 1.-px.y/u.res.y*2., 0., 1.); o.loc = loc; o.a=a; o.b=b; o.f=f; o.s=s; return o; }\n' +
    '@fragment fn fs(i: VO) -> @location(0) vec4<f32> {\n' +
    ' var d: f32; let kd = i32(i.b.y + .5); let r = i.a.z;\n' +
    ' if (kd == 1) { d = length(i.loc) - r; }\n' +
    ' else if (kd == 2) { d = (abs(i.loc.x) + abs(i.loc.y) - r) * .70710678; }\n' +
    ' else if (kd == 3) { let k = vec3<f32>(-.866025404, .5, .577350269); let ri = r * .866025404; var p = abs(i.loc); p = p - 2. * min(dot(k.xy, p), 0.) * k.xy; p = p - vec2<f32>(clamp(p.x, -k.z * ri, k.z * ri), ri); d = length(p) * sign(p.y); }\n' +
    ' else if (kd == 4) { let kk = 1.7320508; let ri = r * .866025404; var p = vec2<f32>(i.loc.x, -i.loc.y); p.x = abs(p.x) - ri; p.y = p.y + ri / kk; if (p.x + kk * p.y > 0.) { p = vec2<f32>(p.x - kk * p.y, -kk * p.x - p.y) / 2.; } p.x = p.x - clamp(p.x, -2. * ri, 0.); d = -length(p) * sign(p.y); }\n' +
    ' else { let q = abs(i.loc) - (i.a.zw - i.b.x); d = length(max(q, vec2<f32>(0.))) + min(max(q.x,q.y),0.) - i.b.x; }\n' +
    ' let px = 1./u.v.x; let fc = clamp(.5 - d/px, 0., 1.); var sc = 0.; if (i.b.z > 0.) { sc = clamp(.5 - (abs(d) - i.b.z*.5)/px, 0., 1.); }\n' +
    ' let f = vec4<f32>(i.f.rgb*i.f.a, i.f.a)*fc; let s = vec4<f32>(i.s.rgb*i.s.a, i.s.a)*sc; return s + f*(1.-s.a); }\n';
  var WGSL_MESH = WGSL_COMMON +
    'struct VO { @builtin(position) pos: vec4<f32>, @location(0) c: vec4<f32>, @location(1) side: f32, @location(2) hw: f32, @location(3) solid: f32 };\n' +
    '@vertex fn vs(@location(0) p: vec2<f32>, @location(1) n: vec2<f32>, @location(2) hs: vec2<f32>, @location(3) c: vec4<f32>) -> VO {\n' +
    ' var solid = 0.; if (hs.x < 0.) { solid = 1.; } let hw = max(hs.x, .7/u.v.x); let w = p + n*hs.y*hw*(1.-solid); let px = w*u.v.x + u.v.yz;\n' +
    ' var o: VO; o.pos = vec4<f32>(px.x/u.res.x*2.-1., 1.-px.y/u.res.y*2., 0., 1.); o.c = c; o.side = hs.y; o.hw = hw*u.v.x; o.solid = solid; return o; }\n' +
    '@fragment fn fs(i: VO) -> @location(0) vec4<f32> {\n' +
    ' var cov = 1.; if (i.solid < .5) { cov = clamp(i.hw - abs(i.side)*i.hw + .5, 0., 1.); } return vec4<f32>(i.c.rgb*i.c.a, i.c.a)*cov; }\n';

  /* turning a big 3D map on the card (WebGPU): the same fragment code as above, with vertex shaders that read the items and links from storage buffers */
  var WGSL_SHAPE_FS = WGSL_SHAPE.slice(WGSL_SHAPE.indexOf('@fragment')), WGSL_MESH_VO = WGSL_MESH.slice(WGSL_MESH.indexOf('struct VO'), WGSL_MESH.indexOf('@vertex')), WGSL_MESH_FS = WGSL_MESH.slice(WGSL_MESH.indexOf('@fragment'));
  var WGSL_RIG = 'struct RU { v: vec4<f32>, res: vec4<f32>, cam: vec4<f32>, c3: vec4<f32>, fd: vec4<f32>, gold: vec4<f32>, boxs: vec4<f32>, acc: vec4<f32> };\n' +
    '@group(0) @binding(0) var<uniform> u: RU;\n@group(0) @binding(1) var<storage, read> nodeF: array<vec4<f32>>;\n@group(0) @binding(2) var<storage, read> nodeS: array<vec4<f32>>;\n' +
    '@group(0) @binding(3) var<storage, read> edgeF: array<vec4<f32>>;\n@group(0) @binding(4) var<storage, read> edgeS: array<vec4<f32>>;\n' +
    'struct Pn { p: vec2<f32>, r: f32, f: f32, fd: f32 };\n' +
    'fn projP(a: vec4<f32>) -> Pn {\n let x1 = a.x*u.cam.x + a.z*u.cam.y; let z1 = -a.x*u.cam.y + a.z*u.cam.x; let y2 = a.y*u.cam.z - z1*u.cam.w; let z2 = a.y*u.cam.w + z1*u.cam.z;\n' +
    ' let f = u.c3.z/(u.c3.z + z2); var o: Pn; o.p = vec2<f32>(u.c3.x + x1*f, u.c3.y + y2*f); o.r = a.w*f; o.f = f;\n o.fd = 1.; if (u.c3.w > .5) { o.fd = .42 + .58*(1. - (z2 - u.fd.x)*u.fd.y); }\n return o; }\n' +
    'fn proj(q: u32) -> Pn { return projP(nodeF[q*4u]); }\n';
  var WGSL_RIG_EDGE = WGSL_RIG + WGSL_MESH_VO +
    '@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) e: u32) -> VO {\n' +
    ' let EA = edgeF[e*4u]; let EB = edgeF[e*4u+1u]; let E0 = edgeF[e*4u+2u]; let E1 = edgeF[e*4u+3u]; let ES = edgeS[e]; let s = projP(EA); let t = projP(EB);\n' +
    ' let dv = t.p - s.p; var d = sqrt(dot(dv,dv)); if (d == 0.) { d = 1.; } let en = t.p - dv/d*t.r; let sn = s.p + dv/d*s.r;\n' +
    ' var w = E0.x*(s.f+t.f)*.5; var col = vec4<f32>(E1.rgb, E1.a*(s.fd+t.fd)*.5); var a = ES.x; if (ES.y > .5) { w = max(w*1.8, w+2.); col = u.acc; a = 1.; }\n' +
    ' let tv = en - sn; var dd = length(tv); if (dd == 0.) { dd = 1.; } let nn = vec2<f32>(-tv.y, tv.x)/dd;\n' +
    ' var side = 1.; if ((v & 1u) == 0u) { side = -1.; } var b = sn; if (v >= 2u) { b = en; }\n' +
    ' let hw = max(w*.5, .7/u.v.x); let wp = b + nn*side*hw; let px = wp*u.v.x + u.v.yz;\n' +
    ' var o: VO; o.pos = vec4<f32>(px.x/u.res.x*2.-1., 1.-px.y/u.res.y*2., 0., 1.); o.c = vec4<f32>(col.rgb, col.a*a); o.side = side; o.hw = hw*u.v.x; o.solid = 0.; return o; }\n' + WGSL_MESH_FS;
  var WGSL_RIG_DOT = WGSL_RIG + WGSL_SHAPE_VO +
    '@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) id: u32) -> VO {\n' +
    ' let q = id >> 1u; let which = id & 1u; let p = proj(q); let N1 = nodeF[q*4u+1u]; let N2 = nodeF[q*4u+2u]; let N3 = nodeF[q*4u+3u]; let S0 = nodeS[q*2u]; let S1 = nodeS[q*2u+1u];\n' +
    ' var c: vec2<f32>; var r: f32; var kind: f32; var sw: f32; var fill: vec4<f32>; var stroke: vec4<f32>;\n' +
    ' if (which == 0u) { c = p.p; r = p.r; kind = N3.y; sw = N3.x; var fa = N1.a*p.fd; if (N3.z - 2.*floor(N3.z*.5) > .5) { fa = .15; } fill = vec4<f32>(N1.rgb, fa); stroke = N2;\n' +
    '   if (S0.y > .5 && r > 4. && fa > .1) { stroke = S1; sw = max(sw, 4.); } }\n' +
    ' else { c = p.p + vec2<f32>(p.r*.72, -p.r*.72); r = max(2.5, p.r*.3); kind = 1.; sw = 1.; fill = u.gold; stroke = u.boxs; if (S0.y > .5 && r > 4. && u.gold.w > .1) { stroke = S1; sw = max(1., 4.); } }\n' +
    ' var rad = r; if (kind < .5) { rad = min(3., r); } fill.w = fill.w*S0.x; stroke.w = stroke.w*S0.x;\n' +
    ' var cs = array<vec2<f32>,6>(vec2<f32>(0.,0.),vec2<f32>(1.,0.),vec2<f32>(0.,1.),vec2<f32>(1.,0.),vec2<f32>(1.,1.),vec2<f32>(0.,1.));\n' +
    ' let qq = cs[vi]*2.-1.; let pad = sw*.5 + 2./u.v.x; let loc = qq*(vec2<f32>(r,r)+pad); let w = c + loc; let px = w*u.v.x + u.v.yz;\n' +
    ' var o: VO; o.pos = vec4<f32>(px.x/u.res.x*2.-1., 1.-px.y/u.res.y*2., 0., 1.); o.loc = loc; o.a = vec4<f32>(c, r, r); o.b = vec4<f32>(rad, kind, sw, 0.); o.f = fill; o.s = stroke; return o; }\n' + WGSL_SHAPE_FS;

  function createWebGPU(host, hooks) {
    if (!navigator.gpu) return Promise.reject(new Error('no WebGPU'));
    return navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).then(function (adapter) {
      if (!adapter) throw new Error('no adapter');
      return adapter.requestDevice().then(function (device) { return { adapter: adapter, device: device }; });
    }).then(function (r) {
      var device = r.device, H = makeHost(host), ctx = H.main.getContext('webgpu');
      if (!ctx) throw new Error('no WebGPU canvas');
      var fmt = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device: device, format: fmt, alphaMode: 'opaque' });
      var destroyed = false;
      device.lost.then(function (info) { if (!destroyed && hooks && hooks.onLost) hooks.onLost('webgpu', info && info.message); });
      var blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
      var mS = device.createShaderModule({ code: WGSL_SHAPE }), mM = device.createShaderModule({ code: WGSL_MESH });
      var pShape = device.createRenderPipeline({ layout: 'auto', vertex: { module: mS, entryPoint: 'vs', buffers: [{ arrayStride: 64, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }, { shaderLocation: 2, offset: 32, format: 'float32x4' }, { shaderLocation: 3, offset: 48, format: 'float32x4' }] }] }, fragment: { module: mS, entryPoint: 'fs', targets: [{ format: fmt, blend: blend }] }, primitive: { topology: 'triangle-list' } });
      var pMesh = device.createRenderPipeline({ layout: 'auto', vertex: { module: mM, entryPoint: 'vs', buffers: [{ arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' }, { shaderLocation: 2, offset: 16, format: 'float32x2' }, { shaderLocation: 3, offset: 24, format: 'float32x4' }] }] }, fragment: { module: mM, entryPoint: 'fs', targets: [{ format: fmt, blend: blend }] }, primitive: { topology: 'triangle-list' } });
      var ubuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      var bgS = device.createBindGroup({ layout: pShape.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
      var bgM = device.createBindGroup({ layout: pMesh.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
      var T = null, S = null, bufs = {}, W = 1, Hh = 1, dpr = 1, ud = new Float32Array(8), fences = [], maxBuf = (device.limits && device.limits.maxBufferSize) || 268435456;
      /* One graphics-memory buffer per kind of shape, kept between pictures: a new picture is written over the old one with writeBuffer, and a buffer is only made
         again when the picture outgrows it (or has shrunk to under a quarter of it). Making and destroying three buffers for every picture was the old way (legacyBuffers). */
      var mk = function (name, data, usage) {
        var b = bufs[name], need = Math.ceil(data.byteLength / 4) * 4;
        if (out.legacyBuffers && b) { b.destroy(); b = bufs[name] = null; }
        if (!need) { if (b && b.size > 65536) { b.destroy(); b = bufs[name] = null; } return; }   /* nothing to draw; the draw counts are zero. Keep a small buffer, free a big one */
        if (!b || b.size < need || (b.size > 4 * need && b.size > 65536)) {
          if (b) b.destroy();
          var cap = out.legacyBuffers ? need : Math.min(maxBuf, Math.max(need, Math.ceil(need * 1.25 / 256) * 256));
          b = bufs[name] = device.createBuffer({ size: cap, usage: usage | GPUBufferUsage.COPY_DST });
        }
        device.queue.writeBuffer(b, 0, data.buffer, data.byteOffset, data.byteLength);
      };
      var load = function () { T = tessellate(S); mk('back', T.back, GPUBufferUsage.VERTEX); mk('front', T.front, GPUBufferUsage.VERTEX); mk('mesh', T.mesh, GPUBufferUsage.VERTEX); };
      /* turning a big 3D map: items and links stay in storage buffers, a picture sends the camera numbers and the paint order (see WGSL_RIG_* above) */
      var RW = null, rs = { id: 0, sid: null, style: -1, ver: -1 }, rbufs = {}, rbg = null, rU = new Float32Array(32);
      var rigPrepare = function () {
        if (RW !== null) return !!RW;
        try {
          device.pushErrorScope('validation');
          var bgl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }] });
          var pl = device.createPipelineLayout({ bindGroupLayouts: [bgl] }), mE = device.createShaderModule({ code: WGSL_RIG_EDGE }), mD = device.createShaderModule({ code: WGSL_RIG_DOT });
          var pe = device.createRenderPipeline({ layout: pl, vertex: { module: mE, entryPoint: 'vs' }, fragment: { module: mE, entryPoint: 'fs', targets: [{ format: fmt, blend: blend }] }, primitive: { topology: 'triangle-strip' } });
          var pd = device.createRenderPipeline({ layout: pl, vertex: { module: mD, entryPoint: 'vs', buffers: [{ arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32' }] }] }, fragment: { module: mD, entryPoint: 'fs', targets: [{ format: fmt, blend: blend }] }, primitive: { topology: 'triangle-list' } });
          var ru = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
          RW = { bgl: bgl, pe: pe, pd: pd, ru: ru };
          device.popErrorScope().then(function (err) { if (err) { RW = false; out.rigOK = false; if (hooks && hooks.onError) hooks.onError('webgpu', 'turning on the card: ' + err.message); } else out.rigOK = true; }, function () { RW = false; out.rigOK = false; });
        } catch (e) { RW = false; out.rigOK = false; }
        return false;
      };
      var rbuf = function (name, floats, usage) {
        var need = Math.max(16, floats.byteLength), b = rbufs[name];
        if (!b || b.size < need) { if (b) b.destroy(); b = rbufs[name] = device.createBuffer({ size: Math.ceil(need / 4) * 4, usage: usage | GPUBufferUsage.COPY_DST }); rbg = null; }
        if (floats.byteLength) device.queue.writeBuffer(b, 0, floats.buffer, floats.byteOffset, floats.byteLength);
      };
      /* the other ways of sending the paint order (the tester compares them): a ring of three card buffers, and staging buffers that are written directly */
      var seqExtras = function (bytes) {
        var i;
        if (rbufs.seqR) for (i = 0; i < rbufs.seqR.length; i++) rbufs.seqR[i].destroy();
        if (rs.stage) for (i = 0; i < rs.stage.length; i++) { try { rs.stage[i].destroy(); } catch (e) { /* already gone */ } }
        rbufs.seqR = []; rs.stage = []; rs.stageOK = []; rs.ring = 0;
        for (i = 0; i < 3; i++) rbufs.seqR.push(device.createBuffer({ size: Math.max(16, bytes), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }));
        rs.bytes = bytes;
      };
      var seqStage = function () {   /* made when first asked for */
        for (var i = 0; i < 5; i++) { rs.stage.push(device.createBuffer({ size: Math.max(16, rs.bytes), usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC, mappedAtCreation: true })); rs.stageOK.push(true); }
      };
      var rigSync = function () {
        var rig = S.rig, STO = GPUBufferUsage.STORAGE;
        if (rs.id !== rig.id) { rbuf('nodeF', rig.nodeF, STO); rbuf('edgeF', rig.edgeG, STO); rs.id = rig.id; rs.style = -1; rbuf('seq', new Float32Array(rig.n * 2), GPUBufferUsage.VERTEX); seqExtras(rig.n * 8); }
        if (rs.style !== S.styleVer || rs.sid !== S) { var st = NFMScene.rigStyle(S); rbuf('nodeS', st.node, STO); rbuf('edgeS', st.edge, STO); rs.style = S.styleVer; rs.sid = S; }
        if (!rbg) rbg = device.createBindGroup({ layout: RW.bgl, entries: [{ binding: 0, resource: { buffer: RW.ru } }, { binding: 1, resource: { buffer: rbufs.nodeF } }, { binding: 2, resource: { buffer: rbufs.nodeS } }, { binding: 3, resource: { buffer: rbufs.edgeF } }, { binding: 4, resource: { buffer: rbufs.edgeS } }] });
      };
      var drawRig = function (view) {
        var tu = S.turn, rig = S.rig; rigSync();
        var bg = S.theme.bg, enc = device.createCommandEncoder(), mapped = -1, seqBuf = rbufs.seq, via = (out.rigDebug && out.rigDebug.orderVia) || out.orderVia || 'write';
        if ((rs.ver !== tu.ver || rs.sid2 !== S) && !(out.rigDebug && out.rigDebug.keepOrder)) {
          var sq = tu.seq.subarray(0, tu.nseq);
          if (sq.byteLength) {
            if (via === 'map' && !rs.stage.length) seqStage();
            if (via === 'map') {                          /* write into a staging buffer the browser already handed over, then copy on the card: no copy made by the browser each picture */
              for (var si = 0; si < rs.stage.length && mapped < 0; si++) if (rs.stageOK[si]) mapped = si;
              if (mapped >= 0) { new Uint32Array(rs.stage[mapped].getMappedRange(0, sq.byteLength)).set(sq); rs.stage[mapped].unmap(); rs.stageOK[mapped] = false; enc.copyBufferToBuffer(rs.stage[mapped], 0, rbufs.seq, 0, sq.byteLength); }
              else device.queue.writeBuffer(rbufs.seq, 0, sq.buffer, sq.byteOffset, sq.byteLength);   /* none free yet: the plain way this once */
            } else if (via === 'ring') { rs.ring = (rs.ring + 1) % 3; device.queue.writeBuffer(rbufs.seqR[rs.ring], 0, sq.buffer, sq.byteOffset, sq.byteLength); }
            else device.queue.writeBuffer(rbufs.seq, 0, sq.buffer, sq.byteOffset, sq.byteLength);
          }
          rs.ver = tu.ver; rs.sid2 = S;
        }
        if (via === 'ring') seqBuf = rbufs.seqR[rs.ring];
        var g = tu.gold, bs = tu.boxS, ac = tu.accent;
        rU.set([view.k, view.tx, view.ty, 0, W, Hh, 0, 0, tu.cy, tu.sy, tu.cp, tu.sp, tu.c3x, tu.c3y, tu.D3, tu.fadeOn, tu.dmin, tu.inv, 0, 0, g[0], g[1], g[2], g[3], bs[0], bs[1], bs[2], bs[3], ac[0], ac[1], ac[2], ac[3]]);
        device.queue.writeBuffer(RW.ru, 0, rU);
        var pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: bg[0], g: bg[1], b: bg[2], a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
        var dbg = out.rigDebug || NODBG;
        if (rig.m && !dbg.noLinks) { pass.setPipeline(RW.pe); pass.setBindGroup(0, rbg); pass.draw(4, rig.m); }
        if (tu.nseq && !dbg.noItems) { pass.setPipeline(RW.pd); pass.setBindGroup(0, rbg); pass.setVertexBuffer(0, seqBuf); pass.draw(6, tu.nseq); }
        pass.end(); device.queue.submit([enc.finish()]);
        if (mapped >= 0) { var mb = mapped; rs.stage[mb].mapAsync(GPUMapMode.WRITE).then(function () { rs.stageOK[mb] = true; }, noop); }
        if (!dbg.noNames) drawLabels(H.ctx2, S, view, W, Hh, dpr);
      };
      var noop = function () { /* a fence that failed (device lost) is not a reason to wait */ };
      var out = {
        name: 'webgpu', label: 'WebGPU', device: (r.adapter.info && (r.adapter.info.description || r.adapter.info.device)) || '', software: !!r.adapter.isFallbackAdapter, legacyBuffers: false,
        setScene: function (s) { S = s; if (S) load(); },
        restyle: function () { if (S && !(S.turn && S.turn.on)) load(); },
        patch: function (s, dirty) {
          if (s !== S || (S.turn && S.turn.on) || !bufs.front || !bufs.mesh) return false;
          return patchBuffers(S, T, dirty, function (which, at, data) { device.queue.writeBuffer(bufs[which], at, data.buffer, data.byteOffset, data.byteLength); });
        },
        rigPrepare: rigPrepare, rigOK: false,
        rigWarm: function () { if (!RW || !S || !S.rig) return false; try { rigSync(); return true; } catch (e) { return false; } },   /* the item and link buffers go to the card now, not during the first turn */
        resize: function (w, h, d) { W = w; Hh = h; dpr = d; sizeCanvases(H, w, h, d); },
        draw: function (view) {
          if (!S || !T) return;
          if (S.turn && S.turn.on && S.rig && RW) { drawRig(view); return; }
          ud[0] = view.k; ud[1] = view.tx; ud[2] = view.ty; ud[3] = 0; ud[4] = W; ud[5] = Hh;
          device.queue.writeBuffer(ubuf, 0, ud);
          var bg = S.theme.bg, enc = device.createCommandEncoder();
          var pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: bg[0], g: bg[1], b: bg[2], a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
          if (T.nBack && bufs.back) { pass.setPipeline(pShape); pass.setBindGroup(0, bgS); pass.setVertexBuffer(0, bufs.back); pass.draw(6, T.nBack); }
          if (T.nMesh && bufs.mesh) { pass.setPipeline(pMesh); pass.setBindGroup(0, bgM); pass.setVertexBuffer(0, bufs.mesh); pass.draw(T.nMesh); }
          if (T.nFront && bufs.front) { pass.setPipeline(pShape); pass.setBindGroup(0, bgS); pass.setVertexBuffer(0, bufs.front); pass.draw(6, T.nFront); }
          pass.end();
          device.queue.submit([enc.finish()]);
          drawLabels(H.ctx2, S, view, W, Hh, dpr);
        },
        /* waits until the graphics card has finished everything sent so far (used where the picture is read back, and by the diagnostics) */
        flush: function () { return device.queue.onSubmittedWorkDone(); },
        /* for loops that draw one picture per screen refresh: resolves at once while fewer than `lag` (default 3) pictures are still being worked on, otherwise when the oldest is done.
           Waiting for the card after every single picture made each picture wait for the browser's slowest round trip to the card. Call once after each draw(). */
        pace: function (lag) {
          var f = { p: device.queue.onSubmittedWorkDone(), done: false }, fin = function () { f.done = true; };
          f.p.then(fin, fin); fences.push(f);
          fences = fences.filter(function (x) { return !x.done; });
          var keep = lag > 0 ? lag : 3;
          return fences.length > keep ? fences[fences.length - 1 - keep].p.then(noop, noop) : Promise.resolve();
        },
        snapshot: function () { return copyViaCanvas(H.main); },
        destroy: function () {
          destroyed = true; fences = [];
          var kill = function (b) { try { if (b && b.destroy) b.destroy(); } catch (e) { /* already gone */ } };
          /* every buffer on its own, arrays too (the rings), and the device last whatever happened before: a buffer that fails to go must not keep the whole device and its memory alive */
          Object.keys(bufs).forEach(function (k) { kill(bufs[k]); });
          Object.keys(rbufs).forEach(function (k) { if (Array.isArray(rbufs[k])) rbufs[k].forEach(kill); else kill(rbufs[k]); });
          if (rs.stage) rs.stage.forEach(kill);
          try { device.destroy(); } catch (e) { /* gone */ }
          host.textContent = '';
        }
      };
      device.addEventListener && device.addEventListener('uncapturederror', function (ev) { if (hooks && hooks.onError) hooks.onError('webgpu', ev.error && ev.error.message); });
      return out;
    });
  }

  /* ---------------------------------------------------------------- the manager: pick, rebuild after loss, step down after three losses in a minute */
  var MAKERS = { webgpu: createWebGPU, webgl2: createWebGL2, canvas2d: createCanvas2D };
  /* The app does not draw with WebGPU (the owner's decision, 2026-10-17): on his laptop it froze for 1.5 to 1.9 seconds at random while WebGL 2 stayed steady. The code stays for the tester and the tests, which switch it on here. WebGPU is still used for the graphics-card arrangement math, which is separate. */
  var webgpuDrawing = false;
  function Manager(host, opts) {
    this.host = host; this.opts = opts || {}; this.order = ['webgl2', 'webgpu', 'canvas2d'];   /* WebGL 2 first: on the laptops measured it draws big maps at a steadier 60 FPS, where WebGPU shows random pauses of 200-350 ms; WebGPU stays as the next choice and in Advanced */ this.r = null; this.losses = []; this.banned = {};
    this.choice = 'auto'; this.canary = null; this.log = [];
  }
  Manager.prototype.candidates = function () {
    var self = this, order = this.choice === 'auto' ? this.order : [this.choice].concat(this.order.filter(function (x) { return x !== self.choice; }));
    return order.filter(function (n) { return !self.banned[n] && (n !== 'webgpu' || webgpuDrawing) && (n === 'canvas2d' || !self.canary || (self.canary[n] && self.canary[n].ok)); });
  };
  Manager.prototype.hooks = function () {
    var self = this;
    return { onLost: function (name, why) { self.lost(name, why); }, onError: function (name, msg) { self.log.push(name + ': ' + msg); } };
  };
  /** Builds the best backend that works. Resolves to the renderer. */
  Manager.prototype.start = function () {
    var self = this, list = this.candidates(), i = 0;
    var hooks = this.hooks();
    var next = function () {
      if (i >= list.length) return Promise.reject(new Error('Nothing could draw.'));
      var name = list[i++];
      return Promise.resolve().then(function () { return MAKERS[name](self.host, hooks); }).then(function (r) { self.r = r; self.name = name; if (self.opts.onChange) self.opts.onChange(r); return r; })
        .catch(function (err) { self.log.push(name + ' failed: ' + (err && err.message)); self.banned[name] = 1; try { self.host.textContent = ''; } catch (e) { /* none */ } return next(); });
    };
    return next();
  };
  /** The old renderer is gone and the list found nothing: try the plain canvas once more, which needs nothing special. mgr.r is then either a working renderer or null, never a destroyed one. */
  Manager.prototype.rescue = function () {
    var self = this, hooks = this.hooks(); this.r = null;
    try { this.host.textContent = ''; } catch (e) { /* none */ }
    return Promise.resolve().then(function () { return MAKERS.canvas2d(self.host, hooks); }).then(function (r) {
      self.r = r; self.name = 'canvas2d'; self.banned.canvas2d = 0; self.log.push('fell back to canvas2d');
      if (self.opts.onChange) self.opts.onChange(r);
      return r;
    });
  };
  Manager.prototype.lost = function (name, why) {
    var now = Date.now(), self = this;
    this.log.push(name + ' lost' + (why ? ': ' + why : ''));
    this.losses = this.losses.filter(function (t) { return now - t < 60000; }); this.losses.push(now);
    if (this.losses.length >= 3) { this.banned[name] = 1; this.losses = []; if (this.opts.onStepDown) this.opts.onStepDown(name); }
    try { if (this.r) this.r.destroy(); } catch (e) { /* ignore */ }
    this.r = null;
    this.start().catch(function () { return self.rescue(); }).then(function (r) { if (r && self.opts.onRebuilt) self.opts.onRebuilt(r); }, function (err) { self.log.push('could not draw again: ' + (err && err.message)); });
  };
  Manager.prototype.use = function (choice) {
    var self = this; this.choice = choice; this.banned = {}; this.losses = [];
    try { if (this.r) this.r.destroy(); } catch (e) { /* ignore */ }
    this.r = null;
    return this.start().catch(function (err) { self.log.push('start failed: ' + (err && err.message)); return self.rescue(); });
  };

  return { setSpare: setSpare, setFont: function (f) { if (typeof f === 'string' && f.length < 300) labelFamily = f; }, Manager: Manager, setWebGPUDrawing: function (on) { webgpuDrawing = !!on; }, webgpuDrawing: function () { return webgpuDrawing; }, tessellate: tessellate, drawLabels: drawLabels, createCanvas2D: createCanvas2D, createWebGL2: createWebGL2, createWebGPU: createWebGPU, copyViaCanvas: copyViaCanvas };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMRender;
