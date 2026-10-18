/* Copyright (c) 2026 LFC Foundry. MIT License. Data sets of about 100,000 items, each packed with memory-compression in the two modes the app could use ('fast' = what the app uses now, 'balanced'), and a tally of the way each piece was stored. */
(function () {
  var MC = self.MemoryCompression, N = 100000;
  function rng(seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
  var SYL = ['ka', 'lo', 'mi', 'ra', 'ten', 'vo', 'shu', 'bel', 'dar', 'in', 'or', 'fe', 'na', 'qui', 'zor', 'ul'];
  function word(r) { var n = 2 + Math.floor(r() * 3), s = ''; for (var i = 0; i < n; i++) s += SYL[Math.floor(r() * SYL.length)]; return s; }
  /* made-up networks with different shapes and different kinds of attributes */
  function network(kind, n, seed) {
    var r = rng(seed), nodes = [], edges = [], seen = new Set(), i, j, t, a;
    var add = function (x, y, extra) { if (x === y) return; var k = x * 1048576 + y; if (seen.has(k)) return; seen.add(k); var e = { from: 'p' + x, to: 'p' + y, label: '', kind: '', attrs: {} }; if (extra) extra(e); edges.push(e); };
    for (i = 0; i < n; i++) {
      var nd = { id: 'p' + i, label: kind === 'rich' ? word(r) + ' ' + word(r) + ' ' + (i % 997) : 'Item ' + i, group: kind === 'rich' ? ['Alpha', 'Beta', 'Gamma', 'Delta'][i % 4] : '', valence: kind === 'rich' ? ['', 'good', 'bad'][i % 3] : '', ghost: false, attrs: {} };
      if (kind === 'rich') { nd.attrs.community = i % 50; nd.attrs.score = Math.round(r() * 10000) / 100; nd.attrs.created = new Date(1.6e12 + Math.floor(r() * 4e10)).toISOString(); }
      else if (kind === 'communities') nd.attrs.community = Math.floor(i / (n / 12));
      nodes.push(nd);
    }
    var per = Math.ceil(n / 12);
    for (j = 0; j < n; j++) {
      var m = 2 + Math.floor(r() * 3);
      for (a = 0; a < m; a++) {
        if (kind === 'hub') t = Math.floor(Math.pow(r(), 3) * n);            /* a few very popular items */
        else if (kind === 'random') t = Math.floor(r() * n);
        else t = Math.floor(j / per) * per + Math.floor(r() * per);
        add(j, t, kind === 'rich' ? function (e) { e.weight = Math.round(r() * 100000) / 1000; e.kind = ['calls', 'owns', 'pays'][Math.floor(r() * 3)]; e.attrs.at = Math.floor(1.6e12 + r() * 4e10); } : null);
      }
      if (kind === 'communities' && r() < 0.12) add(j, Math.floor(r() * n));
    }
    return { name: kind, start: null, nodes: nodes, edges: edges };
  }
  var cleanPart = function (p) { return String(p).replace(/\s*\(time[^)]*\)/, ''); };
  /* pack one value and say which ways held the bytes */
  function pack(label, value, mode, rawBytes, check) {
    self.__WAYS = []; self.__COLS = {}; self.__BY = [];
    var rep = [], t0, bytes, tp, tu, back, ok = true, parts = {}, i, r;
    try {
      t0 = performance.now(); bytes = MC.pack(value, { mode: mode, report: rep }); tp = performance.now() - t0;
      var ways = {}; self.__WAYS.forEach(function (w) { var q = ways[w[0]] = ways[w[0]] || { blocks: 0, bytes: 0 }; q.blocks++; q.bytes += w[1]; }); var cols = self.__COLS, by = {}; self.__BY.forEach(function (b) { var k = b[0] + ', ' + b[1] + (b[2] ? '' : ', stored plain'), q = by[k] = by[k] || { chunks: 0, inBytes: 0, outBytes: 0 }; q.chunks++; q.inBytes += b[3]; q.outBytes += b[4]; });
      t0 = performance.now(); back = MC.unpack(bytes); tu = performance.now() - t0;
      if (check) ok = check(back);
    } catch (e) { return { label: label, mode: mode, error: String(e && e.message || e) }; }
    for (i = 0; i < rep.length; i++) { r = rep[i]; if (r.bytes === undefined) continue; var k = cleanPart(r.part); parts[k] = parts[k] || { bytes: 0, count: 0 }; parts[k].bytes += r.bytes; parts[k].count++; }
    return { label: label, mode: mode, raw: rawBytes || null, packed: bytes.length, packMs: Math.round(tp), unpackMs: Math.round(tu), exact: ok, parts: parts, ways: ways, cols: cols, by: by, columns: rep.filter(function (x) { return x.ms !== undefined; }).length };
  }
  var sameJSON = function (a) { return function (b) { var n = a.length, i; if (b.length !== n) return false; for (i = 0; i < n; i += Math.max(1, Math.floor(n / 300))) { if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false; } return JSON.stringify(a[n - 1]) === JSON.stringify(b[n - 1]); }; };
  var sameArr = function (a) { return function (b) { if (b.length !== a.length) return false; for (var i = 0; i < a.length; i++) { if (a[i] !== b[i] && !(a[i] !== a[i] && b[i] !== b[i])) return false; } return true; }; };
  var out = [];
  function both(label, value, rawBytes, check) { ['fast', 'balanced'].forEach(function (m) { out.push(pack(label, value, m, rawBytes, check)); }); }
  var sets = {
    /* what the app holds */
    app: function (kind) {
      [kind].forEach(function (kind) {
        var g = network(kind, N, 7), L;
        both('graph items: ' + kind, g.nodes, MC.estimateBytes(g.nodes), sameJSON(g.nodes));
        both('graph links: ' + kind, g.edges, MC.estimateBytes(g.edges), sameJSON(g.edges));
        L = NFMEngine.build(g, { view: 'network', colorBy: 'group' });
        both('layout links: ' + kind, L.edges, MC.estimateBytes(L.edges), sameJSON(L.edges));
        var n = L.nodes.length, xy = new Float64Array(n * 2), e = L.edges.length, ends = new Int32Array(e * 2), idx = {}, i;
        for (i = 0; i < n; i++) { idx[L.nodes[i].id] = i; xy[i * 2] = L.nodes[i].x || 0; xy[i * 2 + 1] = L.nodes[i].y || 0; }
        for (i = 0; i < e; i++) { ends[i * 2] = idx[L.edges[i].from]; ends[i * 2 + 1] = idx[L.edges[i].to]; }
        both('scene numbers, positions: ' + kind, xy, xy.byteLength, sameArr(xy));
        both('scene numbers, link ends: ' + kind, ends, ends.byteLength, sameArr(ends));
        var col = new Uint8Array(e * 4); for (i = 0; i < e; i++) { col[i * 4] = 133; col[i * 4 + 1] = 144; col[i * 4 + 2] = 168; col[i * 4 + 3] = 96; }
        both('scene numbers, link colors: ' + kind, col, col.byteLength, sameArr(col));
      });
    },
    /* other kinds of data */
    other: function (what) {
      var r = rng(11), i, a;
      var words = []; for (i = 0; i < N; i++) words.push(word(r));
      both('text: words, unsorted', words, null, sameArr(words)); words = words.slice().sort(); both('text: words, sorted', words, null, sameArr(words));
      var paths = []; for (i = 0; i < N; i++) paths.push('/data/' + word(r) + '/' + word(r) + '/' + (i % 4096) + '.json'); paths.sort(); both('text: file paths, sorted', paths, null, sameArr(paths));
      var logs = []; for (i = 0; i < N; i++) logs.push('2026-10-18T14:' + String(Math.floor(i / 1700) % 60).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0') + 'Z INFO worker ' + (i % 16) + ' finished job ' + (100000 + i) + ' in ' + Math.floor(r() * 900) + ' ms'); both('text: log lines', logs, null, sameArr(logs));
      var seq = new Float64Array(N), small = new Float64Array(N), dec = new Float64Array(N), noise = new Float64Array(N), ts = new Float64Array(N), big = new Float64Array(N);
      for (i = 0; i < N; i++) { seq[i] = i; small[i] = Math.floor(r() * 100); dec[i] = Math.round(r() * 1e6) / 100; noise[i] = r() * 1000; ts[i] = 1.6e12 + i * 1000 + Math.floor(r() * 900); big[i] = Math.floor(r() * 4e9); }
      [['numbers: counting 0,1,2...', seq], ['numbers: small whole (0 to 99)', small], ['numbers: two decimals', dec], ['numbers: random fractions', noise], ['numbers: timestamps in ms', ts], ['numbers: big whole', big]].forEach(function (p) { both(p[0], p[1], p[1].byteLength, sameArr(p[1])); });
      var rnd = new Uint8Array(1 << 20); for (i = 0; i < rnd.length; i++) rnd[i] = Math.floor(r() * 256); both('bytes: random 1 MB', rnd, rnd.length, sameArr(rnd));
      var pat = new Uint8Array(1 << 20); for (i = 0; i < pat.length; i++) pat[i] = (i * 7 + (i >> 8)) & 255; both('bytes: repeating pattern 1 MB', pat, pat.length, sameArr(pat));
      var img = new Uint8Array(1 << 20); for (i = 0; i < img.length; i++) img[i] = (i % 1024 >> 2) + (r() < 0.1 ? 1 : 0); both('bytes: smooth gradient 1 MB', img, img.length, sameArr(img));
    }
  };
  var KINDS = ['communities', 'random', 'hub', 'rich'];
  window.__methodSets = KINDS.map(function (k) { return 'app:' + k; }).concat(['other']);
  window.__methods = function (which) { out = []; var t0 = performance.now(), p = which.split(':'); sets[p[0]](p[1]); return { ms: Math.round(performance.now() - t0), results: out }; };
  document.getElementById('out').textContent = 'loaded; accelerated=' + MC.accelerated;
})();
