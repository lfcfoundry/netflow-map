/* Copyright (c) 2026 LFC Foundry. MIT License. fuzz-kit adapter for Netflow Map: random pans, zooms, setting changes, tab changes, moving items, selecting, and loading good, damaged and odd files, all through the page's own controls and its NFM handle. After every move: the map still has a scene, the camera numbers are real, nothing shows NaN/undefined/[object ...], no error. Run: tools/fuzz-kit/run-netflow.sh (see README of the run script). */
window.__fuzzConfig = function (seed) {
  var I = Fuzzer.Input, VIEWS = ['flow', 'down', 'spine', 'lanes', 'sankey', 'network', 'matrix', 'arc'], ARR = ['stress', 'circle', 'closeness'], COLORS = ['group', 'traffic', 'heat', 'choke', 'none'];
  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }
  function settle(limit) { var t0 = performance.now(); return new Promise(function (res) { (function w() { if (!(window.NFM && NFM.pending()) || performance.now() - t0 > (limit || 15000)) res(); else setTimeout(w, 30); })(); }); }
  function stage() { var e = document.getElementById('stage'), r = e && e.getBoundingClientRect(); return r && r.width > 10 ? r : { left: 0, top: 0, width: innerWidth, height: innerHeight }; }
  function pt(c) { var r = stage(); return [r.left + r.width * (0.1 + 0.8 * c.rand()), r.top + r.height * (0.1 + 0.8 * c.rand())]; }
  function file(name, text, type) { return new File([text], name, { type: type || 'text/plain' }); }
  var good = {
    csv: 'from,to,count\na,b,3\nb,c,2\nc,a,1\nc,d,4\nd,e,2\ne,a,1\n',
    json: JSON.stringify({ nodes: [{ id: 'x' }, { id: 'y' }, { id: 'z' }], edges: [{ from: 'x', to: 'y' }, { from: 'y', to: 'z' }, { from: 'z', to: 'x' }] }),
    outline: '# Start\n- a\n  - b\n  - c\n- d\n'
  };
  function damage(c, s) {
    var kind = c.int(6), n = s.length;
    if (kind === 0) return s.slice(0, c.int(n + 1));
    if (kind === 1) { var i = c.int(n); return s.slice(0, i) + String.fromCharCode(c.int(256)) + s.slice(i + 1); }
    if (kind === 2) return s.replace(/,/g, c.pick([';', '\t', '"', ',,']));
    if (kind === 3) return s + s;
    if (kind === 4) return '';
    return s.split('').reverse().join('');
  }
  function settleGraph() { return settle(30000).then(frame); }
  return {
    seed: seed,
    ops: [
      { name: 'pan', weight: 6, run: function (c) { var a = pt(c), b = pt(c), el = document.getElementById('stage') || document.body; I.pointer(el, 'pointerdown', a[0], a[1], 'mouse'); I.pointer(el, 'pointermove', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'mouse'); I.pointer(el, 'pointermove', b[0], b[1], 'mouse'); I.pointer(el, 'pointerup', b[0], b[1], 'mouse'); return frame(); } },
      { name: 'zoom-wheel', weight: 5, run: function (c) { var a = pt(c), el = document.elementFromPoint(a[0], a[1]) || document.body, n = 1 + c.int(5); for (var k = 0; k < n; k++) el.dispatchEvent(new WheelEvent('wheel', { clientX: a[0], clientY: a[1], deltaY: c.pick([-240, -120, 120, 240, -40, 40]), bubbles: true, cancelable: true })); return frame(); } },
      { name: 'zoom-call', weight: 2, run: function (c) { var a = pt(c); NFM.zoomAt(a[0], a[1], c.pick([0.5, 0.8, 1.25, 2, 4, 40, 0.02]), c.chance(0.5)); return frame(); } },
      { name: 'fit', weight: 1, run: function () { NFM.fitView(true); return frame(); } },
      { name: 'view', weight: 3, run: function (c) { NFM.setV({ view: c.pick(VIEWS) }); return settle().then(frame); } },
      { name: 'arrange', weight: 2, run: function (c) { NFM.setV({ view: 'network', arrange: c.pick(ARR) }); return settle().then(frame); } },
      { name: 'color', weight: 2, run: function (c) { NFM.setV({ colorBy: c.pick(COLORS) }); return settle().then(frame); } },
      { name: 'line-width', weight: 3, run: function (c) { NFM.setV({ widthMul: 0.3 + 2.7 * c.rand() }); NFM.scheduleScene(); return frame(); } },
      { name: 'curve', weight: 2, run: function (c) { NFM.setV({ curve: c.pick([0, 0.2, 0.6]) }); NFM.scheduleScene(); return frame(); } },
      { name: 'label-top', weight: 1, run: function (c) { NFM.setV({ labels: { items: { topN: c.int(101), scale: 0.5 + 2 * c.rand() } } }); NFM.scheduleScene(); return frame(); } },
      { name: 'tab', weight: 2, run: function (c) { NFM.showTab(c.pick(['map', 'adv', 'map'])); return frame(); } },
      { name: 'move-items', weight: 3, run: function (c) { var L = NFM.state.L; if (!L || !L.nodes || !L.nodes.length || L.view !== 'network') return; var list = [], n = 1 + c.int(4); for (var k = 0; k < n; k++) { var q = L.nodes[c.int(L.nodes.length)]; list.push([q.nodeId || q.id, q.cx + (c.rand() - 0.5) * 200, q.cy + (c.rand() - 0.5) * 200]); } NFM.moveItems(list); return frame().then(function () { if (c.chance(0.6) && NFM.dropItems) NFM.dropItems(); }); } },
      { name: 'select', weight: 2, run: function (c) { var S = NFM.state, ids = S.byId ? Array.from(S.byId.keys()) : []; if (!ids.length) return; NFM.setSel(c.chance(0.2) ? [] : [ids[c.int(ids.length)]]); return frame(); } },
      { name: 'example', weight: 1, run: function (c) { var ex = NFMExamples.LIST[c.int(NFMExamples.LIST.length)]; var r = ex.load(); NFM.setGraph(r.graph); return settleGraph(); } },
      { name: 'big-network', weight: 2, run: function (c) { NFM.setGraph(NFMExamples.bigNetwork(300 + c.int(4000), 2 + c.int(6), 1 + c.int(50))); NFM.showTab('map'); NFM.setV({ view: 'network', arrange: c.pick(ARR) }); return settleGraph(); } },
      { name: 'load-file', weight: 3, run: function (c) { var k = c.pick(Object.keys(good)), txt = good[k]; if (c.chance(0.6)) txt = damage(c, txt); return NFM.ingest([file('fuzz.' + (k === 'outline' ? 'md' : k), txt, k === 'json' ? 'application/json' : 'text/plain')]).then(settleGraph, settleGraph); } },
      { name: 'load-junk', weight: 1, run: function (c) { var junk = I.junk ? I.junk(c) : 'NaN'; return NFM.ingest([file('junk.csv', String(junk) + '\n' + String(junk))]).then(settleGraph, settleGraph); } },
      { name: 'wait', weight: 2, run: function (c) { return new Promise(function (r) { setTimeout(r, 10 + c.int(160)); }); } }
    ].concat(Fuzzer.Real.ops()),
    invariants: [
      Fuzzer.Invariants.noJunkText(),
      function () {
        if (!window.NFM) return 'the NFM handle is gone';
        var S = NFM.state, v = S.view; if (!S) return 'no state';
        if (v && !(isFinite(v.k) && v.k > 0 && isFinite(v.tx) && isFinite(v.ty))) return 'camera is not a real number: ' + JSON.stringify([v.k, v.tx, v.ty]);
        return '';
      },
      function () { var S = NFM.state; if (S.mapBuilt && S.L && !S.scene && !NFM.pending()) return 'a built map with nothing to draw'; return ''; }
    ],
    state: function () { var S = window.NFM && NFM.state; return S && S.L ? S.L.view + ':' + (S.L.nodes ? Math.min(S.L.nodes.length, 9999) >> 8 : 0) : 'no map'; },
    afterFail: function () { try { NFM.showTab('map'); NFM.fitView(true); } catch (e) { /* ignore */ } }
  };
};
