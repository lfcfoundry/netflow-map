/* Copyright (c) 2026 LFC Foundry. MIT License. The page's name for the scene module (vendor/netflow-scene.js, a copy of JS-modules netflow-scene); the app and renderer say NFMScene. */
var NFMScene = Object.assign({}, NetflowScene, {
  /* the round and nested views (src/charts.js) draw their own shapes on top of the module's items, names and key */
  make: function (L, o) { return L && L.chart && typeof NFMCharts !== 'undefined' ? NFMCharts.scene(L, o || {}, NetflowScene) : NetflowScene.make(L, o); }
});
