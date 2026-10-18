/* ---------------------------------------------------------------- the mini-map: the whole picture in one corner, with a frame for what is on screen */
var MM = { sc: null, bg: null, w: 0, h: 0, sx: 1, drag: false, shown: false };
/** Is the mini-map wanted now? 'on' always (flat pictures), 'auto' when what is on screen is less than 70% of the picture's width or height, 'off' never. */
function minimapWanted() {
  var sc = S.scene, m = S.V.minimap || 'auto';
  if (!sc || !S.L || S.L.is3d || m === 'off' || S.tab !== 'map' || !(sc.w > 0) || !(sc.h > 0) || (!sc.rects.length && !sc.dots.length)) return false;
  if (m === 'on') return true;
  var k = S.view.k, vw = S.stageW / k, vh = S.stageH / k;
  return vw < 0.7 * sc.w || vh < 0.7 * sc.h;
}
function minimapBackdrop(sc, w, h, dpr) {
  var cv = document.createElement('canvas'); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  var g = cv.getContext('2d'); g.scale(dpr, dpr);
  var s = w / sc.w, step = sc.rects.length > 120000 ? Math.ceil(sc.rects.length / 120000) : 1;
  for (var i = 0; i < sc.rects.length; i += step) {
    var r = sc.rects[i]; if (r.layer === 0 || !r.fill || r.fill[3] === 0) continue;
    var rw = Math.max(1.2, r.w * s), rh = Math.max(1.2, r.h * s);
    g.fillStyle = NFMScene.css(r.fill); g.fillRect((r.x - sc.x0) * s, (r.y - sc.y0) * s, rw, rh);
  }
  return cv;
}
function renderMinimap() {
  var el = $('minimap'); if (!el) return;
  var want = minimapWanted();
  if (!want) { if (!el.hidden) el.hidden = true; MM.shown = false; return; }
  var sc = S.scene, sz = Math.min(168 / sc.w, 300 / sc.h), w = Math.max(24, Math.round(sc.w * sz)), h = Math.max(24, Math.round(sc.h * sz)), dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (MM.sc !== sc || MM.w !== w || MM.h !== h) {
    MM.sc = sc; MM.w = w; MM.h = h; MM.sx = w / sc.w;
    el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); el.style.width = w + 'px'; el.style.height = h + 'px';
    MM.bg = minimapBackdrop(sc, w, h, dpr);
  }
  el.hidden = false; MM.shown = true;
  var g = el.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (MM.bg) g.drawImage(MM.bg, 0, 0, w, h);
  var k = S.view.k, b = freeBox(), x0 = (b.x - S.view.tx) / k, y0 = (b.y - S.view.ty) / k, x1 = (b.x + b.w - S.view.tx) / k, y1 = (b.y + b.h - S.view.ty) / k;
  var fx = Math.max(0, (x0 - sc.x0) * MM.sx), fy = Math.max(0, (y0 - sc.y0) * MM.sx), fx1 = Math.min(w, (x1 - sc.x0) * MM.sx), fy1 = Math.min(h, (y1 - sc.y0) * MM.sx);
  var acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2563d6';
  g.fillStyle = acc; g.globalAlpha = 0.14; g.fillRect(fx, fy, Math.max(2, fx1 - fx), Math.max(2, fy1 - fy)); g.globalAlpha = 1;
  g.strokeStyle = acc; g.lineWidth = 1.6; g.strokeRect(fx + 0.8, fy + 0.8, Math.max(2, fx1 - fx) - 1.6, Math.max(2, fy1 - fy) - 1.6);
}
/** Centers the screen on the clicked spot of the mini-map (same zoom). */
function minimapGo(e) {
  var el = $('minimap'), sc = S.scene; if (!el || !sc) return;
  var r = el.getBoundingClientRect(), wx = sc.x0 + (e.clientX - r.left) / MM.sx, wy = sc.y0 + (e.clientY - r.top) / MM.sx, b = freeBox(), k = S.view.k;
  stopCam(); S.view = { k: k, tx: b.x + b.w / 2 - wx * k, ty: b.y + b.h / 2 - wy * k }; requestDraw();
}
function buildMinimap() {
  var el = h('canvas', { id: 'minimap', class: 'glass', hidden: true, role: 'img', 'aria-label': 'Mini-map of the whole picture. Click or drag to move around.', title: T('Click or drag to move around', 'Tap or drag to move around') });
  el.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); MM.drag = true; try { el.setPointerCapture(e.pointerId); } catch (x) { /* none */ } minimapGo(e); });
  el.addEventListener('pointermove', function (e) { if (MM.drag) { e.stopPropagation(); minimapGo(e); } });
  var up = function (e) { MM.drag = false; try { el.releasePointerCapture(e.pointerId); } catch (x) { /* none */ } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', function (e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  return el;
}
