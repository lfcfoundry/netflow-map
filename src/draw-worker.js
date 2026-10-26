/*!
 * Netflow Map drawing worker: draws GIF/video pictures off the main thread. Gets the layout once, then one message per picture. The same handler can run on the page (the twin check).
 * Needs NetflowScene (as NFMScene), NFMRender and NFMLook in the same scope. Draws the map only (background and both layers); the page adds the key and the caption. Copyright (c) 2026 LFC Foundry. MIT License.
 * Messages in:  init {L, so, tables, W, H, view, o, font, keyEdits} | draw {id, cam, names, caption}
 * Messages out: ready | drawn {id, buf} | error {id, msg}
 */
var NFMDrawWorker = (function () {
  'use strict';
  var st = null;
  function styleFns(so, T) {
    if (T.chName) { var cn = T.chName; so.chName = function (c) { return cn.has(c) ? cn.get(c) : c; }; }
    if (T.nodeStyle || T.nodeScale !== 1) {
      var nsT = T.nodeStyle, sc = T.nodeScale;
      so.nodeStyle = function (n) { var b = nsT ? (nsT.get(n.nodeId || n.id) || null) : null; return sc !== 1 ? Object.assign({}, b || {}, { scale: ((b && b.scale) || 1) * sc }) : b; };
    }
    if (T.edgeStyle) { var esT = T.edgeStyle; so.linkStyle = function (e) { var best = null; if (e.orig) for (var i = 0; i < e.orig.length && !best; i++) best = esT.get(e.orig[i]) || null; return best; }; }
  }
  function editKey(sc, ed) {
    if (!sc.legend) return;
    if (ed.__title) sc.legendTitle = ed.__title;
    sc.legend = sc.legend.filter(function (l) { var k = l.key || l.t, e = ed[k]; if (e && e.hide) return false; if (e && e.t) l.t = e.t; return true; });
  }
  function init(m) {
    st = { L: m.L, so: m.so, T: m.tables || {}, W: m.W, H: m.H, view: m.view, o: m.o || {}, font: m.font, keyEdits: m.keyEdits || {}, r: null, out: null, x: null };
    NFMLook.register(NFMScene, m.fmt, m.themeName); NFMRender.setFont(NFMLook.fontStack(m.fmt.font));   /* the same look and font names the page registered */
    var host = { offscreen: true };
    return NFMRender.createCanvas2D(host, { cpu: true }).then(function (r) {
      st.r = r; r.resize(st.W, st.H, 1); st.out = new OffscreenCanvas(st.W, st.H); st.x = st.out.getContext('2d', { willReadFrequently: true });
    });
  }
  function draw(m) {
    var so = Object.assign({}, st.so); styleFns(so, st.T); if (m.cam) so.cam = m.cam;
    var sc = NFMScene.make(st.L, so); editKey(sc, st.keyEdits);
    if (m.names !== undefined && m.names < 0.999) { if (m.names <= 0.01) sc.labels = []; else sc.labels.forEach(function (l) { l.a = (l.a === undefined ? 1 : l.a) * m.names; }); }
    var r = st.r, x = st.x, W = st.W, H = st.H;
    r.setScene(sc); r.draw({ k: st.view.k, tx: st.view.tx, ty: st.view.ty, invalidate: function () { /* still picture */ } });
    x.fillStyle = sc.theme.hex.bg; x.fillRect(0, 0, W, H);
    var cv = r.layers ? r.layers() : null; for (var i = 0; cv && i < cv.length; i++) x.drawImage(cv[i], 0, 0);
    /* the key and the caption are drawn by the page afterwards: text drawn in a worker can differ a little from the page's (Firefox), the map itself does not */
    return x.getImageData(0, 0, W, H).data.buffer;
  }
  function handle(m, post) {
    try {
      if (m.t === 'init') init(m).then(function () { post({ t: 'ready', id: m.id }); }, function (e) { post({ t: 'error', id: m.id, msg: String(e && e.message || e) }); });
      else if (m.t === 'draw') { var t0 = Date.now(), b = draw(m); post({ t: 'drawn', id: m.id, buf: b, ms: Date.now() - t0 }, [b]); }
      else if (m.t === 'close') { try { st.r.destroy(); } catch (e) { /* gone */ } st = null; }
    } catch (e) { post({ t: 'error', id: m.id, msg: String(e && e.message || e) }); }
  }
  if (typeof importScripts === 'function' && typeof document === 'undefined') self.onmessage = function (e) { handle(e.data, function (msg, tr) { self.postMessage(msg, tr || []); }); };
  return { handle: handle };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMDrawWorker;
