/* Copyright (c) 2026 LFC Foundry. MIT License. The nested and round views (treemap, icicle, sunburst, circle pack, tidy tree, bundled links, chord) under the page's one name, NFMCharts.
 * They live in two vendored JS-modules copies: vendor/netflow-hierarchy.js (treemap, icicle, sunburst, pack, tree) and vendor/netflow-circular.js (chord, bundles; it needs the first). */
var NFMCharts = (function () {
  var H = typeof NetflowHierarchy !== 'undefined' ? NetflowHierarchy : require('../vendor/netflow-hierarchy.js');
  var C = typeof NetflowCircular !== 'undefined' ? NetflowCircular : require('../vendor/netflow-circular.js');
  return {
    VIEWS: C.VIEWS.concat(H.VIEWS), IS: Object.assign({}, C.IS, H.IS), NESTED: Object.assign({}, C.NESTED, H.NESTED),
    layout: function (v, G, o) { return C.IS[v] ? C.layout(v, G, o) : H.layout(v, G, o); },
    scene: function (L, o, NS) { return L.chart && C.IS[L.chart.type] ? C.scene(L, o, NS) : H.scene(L, o, NS); },
    hierarchy: H.hierarchy, packSiblings: H.packSiblings, enclose: H.enclose, bsplineToBezier: C.bsplineToBezier, linkValue: H.linkValue
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMCharts;
