/*!
 * Netflow Map app, part 5: mouse, touch and keyboard on the map, menus, selection tools. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var ptrs = new Map(), P0 = null, lastDist = 0, inkShape = null, velo = [], tipEl = $('tip'), hoverRaf = 0, pressTimer = 0;
var isTouch = false;
function local(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function hitAt(x, y) { if (!S.scene) return { type: 'bg' }; var w = worldOf(x, y); return NFMScene.hit(S.scene, w[0], w[1], S.view.k, { slop: isTouch ? 12 : 5, edgeTol: isTouch ? 12 : 7 }); }
function canDrag() { return S.L && S.L.view === 'network' && !S.L.is3d; }
function idsOfGroup(g) { return S.dg.nodes.filter(function (n) { return String(n.group || '(none)') === String(g || '(none)') || (S.L && S.L.cls && S.L.cls[n.id] === g); }).map(function (n) { return n.id; }); }
function idsOfLane(i) {
  var name = S.L && S.L.laneNames && S.L.laneNames[i], out = [];
  if (name === undefined) return out;
  liveScene().nodes.forEach(function (n) { if (n.nodeId !== undefined && S.L.cls[n.key] === name) out.push(n.nodeId); });
  return out;
}
function idOfHit(h) { return h && (h.type === 'node' || h.type === 'label') && h.node ? h.node.nodeId : undefined; }
function groupHitIds(hh) { return hh.type === 'group' ? idsOfGroup(hh.group) : hh.type === 'lane' ? idsOfLane(hh.lane) : []; }

/* ---------------------------------------------------------------- ink: the box and lasso being drawn */
function drawInk() {
  var svg = $('ink'); if (!svg) return;
  if (!inkShape) { if (svg.firstChild) clear(svg); return; }
  var NS = 'http://www.w3.org/2000/svg', el;
  clear(svg);
  var acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2563d6';
  if (inkShape.type === 'box') { el = document.createElementNS(NS, 'rect'); el.setAttribute('x', Math.min(inkShape.x0, inkShape.x1)); el.setAttribute('y', Math.min(inkShape.y0, inkShape.y1)); el.setAttribute('width', Math.abs(inkShape.x1 - inkShape.x0)); el.setAttribute('height', Math.abs(inkShape.y1 - inkShape.y0)); }
  else { el = document.createElementNS(NS, 'polygon'); el.setAttribute('points', inkShape.pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ')); }
  el.setAttribute('fill', acc); el.setAttribute('fill-opacity', '0.12'); el.setAttribute('stroke', acc); el.setAttribute('stroke-width', '1.5'); el.setAttribute('stroke-dasharray', '5 4');
  svg.appendChild(el);
}
function setInk(s) { inkShape = s; drawInk(); }

/* ---------------------------------------------------------------- pointer */
stage.addEventListener('pointerdown', function (e) {
  if (e.target.closest('#ui > *')) return;
  hideMenu();
  if (e.button === 2) return;
  isTouch = e.pointerType === 'touch';
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  var p = local(e); ptrs.set(e.pointerId, p);
  stage.focus({ preventScroll: true });
  if (ptrs.size === 2) { var a = Array.from(ptrs.values()); lastDist = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (P0) P0.mode = 'pinch'; clearTimeout(pressTimer); return; }
  stopCam();
  var hh = hitAt(p[0], p[1]), mode = 'pan';
  if (S.L && S.L.is3d) mode = 'orbit';
  if (S.tool === 'box' || e.shiftKey) mode = 'box'; else if (S.tool === 'lasso' || e.altKey) mode = 'lasso';
  else if (hh.type === 'node' && (canDrag() || skOn())) mode = 'node';
  P0 = { x: p[0], y: p[1], hit: hh, mode: mode, moved: false, shift: e.shiftKey || e.ctrlKey || e.metaKey, t: performance.now(), pid: e.pointerId, yaw: S.V.cam.yaw, pitch: S.V.cam.pitch, tx: S.view.tx, ty: S.view.ty };
  velo = [[p[0], p[1], P0.t]];
  if (isTouch) pressTimer = setTimeout(function () { if (P0 && !P0.moved && ptrs.size === 1) { var q = P0; P0 = null; openContext(q.x, q.y, q.hit, true); } }, 560);
});
stage.addEventListener('pointermove', function (e) {
  var p = local(e);
  if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') hover(p, e); return; }
  var prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) {
    var a = Array.from(ptrs.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
    if (lastDist > 0 && d > 0) zoomAt((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2, d / lastDist, true);
    lastDist = d; if (P0) P0.moved = true; return;
  }
  if (!P0 || P0.pid !== e.pointerId) return;
  var dx = p[0] - P0.x, dy = p[1] - P0.y;
  if (!P0.moved) { if (Math.hypot(dx, dy) < (isTouch ? 8 : 4)) return; P0.moved = true; clearTimeout(pressTimer); hideTip(); if (P0.mode === 'node') beginNodeDrag(P0); stage.classList.add(P0.mode === 'pan' || P0.mode === 'orbit' ? 'drag' : P0.mode === 'node' ? 'move' : 'pick'); }
  var m = P0.mode;
  if (m === 'pan') { S.view = { k: S.view.k, tx: S.view.tx + p[0] - prev[0], ty: S.view.ty + p[1] - prev[1] }; velo.push([p[0], p[1], performance.now()]); if (velo.length > 6) velo.shift(); requestDraw(); }
  else if (m === 'orbit') { var c = S.V.cam; c.yaw = P0.yaw + dx * 0.008; c.pitch = clamp(P0.pitch + dy * 0.008, -1.45, 1.45); scheduleScene(true); }
  else if (m === 'box') setInk({ type: 'box', x0: P0.x, y0: P0.y, x1: p[0], y1: p[1] });
  else if (m === 'lasso') { var pts = (inkShape && inkShape.type === 'lasso' ? inkShape.pts : [[P0.x, P0.y]]); pts.push([p[0], p[1]]); setInk({ type: 'lasso', pts: pts }); }
  else if (m === 'node') moveNodes(p);
});
function endPtr(e) {
  var had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); lastDist = 0; stage.classList.remove('drag', 'pick', 'move'); clearTimeout(pressTimer);
  if (!had) return;
  if (ptrs.size === 1 && P0) { P0.moved = true; P0.mode = 'pan'; var r = Array.from(ptrs.values())[0]; P0.x = r[0]; P0.y = r[1]; P0.pid = Array.from(ptrs.keys())[0]; return; }   /* after a pinch the finger that is left carries on as the pan (whichever one was lifted) */
  var q = P0; P0 = null; if (!q || q.pid !== e.pointerId) { setInk(null); return; }
  var p = local(e);
  if (e.type === 'pointercancel') { setInk(null); return; }
  if (!q.moved) { setInk(null); clickAt(q, e); return; }
  if (q.mode === 'box' || q.mode === 'lasso') {
    var w0, w1, ids;
    if (q.mode === 'box') { w0 = worldOf(q.x, q.y); w1 = worldOf(p[0], p[1]); ids = NFMScene.inRect(S.scene, w0[0], w0[1], w1[0], w1[1]); }
    else { var poly = []; inkShape.pts.forEach(function (pt) { var w = worldOf(pt[0], pt[1]); poly.push(w[0], w[1]); }); ids = NFMScene.inLasso(S.scene, poly); }
    var items = [], byKey = new Map(); liveScene().nodes.forEach(function (x) { byKey.set(x.key, x); }); ids.forEach(function (k) { var n = byKey.get(k); if (n && n.nodeId !== undefined) items.push(n.nodeId); });
    if (q.shift && S.sel.size) items = Array.from(new Set(Array.from(S.sel).concat(items)));
    setInk(null); setSel(items); if (items.length) toast(plural(items.length, 'item') + ' selected. ' + T('Right-click', 'Press and hold') + ' for what to do with them.');
    if (S.tool !== 'hand' && !e.shiftKey && !e.altKey) { /* keep the tool until the person changes it */ }
  } else if (q.mode === 'node') endNodeDrag();
  else if (q.mode === 'pan' && !reduceMotion && velo.length > 2) {
    var a = velo[0], b = velo[velo.length - 1], dt = Math.max(1, b[2] - a[2]), vx = (b[0] - a[0]) / dt * 16, vy = (b[1] - a[1]) / dt * 16;
    if (performance.now() - b[2] < 70 && Math.hypot(vx, vy) > 3) { CAM.fling = { vx: vx, vy: vy }; kick(); }
  } else if (q.mode === 'orbit') saveView();
  setInk(null);
}
stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
stage.addEventListener('lostpointercapture', function (e) { if (ptrs.has(e.pointerId) && !P0) ptrs.delete(e.pointerId); });
stage.addEventListener('wheel', function (e) {
  if (e.target.closest('#ui > *')) return;
  e.preventDefault(); var p = local(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  if (S.V.lens.on && S.L && !S.L.is3d && e.shiftKey) { S.V.lens.d = clamp(S.V.lens.d - dy * 0.01, 0.5, 12); scheduleScene(); return; }
  zoomAt(p[0], p[1], Math.exp(-clamp(dy, -240, 240) * (e.ctrlKey ? 0.01 : 0.0022)));
}, { passive: false });
stage.addEventListener('dblclick', function (e) {
  if (e.target.closest('#ui > *')) return;
  var p = local(e), hh = hitAt(p[0], p[1]);
  if (skOn() && (hh.type === 'label' || hh.type === 'node') && hh.node && hh.node.nodeId !== undefined) { skEditLabel(hh.node.nodeId); return; }
  if (skOn() && hh.type === 'edge') { var ce = (skV().links[skLinkKey(hh.edge)] || {}).color; askColor('Flow color', ce, 'Back to automatic').then(function (c) { if (c !== null) skLinkPatch([hh.edge], { color: c, mode: '' }); }); return; }
  if (hh.type === 'node' && hh.node.nodeId !== undefined) { var id = hh.node.nodeId; setSel([id]); var nb = Array.from(neighborIds([id])); var v = fitTarget(nb); if (v) viewTo(v, 480); }
  else if (hh.type === 'bg') zoomAt(p[0], p[1], 1.9);
});
stage.addEventListener('contextmenu', function (e) {
  if (e.target.closest('#ui > *')) return;
  e.preventDefault(); var p = local(e); isTouch = false; openContext(p[0], p[1], hitAt(p[0], p[1]), false);
});
stage.addEventListener('pointerleave', hideTip);

function clickAt(q, e) {
  var hh = q.hit, add = q.shift;
  if (hh.type === 'node' || (hh.type === 'label' && hh.node)) {
    if (hh.node.chapter && hh.node.chKey) { S.centerAfter = [hh.node.nodeId]; toggleChapter(hh.node.chKey, true); return; }
    var id = hh.node.nodeId; if (id === undefined) return;
    if (add) { var s = new Set(S.sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(Array.from(s)); } else setSel([id]);
  } else if (hh.type === 'edge') {
    var es = add ? new Set(S.selEdges) : new Set(); if (es.has(hh.edge)) es.delete(hh.edge); else es.add(hh.edge); setSel(add ? Array.from(S.sel) : [], { edges: Array.from(es) });
  } else if (hh.type === 'group' || hh.type === 'lane') {
    var ids = groupHitIds(hh); if (add) ids = Array.from(new Set(Array.from(S.sel).concat(ids))); setSel(ids);
  } else if (!add) { setSel([]); if (S.search.q) { /* keep search highlight */ } }
}

/* ---------------------------------------------------------------- moving nodes by hand */
var DRAG = null;
function beginNodeDrag(q) {
  if (skOn()) { skBeginDrag(q); return; }
  var id = q.hit.node.nodeId; if (id === undefined) { q.mode = 'pan'; return; }
  if (!S.sel.has(id)) setSel([id]);
  var moving = Array.from(S.sel), pos = {};
  var byId = new Map(), slot = {}; S.L.nodes.forEach(function (n, i) { var k = n.nodeId || n.id; byId.set(k, n); slot[k] = i; });
  moving.forEach(function (m) { var n = byId.get(m); if (n) pos[m] = [n.cx, n.cy]; });
  var key = pinKey(); S.V.pins[key] = S.V.pins[key] || {};
  DRAG = { ids: Object.keys(pos), pos: pos, w0: worldOf(q.x, q.y), key: key, slot: slot, fast: false };
}
function moveNodes(p) {
  if (!DRAG) return;
  if (DRAG.sk) { skDragTo(p); return; }
  var w = worldOf(p[0], p[1]), dx = w[0] - DRAG.w0[0], dy = w[1] - DRAG.w0[1], pins = S.V.pins[DRAG.key];
  DRAG.ids.forEach(function (id) { pins[id] = [DRAG.pos[id][0] + dx, DRAG.pos[id][1] + dy]; });
  if (!moveInPlace(DRAG.ids, DRAG.slot, DRAG.key)) scheduleScene(false, true); else DRAG.fast = true;
}
/** A big flat map: put the moved items' dots, names and links where they now are, in place, and send just those to the graphics card, instead of building and sending the whole picture for every mouse move (about 16 MB at 10,000 items). False when this picture cannot do it; the page then builds it again as before. ids and slot: the moved items and their places in L.nodes; their new places are in the pins. */
function moveInPlace(ids, slot, key) {
  var sc = S.scene, r = mgr && mgr.r;
  if (!sc || !sc.moveNodes || !r || !S.L || S.L.is3d || S.L.view !== 'network' || sceneQueued || (sc.turn && sc.turn.on)) return false;
  var pins = S.V.pins[key], moves = ids.map(function (id) { return [slot[id], pins[id][0], pins[id][1]]; });
  var dirty = sc.moveNodes(moves); if (!dirty) return false;
  if (!(r.patch && r.patch(sc, dirty)) && r.setScene) r.setScene(sc);
  requestDraw(); return true;
}
/** The drop after moving items in place: the outer box, pick grid and link hover index are worked out again for the new places (a few milliseconds) instead of building the whole picture again (about a tenth of a second at 10,000 items). Falls back to building it again when the picture cannot. Returns whether it settled in place. */
function settleDrop() {
  var sc = S.scene;
  if (sceneQueued || !sc || !sc.settleMoves || !sc.settleMoves()) { scheduleScene(false, true); return false; }
  DOTS.sc = null; MM.sc = null; requestDraw(); return true;
}
/** Moves items to given places the way a drag does (for tests and scripts): list = [[id, x, y], ...]. Returns {fast}: whether the in-place way was used. */
function moveItems(list, rebuild) {
  if (!S.L || S.L.view !== 'network' || S.L.is3d) return { fast: false };
  var key = pinKey(), pins = S.V.pins[key] = S.V.pins[key] || {}, slot = {}, ids = [];
  S.L.nodes.forEach(function (n, i) { slot[n.nodeId || n.id] = i; });
  list.forEach(function (m) { if (slot[m[0]] !== undefined) { pins[m[0]] = [m[1], m[2]]; ids.push(String(m[0])); } });
  var fast = !rebuild && moveInPlace(ids, slot, key); if (!fast) scheduleScene(false, true);
  return { fast: fast };
}
function endNodeDrag() { var was = DRAG; DRAG = null; if (was && was.sk) { skEndDrag(); return; } if (was && was.fast) settleDrop(); /* the picture's outer box, pick grid and link hover index were left as they were while moving: work them out again once */ saveView(); renderMapUI(); }
function setPins(map) { var key = pinKey(); S.V.pins[key] = Object.assign(S.V.pins[key] || {}, map); saveView(); makeScene(false); }
function clearPins(ids) {
  var key = pinKey(), pins = S.V.pins[key]; if (!pins) return;
  if (!ids) delete S.V.pins[key]; else ids.forEach(function (id) { delete pins[id]; });
  saveView(); refreshMap('look');
}
function layoutPositions() { var m = new Map(); S.L.nodes.forEach(function (n) { m.set(n.nodeId || n.id, n); }); return m; }
/** Moves the chosen items slightly apart from each other and from anything they overlap (never touches the rest). */
function separateItems(ids) {
  if (!canDrag()) { toast('Moving items by hand works in the Network view.'); return; }
  var pos = layoutPositions(), sel = new Set(ids), P = {}, gap = 10, out = {};
  pos.forEach(function (n, id) { P[id] = [n.cx, n.cy, n.w / 2]; });
  for (var it = 0; it < 40; it++) {
    var moved = false;
    ids.forEach(function (a) {
      var A = P[a]; if (!A) return;
      pos.forEach(function (n, b) {
        if (a === b) return; var B = P[b], dx = A[0] - B[0], dy = A[1] - B[1], d = Math.hypot(dx, dy) || 0.01, need = (A[2] + B[2]) * 1.15 + gap;
        if (d < need) { var push = (need - d) * (sel.has(b) ? 0.5 : 1); A[0] += dx / d * push; A[1] += dy / d * push; moved = true; }
      });
    });
    if (!moved) break;
  }
  ids.forEach(function (id) { if (P[id]) out[id] = [P[id][0], P[id][1]]; });
  setPins(out); toast('Moved apart slightly. Drag any item to fine-tune.');
}
function spreadItems(ids, f) {
  if (!canDrag()) { toast('Moving items by hand works in the Network view.'); return; }
  var pos = layoutPositions(), cx = 0, cy = 0, c = 0, out = {};
  ids.forEach(function (id) { var n = pos.get(id); if (n) { cx += n.cx; cy += n.cy; c++; } }); if (!c) return; cx /= c; cy /= c;
  ids.forEach(function (id) { var n = pos.get(id); if (n) out[id] = [cx + (n.cx - cx) * f, cy + (n.cy - cy) * f]; });
  setPins(out);
}

/* ---------------------------------------------------------------- hover tooltip */
function hideTip() { tipEl.hidden = true; }
function hover(p) {
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(function () {
    hoverRaf = 0; if (!S.scene || P0) return;
    var hh = hitAt(p[0], p[1]), text = '', cur = '';
    if (hh.type === 'node' || (hh.type === 'label' && hh.node)) {
      var id = hh.node.nodeId, g = S.byId.get(id), n = hh.node.n; cur = canDrag() || skOn() ? 'move' : 'pointer';
      if (g) { text = g.label + (g.group ? ' · ' + g.group : ''); if (n && n.sizeV === n.sizeV && S.V.sizeBy) text += ' · ' + chLabel(S.V.sizeBy) + ' ' + NFMColumns.fmt(n.sizeV); if (n && n.colorV === n.colorV && /^(col|sys):/.test(S.V.colorBy)) text += ' · ' + chLabel(S.V.colorBy) + ' ' + NFMColumns.fmt(n.colorV); }
    } else if (hh.type === 'edge') {
      var e = edgeOf(hh.edge); cur = 'pointer';
      if (e) { var a = S.byId.get(e.from), b = S.byId.get(e.to); text = (a ? a.label : e.from) + ' → ' + (b ? b.label : e.to) + (e.widthV === e.widthV && S.V.widthBy ? ' · ' + chLabel(S.V.widthBy, 'edges') + ' ' + NFMColumns.fmt(e.widthV) : '') + (e.count > 1 ? ' · ' + e.count + ' links' : '') + (skOn() ? ' · drag bars to place · double-click for color' : ''); }
    } else if (hh.type === 'group') { text = 'Group: ' + (hh.group || '(none)'); cur = 'pointer'; }
    stage.style.cursor = cur; stage.classList.toggle('over-node', !!cur);
    if (!text) { hideTip(); return; }
    tipEl.textContent = text; tipEl.hidden = false; tipEl.style.left = Math.min(S.stageW - 290, p[0] + 14) + 'px'; tipEl.style.top = (p[1] + 18) + 'px';
  });
}

/* ---------------------------------------------------------------- 3D: spin and snap */
var spinning = false;
function spinLoop() {
  if (spinning) return; spinning = true;
  var last = performance.now();
  (function f(t) {
    if (!(S.V && S.V.cam.spin && S.L && S.L.is3d && S.tab === 'map' && !document.hidden)) { spinning = false; return; }
    var dt = Math.min(64, t - last); last = t;
    if (!P0) { S.V.cam.yaw += dt * 0.00032; scheduleScene(true); }
    requestAnimationFrame(f);
  })(last);
}
function snapCam(kind) {
  var c = S.V.cam, to = kind === 'front' ? { yaw: 0, pitch: 0 } : kind === 'side' ? { yaw: Math.PI / 2, pitch: 0 } : kind === 'top' ? { yaw: 0, pitch: 1.45 } : { yaw: 0.6, pitch: 0.35 };
  var y0 = c.yaw, p0 = c.pitch, t0 = performance.now();
  (function f(t) { var u = reduceMotion ? 1 : Math.min(1, (t - t0) / 420), e = u * u * (3 - 2 * u); c.yaw = y0 + (to.yaw - y0) * e; c.pitch = p0 + (to.pitch - p0) * e; scheduleScene(true); if (u < 1) requestAnimationFrame(f); else saveView(); })(t0);
}

/* ---------------------------------------------------------------- menus */
function hideMenu() { var m = $('ctx'); if (!m.hidden) { m.hidden = true; clear(m); } }
function showMenu(x, y, items, client) {
  var m = $('ctx'); clear(m);
  items.forEach(function (it) {
    if (!it) return;
    if (it.hd) { m.appendChild(h('div', { class: 'hd' }, it.hd)); return; }
    if (it.sep) { m.appendChild(h('hr')); return; }
    m.appendChild(h('button', { role: 'menuitem', disabled: it.off, onclick: function () { hideMenu(); it.fn(); } }, [it.t, it.k ? h('span', { class: 'k' }, it.k) : null]));
  });
  m.hidden = false;
  var r = stage.getBoundingClientRect(), px = (client ? x : x + r.left), py = (client ? y : y + r.top), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(6, Math.min(window.innerWidth - mw - 6, px)) + 'px'; m.style.top = Math.max(6, Math.min(window.innerHeight - mh - 6, py)) + 'px';
  var f = m.querySelector('button:not([disabled])'); if (f) f.focus();
}
document.addEventListener('pointerdown', function (e) { var m = $('ctx'); if (!m.hidden && !m.contains(e.target)) hideMenu(); }, true);
$('ctx').addEventListener('keydown', function (e) {
  var bs = Array.from($('ctx').querySelectorAll('button:not([disabled])')), i = bs.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } else if (e.key === 'Escape') { hideMenu(); stage.focus(); }
});
function labelOf(id) { var n = S.byId.get(id); return n ? n.label : id; }
function openContext(x, y, hh, touch) {
  var items = [], ids = Array.from(S.sel);
  if (hh.type === 'node' || (hh.type === 'label' && hh.node)) {
    var id = hh.node.nodeId; if (id === undefined) return;
    if (!S.sel.has(id)) { setSel([id]); ids = [id]; }
    items = ids.length > 1 ? selectionMenu(ids) : nodeMenu(id);
    if (skOn()) items = (hh.type === 'label' && ids.length === 1 ? skLabelItems(id) : skNodeItems(ids)).concat(items);
  } else if (hh.type === 'edge') {
    if (!S.selEdges.has(hh.edge)) setSel([], { edges: [hh.edge] });
    items = edgeMenu(hh.edge);
    if (skOn()) items = skLinkItems(hh.edge).concat(items);
  } else if (hh.type === 'group' || hh.type === 'lane') {
    var gi = groupHitIds(hh); setSel(gi); items = groupMenu(hh, gi);
  } else {
    items = ids.length ? selectionMenu(ids).concat([{ sep: 1 }]).concat(backgroundMenu()) : backgroundMenu();
    if (skOn()) items = skBackgroundItems().concat(items);
  }
  showMenu(x, y, items);
  if (touch && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* none */ } }
}
/** Every page that can lead to this one plus every page it can lead on to (the pages on some route through it). */
function routeIds(id) {
  var seen = new Set([id]);
  [[S.outAdj, 'to'], [S.inAdj, 'from']].forEach(function (d) {
    var q = [id], seenD = new Set([id]);
    for (var i = 0; i < q.length; i++) (d[0].get(q[i]) || []).forEach(function (e) { var w = e[d[1]]; if (!seenD.has(w)) { seenD.add(w); seen.add(w); q.push(w); } });
  });
  return Array.from(seen);
}
function nodeMenu(id) {
  var g = S.byId.get(id), outs = S.outAdj.get(id) || [], blocked = S.V.block.indexOf(id) >= 0, pinned = own(S.V.pins[pinKey()], id);
  var it = [{ hd: g ? g.label : id },
    { t: 'Show details', fn: function () { renderDetails(true); } },
    { t: 'Zoom to it and its neighbors', fn: function () { var v = fitTarget(Array.from(neighborIds([id]))); if (v) viewTo(v, 480); } },
    { t: 'Select what it leads to', fn: function () { setSel(outs.map(function (e) { return e.to; }).concat([id])); } },
    { t: 'Select what leads to it', fn: function () { setSel((S.inAdj.get(id) || []).map(function (e) { return e.from; }).concat([id])); } },
    { t: 'Select every page on a route through it', fn: function () { setSel(routeIds(id)); } },
    ].concat(((S.L && S.L.chapters && S.L.chapters.openOf && S.L.chapters.openOf[id]) || []).map(function (k) { return { t: k.charAt(0) === 'p' ? 'Fold this part back into one box' : 'Fold this chapter back into one box', fn: function () { toggleChapter(k, false); } }; })).concat([
    { sep: 1 },
    { hd: 'Show only…' },
    { t: 'Around it, 1 step', fn: function () { setAround(id, 1); } }, { t: 'Around it, 2 steps', fn: function () { setAround(id, 2); } }, { t: 'Around it, 3 steps', fn: function () { setAround(id, 3); } },
    { t: 'Light up routes from here', fn: function () { railTab('find'); setRouteFrom(id); } },
    { sep: 1 },
    { hd: 'Change' },
    { t: 'Make this the start', fn: function () { edit(function (gg) { gg.start = id; }); toast('Start is now ' + labelOf(id) + '.'); } },
    { t: blocked ? 'Put it back' : 'Take it out (what if)', fn: function () { var b = S.V.block.slice(), i = b.indexOf(id); if (i >= 0) b.splice(i, 1); else b.push(id); setV({ block: b }); } }]);
  if (S.story && !outs.length) it.push({ t: 'Mark as good ending', fn: function () { setValence([id], 'good'); } }, { t: 'Mark as bad ending', fn: function () { setValence([id], 'bad'); } });
  it.push({ t: 'Highlight in a color', fn: function () { markMenu([id], null); } }, { t: 'Style this item…', fn: function () { openStyleFor({ type: 'set' }, [id]); } });
  if (canDrag()) it.push({ t: pinned ? 'Let it float again' : 'Keep it where it is', fn: function () { if (pinned) clearPins([id]); else { var n = layoutPositions().get(id); if (n) setPins(JSON.parse('{"' + id.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '":[' + n.cx + ',' + n.cy + ']}')); } } });
  it.push({ sep: 1 }, { t: 'Copy name', fn: function () { copyText(g ? g.label : id); } });
  return it;
}
function selectionMenu(ids) {
  var n = ids.length;
  return [{ hd: plural(n, 'item') + ' selected' },
    { t: 'Zoom to them', fn: function () { var v = fitTarget(ids); if (v) viewTo(v, 480); } },
    { t: 'Add their neighbors', fn: function () { setSel(Array.from(neighborIds(ids))); } },
    { t: 'Show only these', fn: function () { onlyShow(ids); } },
    { t: 'Take them out (what if)', fn: function () { setV({ block: Array.from(new Set(S.V.block.concat(ids))) }); setSel([]); } },
    { sep: 1 }, { hd: 'Make' },
    { t: 'Group them together…', fn: function () { makeGroup(ids); } },
    { t: 'Save as a named set…', fn: function () { makeSet(ids); } },
    { t: 'Highlight in a color', fn: function () { markMenu(ids, null); } },
    { t: 'Style them…', fn: function () { openStyleFor({ type: 'set' }, ids); } },
    { sep: 1 }, { hd: 'Arrange' },
    { t: 'Move apart slightly', fn: function () { separateItems(ids); }, off: !canDrag() },
    { t: 'Spread out 30%', fn: function () { spreadItems(ids, 1.3); }, off: !canDrag() },
    { t: 'Pull together 30%', fn: function () { spreadItems(ids, 0.7); }, off: !canDrag() },
    { t: 'Let them float again', fn: function () { clearPins(ids); }, off: !canDrag() },
    { sep: 1 },
    { t: 'Copy names', fn: function () { copyText(ids.map(labelOf).join('\n')); } },
    { t: 'Clear selection', fn: function () { setSel([]); }, k: 'Esc' }];
}
function edgeMenu(ei) {
  var e = edgeOf(ei); if (!e) return [];
  var kinds = e.orig && S.dg.edges[e.orig[0]] ? S.dg.edges[e.orig[0]].kind : '';
  return [{ hd: labelOf(e.from) + ' → ' + labelOf(e.to) },
    { t: 'Show details', fn: function () { renderDetails(true); } },
    { t: 'Select both ends', fn: function () { setSel([e.from, e.to]); } },
    { t: 'Light up routes through it', fn: function () { routeThrough(e); } },
    { t: 'Style this link…', fn: function () { openStyleFor({ type: 'kind', value: kinds }, null, 'links', ei); } },
    kinds ? { t: 'Hide links of kind "' + kinds + '"', fn: function () { setV({ hideKinds: S.V.hideKinds.concat([kinds]) }); } } : null,
    { t: 'Remove this link from the data', fn: function () { var os = (e.orig || []).slice(); edit(function (g) { g.edges = g.edges.filter(function (_, i) { return os.indexOf(i) < 0; }); }); setSel([]); toast('Link removed. ' + T('Ctrl+Z', 'Undo on the Data tab') + ' undoes it.'); } }];
}
function groupMenu(hh, ids) {
  var name = hh.type === 'group' ? (hh.group || '(none)') : (S.L.laneNames && S.L.laneNames[hh.lane]);
  return [{ hd: 'Group ' + name + ' (' + plural(ids.length, 'item') + ')' },
    { t: 'Zoom to the group', fn: function () { var v = fitTarget(ids); if (v) viewTo(v, 480); } },
    { t: 'Show only this group', fn: function () { onlyShow(ids); } },
    { t: 'Take the group out (what if)', fn: function () { setV({ block: Array.from(new Set(S.V.block.concat(ids))) }); setSel([]); } },
    { t: 'Style this group…', fn: function () { openStyleFor({ type: 'group', value: name }); } },
    { t: 'Highlight in a color', fn: function () { markMenu(ids, null); } },
    { t: S.V.hulls ? 'Hide group shapes' : 'Show group shapes', fn: function () { setV({ hulls: !S.V.hulls }); } }];
}
function backgroundMenu() {
  var V = S.V, it = [{ hd: 'Map' }, { t: 'Fit everything', fn: function () { fitView(); }, k: '0' }, { t: 'Select all', fn: function () { setSel(S.dg.nodes.map(function (n) { return n.id; })); }, k: 'Ctrl+A' }, { sep: 1 }, { hd: 'View' }];
  VIEWS.forEach(function (v) { if (v[0] !== V.view) it.push({ t: v[1], fn: function () { setV({ view: v[0] }); } }); });
  if (V.view === 'network') { it.push({ sep: 1 }, { hd: 'Arrange as' }); Object.keys(ARR).forEach(function (k) { if (k !== V.arrange) it.push({ t: ARR[k], fn: function () { setV({ arrange: k }); } }); }); }
  it.push({ sep: 1 }, { t: V.lab.items.show ? 'Hide item labels' : 'Show item labels', fn: function () { setV({ lab: { items: { show: !V.lab.items.show } } }, 'look'); } },
    { t: V.hulls ? 'Hide group shapes' : 'Show group shapes', fn: function () { setV({ hulls: !V.hulls }, 'look'); } },
    { t: 'Open the Style panel…', fn: function () { railTab('style'); } },
    { t: 'Save this view…', fn: function () { railTab('views'); } });
  return it;
}
function copyText(t) { try { navigator.clipboard.writeText(t).then(function () { toast('Copied.'); }, function () { toast('Could not copy.'); }); } catch (e) { toast('Could not copy.'); } }
function markMenu(ids, el) {
  var colors = ['#e15759', '#f28e2b', '#edc948', '#59a14f', '#4e79a7', '#b07aa1', null];
  var items = [{ hd: 'Highlight ' + plural(ids.length, 'item') }].concat(colors.map(function (c) { return { t: c ? '● ' + ({ '#e15759': 'Red', '#f28e2b': 'Orange', '#edc948': 'Yellow', '#59a14f': 'Green', '#4e79a7': 'Blue', '#b07aa1': 'Purple' }[c]) : 'Remove highlight', fn: function () { var m = Object.assign({}, S.V.marks); ids.forEach(function (id) { if (c) m[id] = c; else delete m[id]; }); S.V.marks = m; saveView(); applyStyle(); renderMapUI(); } }; }));
  var r = stage.getBoundingClientRect();
  showMenu(r.left + 120, r.top + 120, items, true);
}
function askText(title, label, def) {
  return new Promise(function (resolve) {
    var dlg = $('dlg'), body = $('dlg-body'), inp = h('input', { type: 'text', value: def || '', 'aria-label': label, style: { width: '100%' } });
    var done = function (v) { dlg.close(); resolve(v); };
    mount(body, [h('h3', { id: 'dlg-h' }, title), field(label, inp), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [h('button', { onclick: function () { done(null); } }, 'Cancel'), h('button', { class: 'primary', onclick: function () { done(inp.value.trim() || null); } }, 'OK')])]);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(inp.value.trim() || null); });
    dlg.onclose = function () { resolve(null); };
    dlg.showModal(); inp.focus(); inp.select();
  });
}
function makeGroup(ids) {
  askText('Group these ' + plural(ids.length, 'item'), 'Group name', '').then(function (name) {
    if (!name) return;
    var set = new Set(ids);
    edit(function (g) { g.nodes = g.nodes.map(function (n) { return set.has(n.id) ? Object.assign({}, n, { group: name }) : n; }); });
    toast('Grouped as "' + name + '". ' + T('Ctrl+Z', 'Undo on the Data tab') + ' undoes it.');
  });
}
function makeSet(ids) {
  askText('Save these ' + plural(ids.length, 'item') + ' as a set', 'Set name', 'My set').then(function (name) {
    if (!name) return;
    var sets = Object.assign({}, S.V.sets); sets[name] = ids.slice(); S.V.sets = sets; saveView();
    toast('Saved the set "' + name + '". Use it in the Style panel to format it.'); openStyleFor({ type: 'set', name: name });
  });
}
function setValence(ids, v) { var set = new Set(ids); edit(function (g) { g.nodes = g.nodes.map(function (n) { return set.has(n.id) ? Object.assign({}, n, { valence: v }) : n; }); }); }
function onlyShow(ids) { S.V.only = ids.slice(); saveView(); refreshMap('options'); toast('Showing only ' + plural(ids.length, 'item') + '. "Show everything" is on the Filter tab.'); }
function setAround(id, depth) { S.V.around = { id: id, depth: depth }; saveView(); refreshMap('options'); renderMapUI(); }

/* ---------------------------------------------------------------- selection bar */
function renderSelbar() {
  var bar = $('selbar'); if (!bar) return;
  var n = S.sel.size, e = S.selEdges.size;
  if (!n && !e) { bar.hidden = true; return; }
  var ids = Array.from(S.sel);
  bar.hidden = false;
  mount(bar, [h('b', { class: 'small' }, n ? plural(n, 'item') + ' selected' : plural(e, 'link') + ' selected'),
    n ? h('button', { class: 'sm', onclick: function () { var v = fitTarget(ids); if (v) viewTo(v, 480); } }, 'Zoom to') : null,
    n > 1 ? h('button', { class: 'sm', onclick: function () { separateItems(ids); }, disabled: !canDrag(), title: canDrag() ? '' : 'Network view only' }, 'Move apart') : null,
    n ? h('button', { class: 'sm', onclick: function () { markMenu(ids); } }, 'Highlight') : null,
    n > 1 ? h('button', { class: 'sm', onclick: function () { makeGroup(ids); } }, 'Group…') : null,
    n ? h('button', { class: 'sm', onclick: function () { onlyShow(ids); } }, 'Show only') : null,
    n ? h('button', { class: 'sm', onclick: function () { openStyleFor({ type: 'set' }, ids); } }, 'Style…') : null,
    h('button', { class: 'sm quiet', onclick: function () { setSel([]); }, 'aria-label': 'Clear selection' }, '✕')]);
}

/* ---------------------------------------------------------------- details panel */
function chipsFor(list, key) {
  return list.length ? h('div', { class: 'chips' }, list.slice(0, 40).map(function (e) { return h('button', { class: 'chip', title: e.label || '', onclick: function () { setSel([e[key]], { center: true }); } }, labelOf(e[key])); }).concat(list.length > 40 ? [h('span', { class: 'muted small' }, 'and ' + (list.length - 40) + ' more')] : [])) : h('span', { class: 'muted small' }, 'none');
}
function kvTable(rows) { return h('table', { class: 't' }, h('tbody', null, rows.map(function (r) { return h('tr', null, [h('td', null, r[0]), h('td', null, h('b', null, r[1]))]); }))); }
function closeDetails() { S.detailsOff = true; renderDetails(); }
function renderDetails(force) {
  var d = $('details'); if (!d) return;
  if (force) S.detailsOff = false;
  var ids = Array.from(S.sel), eds = Array.from(S.selEdges);
  if ((!ids.length && !eds.length) || S.detailsOff) { d.hidden = true; return; }
  var kids = [];
  if (ids.length === 1) {
    var id = ids[0], g = S.dg.byId ? S.dg.byId.get(id) : null; g = S.byId.get(id) && S.dg.nodes[S.graph.nodes.indexOf(S.byId.get(id))] || S.byId.get(id);
    var sn = sceneNodeFor(id), nn = sn && sn.n, outs = S.outAdj.get(id) || [], ins = S.inAdj.get(id) || [], L = S.L, blocked = S.V.block.indexOf(id) >= 0;
    kids.push(h('div', { class: 'row' }, [h('h3', { style: { flex: 1 } }, g.label), h('button', { class: 'quiet icon', onclick: closeDetails, 'aria-label': 'Close details' }, '✕')]));
    kids.push(h('div', { class: 'row tight' }, [g.group ? h('span', { class: 'pill' }, g.group) : null, id === (L && L.startId) ? h('span', { class: 'pill' }, 'start') : null, nn && nn.choke ? h('span', { class: 'pill' }, 'choke point') : null,
      g.valence ? h('span', { class: 'pill ' + (g.valence === 'good' ? 'good' : g.valence === 'bad' ? 'bad' : '') }, g.valence === 'neutral' ? 'other ending' : g.valence + ' ending') : null, g.ghost ? h('span', { class: 'pill ghost' }, 'placeholder') : null, nn && nn.unreached ? h('span', { class: 'pill' }, 'not reached') : null]));
    var rows = [[cap(word('links')) + ' going out', outs.length], [cap(word('links')) + ' coming in', ins.length]];
    if (nn && nn.outW !== undefined && S.prof && NFMColumns.findCol(S.prof.edges, 'weight')) rows.push(['Weight out / in', NFMColumns.fmt(nn.outW) + ' / ' + NFMColumns.fmt(nn.inW)]);
    if (nn && L && L.startId && L.view !== 'network') { rows.push(['Routes passing through', Math.round((nn.traffic || 0) * 100) + '%']); if (L.flow) rows.push([L.flow.exact ? 'Expected visits per ' + word('walker') : 'Average visits per ' + word('walker'), (nn.visits || 0).toFixed(2)]); }
    if (S.simSnap && S.simSnap.visits) rows.push(['Simulated visits', NFMColumns.fmt(S.simSnap.visits[S.graph.nodes.indexOf(S.byId.get(id))] || 0)]);
    kids.push(kvTable(rows));
    var at = g.attrs ? Object.keys(g.attrs) : [];
    if (at.length) kids.push(h('div', null, [h('b', { class: 'small' }, 'From your data'), kvTable(at.slice(0, 16).map(function (k) { var v = g.attrs[k]; return [k, typeof v === 'number' ? NFMColumns.fmt(v) : String(v).slice(0, 140)]; }))]));
    kids.push(h('div', null, [h('b', { class: 'small' }, 'Goes to'), chipsFor(outs, 'to')]), h('div', null, [h('b', { class: 'small' }, 'Comes from'), chipsFor(ins, 'from')]));
    var acts = [h('button', { class: 'sm', onclick: function () { edit(function (gg) { gg.start = id; }); } }, 'Make this the start'),
      h('button', { class: 'sm', onclick: function () { setAround(id, 2); } }, 'Show around it'),
      h('button', { class: 'sm', onclick: function () { var b = S.V.block.slice(), i = b.indexOf(id); if (i >= 0) b.splice(i, 1); else b.push(id); setV({ block: b }); } }, blocked ? 'Put it back' : 'Take it out (what if)'),
      h('button', { class: 'sm', onclick: function () { openStyleFor({ type: 'set' }, [id]); } }, 'Style it…')];
    if (S.story && !outs.length) acts.push(h('button', { class: 'sm', onclick: function () { setValence([id], 'good'); } }, 'Mark good ending'), h('button', { class: 'sm', onclick: function () { setValence([id], 'bad'); } }, 'Mark bad ending'));
    if (g.valence) acts.push(h('button', { class: 'sm', onclick: function () { setValence([id], ''); } }, 'Clear ending mark'));
    kids.push(h('div', { class: 'row tight' }, acts));
  } else if (ids.length > 1) {
    kids.push(h('div', { class: 'row' }, [h('h3', { style: { flex: 1 } }, plural(ids.length, 'item') + ' selected'), h('button', { class: 'quiet icon', onclick: closeDetails, 'aria-label': 'Close details' }, '✕')]));
    var nodes = ids.map(function (i) { return S.dg.nodes[S.graph.nodes.indexOf(S.byId.get(i))] || S.byId.get(i); });
    var byG = {}; nodes.forEach(function (n) { var k = n.group || '(none)'; byG[k] = (byG[k] || 0) + 1; });
    var inside = 0, outside = 0, set = new Set(ids); ids.forEach(function (i) { (S.outAdj.get(i) || []).forEach(function (e) { if (set.has(e.to)) inside++; else outside++; }); (S.inAdj.get(i) || []).forEach(function (e) { if (!set.has(e.from)) outside++; }); });
    kids.push(kvTable([['Links between them', inside], ['Links to or from outside', outside]]));
    kids.push(h('div', { class: 'chips' }, Object.keys(byG).sort(function (a, b) { return byG[b] - byG[a]; }).slice(0, 10).map(function (k) { return h('span', { class: 'pill' }, k + ' · ' + byG[k]); })));
    var numCols = S.prof.nodes.filter(function (c) { return !c.builtin && c.kind === 'number'; }).slice(0, 8);
    if (numCols.length) kids.push(h('div', null, [h('b', { class: 'small' }, 'Totals for the selection'), h('table', { class: 't' }, [h('thead', null, h('tr', null, ['Column', 'Total', 'Average'].map(function (x) { return h('th', null, x); }))), h('tbody', null, numCols.map(function (c) {
      var s = 0, k = 0; nodes.forEach(function (n) { var v = NFMColumns.num(n.attrs && n.attrs[c.key]); if (v === v) { s += v; k++; } }); return h('tr', null, [h('td', null, c.name), h('td', null, NFMColumns.fmt(s)), h('td', null, k ? NFMColumns.fmt(s / k) : '–')]);
    }))])]));
    kids.push(h('div', { class: 'chips' }, ids.slice(0, 40).map(function (i) { return h('button', { class: 'chip', onclick: function () { setSel([i], { center: true }); } }, labelOf(i)); }).concat(ids.length > 40 ? [h('span', { class: 'muted small' }, 'and ' + (ids.length - 40) + ' more')] : [])));
    kids.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { makeGroup(ids); } }, 'Group them…'), h('button', { class: 'sm', onclick: function () { makeSet(ids); } }, 'Save as a set…'), h('button', { class: 'sm', onclick: function () { onlyShow(ids); } }, 'Show only these'), h('button', { class: 'sm', onclick: function () { openStyleFor({ type: 'set' }, ids); } }, 'Style…')]));
  } else {
    var e = edgeOf(eds[0]); if (!e) { d.hidden = true; return; }
    var os = (e.orig || []).map(function (i) { return S.dg.edges[i]; }).filter(Boolean);
    kids.push(h('div', { class: 'row' }, [h('h3', { style: { flex: 1 } }, labelOf(e.from) + ' → ' + labelOf(e.to)), h('button', { class: 'quiet icon', onclick: closeDetails, 'aria-label': 'Close details' }, '✕')]));
    var rr = [['Links merged here', e.count || 1]]; if (e.widthV === e.widthV && S.V.widthBy) rr.push([chLabel(S.V.widthBy, 'edges'), NFMColumns.fmt(e.widthV)]);
    if (e.flow) rr.push(['Flow carried', NFMColumns.fmt(e.flow)]); kids.push(kvTable(rr));
    os.slice(0, 6).forEach(function (o) {
      var rows2 = []; if (o.label) rows2.push(['Label', o.label]); if (o.weight !== undefined) rows2.push(['Weight', NFMColumns.fmt(o.weight)]); if (o.kind) rows2.push(['Kind', o.kind]);
      Object.keys(o.attrs || {}).slice(0, 12).forEach(function (k) { var v = o.attrs[k]; rows2.push([k, typeof v === 'number' ? NFMColumns.fmt(v) : String(v).slice(0, 100)]); });
      if (rows2.length) kids.push(kvTable(rows2));
    });
    kids.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { setSel([e.from, e.to]); } }, 'Select both ends'), h('button', { class: 'sm', onclick: function () { routeThrough(e); } }, 'Light up routes through it')]));
  }
  mount(d, kids); d.hidden = false;
}

/* ---------------------------------------------------------------- keyboard */
stage.addEventListener('keydown', function (e) {
  if (e.target !== stage) return;
  var k = e.key, ids = Array.from(S.sel), id = ids.length === 1 ? ids[0] : null, W = S.stageW / 2, H = S.stageH / 2;
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') { e.preventDefault(); setSel(S.dg.nodes.map(function (n) { return n.id; })); return; }
  if (k === '/' || ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'f')) { e.preventDefault(); railTab('find'); var si = $('search'); if (si) si.focus(); return; }
  var plainKey = !e.ctrlKey && !e.metaKey && !e.altKey;   /* Ctrl + / - / 0 is the browser's own page zoom: leave it alone */
  if (plainKey && (k === '+' || k === '=')) { zoomAt(W, H, 1.35); e.preventDefault(); return; }
  if (plainKey && (k === '-' || k === '_')) { zoomAt(W, H, 1 / 1.35); e.preventDefault(); return; }
  if (plainKey && k === '0') { fitView(); e.preventDefault(); return; }
  if (k === 'f' && ids.length) { var v = fitTarget(ids); if (v) viewTo(v, 480); return; }
  if (k === 'ContextMenu' || (e.shiftKey && k === 'F10')) { e.preventDefault(); var n0 = ids.length ? sceneNodeFor(ids[0]) : null, px = n0 ? (n0.x + n0.w / 2) * S.view.k + S.view.tx : W, py = n0 ? (n0.y + n0.h / 2) * S.view.k + S.view.ty : H; openContext(px, py, n0 ? { type: 'node', node: n0 } : { type: 'bg' }, false); return; }
  if (k === 'Escape') { if (S.search.q) { runSearch(''); var si2 = $('search'); if (si2) si2.value = ''; } else if (S.route) { S.route = null; applyStyle(); renderMapUI(); } else if (ids.length || S.selEdges.size) setSel([]); return; }
  if (k === 'Delete' && ids.length) { setV({ block: Array.from(new Set(S.V.block.concat(ids))) }); setSel([]); return; }
  if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter'].indexOf(k) < 0) return;
  e.preventDefault();
  if (e.shiftKey && id && canDrag() && k !== 'Enter') { var nn = layoutPositions().get(id); if (nn) { var st = 12 / S.view.k, o2 = {}; o2[id] = [nn.cx + (k === 'ArrowRight' ? st : k === 'ArrowLeft' ? -st : 0), nn.cy + (k === 'ArrowDown' ? st : k === 'ArrowUp' ? -st : 0)]; setPins(o2); } return; }
  if (!id) { var first = (S.L && S.L.startId) || (liveScene() && S.scene.nodes.length && S.scene.nodes[0].nodeId); if (first) setSel([first], { center: true }); return; }
  if (k === 'Enter') { renderDetails(true); var dd = $('details'); if (!dd.hidden) { var b = dd.querySelector('button'); if (b) b.focus(); } return; }
  var outs = S.outAdj.get(id) || [], ins = S.inAdj.get(id) || [], dirTB = S.V.dir === 'TB' && S.V.view === 'flow';
  if (k === (dirTB ? 'ArrowDown' : 'ArrowRight') || (k === 'ArrowRight' && S.V.view === 'network')) {
    if (!outs.length) { say('No way on from here.'); return; }
    S.ring = { list: outs.map(function (x) { return x.to; }), i: 0 }; setSel([S.ring.list[0]], { center: true }); return;
  }
  if (k === (dirTB ? 'ArrowUp' : 'ArrowLeft') || k === 'ArrowLeft') {
    if (!ins.length) { say('Nothing leads here.'); return; }
    var par = ins[0].from, sib = (S.outAdj.get(par) || []).map(function (x) { return x.to; }); setSel([par], { center: true }); S.ring = { list: sib, i: Math.max(0, sib.indexOf(id)) }; return;
  }
  if (S.ring && S.ring.list.length > 1 && S.ring.list.indexOf(id) >= 0) {
    var n = S.ring.list.length, i = S.ring.list.indexOf(id) + (k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1); i = (i + n) % n; var keep = S.ring; setSel([keep.list[i]], { center: true }); S.ring = keep; return;
  }
  say('No other choice at this point.');
});
