/*!
 * Netflow Map app, part 10: start-up. Copyright (c) 2026 LFC Foundry. MIT License.
 */
(function boot() {
  try { var p = JSON.parse(LS.get('nfm-prefs') || '{}'); if (p.theme) S.theme = p.theme; if (p.method) S.method = p.method; } catch (e) { /* ignore */ }
  $('btn-theme').addEventListener('click', function () { S.theme = themeName() === 'dark' ? 'light' : 'dark'; savePrefs(); applyTheme(); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (S.theme === 'auto') applyTheme(); });
  TABS.forEach(function (t) { $('tabbtn-' + t).addEventListener('click', function () { showTab(t); }); });
  document.querySelector('.tabs').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var i = TABS.indexOf(S.tab) + (e.key === 'ArrowRight' ? 1 : -1); showTab(TABS[(i + TABS.length) % TABS.length]); $('tabbtn-' + S.tab).focus(); }
  });
  bindIntake(); bindMapping();
  client = new NFMEngineClient.Client(engineSrc, getEngine);
  client.store = typeof NFMLayoutStore !== 'undefined' && LS.get(SAVE_LAYOUTS_KEY) !== '0' ? NFMLayoutStore.open() : null;   // saved pictures of big Network maps, kept in this browser only
  client.holdIf = function () { return SIM.st === 'running'; };   /* a running simulation lives in the worker, so it stays */
  client.keeper = typeof Worker !== 'undefined' && typeof DecompressionStream !== 'undefined' && typeof MessageChannel === 'function' ? LAYOUT_KEEPER : null;   /* a parked worker's graph is kept packed, so the restart needs no whole copy on the page (src/app/75-mapfile.js) */
  client.parkAfter = 4000;   /* a big map's engine worker is ended after 4 s of nothing to do (frees its copy of the graph); the next layout restarts it */
  startTwinGuard();
  var saved = LS.get('nfm-graph');
  if (saved) { try { S.graph = NFMImport.sanitizeGraph(JSON.parse(saved)); S.gver++; } catch (e) { LS.del('nfm-graph'); } }
  applyTheme(); placeChrome(); keyboardLift();
  if (window.matchMedia) ['(hover: none) and (pointer: coarse)', '(max-width:820px)'].forEach(function (q) { matchMedia(q).addEventListener('change', function () { placeChrome(); if (S.mapBuilt) renderMapUI(); }); });
  indexGraph(); loadView(); loadAdv();
  renderReport(); renderCols();
  $('b-undo').disabled = true;
  var bootVer = S.gver;
  SAFE.newer('nfm-graph').then(function (r) {   /* the browser lost the newest saves (a crash soon after them): bring back the safe copies */
    var g = S.graph;
    if (r) { try { g = NFMImport.sanitizeGraph(JSON.parse(r.text)); } catch (e) { r = null; g = S.graph; } }
    var vk = 'nfm-v:' + (g.name || 'Untitled');
    return SAFE.newer(vk).then(function (rv) {
      if ((!r && !rv) || S.gver !== bootVer || S.hist.length) return;   /* nothing newer, or a change was already made: that one stands */
      if (r) { SAFE.repair('nfm-graph', r); S.graph = g; S.gver++; }
      if (rv) SAFE.repair(vk, rv);
      graphChanged(true); toast('Brought back your latest changes: the browser had closed before keeping them.', 6000);
    });
  });
  client.start().then(function () { if (window.NFMReport) window.NFMReport.mark('engine-ready'); client.setTune(S.tune); client.setGraph(S.graph); maybeAskTune(); if (S.tab === 'map') refreshMap('boot'); });
  if (window.NFMReport) window.NFMReport.mark('first-screen');
  window.NFM = { groupSvg: groupSvg, svgText: svgText, mapFileBytes: mapFileBytes, openMapBytes: openMapBytes, neighborIds: neighborIds, routeIds: routeIds, gif: function () { return GX.result; }, gifRun: function (patch) { Object.assign(GX.opts, patch); return runGif(); }, gifTwin: function (patch) { return ensureMap().then(function () { return makeGif(Object.assign({}, GX.opts, patch, { preview: true, twin: true }), function () { }, function () { return false; }); }); }, pending: function () { return DEBOUNCING; }, moveItems: moveItems, dropItems: settleDrop, touch: function (v) { touchForce = v; placeChrome(); if (S.mapBuilt) renderMapUI(); }, state: S, engine: getEngine, client: function () { return client; }, manager: function () { return mgr; }, showTab: showTab, setGraph: setGraph, ingest: ingest, refreshMap: refreshMap, select: function (id) { setSel(id ? [id] : []); }, setSel: setSel, toggleChapter: toggleChapter, minimap: function () { var e = document.getElementById('minimap'); return { shown: !!(e && !e.hidden), w: e ? e.width : 0, h: e ? e.height : 0, box: e ? JSON.parse(JSON.stringify(e.getBoundingClientRect())) : null }; }, renderMinimap: renderMinimap, setV: setV, scheduleScene: scheduleScene, settleTurn: settleTurn, fitView: fitView, zoomAt: zoomAt, runSearch: runSearch, snapshot: snapshot, applySnapshot: applySnapshot, safe: SAFE, indexMatches: indexMatches, idx: IDX };
})();
