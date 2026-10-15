/*!
 * Net Flow Map app, part 10: start-up. Copyright (c) 2026 LFC Foundry. MIT License.
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
  var saved = LS.get('nfm-graph');
  if (saved) { try { S.graph = NFMImport.sanitizeGraph(JSON.parse(saved)); S.gver++; } catch (e) { LS.del('nfm-graph'); } }
  applyTheme(); placeChrome(); keyboardLift();
  if (window.matchMedia) ['(hover: none) and (pointer: coarse)', '(max-width:820px)'].forEach(function (q) { matchMedia(q).addEventListener('change', function () { placeChrome(); if (S.mapBuilt) renderMapUI(); }); });
  indexGraph(); loadView(); loadAdv();
  renderReport(); renderCols();
  $('b-undo').disabled = true;
  client.start().then(function () { client.setTune(S.tune); client.setGraph(S.graph); maybeAskTune(); if (S.tab === 'map') refreshMap('boot'); });
  window.NFM = { touch: function (v) { touchForce = v; placeChrome(); if (S.mapBuilt) renderMapUI(); }, state: S, engine: getEngine, client: function () { return client; }, manager: function () { return mgr; }, showTab: showTab, setGraph: setGraph, ingest: ingest, refreshMap: refreshMap, select: function (id) { setSel(id ? [id] : []); }, setSel: setSel, setV: setV, fitView: fitView, zoomAt: zoomAt, runSearch: runSearch, snapshot: snapshot, applySnapshot: applySnapshot };
})();
