/*!
 * Netflow Map app, part 8: the Advanced tab (layout and fold settings, check this device; the simulation lives here too). Copyright (c) 2026 LFC Foundry. MIT License.
 */
S.A = { mode: 'random', runs: 2000, weights: false, amounts: false };
var AKEY = function () { return 'nfm-a:' + (S.graph.name || 'Untitled'); };
function loadAdv() { S.A = Object.assign({ mode: 'random', runs: 2000, weights: false, amounts: false }, (function () { try { return JSON.parse(LS.get(AKEY()) || '{}'); } catch (e) { return {}; } })()); }
var saveAdv = debounce(function () { LS.set(AKEY(), JSON.stringify(S.A)); }, 400);
HOOKS.graph.push(function () { loadAdv(); if (S.tab === 'adv') renderAdv(); });
TAB_HOOKS.adv = function () { renderAdv(); };
function advPanels() { return []; }
function renderAdv() {
  var box = $('adv-body'); if (!box) return;
  if (!S.graph.nodes.length) { mount(box, h('div', { class: 'card' }, [h('h2', null, 'Advanced'), h('p', { class: 'muted' }, 'Bring in data first.')])); return; }
  var V = S.V, kids = simCards();
  kids.push(h('div', { class: 'card' }, [h('h2', null, 'Layout and fold'),
    h('div', { class: 'maprow' }, [
      field('Direction (Flow view)', seg([['LR', 'Left to right'], ['TB', 'Top to bottom']], V.dir, function (v) { setV({ dir: v }, 'none'); renderAdv(); })),
      field('Network arrangement', select(Object.keys(ARR).map(function (k) { return [k, ARR[k]]; }), V.arrange, function (v) { setV({ arrange: v }, 'none'); renderAdv(); }), adviceFor(V.arrange, S.graph.nodes.length).text),
      field('Group lanes by', select([['group', 'The group column'], ['found', 'Found groups']].concat(colsOf('nodes', ['category']).filter(function (c) { return c.key !== 'group'; }).map(function (c) { return [c.key, c.name]; })), V.laneBy, function (v) { setV({ laneBy: v }, 'none'); }))]),
    check('Fold straight runs of ' + word('items') + ' into one box', V.fold, function (on) { setV({ fold: on }, 'none'); }),
    check('Merge parallel arrows', V.merge, function (on) { setV({ merge: on }, 'none'); }),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'These change the Map when you next look at it.')]));
  kids.push(h('div', { class: 'card' }, [h('h2', null, 'Odds colors on the Map (no dice)'),
    h('div', { class: 'maprow' }, [
      field('Choosing', select([['random', 'At random (exact odds, no dice)'], ['first', 'Always the first option'], ['curious', 'Prefer places not seen yet']], S.A.mode, function (v) { S.A.mode = v; saveAdv(); renderAdv(); })),
      S.A.mode !== 'random' ? field('Number of ' + word('walkers'), select([500, 2000, 10000, 50000].map(function (r) { return [r, nfmt(r)]; }), S.A.runs, function (v) { S.A.runs = +v; saveAdv(); })) : null]),
    check('Use link weights as the odds of taking a link', S.A.weights, function (on) { S.A.weights = on; saveAdv(); }),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Used by the "' + word('odds') + '" colors and the River view.')]));
  kids.push(tuneCard());
  kids.push(deviceCard());
  mount(box, kids);
}
/* ---------------------------------------------------------------- check this device */
function syntheticScene(n, m, seed) {
  var s = seed | 0, rnd = function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  var cols = Math.ceil(Math.sqrt(n * 1.6)), nodes = [], pos = {}, edges = [];
  for (var i = 0; i < n; i++) { var nd = { id: 'n' + i, nodeId: 'n' + i, label: 'Item ' + i, sub: '', group: 'g' + (i % 7), x: (i % cols) * 230, y: Math.floor(i / cols) * 90, w: 176, h: 56, layer: i % cols, traffic: rnd(), choke: i % 17 === 0, visits: rnd(), pGood: rnd(), pBad: rnd(), pNeutral: 0, deg: 2, start: i === 0, end: i % 29 === 0, valence: i % 29 === 0 ? (i % 2 ? 'good' : 'bad') : '', unreached: false, ghost: false, run: false, k: 1 }; nodes.push(nd); pos[nd.id] = nd; }
  for (var j = 0; j < m; j++) { var a = Math.floor(rnd() * n), b = Math.min(n - 1, a + 1 + Math.floor(rnd() * cols * 1.5)); edges.push({ from: 'n' + a, to: 'n' + b, label: '', count: 1, flow: rnd(), weight: 1, kind: 'fwd', pts: [] }); }
  var L = { kind: 'nodes', dir: 'LR', view: 'flow', nodes: nodes, edges: edges, pos: pos, lanes: [], width: cols * 230, height: Math.ceil(n / cols) * 90, imp: { goal: [], goalKind: '', spine: [], routesLog10: 0, reached: n, chokeCount: 0 } };
  return NFMScene.make(L, { colorBy: 'odds', theme: themeName() });
}
function deviceCard() {
  var out = h('div', { id: 'chk-out' }), btn = h('button', { class: 'primary', id: 'chk-run' }, 'Check this device');
  var method = select([['auto', 'Automatic (recommended)'], ['webgl2', 'WebGL 2'], ['canvas2d', 'Plain canvas (slowest, always works)']], (mgr && mgr.choice) || S.method || 'auto', function (v) {
    S.method = v; savePrefs(); if (mgr) { if (v !== 'auto' && S.canary && S.canary[v]) mgr.canary[v] = { ok: true }; mgr.use(v).then(function (r) { toast('Now drawing with ' + r.label + '.'); }); }
  });
  btn.addEventListener('click', function () {
    btn.disabled = true; mount(out, h('p', { class: 'muted', id: 'chk-step' }, 'Starting…'));
    NFMProbe.check({
      ms: window.NFM_CHECK_MS || 0,   /* a shorter timing window for automated tests; nothing sets it for people */
      onStep: function (t) { var el = $('chk-step'); if (el) el.textContent = t; },
      cardCheck: cardCheckForDevice,
      makeTurnScene: function () {   // a 3D arrangement of the sample network, rebuilt for each angle exactly as the map does when you drag
        var E = getEngine(), g = NFMExamples.bigNetwork(1500, 9, 7), L3 = E.build(g, { view: 'network', arrange: 'force3d', colorBy: 'group' });
        return function (yaw, pitch) { return NFMScene.make(L3, { plan: true, colorBy: 'group', theme: themeName(), cam: { yaw: yaw, pitch: pitch, persp: 2.4 } }); };
      },
      makeScene: function (kind) {
        if (kind === 'stress') return tuneSizes() ? syntheticScene(400, 900, 5) : syntheticScene(1600, 3600, 5);   /* a smaller one only for the automatic tests (?tunesizes=) */
        var E = getEngine(), x = NFMExamples.LIST[0].load(), L = E.build(x.graph, { view: 'flow', colorBy: 'odds', wantFlow: true });
        return NFMScene.make(L, { colorBy: 'odds', theme: 'light' });
      }
    }).then(function (r) {
      mount(out, [h('div', { class: 'verdict ' + r.verdict }, r.headline), h('ul', { class: 'checks', style: { marginTop: '10px' } }, r.lines.map(function (l) { return h('li', { class: l.ok === true ? 'ok' : l.ok === false ? 'no' : 'meh' }, tintErrors(l.text)); })), h('p', { class: 'muted small' }, 'Took ' + r.data.seconds.toFixed(1) + ' seconds. Version ' + APP_VERSION + '.')]);
      S.checkResult = r;
    }).catch(function (err) { mount(out, h('div', { class: 'verdict limited' }, 'The check itself ran into a problem: ' + err.message)); }).then(function () { btn.disabled = false; });
  });
  return h('div', { class: 'card' }, [h('h2', null, 'Check this device'), h('p', { class: 'muted small', style: { margin: 0 } }, 'One button. It tries each way of drawing on a sample map and tells you which works best here.'), h('div', { class: 'row' }, [btn, field('Drawing method', method)]), out]);
}
var APP_VERSION = '@@VERSION@@';
