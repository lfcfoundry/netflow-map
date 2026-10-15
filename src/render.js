/*!
 * Net Flow Map drawing backends: WebGPU, WebGL2 and Canvas2D draw the same scene (see scene.js) and look the same.
 * Shapes are drawn as signed-distance quads (a 1-pixel soft edge instead of MSAA); lines and ribbons are triangle strips
 * with the same soft edge. Labels always go on a 2D overlay canvas. Picking is done on the CPU (scene.js).
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMRender = (function () {
  'use strict';
  var css = NFMScene.css, SHAPE_STRIDE = 16, MESH_STRIDE = 10;

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
  /** Turns a scene into flat arrays: back shapes, mesh (lines, arrows, ribbons), front shapes. a = item alpha from restyle. */
  function tessellate(S) {
    var back = [], front = [], i;
    var shape = function (list, cx, cy, hw, hh, rad, kind, sw, fill, stroke, a) {
      list.push(cx, cy, hw, hh, rad, kind, sw, 0, fill[0], fill[1], fill[2], fill[3] * a, stroke[0], stroke[1], stroke[2], stroke[3] * a);
    };
    S.rects.forEach(function (r) { shape(r.layer === 0 ? back : front, r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, Math.min(r.r, r.w / 2, r.h / 2), 0, r.sw, r.fill, r.stroke, r.a === undefined ? 1 : r.a); });
    S.dots.forEach(function (d) { var k = d.kind === undefined ? 1 : d.kind; shape(front, d.cx, d.cy, d.r, d.r, k === 0 ? Math.min(3, d.r) : d.r, k, d.sw, d.fill, d.stroke, d.a === undefined ? 1 : d.a); });
    /* mesh */
    var verts = 0, plan = [];
    S.ribbons.forEach(function (r) { var n = Math.max(10, Math.min(40, Math.ceil(Math.abs(r.x1 - r.x0) / 10))); plan.push(r); verts += n * 6; });
    var polyTris = 0;
    (S.polys || []).forEach(function (p) { polyTris += p.pts.length / 2; });
    verts += polyTris * 3;
    S.curves.forEach(function (c) {
      var pts = c.pts || (c.pts = bezPts(c.P, c.line));
      c.dashed = c.dash ? dashPieces(pts, c.w, c.dash) : null;
      var n = c.dashed ? c.dashed.reduce(function (a, q) { return a + q.length / 2 - 1; }, 0) : pts.length / 2 - 1;
      verts += n * 6 + (c.arrow ? 3 : 0);
    });
    var mesh = new Float32Array(verts * MESH_STRIDE), o = 0;
    var put = function (x, y, nx, ny, hw, side, c, a) { mesh[o++] = x; mesh[o++] = y; mesh[o++] = nx; mesh[o++] = ny; mesh[o++] = hw; mesh[o++] = side; mesh[o++] = c[0]; mesh[o++] = c[1]; mesh[o++] = c[2]; mesh[o++] = c[3] * a; };
    S.ribbons.forEach(function (r) {
      var a = r.a === undefined ? 1 : r.a, n = Math.max(10, Math.min(40, Math.ceil(Math.abs(r.x1 - r.x0) / 10))), c = r.color;
      var ptsAt = function (ya0, ya1, u) { var m = 1 - u, y = m * m * m * ya0 + 3 * m * m * u * ya0 + 3 * m * u * u * ya1 + u * u * u * ya1, x = m * m * m * r.x0 + 3 * m * m * u * r.xm + 3 * m * u * u * r.xm + u * u * u * r.x1; return [x, y]; };
      for (var k = 0; k < n; k++) {
        var u0 = k / n, u1 = (k + 1) / n, t0 = ptsAt(r.y0a, r.y1a, u0), t1 = ptsAt(r.y0a, r.y1a, u1), b0 = ptsAt(r.y0b, r.y1b, u0), b1 = ptsAt(r.y0b, r.y1b, u1);
        put(t0[0], t0[1], 0, 0, -1, 0, c, a); put(b0[0], b0[1], 0, 0, -1, 0, c, a); put(t1[0], t1[1], 0, 0, -1, 0, c, a);
        put(t1[0], t1[1], 0, 0, -1, 0, c, a); put(b0[0], b0[1], 0, 0, -1, 0, c, a); put(b1[0], b1[1], 0, 0, -1, 0, c, a);
      }
    });
    (S.polys || []).forEach(function (p) {
      var a = (p.a === undefined ? 1 : p.a), n = p.pts.length / 2, cx = p.c[0], cy = p.c[1];
      for (var q = 0; q < n; q++) { var q2 = (q + 1) % n; put(cx, cy, 0, 0, -1, 0, p.fill, a); put(p.pts[q * 2], p.pts[q * 2 + 1], 0, 0, -1, 0, p.fill, a); put(p.pts[q2 * 2], p.pts[q2 * 2 + 1], 0, 0, -1, 0, p.fill, a); }
    });
    var strip = function (pts, hw, col, a) {
      var n = pts.length / 2, nr = new Array(n * 2), i;
      for (i = 0; i < n; i++) {
        var p0 = Math.max(0, i - 1), p1 = Math.min(n - 1, i + 1), tx = pts[p1 * 2] - pts[p0 * 2], ty = pts[p1 * 2 + 1] - pts[p0 * 2 + 1], d = Math.hypot(tx, ty) || 1;
        nr[i * 2] = -ty / d; nr[i * 2 + 1] = tx / d;
      }
      for (i = 0; i + 1 < n; i++) {
        var xa = pts[i * 2], ya = pts[i * 2 + 1], xb = pts[i * 2 + 2], yb = pts[i * 2 + 3];
        put(xa, ya, nr[i * 2], nr[i * 2 + 1], hw, -1, col, a); put(xa, ya, nr[i * 2], nr[i * 2 + 1], hw, 1, col, a); put(xb, yb, nr[i * 2 + 2], nr[i * 2 + 3], hw, -1, col, a);
        put(xb, yb, nr[i * 2 + 2], nr[i * 2 + 3], hw, -1, col, a); put(xa, ya, nr[i * 2], nr[i * 2 + 1], hw, 1, col, a); put(xb, yb, nr[i * 2 + 2], nr[i * 2 + 3], hw, 1, col, a);
      }
    };
    S.curves.forEach(function (c) {
      var a = c.a === undefined ? 1 : c.a, hw = c.w / 2, col = c.color;
      if (c.dashed) c.dashed.forEach(function (q) { strip(q, hw, col, a); }); else strip(c.pts, hw, col, a);
      if (c.arrow) { var t = NFMScene.arrowTri(c); for (i = 0; i < 3; i++) put(t[i * 2], t[i * 2 + 1], 0, 0, -1, 0, col, a); }
    });
    return { back: new Float32Array(back), front: new Float32Array(front), mesh: mesh.subarray(0, o), nBack: back.length / SHAPE_STRIDE, nFront: front.length / SHAPE_STRIDE, nMesh: o / MESH_STRIDE };
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
      var font = (l.bold ? '700 ' : '500 ') + Math.min(px, 60).toFixed(1) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      if (font !== lastFont) { ctx.font = font; lastFont = font; }
      ctx.globalAlpha = l.a === undefined ? 1 : l.a;
      ctx.textAlign = l.align === 'l' ? 'left' : l.align === 'r' ? 'right' : 'center';
      if (l.rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(l.rot * Math.PI / 180); x = 0; y = 0; }
      if (l.bg) { var tw = ctx.measureText(l.t).width; ctx.fillStyle = bg; ctx.fillRect(x - tw / 2 - 2, y - px, tw + 4, px + 3); }
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
  function makeHost(host) {
    host.textContent = '';
    var a = document.createElement('canvas'), b = document.createElement('canvas');
    [a, b].forEach(function (c) { c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none'; });
    a.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-hidden', 'true'); b.style.pointerEvents = 'none';
    host.appendChild(a); host.appendChild(b);
    return { main: a, over: b, ctx2: b.getContext('2d') };
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
    var H = makeHost(host), ctx = H.main.getContext('2d', { alpha: false }), S = null, W = 1, Hh = 1, dpr = 1;
    if (!ctx) throw new Error('no 2D canvas');
    var out = {
      name: 'canvas2d', label: 'Canvas 2D',
      setScene: function (s) { S = s; if (S) S.curves.forEach(function (c) { if (c.bb === undefined) { var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (var i = 0; i < c.P.length; i += 2) { x0 = Math.min(x0, c.P[i]); x1 = Math.max(x1, c.P[i]); y0 = Math.min(y0, c.P[i + 1]); y1 = Math.max(y1, c.P[i + 1]); } c.bb = [x0 - 12, y0 - 12, x1 + 12, y1 + 12]; } }); },
      resize: function (w, h, d) { W = w; Hh = h; dpr = d; sizeCanvases(H, w, h, d); },
      draw: function (view) {
        if (!S) return;
        var k = view.k, vx0 = -view.tx / k, vy0 = -view.ty / k, vx1 = (W - view.tx) / k, vy1 = (Hh - view.ty) / k;
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
          ctx.beginPath(); ctx.moveTo(r.x0, r.y0a); ctx.bezierCurveTo(r.xm, r.y0a, r.xm, r.y1a, r.x1, r.y1a); ctx.lineTo(r.x1, r.y1b); ctx.bezierCurveTo(r.xm, r.y1b, r.xm, r.y0b, r.x0, r.y0b); ctx.closePath(); ctx.fill();
        });
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        S.curves.forEach(function (c) {
          var bb = c.bb; if (bb[0] > vx1 || bb[2] < vx0 || bb[1] > vy1 || bb[3] < vy0) return;
          var P = c.P, a = (c.a === undefined ? 1 : c.a) * c.color[3], col = css([c.color[0], c.color[1], c.color[2], 1]);
          ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = Math.max(c.w, 1.4 / k);
          if (c.dash) { var lw = ctx.lineWidth; ctx.setLineDash(c.dash === 1 ? [0.01, lw * 2.2 + 2] : c.dash === 3 ? [lw * 6 + 6, lw * 3 + 5] : [lw * 3 + 4, lw * 2 + 4]); ctx.lineCap = c.dash === 1 ? 'round' : 'butt'; }
          ctx.beginPath(); ctx.moveTo(P[0], P[1]);
          for (var i = 2; i < P.length; i += 6) ctx.bezierCurveTo(P[i], P[i + 1], P[i + 2], P[i + 3], P[i + 4], P[i + 5]);
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
      },
      flush: function () { return Promise.resolve(); },
      snapshot: function () { return ctx.getImageData(0, 0, H.main.width, H.main.height); },
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
  var GL_MESH_FS = '#version 300 es\nprecision highp float;in vec4 vC;in float vSide;in float vHw;in float vSolid;out vec4 o;\n' +
    'void main(){float cov=vSolid>.5?1.:clamp(vHw-abs(vSide)*vHw+.5,0.,1.);o=vec4(vC.rgb*vC.a,vC.a)*cov;}';

  function glProgram(gl, vs, fs) {
    var mk = function (t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
    var p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  function createWebGL2(host, hooks) {
    var H = makeHost(host), gl = H.main.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no WebGL2');
    var lost = false;
    H.main.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; if (hooks && hooks.onLost) hooks.onLost('webgl2'); });
    var pS = glProgram(gl, GL_SHAPE_VS, GL_SHAPE_FS), pM = glProgram(gl, GL_MESH_VS, GL_MESH_FS);
    var uS = { v: gl.getUniformLocation(pS, 'uV'), r: gl.getUniformLocation(pS, 'uRes') }, uM = { v: gl.getUniformLocation(pM, 'uV'), r: gl.getUniformLocation(pM, 'uRes') };
    var mkVao = function (layout, buf, divisor) {
      var vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      layout.forEach(function (a) { gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, a[3], a[2] * 4); if (divisor) gl.vertexAttribDivisor(a[0], 1); });
      gl.bindVertexArray(null); return vao;
    };
    var bBack = gl.createBuffer(), bFront = gl.createBuffer(), bMesh = gl.createBuffer();
    var sl = [[0, 4, 0, 64], [1, 4, 4, 64], [2, 4, 8, 64], [3, 4, 12, 64]], vaoBack = mkVao(sl, bBack, true), vaoFront = mkVao(sl, bFront, true);
    var vaoMesh = mkVao([[0, 2, 0, 40], [1, 2, 2, 40], [2, 2, 4, 40], [3, 4, 6, 40]], bMesh, false);
    var T = null, S = null, W = 1, Hh = 1, dpr = 1;
    var up = function (buf, data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); };
    var info = (function () { try { var e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (x) { return ''; } })();
    var out = {
      name: 'webgl2', label: 'WebGL 2', device: info,
      setScene: function (s) { S = s; T = s ? tessellate(s) : null; if (T) { up(bBack, T.back); up(bFront, T.front); up(bMesh, T.mesh); } },
      restyle: function () { if (S) { T = tessellate(S); up(bBack, T.back); up(bFront, T.front); up(bMesh, T.mesh); } },
      resize: function (w, h, d) { W = w; Hh = h; dpr = d; sizeCanvases(H, w, h, d); },
      draw: function (view) {
        if (!S || lost) return;
        gl.viewport(0, 0, H.main.width, H.main.height);
        var bg = S.theme.bg; gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        var shapes = function (vao, n) { if (!n) return; gl.useProgram(pS); gl.uniform4f(uS.v, view.k, view.tx, view.ty, 0); gl.uniform2f(uS.r, W, Hh); gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n); };
        shapes(vaoBack, T.nBack);
        if (T.nMesh) { gl.useProgram(pM); gl.uniform4f(uM.v, view.k, view.tx, view.ty, 0); gl.uniform2f(uM.r, W, Hh); gl.bindVertexArray(vaoMesh); gl.drawArrays(gl.TRIANGLES, 0, T.nMesh); }
        shapes(vaoFront, T.nFront);
        gl.bindVertexArray(null);
        drawLabels(H.ctx2, S, view, W, Hh, dpr);
      },
      flush: function () { var px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Promise.resolve(); },
      snapshot: function () { return copyViaCanvas(H.main); },
      destroy: function () { try { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* gone */ } host.textContent = ''; }
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
  var WGSL_SHAPE = WGSL_COMMON +
    'struct VO { @builtin(position) pos: vec4<f32>, @location(0) loc: vec2<f32>, @location(1) @interpolate(flat) a: vec4<f32>, @location(2) @interpolate(flat) b: vec4<f32>, @location(3) @interpolate(flat) f: vec4<f32>, @location(4) @interpolate(flat) s: vec4<f32> };\n' +
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
      var noop = function () { /* a fence that failed (device lost) is not a reason to wait */ };
      var out = {
        name: 'webgpu', label: 'WebGPU', device: (r.adapter.info && (r.adapter.info.description || r.adapter.info.device)) || '', software: !!r.adapter.isFallbackAdapter, legacyBuffers: false,
        setScene: function (s) { S = s; if (S) load(); },
        restyle: function () { if (S) load(); },
        resize: function (w, h, d) { W = w; Hh = h; dpr = d; sizeCanvases(H, w, h, d); },
        draw: function (view) {
          if (!S || !T) return;
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
        destroy: function () { destroyed = true; fences = []; try { Object.keys(bufs).forEach(function (k) { if (bufs[k]) bufs[k].destroy(); }); device.destroy(); } catch (e) { /* gone */ } host.textContent = ''; }
      };
      device.addEventListener && device.addEventListener('uncapturederror', function (ev) { if (hooks && hooks.onError) hooks.onError('webgpu', ev.error && ev.error.message); });
      return out;
    });
  }

  /* ---------------------------------------------------------------- the manager: pick, rebuild after loss, step down after three losses in a minute */
  var MAKERS = { webgpu: createWebGPU, webgl2: createWebGL2, canvas2d: createCanvas2D };
  function Manager(host, opts) {
    this.host = host; this.opts = opts || {}; this.order = ['webgpu', 'webgl2', 'canvas2d']; this.r = null; this.losses = []; this.banned = {};
    this.choice = 'auto'; this.canary = null; this.log = [];
  }
  Manager.prototype.candidates = function () {
    var self = this, order = this.choice === 'auto' ? this.order : [this.choice].concat(this.order.filter(function (x) { return x !== self.choice; }));
    return order.filter(function (n) { return !self.banned[n] && (n === 'canvas2d' || !self.canary || (self.canary[n] && self.canary[n].ok)); });
  };
  /** Builds the best backend that works. Resolves to the renderer. */
  Manager.prototype.start = function () {
    var self = this, list = this.candidates(), i = 0;
    var hooks = { onLost: function (name, why) { self.lost(name, why); }, onError: function (name, msg) { self.log.push(name + ': ' + msg); } };
    var next = function () {
      if (i >= list.length) return Promise.reject(new Error('Nothing could draw.'));
      var name = list[i++];
      return Promise.resolve().then(function () { return MAKERS[name](self.host, hooks); }).then(function (r) { self.r = r; self.name = name; if (self.opts.onChange) self.opts.onChange(r); return r; })
        .catch(function (err) { self.log.push(name + ' failed: ' + (err && err.message)); self.banned[name] = 1; try { self.host.textContent = ''; } catch (e) { /* none */ } return next(); });
    };
    return next();
  };
  Manager.prototype.lost = function (name, why) {
    var now = Date.now(), self = this;
    this.log.push(name + ' lost' + (why ? ': ' + why : ''));
    this.losses = this.losses.filter(function (t) { return now - t < 60000; }); this.losses.push(now);
    if (this.losses.length >= 3) { this.banned[name] = 1; this.losses = []; if (this.opts.onStepDown) this.opts.onStepDown(name); }
    try { if (this.r) this.r.destroy(); } catch (e) { /* ignore */ }
    this.start().then(function (r) { if (self.opts.onRebuilt) self.opts.onRebuilt(r); });
  };
  Manager.prototype.use = function (choice) { this.choice = choice; this.banned = {}; this.losses = []; try { if (this.r) this.r.destroy(); } catch (e) { /* ignore */ } return this.start(); };

  return { Manager: Manager, tessellate: tessellate, drawLabels: drawLabels, createCanvas2D: createCanvas2D, createWebGL2: createWebGL2, createWebGPU: createWebGPU, copyViaCanvas: copyViaCanvas };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMRender;
